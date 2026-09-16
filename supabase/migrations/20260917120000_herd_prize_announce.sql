-- The Barn Draw tells the crew (2026-09-16 ruling, build 192).
--
-- 20260916120000 draws one for-sale furnishing per crew every Monday and
-- grants it — and told nobody: the only Monday line was the carried
-- race_result announcement, which names bunting. The ratified block promises
-- the seed "revealed with the result"; a silent grant is a confused winner.
--
-- CARRY-LATEST-DEF: _herd_prize_resolve is carried VERBATIM from
-- 20260916120000_barn_draw_and_trough_quarter_reward.sql (the only prior
-- definition) with ONE added block — after the draw row is written, every
-- crew member gets an inlined system_announcements row (kind 'herd_prize',
-- screen 'season') and a push; the winner's line is theirs, everyone else's
-- names who drew. Each line is wrapped so a failure never blocks a draw.
--
-- ADMIN-GATED ANNOUNCEMENT: the INSERT is INLINE — send_system_announcement()
-- raises admin_only for the cron role and would roll the draw back.
--
-- A 'none' crew (nobody dug) still says nothing; the sleeper on a drawing
-- crew hears who drew but is never named as having slept.
--
-- Migrations are WRITTEN, NOT PUSHED — never `db push` without the founder's
-- explicit "go".

CREATE OR REPLACE FUNCTION public._herd_prize_resolve(p_cycle text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk       record;
	seed_txt text;
	fresh    text;
	next_key text;
	c        record;
	entrants jsonb;
	winner   uuid;
	win_key  text;
	item     text;
	amt      int;
	kind     text;
	drawn    int := 0;
	w_name   text;
	i_name   text;
	mem      record;
	ttl      text;
	line     text;
BEGIN
	IF p_cycle IS NULL OR btrim(p_cycle) = '' THEN RETURN 0; END IF;
	-- Serialize the cycle: two resolvers can't both draw the same week.
	PERFORM pg_advisory_xact_lock(hashtextextended('herd_prize:' || p_cycle, 0));

	SELECT * INTO wk FROM public._barn_cycle_bounds(p_cycle);

	SELECT s.seed INTO seed_txt FROM public.herd_prize_seeds s WHERE s.iso_week = p_cycle;
	IF seed_txt IS NULL THEN
		-- First run: nothing committed a seed for this week (no prior cycle
		-- resolved), so commit one now and reveal it below, in the same breath.
		fresh := gen_random_uuid()::text;
		INSERT INTO public.herd_prize_seeds (iso_week, seed, seed_hash)
		VALUES (p_cycle, fresh, encode(sha256(fresh::bytea), 'hex'))
		ON CONFLICT (iso_week) DO NOTHING;
		SELECT s.seed INTO seed_txt FROM public.herd_prize_seeds s WHERE s.iso_week = p_cycle;
	END IF;

	FOR c IN SELECT cr.id FROM public.crews cr WHERE cr.is_bot = false ORDER BY cr.id LOOP
		CONTINUE WHEN EXISTS (
			SELECT 1 FROM public.herd_prize_draws hp
			WHERE hp.iso_week = p_cycle AND hp.crew_id = c.id);

		-- Entry: a crew member who dug at least one feeding in the cycle.
		-- Giving to a Trough is deliberately NOT an entry and never a weight.
		SELECT COALESCE(jsonb_agg(to_jsonb(m.user_id) ORDER BY m.user_id), '[]'::jsonb)
			INTO entrants
			FROM public.crew_members m
			WHERE m.crew_id = c.id
			  AND public._monday_draw_eligible(m.user_id, p_cycle, wk.starts_at, wk.ends_at);

		IF jsonb_array_length(entrants) = 0 THEN
			INSERT INTO public.herd_prize_draws
				(iso_week, crew_id, winner_user_id, kind, item_id, amount, entrants, winner_key)
			VALUES (p_cycle, c.id, NULL, 'none', NULL, 0, '[]'::jsonb, NULL);
			CONTINUE;
		END IF;

		-- Equal odds, decided by the committed seed: the largest
		-- md5(seed:crew:user) wins. A crew of one draws alone and wins.
		SELECT m.user_id, md5(seed_txt || ':' || c.id::text || ':' || m.user_id::text)
			INTO winner, win_key
			FROM public.crew_members m
			WHERE m.crew_id = c.id
			  AND public._monday_draw_eligible(m.user_id, p_cycle, wk.starts_at, wk.ends_at)
			ORDER BY md5(seed_txt || ':' || c.id::text || ':' || m.user_id::text) DESC, m.user_id
			LIMIT 1;

		item := public._barn_draw_pick(winner, p_cycle, 'all');
		IF item IS NOT NULL THEN
			PERFORM public.grant_habitat_item(winner, item, 'herd_prize', p_cycle);
			kind := 'habitat';
			amt  := 0;
		ELSE
			-- The winner already owns every for-sale furnishing. Pay a purse.
			amt  := public._barn_draw_purse(winner);
			kind := 'tickles';
		END IF;

		INSERT INTO public.herd_prize_draws
			(iso_week, crew_id, winner_user_id, kind, item_id, amount, entrants, winner_key)
		VALUES (p_cycle, c.id, winner, kind, item, amt, entrants, win_key);
		drawn := drawn + 1;

		-- Tell the whole crew (2026-09-16 ruling): the winner hears it as theirs,
		-- everyone else hears who drew. Inlined INSERT — send_system_announcement()
		-- would raise admin_only and roll the draw back. A failed line never
		-- blocks a draw. The sleeper is on the roster and hears it too; nothing
		-- names who slept.
		SELECT p.username INTO w_name FROM public.profiles p WHERE p.id = winner;
		i_name := NULL;
		IF item IS NOT NULL THEN
			SELECT i.name INTO i_name FROM public.habitat_items i WHERE i.id = item;
		END IF;
		ttl := 'The Barn Draw';
		FOR mem IN SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = c.id LOOP
			IF mem.user_id = winner THEN
				line := CASE WHEN kind = 'habitat'
					THEN 'Your crew''s Monday draw came up you — the ' || COALESCE(i_name, 'new design') || ' is yours. Hang it in the Barn.'
					ELSE 'Your crew''s Monday draw came up you — a purse of ' || amt || ' tickles, since your Barn already holds every design.'
					END;
			ELSE
				line := COALESCE(w_name, 'A crewmate') || CASE WHEN kind = 'habitat'
					THEN ' drew the ' || COALESCE(i_name, 'new design') || ' in the herd''s Monday draw.'
					ELSE ' drew a purse of ' || amt || ' tickles in the herd''s Monday draw.'
					END;
			END IF;
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (mem.user_id, 'herd_prize', ttl, line, jsonb_build_object(
					'cycle_key', p_cycle,
					'crew_id', c.id,
					'winner_user_id', winner,
					'kind', kind,
					'item_id', item,
					'amount', amt,
					'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL;
			END;
			BEGIN
				PERFORM public.send_push_to_user(mem.user_id, ttl, line, jsonb_build_object(
					'kind', 'herd_prize',
					'cycle_key', p_cycle,
					'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL;
			END;
		END LOOP;
	END LOOP;

	-- Reveal this week's seed, then commit next week's (hash publishable now,
	-- seed sealed until it draws).
	UPDATE public.herd_prize_seeds
		SET revealed_at = now()
		WHERE iso_week = p_cycle AND revealed_at IS NULL;

	next_key := to_char(to_date(p_cycle, 'YYYYMMDD') + 7, 'YYYYMMDD');
	fresh    := gen_random_uuid()::text;
	INSERT INTO public.herd_prize_seeds (iso_week, seed, seed_hash)
	VALUES (next_key, fresh, encode(sha256(fresh::bytea), 'hex'))
	ON CONFLICT (iso_week) DO NOTHING;

	RETURN drawn;
END;
$function$;
REVOKE ALL ON FUNCTION public._herd_prize_resolve(text) FROM PUBLIC, anon, authenticated;
