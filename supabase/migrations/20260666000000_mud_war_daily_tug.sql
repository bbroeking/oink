-- Phase 1b — the DAILY-TUG / ROUT win condition. HELD FOR REVIEW; push only on go.
--
-- Today resolve_war picks the winner by whole-war per-capita at ends_at. This
-- reworks it into a tug of war: each COMPLETED UTC day, the day's per-capita
-- margin moves a rope a capped notch toward that day's winner; the notches
-- accumulate in mud_wars.rope_pos (+ = challenger, - = defender). A crew that
-- drags the rope to the peg (|rope_pos| >= ROUT) wins EARLY (a rout); otherwise
-- whoever's side it's on at ends_at wins. Per-day quorum (2+ active) keeps it a
-- crew rally, not a solo grind. The daily throw cap means a rout needs ~3 days
-- of dominance — no one-day blowouts.
--
-- The minigame scoring (throw_mud, slings, caps) is UNCHANGED — this only
-- changes how slings are tallied into a winner. Constants: ROUT 12, MAX_NOTCH 4
-- (per day), NOTCH_SCALE 5 (per-capita margin per notch), QUORUM 2.

ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS rope_pos int NOT NULL DEFAULT 0;
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS last_scored_day date;

-- Fold every completed, not-yet-scored UTC day into rope_pos. Idempotent via
-- last_scored_day. SECURITY DEFINER; called by resolve_war (and only there).
CREATE OR REPLACE FUNCTION public.score_mud_war_days(p_war uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	d           date;
	last_day    date;
	war_end_day date;
	ch_total    int; ch_active int; ch_pc numeric;
	df_total    int; df_active int; df_pc numeric;
	margin      numeric; notch int;
	c_quorum    int := 2;
	c_bot_pace  int := 12;
	c_scale     numeric := 5;
	c_maxnotch  int := 4;
	c_rout      int := 12;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'active' OR w.started_at IS NULL THEN RETURN; END IF;

	war_end_day := (w.ends_at AT TIME ZONE 'UTC')::date;
	-- An ended war scores its FINAL day even if that calendar day isn't over yet
	-- (no more slings can land past ends_at); a live war scores only days that
	-- have fully elapsed (date < today UTC).
	IF w.ends_at <= now() THEN
		last_day := war_end_day;
	ELSE
		last_day := LEAST((now() AT TIME ZONE 'UTC')::date - 1, war_end_day);
	END IF;

	IF w.last_scored_day IS NOT NULL THEN
		d := w.last_scored_day + 1;
	ELSE
		d := (w.started_at AT TIME ZONE 'UTC')::date;
	END IF;

	WHILE d <= last_day LOOP
		SELECT COALESCE(SUM(slings), 0), COUNT(*) FILTER (WHERE slings > 0)
			INTO ch_total, ch_active
			FROM public.mud_slings WHERE war_id = p_war AND crew_id = w.challenger_crew AND war_day = d;
		-- Per-day quorum: a real-war side that didn't field 2+ active scores 0 that
		-- day. Waived vs the house (bot grants no rank/cosmetics) so solo practice
		-- + solo playtesting can win.
		ch_pc := CASE
			WHEN ch_active = 0 THEN 0
			WHEN w.is_bot_war OR ch_active >= c_quorum THEN ch_total::numeric / ch_active
			ELSE 0
		END;

		IF w.is_bot_war THEN
			df_pc := c_bot_pace; -- the house keeps a fixed daily pace
		ELSE
			SELECT COALESCE(SUM(slings), 0), COUNT(*) FILTER (WHERE slings > 0)
				INTO df_total, df_active
				FROM public.mud_slings WHERE war_id = p_war AND crew_id = w.defender_crew AND war_day = d;
			df_pc := CASE WHEN df_active >= c_quorum THEN df_total::numeric / df_active ELSE 0 END;
		END IF;

		margin := ch_pc - df_pc;
		notch := GREATEST(-c_maxnotch, LEAST(c_maxnotch, round(margin / c_scale)::int));
		UPDATE public.mud_wars
			SET rope_pos = GREATEST(-c_rout, LEAST(c_rout, rope_pos + notch)),
			    last_scored_day = d
			WHERE id = p_war;
		d := d + 1;
	END LOOP;
END;
$function$;

-- resolve_war — carried verbatim from 20260647 with surgical changes:
--   (1) score completed days first; (2) resolve when ENDED *or* ROUTED (not only
--   at ends_at); (3) winner is the side of rope_pos (the tug), not whole-war
--   per-capita. Payout / buff / titles / announce mechanics are UNCHANGED.
CREATE OR REPLACE FUNCTION public.resolve_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	c_house     int := 25;
	ch_total    int; ch_active int;
	df_total    int; df_active int;
	winner      uuid := NULL;
	win_active  int := 0;
	loser_pot   int := 0;
	share       int := 0;
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

	-- Bring the tug current, then re-read the fresh rope_pos.
	PERFORM public.score_mud_war_days(p_war);
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;

	-- Resolve only when the war has ENDED or a crew has ROUTED the rope.
	IF w.ends_at > now() AND ABS(w.rope_pos) < c_rout THEN
		RETURN jsonb_build_object('ok', true, 'not_yet', true, 'rope_pos', w.rope_pos);
	END IF;

	-- Whole-war totals (still used for the snout pot + per-winner shares).
	SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
		INTO ch_total, ch_active
		FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
		      WHERE war_id = p_war AND crew_id = w.challenger_crew GROUP BY user_id) s;
	IF w.is_bot_war THEN
		df_total := 0; df_active := 0;
	ELSE
		SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
			INTO df_total, df_active
			FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			      WHERE war_id = p_war AND crew_id = w.defender_crew GROUP BY user_id) s;
	END IF;

	-- Winner = the side the rope is on (the daily tug). 0 = a held rope = draw.
	winner := CASE
		WHEN w.rope_pos > 0 THEN w.challenger_crew
		WHEN w.rope_pos < 0 THEN w.defender_crew
		ELSE NULL
	END;

	-- Payout only when a REAL crew won (the bot has no members to pay).
	IF winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew) THEN
		IF winner = w.challenger_crew THEN win_active := ch_active; ELSE win_active := df_active; END IF;
		IF w.is_bot_war THEN
			loser_pot := 0; share := c_house;
		ELSE
			IF winner = w.challenger_crew THEN loser_pot := df_total; ELSE loser_pot := ch_total; END IF;
			share := CASE WHEN win_active > 0 THEN floor((loser_pot * 0.5) / win_active)::int ELSE 0 END;
		END IF;

		FOR m IN
			SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			WHERE war_id = p_war AND crew_id = winner GROUP BY user_id HAVING SUM(slings) > 0
		LOOP
			IF w.is_bot_war THEN
				UPDATE public.profiles SET counter = counter + c_house WHERE id = m.user_id;
			ELSE
				reward := m.own + share;
				UPDATE public.profiles
					SET counter        = counter + reward,
					    tickles_earned = tickles_earned + reward,
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

	BEGIN
		FOR m IN SELECT user_id, crew_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id,
				CASE WHEN winner IS NULL THEN 'war_draw'
				     WHEN m.crew_id = winner THEN 'war_won' ELSE 'war_lost' END,
				CASE WHEN winner IS NULL THEN 'Mud Fight: a draw'
				     WHEN m.crew_id = winner THEN 'Mud Fight won!' ELSE 'Mud Fight lost' END,
				CASE WHEN winner IS NULL THEN 'The rope held dead even. Rally your Sounder next time.'
				     WHEN m.crew_id = winner THEN 'Your Sounder dragged the rope home! Snouts paid and a 72h regen buff is on you.'
				     ELSE 'Your Sounder lost the tug this time.' END,
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'winner', winner, 'rope_pos', w.rope_pos,
		'routed', ABS(w.rope_pos) >= c_rout);
END;
$function$;

-- sweep_mud_wars — carried from 20260663; the active-war loop now scores +
-- resolves EVERY active war each tick (resolve_war no-ops until ended/routed but
-- keeps rope_pos current). Pending-expiry unchanged. (cron job already scheduled
-- by name in 20260663 — no re-schedule needed.)
CREATE OR REPLACE FUNCTION public.sweep_mud_wars()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	r record;
	c_pending_ttl interval := interval '48 hours';
BEGIN
	FOR r IN
		SELECT id FROM public.mud_wars WHERE status = 'active' AND resolved_at IS NULL
	LOOP
		PERFORM public.resolve_war(r.id); -- scores the tug + resolves if ended or routed
	END LOOP;

	FOR r IN
		SELECT id, challenger_crew, defender_crew FROM public.mud_wars
		WHERE status = 'pending' AND created_at <= now() - c_pending_ttl
	LOOP
		UPDATE public.mud_wars SET status = 'declined' WHERE id = r.id;
		BEGIN
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			SELECT cm.user_id, 'war_expired', 'Mud Fight challenge expired',
				'A challenge went unanswered for 48 hours and was called off.',
				jsonb_build_object('war_id', r.id)
			FROM public.crew_members cm
			WHERE cm.crew_id = r.challenger_crew OR cm.crew_id = r.defender_crew;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;
END;
$function$;

-- war_state — carried from 20260665 (its latest def) + rope_pos & ropeNorm so
-- the client rope reflects the tug standings (and rout progress).
CREATE OR REPLACE FUNCTION public.war_state(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	them_crew uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	my_today  int;
	my_throws int;
	allotment int := 20;
	throws_cap int := 7;
	bot_pace  int := 12;
	c_rout    int := 12;
	elapsed   numeric;
	mine      jsonb;
	them      jsonb;
BEGIN
	IF caller_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN 'null'::jsonb; END IF;
	IF NOT public.is_war_participant(p_war, caller_id) THEN RETURN 'null'::jsonb; END IF;
	IF w.status = 'active' AND (w.ends_at <= now() OR ABS(w.rope_pos) >= c_rout) THEN
		PERFORM public.resolve_war(p_war);
		SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	END IF;

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew = w.defender_crew THEN them_crew := w.challenger_crew; ELSE them_crew := w.defender_crew; END IF;

	mine := public.war_side(p_war, my_crew);
	IF w.is_bot_war AND them_crew = w.defender_crew THEN
		elapsed := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (LEAST(now(), w.ends_at) - w.started_at)) / 86400.0));
		them := jsonb_build_object(
			'crew', jsonb_build_object('id', them_crew, 'name', 'The Mudlarks', 'is_bot', true),
			'members', '[]'::jsonb, 'total', bot_pace * elapsed, 'active', NULL,
			'perCapita', bot_pace * elapsed, 'quorumMet', true);
	ELSE
		them := public.war_side(p_war, them_crew);
	END IF;

	SELECT slings, throws_today INTO my_today, my_throws FROM public.mud_slings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;

	RETURN jsonb_build_object(
		'warId', w.id, 'status', w.status, 'endsAt', w.ends_at, 'isBotWar', w.is_bot_war,
		'winnerCrew', w.winner_crew, 'iAmChallenger', my_crew = w.challenger_crew,
		'myRemainingToday', allotment - COALESCE(my_today, 0),
		'myThrowsRemaining', throws_cap - COALESCE(my_throws, 0),
		'ropePos', w.rope_pos,
		-- challenger-positive normalized -1..1; flip to the caller's POV (+ = me ahead)
		'ropeNorm', (CASE WHEN my_crew = w.challenger_crew THEN 1 ELSE -1 END)
			* GREATEST(-1.0, LEAST(1.0, w.rope_pos::numeric / c_rout)),
		'mine', mine, 'them', them);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.war_state(uuid) TO authenticated;
-- score_mud_war_days is internal (called by resolve_war); intentionally NOT granted.
