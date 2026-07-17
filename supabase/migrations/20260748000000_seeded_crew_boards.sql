-- ── Seeded crew boards (wedge 5a) ─────────────────────────────────────────────
--
-- Board generation becomes DETERMINISTIC PER (feeding window, crew): every pig
-- in the same Sounder digs the IDENTICAL patch each feeding, so results are
-- comparable in the group chat ("the golden was in the corner — took me 14").
-- Per-crew (not global) keeps spoilers in-herd where they're fun; boards still
-- expire with the 8h window so leaks decay. Solo/crewless pigs seed on
-- (window_index, user_id) — feel unchanged (and in open_rooting the no_crew gate
-- means a crewless caller never reaches the seed line anyway; the COALESCE is
-- the documented, defensive expression of that branch).
--
-- WHAT CHANGES: exactly one line of open_rooting — the seed-derivation string is
-- keyed on the caller's crew instead of the caller. No reward math, no find
-- tables, no uniques roll, no window geometry moves. The relic roll stays
-- per-user-random (random() < 0.4): the shared SEED fixes the truffle/junk
-- LAYOUT across the herd — which is the comparability the wedge wants — while
-- each pig independently rolls whether THEIR board also carries a relic. A
-- unique is placed AFTER every layout draw (generateBoard), so its presence
-- never shifts the shared layout.
--
-- CARRY-LATEST-DEF: open_rooting is carried VERBATIM from the newest def in
-- 20260744100000_feeding_schedule_config.sql (the server-authoritative schedule
-- carry) — NOT an older migration. 20260746/20260747 do not touch open_rooting,
-- so 20260744100000 remains the latest body. Only the seed line + its comment
-- differ from that base. This is the carry-latest-def footgun (a stale base
-- silently deletes later features — build 93's referral gate died that way):
-- feeding_state / submit_rooting / patch_phase_open are UNTOUCHED here (the seed
-- change is confined to open_rooting; submit_rooting reads the STORED row seed,
-- so it needs no carry), and are deliberately left as their 20260744100000 defs.
--
-- CLIENT PARITY: utils/rooting.ts mirrors the derivation SHAPE (crewBoardSeed):
-- deterministic per (window, group), identical across a crew, different per
-- crew. It does NOT byte-match hashtext (same posture as practiceSeed) — the
-- server seed handed back by open_rooting is always authoritative, so a client
-- that predicts locally and a server that hasn't been pushed yet reconcile with
-- the server board winning (hooks/useRooting stores r.seed, never a local guess).

-- ── open_rooting — carried VERBATIM from 20260744100000; seed keyed on crew ────
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	sched       int[] := public._feeding_sched();
	win         bigint;
	today       date;
	the_seed    int;
	existing    record;
	coop_now    boolean;
	blessed_now boolean;
	crew_dug    jsonb;
	block_start timestamptz;
	phase_ends  timestamptz;
	opens       timestamptz;
	the_unique  text;   -- the relic this NEW board carries, or NULL
	the_carry   record; -- the caller's carry slot (kind, unique_id, gild), or none
	carry_json  jsonb := NULL;  -- {kind, unique_id, gild} echoed to the client
BEGIN
	win   := floor((extract(epoch FROM v_now) - sched[3]) / sched[1])::bigint;
	today := (v_now AT TIME ZONE 'UTC')::date;
	block_start := to_timestamp(win * sched[1] + sched[3]);
	opens       := block_start + make_interval(secs => sched[1]);   -- the next opening instant
	phase_ends  := CASE WHEN public.patch_phase_open(v_now)
	                    THEN block_start + make_interval(secs => sched[2])   -- open phase ends
	                    ELSE opens END;                                      -- guard ends = next open

	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Phase gate: the patch is guarded during the tail of each block.
	IF NOT public.patch_phase_open(v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'patch_closed',
			'phase_ends_at', phase_ends, 'opens_at', opens);
	END IF;

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');   -- the dig is Sounder-gated
	END IF;

	coop_now := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL);
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', r.user_id, 'display_name', p.username)), '[]'::jsonb)
		INTO crew_dug
		FROM public.war_rootings r JOIN public.profiles p ON p.id = r.user_id
		WHERE r.crew_id = my_crew AND r.window_index = win
		  AND r.submitted_at IS NOT NULL AND r.user_id <> caller_id;

	-- The caller's carry slot, if any (echoed to the client; drives the re-bury).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = caller_id;
	IF the_carry.kind IS NOT NULL THEN
		carry_json := jsonb_build_object(
			'kind', the_carry.kind, 'unique_id', the_carry.unique_id, 'gild', the_carry.gild);
	END IF;

	-- SEEDED CREW BOARDS (wedge 5a): the board seed is keyed on the caller's CREW,
	-- so every pig in the Sounder gets the IDENTICAL patch layout this window (the
	-- comparability unlock). f(window, crew_id) here; f(window, user_id) only on
	-- the crewless branch (unreachable past the no_crew gate above — the COALESCE
	-- documents that fallback). Normalized Park–Miller seed in [1, 2147483646]
	-- (client receives it; parity is in board generation from the seed). Reward
	-- math / find tables / the per-user relic roll below are all unchanged.
	the_seed := (abs(hashtext(win::text || ':' || COALESCE(my_crew, caller_id)::text)) % 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win;
	IF existing.user_id IS NOT NULL THEN
		-- Existing row: echo its stored relic (never re-rolled — the board is fixed).
		RETURN jsonb_build_object(
			'ok', true,
			'already', existing.submitted_at IS NOT NULL,
			'window_index', win, 'seed', existing.seed, 'opened_at', existing.opened_at,
			'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
			'phase_ends_at', phase_ends, 'opens_at', opens,
			'unique_id', existing.unique_id,
			'carry', carry_json);
	END IF;

	-- New board: if the caller carries a RELIC, re-bury that exact relic (the one
	-- that got away) and skip the random roll. Otherwise roll whether the board
	-- carries a relic (~2 in 5) and which — unchanged from 20260728.
	IF the_carry.kind = 'unique' AND the_carry.unique_id IS NOT NULL THEN
		the_unique := the_carry.unique_id;
	ELSIF random() < 0.4 THEN
		the_unique := public.roll_unique();
	END IF;

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day, opened_at, unique_id)
		VALUES (caller_id, my_crew, win, the_seed, today, v_now, the_unique);
	RETURN jsonb_build_object(
		'ok', true,
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', v_now,
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
		'phase_ends_at', phase_ends, 'opens_at', opens,
		'unique_id', the_unique,
		'carry', carry_json);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;
