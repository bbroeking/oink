-- ════════════════════════════════════════════════════════════════════════
-- Season-2 pass COMPLETE (free track filled, all 30 levels × both tracks)
-- + scuffle play becomes the season's main XP source + per-user preview.
--
--   FREE TRACK   — 20260706100000 left 14 free-tier gaps; every level now
--                  pays something on both tracks (tickle bundles + three
--                  Mystery Hat Boxes on free; premium unchanged).
--   WAR XP       — "a lot of the XP should come from competing in Sounder
--                  scuffles": each submitted Truffle-Patch dig now grants
--                  +20 season XP (submit_rooting), and when a scuffle
--                  resolves every ACTIVE participant on both sides gets
--                  +30, winners +60 more (resolve_war). At 100 XP/tier a
--                  committed digger clears most of the pass through play.
--   PREVIEW      — active_season() now honors the caller's per-user
--                  world_boss OVERRIDE (profiles.feature_overrides): test
--                  accounts see the Season-2 pass before Jul 12 while
--                  every other player stays date-driven on Season 1.
--                  No-auth contexts (crons) keep pure date logic.
--
-- Carried latest defs: active_season ← 20260502010000;
-- submit_rooting ← 20260706200000; resolve_war ← 20260705200000.
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
('snout_season_2',  2, 'free', 'tickles',     '{"amount": 25}',      '25 tickles'),
('snout_season_2',  4, 'free', 'mystery_box', '{"box_kind": "hat"}', 'Mystery Hat Box'),
('snout_season_2',  6, 'free', 'tickles',     '{"amount": 50}',      '50 tickles'),
('snout_season_2',  8, 'free', 'tickles',     '{"amount": 50}',      '50 tickles'),
('snout_season_2', 10, 'free', 'tickles',     '{"amount": 75}',      '75 tickles'),
('snout_season_2', 12, 'free', 'tickles',     '{"amount": 75}',      '75 tickles'),
('snout_season_2', 14, 'free', 'mystery_box', '{"box_kind": "hat"}', 'Mystery Hat Box'),
('snout_season_2', 16, 'free', 'tickles',     '{"amount": 100}',     '100 tickles'),
('snout_season_2', 18, 'free', 'tickles',     '{"amount": 100}',     '100 tickles'),
('snout_season_2', 20, 'free', 'tickles',     '{"amount": 125}',     '125 tickles'),
('snout_season_2', 23, 'free', 'tickles',     '{"amount": 150}',     '150 tickles'),
('snout_season_2', 25, 'free', 'mystery_box', '{"box_kind": "hat"}', 'Mystery Hat Box'),
('snout_season_2', 27, 'free', 'tickles',     '{"amount": 150}',     '150 tickles'),
('snout_season_2', 29, 'free', 'tickles',     '{"amount": 200}',     '200 tickles')
ON CONFLICT (season_id, tier, track) DO NOTHING;

-- active_season — carried; adds the per-user world_boss preview.
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.* FROM public.seasons s
  WHERE
    CASE WHEN auth.uid() IS NOT NULL AND COALESCE(
        ((SELECT feature_overrides ->> 'world_boss' FROM public.profiles
          WHERE id = auth.uid()))::boolean, false)
      THEN s.id = 'snout_season_2'
      ELSE s.starts_at <= now() AND s.ends_at >= now()
    END
  ORDER BY s.starts_at DESC
  LIMIT 1;
$function$;

-- submit_rooting — carried VERBATIM from 20260706200000; ONE change: a
-- submitted dig grants +20 season XP (the pass is earned in the bog).
CREATE OR REPLACE FUNCTION public.submit_rooting(p_war uuid, p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	w           record;
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today       date := (now() AT TIME ZONE 'UTC')::date;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	root_today  int;
	pts         int;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	bal         int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		RETURN jsonb_build_object('ok', false, 'reason', 'war_over');
	END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'war_not_active'); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;

	-- Crewmates who already rooted this window — powers the co-op depth
	-- (deeper action budget + daily headroom) AND the golden echo below.
	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE war_id = p_war AND crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_actions');
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win
		FOR UPDATE;
	IF row_r.war_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting'); END IF;
	IF row_r.submitted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted'); END IF;

	-- Finds must exist on THIS seed's board (dedupe first; stones are inert and
	-- not claimable; a forged find rejects the whole submit).
	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		IF NOT (f = ANY (valid)) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;

	-- Mud: +1 per truffle, ≤2/window by construction; the daily cross-window
	-- cap deepens 6 → 8 when the crew dug together this window.
	SELECT COALESCE(SUM(mud_minted), 0) INTO root_today FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today
		  AND submitted_at IS NOT NULL;
	pts := LEAST(truffle_cnt, 2,
		GREATEST(0, (CASE WHEN prior_cnt >= 1 THEN 8 ELSE 6 END) - root_today));

	IF pts > 0 THEN
		-- Plain add (no LEAST clamp): skill RPCs bound themselves at 21 via their
		-- own budgets; rooting bounds itself at 8/day here; CHECK caps the sum at 27.
		INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, war_day)
			VALUES (p_war, my_crew, caller_id, pts, today)
		ON CONFLICT (war_id, user_id, war_day) DO UPDATE
			SET slings = mud_slings.slings + pts;
	END IF;

	-- Golden Truffles: first truffle = +1; golden echo when 2+ distinct
	-- crewmates rooted this window (async sync — the whole "multiplayer");
	-- BLESSED digs (any active timed blessing) find one extra.
	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'rooting', p_war);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'rooting_echo', p_war);
			my_echo := true;
		END IF;
		IF blessed THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'blessed_dig', p_war);
		END IF;
	END IF;
	-- Retroactive gild: my dig completes the echo for earlier crew diggers who
	-- found a truffle and haven't been credited (first-mover never taxed, A6).
	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE war_id = p_war AND crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'rooting_echo', p_war);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE war_id = p_war AND user_id = r.user_id AND window_index = win;
	END LOOP;

	UPDATE public.war_rootings SET
		submitted_at    = now(),
		finds           = claimed,
		actions         = p_actions,
		mud_minted      = pts,
		truffles_minted = minted,
		echo_credited   = my_echo
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win;

	-- CARRY DIFF: the pass is earned in the bog — +20 season XP per dig.
	PERFORM public.grant_season_xp(caller_id, 20);

	SELECT golden_truffles INTO bal FROM public.profiles WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true,
		'mud', pts,
		'truffles', minted,
		'echo', my_echo,
		'coop', prior_cnt >= 1,
		'blessed', blessed,
		'golden_truffles', COALESCE(bal, 0),
		'root_mud_today', root_today + pts,
		'window_ends_at', to_timestamp((win + 1) * 28800));
END;
$function$;

-- resolve_war — carried VERBATIM from 20260705200000; ONE addition: season
-- XP for competing — +30 to every ACTIVE participant (slung or dug) on
-- BOTH sides, +60 more to each active winner.
CREATE OR REPLACE FUNCTION public.resolve_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	winner      uuid := NULL;
	m           record;
	reward      int;
	wins_now    int;
	c_rout      int := 12;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status <> 'active' OR w.resolved_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', true, 'noop', true);
	END IF;

	PERFORM public.score_mud_war_days(p_war);
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;

	IF w.forfeited_by IS NULL AND w.ends_at > now() AND ABS(w.rope_pos) < c_rout THEN
		RETURN jsonb_build_object('ok', true, 'not_yet', true, 'rope_pos', w.rope_pos);
	END IF;

	winner := CASE
		WHEN w.forfeited_by IS NOT NULL THEN
			CASE WHEN w.forfeited_by = w.challenger_crew THEN w.defender_crew ELSE w.challenger_crew END
		WHEN w.rope_pos > 0 THEN w.challenger_crew
		WHEN w.rope_pos < 0 THEN w.defender_crew
		ELSE NULL
	END;

	-- CARRY DIFF: XP for competing — every active participant (slung mud or
	-- submitted a dig) on EITHER side earns +30 season XP at resolution.
	FOR m IN
		SELECT DISTINCT u.user_id FROM (
			SELECT user_id FROM public.mud_slings
				WHERE war_id = p_war AND slings > 0
			UNION
			SELECT user_id FROM public.war_rootings
				WHERE war_id = p_war AND submitted_at IS NOT NULL
		) u
	LOOP
		BEGIN
			PERFORM public.grant_season_xp(m.user_id, 30);
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;

	IF winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew) THEN
		-- Participation-paid: each winner earns tickles for what THEY did —
		-- sling points ×1 + submitted truffle digs ×3, capped so a marathon
		-- week can't overflow the bank into pure waste.
		FOR m IN
			SELECT u.user_id, SUM(u.units)::int AS units FROM (
				SELECT user_id, SUM(slings)::int AS units FROM public.mud_slings
					WHERE war_id = p_war AND crew_id = winner GROUP BY user_id
				UNION ALL
				SELECT user_id, COUNT(*)::int * 3 FROM public.war_rootings
					WHERE war_id = p_war AND crew_id = winner AND submitted_at IS NOT NULL
					GROUP BY user_id
			) u GROUP BY u.user_id HAVING SUM(u.units) > 0
		LOOP
			reward := LEAST(m.units, CASE WHEN w.is_bot_war THEN 10 ELSE 20 END);
			PERFORM public.grant_tickles(m.user_id, reward);
			-- CARRY DIFF: winners earn +60 more season XP on top of the +30.
			BEGIN
				PERFORM public.grant_season_xp(m.user_id, 60);
			EXCEPTION WHEN OTHERS THEN NULL; END;
			IF NOT w.is_bot_war THEN
				UPDATE public.profiles
					SET tickles_earned = tickles_earned + reward,
					    war_wins       = war_wins + 1
					WHERE id = m.user_id
					RETURNING war_wins INTO wins_now;
			END IF;
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			IF NOT w.is_bot_war THEN
				BEGIN
					INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_champion')
						ON CONFLICT DO NOTHING;
					IF wins_now >= 5 THEN
						INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_veteran')
							ON CONFLICT DO NOTHING;
					END IF;
					IF wins_now >= 25 THEN
						INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_legend')
							ON CONFLICT DO NOTHING;
					END IF;
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;
		END LOOP;
	END IF;

	UPDATE public.mud_wars SET status = 'resolved', winner_crew = winner, resolved_at = now()
		WHERE id = p_war;

	-- Win-trade cooldown — REAL crew-vs-crew wars ONLY (carried).
	IF NOT w.is_bot_war THEN
		UPDATE public.crews SET next_war_at = now() + interval '24 hours'
			WHERE id IN (w.challenger_crew, w.defender_crew) AND is_bot = false;
	END IF;

	-- GATED: ladder update for real (non-bot) wars only (carried).
	IF w.fronts_enabled AND NOT w.is_bot_war THEN
		BEGIN
			PERFORM public.apply_crew_elo(w.challenger_crew, w.defender_crew, winner, w.rope_pos);
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	BEGIN
		FOR m IN SELECT user_id, crew_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id,
				CASE WHEN winner IS NULL THEN 'war_draw'
				     WHEN m.crew_id = winner THEN 'war_won' ELSE 'war_lost' END,
				CASE WHEN winner IS NULL THEN 'Mud Scuffle: a draw'
				     WHEN m.crew_id = winner THEN 'Mud Scuffle won!' ELSE 'Mud Scuffle lost' END,
				CASE WHEN winner IS NULL THEN 'The rope held dead even. Rally your Sounder next time.'
				     WHEN m.crew_id = winner AND w.forfeited_by IS NOT NULL
				          THEN 'Their Sounder yielded the bog — the scuffle is yours. Tickles paid for your digging and slinging.'
				     WHEN m.crew_id = winner
				          THEN 'Your Sounder dragged the rope home! Tickles paid for your digging and slinging, and a 72h regen buff is on you.'
				     WHEN w.forfeited_by IS NOT NULL
				          THEN 'Your Sounder yielded. No mud lost — regroup and return.'
				     ELSE 'Your Sounder lost the tug this time.' END,
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'winner', winner, 'rope_pos', w.rope_pos,
		'routed', ABS(w.rope_pos) >= c_rout,
		'forfeited', w.forfeited_by IS NOT NULL);
END;
$function$;
