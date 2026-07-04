-- ════════════════════════════════════════════════════════════════════════
-- Truffle Patch DEPTH (tasks 17+18): dig deeper together, blessed digs,
-- and golden barn truffles.
--
--   CO-OP DEPTH  — when a crewmate has already rooted this 8h feeding,
--                  later diggers dig DEEPER: action budget 20 → 25 and
--                  daily root-mud headroom 6 → 8. (The async golden echo
--                  + retroactive gild from 20260704100000 are unchanged —
--                  this adds the LIVE bonus for showing up together.)
--   BLESSED DIGS — an active timed blessing makes digs luckier: finding
--                  any truffle mints +1 bonus Golden Truffle
--                  ('blessed_dig'). Blessings now matter in the Patch,
--                  closing the loop with crewmate blessing + the Chorus.
--   GOLDEN BARN  — while world_boss is live, digging a friend's buried
--                  truffle has a 20% chance to come up GOLDEN: +5 to the
--                  DIGGER's tickles_earned (leaderboard count only, not
--                  the bank), once per digger per UTC day.
--
-- Carried latest defs: open_rooting + submit_rooting ← 20260704100000;
-- dig_truffle ← 20260629 (the redig-cooldown def; also drops the emoji
-- from its announcement title per the no-emoji rule).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.golden_barn_finds (
	user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	found_on date NOT NULL,
	PRIMARY KEY (user_id, found_on)
);
ALTER TABLE public.golden_barn_finds ENABLE ROW LEVEL SECURITY;

-- open_rooting — carried; adds coop/blessed/max_actions to the payload so
-- the Patch can stage the deeper board before the first scratch.
CREATE OR REPLACE FUNCTION public.open_rooting(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	win       bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	the_seed  int;
	existing  record;
	coop_now    boolean;
	blessed_now boolean;
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

	coop_now := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE war_id = p_war AND crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL);
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());

	-- Normalized Park–Miller seed in [1, 2147483646] (parity contract).
	the_seed := (abs(hashtext(p_war::text || ':' || win::text || ':' || caller_id::text))
		% 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win;
	IF existing.war_id IS NOT NULL THEN
		IF existing.submitted_at IS NOT NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted',
				'window_ends_at', to_timestamp((win + 1) * 28800));
		END IF;
		-- Re-open of an unfinished rooting: same seed (idempotent).
		RETURN jsonb_build_object('ok', true, 'seed', existing.seed,
			'window_index', win, 'window_ends_at', to_timestamp((win + 1) * 28800),
			'coop', coop_now, 'blessed', blessed_now,
			'max_actions', CASE WHEN coop_now THEN 25 ELSE 20 END);
	END IF;

	INSERT INTO public.war_rootings (war_id, user_id, crew_id, window_index, seed, war_day)
		VALUES (p_war, caller_id, my_crew, win, the_seed, today);
	RETURN jsonb_build_object('ok', true, 'seed', the_seed,
		'window_index', win, 'window_ends_at', to_timestamp((win + 1) * 28800),
		'coop', coop_now, 'blessed', blessed_now,
		'max_actions', CASE WHEN coop_now THEN 25 ELSE 20 END);
END;
$function$;

-- submit_rooting — carried; prior_cnt moves up so the co-op depth applies
-- to validation (25 actions) and the daily headroom (8), and blessed digs
-- mint the bonus truffle.
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

-- dig_truffle — carried from 20260629; adds the GOLDEN barn find (S2 only)
-- and drops the emoji from the announcement title.
CREATE OR REPLACE FUNCTION public.dig_truffle(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	share        constant numeric := 0.40;  -- fraction of remaining per dig
	floor_all    constant int := 5;         -- under this many left → take the rest
	redig_wait   constant interval := interval '3 hours';  -- matches visit cadence
	v_truffle_id bigint;
	v_remaining  int;
	v_take       int;
	v_left       int;
	last_dig     timestamptz;
	digger_name  text;
	first_today  boolean;
	v_world_boss boolean := false;
	v_golden     boolean := false;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	-- Lock the host's active truffle so concurrent diggers serialise.
	SELECT id, remaining INTO v_truffle_id, v_remaining
	FROM public.truffles
	WHERE host_id = p_host AND dug_at IS NULL
	FOR UPDATE;

	IF v_truffle_id IS NULL OR v_remaining <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- One share per visitor per 3h on THIS truffle (was: one dig EVER, which
	-- stranded the pot in small Sounders — see 20260629 header).
	SELECT dd.dug_at INTO last_dig
	FROM public.truffle_digs dd
	WHERE dd.truffle_id = v_truffle_id AND dd.digger_id = caller_id
	ORDER BY dd.dug_at DESC
	LIMIT 1;
	IF last_dig IS NOT NULL AND last_dig + redig_wait > now() THEN
		RETURN jsonb_build_object('ok', false, 'error', 'dig_cooldown',
			'next_at', last_dig + redig_wait);
	END IF;

	-- Your share of what's left.
	IF v_remaining < floor_all THEN
		v_take := v_remaining;
	ELSE
		v_take := GREATEST(1, round(v_remaining * share)::int);
	END IF;
	v_take := LEAST(v_take, v_remaining);
	v_left := v_remaining - v_take;

	UPDATE public.truffles
		SET remaining = v_left,
		    dug_by    = caller_id,
		    dug_at    = CASE WHEN v_left <= 0 THEN now() ELSE dug_at END
		WHERE id = v_truffle_id;

	-- First dig of the (UTC) day? Checked BEFORE inserting this dig's ledger row.
	SELECT NOT EXISTS (
		SELECT 1 FROM public.truffle_digs dd
		WHERE dd.digger_id = caller_id
		  AND (dd.dug_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	INSERT INTO public.truffle_digs AS dd (truffle_id, digger_id, amount)
		VALUES (v_truffle_id, caller_id, v_take);

	-- Pay the digger; thank the host (generous, tied to a real dig) + notify.
	UPDATE public.profiles SET counter = counter + v_take WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	-- GOLDEN barn truffle (Season 2 only): 20% per dig, once per digger per
	-- UTC day — +5 to the DIGGER's leaderboard count (tickles_earned), never
	-- the bank. The ledger PK enforces the cap under concurrency.
	v_world_boss := COALESCE(
		(SELECT enabled FROM public.app_config WHERE key = 'world_boss'), false);
	IF v_world_boss AND random() < 0.20 THEN
		BEGIN
			INSERT INTO public.golden_barn_finds (user_id, found_on)
				VALUES (caller_id, (now() AT TIME ZONE 'UTC')::date);
			UPDATE public.profiles SET tickles_earned = tickles_earned + 5
				WHERE id = caller_id;
			v_golden := true;
		EXCEPTION WHEN unique_violation THEN
			v_golden := false;  -- already struck gold today
		END;
	END IF;

	-- Inline the announcement INSERT instead of send_system_announcement() —
	-- that wrapper is admin-gated and would abort this whole dig for non-admins.
	SELECT username INTO digger_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'truffle_dug', 'Your truffle was found!',
		COALESCE(digger_name, 'A visitor') || ' dug up ' || v_take || ' snouts from your truffle.'
			|| CASE WHEN v_golden THEN ' It came up GOLDEN.' ELSE '' END,
		'{}'::jsonb
	);

	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 3); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', v_take, 'remaining', v_left,
		'golden', v_golden);
END;
$function$;
