-- ═══════════════════════════════════════════════════════════════════════════
-- DIG SCHEDULE — the "commuter" LOCAL-TIME feeding windows.
--
-- PROPOSAL (pending founder approval — see docs/wiki/outputs/memos/
-- dig-schedule-commuter-local-2026-07.md). Three changes to when the Truffle
-- Patch opens:
--   1. Better hours — the morning window moves to commuter time (was 4–8am in
--      ET under the old UTC anchor; now 6–10am wherever the player is).
--   2. Phone-LOCAL time — the schedule is derived from the caller's UTC offset
--      (p_utc_offset_minutes), so a West-Coast pig gets 6–10am on THEIR clock,
--      same as an East-Coast pig. No more UTC-anchored windows.
--   3. Non-uniform windows — shorter, more frequent daytime windows and one long
--      overnight gorge while players sleep. Four windows/day (was three):
--
--        morning    6:00–10:00a  (open 4h)  gorge → 12:00p
--        lunch     12:00– 2:00p  (open 2h)  gorge →  5:00p
--        evening    5:00– 8:00p  (open 3h)  gorge →  9:00p
--        wind-down  9:00–11:00p  (open 2h)  OVERNIGHT gorge → 6:00a
--
-- MODEL — "local hours, global patch." The board seed is ALREADY per-user
-- (hashtext(win || ':' || caller_id)) and the Great Hungerer meter is a pure
-- cumulative total with no time dependency, so moving to a local clock changes
-- NEITHER: each pig still digs its own board, and every find still drains the
-- one shared boss. The only thing `win` gates is (a) which board you get, (b) the
-- one-dig-per-window PK (user_id, window_index), and (c) the co-op ECHO detection
-- (crew_id + window_index). (a)+(b) are per-user and unaffected. (c) means the
-- echo now syncs crewmates who dig in the SAME LOCAL window — perfect for a
-- same-timezone crew (the common case), degraded for cross-timezone crews. This
-- is called out in the memo as a conscious tradeoff.
--
-- WINDOW INDEX — `dig_day * 4 + bucket`, dig-day anchored at 6:00am LOCAL. The
-- scale differs from the old floor(epoch/28800) (~1.98M) — new indices are far
-- smaller (~82k), so a new local index can never collide with a user's old-scale
-- rows on the PK.
--
-- CONSTANTS (MUST match client constants/dig.ts DIG_* values):
--   anchor 360 (6am), day 1440, bucket starts [0,360,660,900], open mins
--   [240,120,180,120] → open spans [0,240) [360,480) [660,840) [900,1020).
--
-- FOOTGUNS honored — carry-latest-def: open_rooting AND submit_rooting are
-- carried VERBATIM from 20260730000000_patch_carryover (the LATEST defs: phase
-- gate + _patch_now() + carry-over + unique roll/claim + race attribution) with
-- ONLY these deltas: (1) a p_utc_offset_minutes arg, (2) `win` derived via
-- patch_window_index(v_now, off) instead of floor(epoch/28800), (3) the phase
-- gate + phase_ends/opens_at derived via the new local-schedule helpers. The
-- board-PRNG parity contract, drain crediting, and all refusal envelopes are
-- untouched. Old deployed clients keep working through no-arg / 3-arg wrappers
-- that pass offset 0 (a UTC-anchored view of the same commuter schedule).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Schedule helpers — the one place the local-window math lives ──────────

-- Minutes since THIS dig-day's 6:00am-local anchor, normalized to 0..1439.
CREATE OR REPLACE FUNCTION public._patch_local_min(p_at timestamptz, p_off int)
RETURNS bigint LANGUAGE sql IMMUTABLE
AS $function$
	-- (epoch-minutes + offset − 6am-anchor) mod one-day, kept non-negative.
	SELECT ((floor(extract(epoch FROM p_at) / 60)::bigint + COALESCE(p_off, 0) - 360) % 1440 + 1440) % 1440;
$function$;
GRANT EXECUTE ON FUNCTION public._patch_local_min(timestamptz, int) TO authenticated;

-- The window index `dig_day * 4 + bucket` for an instant on the caller's clock.
CREATE OR REPLACE FUNCTION public.patch_window_index(p_at timestamptz, p_off int)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	adj     bigint := floor(extract(epoch FROM p_at) / 60)::bigint + COALESCE(p_off, 0) - 360;
	dig_day bigint := floor(adj::numeric / 1440)::bigint;
	m       bigint := adj - dig_day * 1440;   -- 0..1439, minutes since 6am local
BEGIN
	RETURN dig_day * 4 + CASE
		WHEN m >= 900 THEN 3     -- wind-down
		WHEN m >= 660 THEN 2     -- evening
		WHEN m >= 360 THEN 1     -- lunch
		ELSE 0 END;              -- morning
END;
$function$;
GRANT EXECUTE ON FUNCTION public.patch_window_index(timestamptz, int) TO authenticated;

-- Is the patch diggable right now on the caller's clock (inside an open span)?
-- 2-arg overload; the 1-arg UTC form from 20260721 stays for any legacy caller.
CREATE OR REPLACE FUNCTION public.patch_phase_open(p_at timestamptz, p_off int)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	m bigint := public._patch_local_min(p_at, p_off);
BEGIN
	-- open spans: 6–10a, 12–2p, 5–8p, 9–11p (see header constants).
	RETURN (m < 240)
	    OR (m >= 360 AND m < 480)
	    OR (m >= 660 AND m < 840)
	    OR (m >= 900 AND m < 1020);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.patch_phase_open(timestamptz, int) TO authenticated;

-- Server truth for the client countdowns:
--   phase_ends — end of the CURRENT phase (open → this span's close; else = opens)
--   opens_at   — the NEXT opening instant (next bucket start, wrapping overnight)
CREATE OR REPLACE FUNCTION public.patch_phase_bounds(
	p_at timestamptz, p_off int,
	OUT phase_ends timestamptz, OUT opens_at timestamptz)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	off        int    := COALESCE(p_off, 0);
	adj        bigint := floor(extract(epoch FROM p_at) / 60)::bigint + off - 360;
	dig_day    bigint := floor(adj::numeric / 1440)::bigint;
	m          bigint := adj - dig_day * 1440;              -- 0..1439
	base       bigint := dig_day * 1440 + 360 - off;        -- UTC epoch-min of this dig-day's 6am
	is_open    boolean := (m < 240) OR (m >= 360 AND m < 480) OR (m >= 660 AND m < 840) OR (m >= 900 AND m < 1020);
	next_start bigint;
	cur_end    bigint;
BEGIN
	-- The next bucket start strictly after m (wraps to the next day's 6am = 1440).
	next_start := CASE
		WHEN m < 360 THEN 360
		WHEN m < 660 THEN 660
		WHEN m < 900 THEN 900
		ELSE 1440 END;
	opens_at := to_timestamp((base + next_start) * 60);
	IF is_open THEN
		-- The close of the open span containing m.
		cur_end := CASE
			WHEN m < 240 THEN 240
			WHEN m < 480 THEN 480
			WHEN m < 840 THEN 840
			ELSE 1020 END;
		phase_ends := to_timestamp((base + cur_end) * 60);
	ELSE
		phase_ends := opens_at;   -- guarded → the phase ends when it next opens
	END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.patch_phase_bounds(timestamptz, int) TO authenticated;

-- ── 2. open_rooting(int) — carried VERBATIM from 20260730; + local schedule ──
-- DELTA vs 20260730: (1) p_utc_offset_minutes arg; (2) win via
-- patch_window_index(v_now, off); (3) phase gate + phase_ends/opens_at via the
-- local-schedule helpers above. Everything else (crew gate, coop/crew_dug, carry
-- re-bury, seed derivation, existing-row echo, insert) is byte-for-byte the same.
CREATE OR REPLACE FUNCTION public.open_rooting(p_utc_offset_minutes int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	off         int := COALESCE(p_utc_offset_minutes, 0);
	my_crew     uuid;
	win         bigint;
	today       date;
	the_seed    int;
	existing    record;
	coop_now    boolean;
	blessed_now boolean;
	crew_dug    jsonb;
	phase_ends  timestamptz;
	opens       timestamptz;
	the_unique  text;   -- the relic this NEW board carries, or NULL
	the_carry   record; -- the caller's carry slot (kind, unique_id, gild), or none
	carry_json  jsonb := NULL;  -- {kind, unique_id, gild} echoed to the client
BEGIN
	win   := public.patch_window_index(v_now, off);
	today := (v_now AT TIME ZONE 'UTC')::date;
	SELECT b.phase_ends, b.opens_at INTO phase_ends, opens
		FROM public.patch_phase_bounds(v_now, off) b;

	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Phase gate: the patch is guarded outside the current window's open span.
	IF NOT public.patch_phase_open(v_now, off) THEN
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

	-- Normalized Park–Miller seed in [1, 2147483646] (client receives it; parity
	-- is in board generation from the seed, not the seed derivation).
	the_seed := (abs(hashtext(win::text || ':' || caller_id::text)) % 2147483646) + 1;

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
REVOKE ALL ON FUNCTION public.open_rooting(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting(int) TO authenticated;

-- Back-compat: old clients call open_rooting() with no args → offset 0 (a
-- UTC-anchored view of the commuter schedule). Keeps deployed builds working.
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.open_rooting(0);
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 3. submit_rooting(text[], int, text[], int) — carried VERBATIM from
--      20260730; + p_utc_offset_minutes so win matches the local open window ──
-- DELTA vs 20260730's 3-arg def: (1) p_utc_offset_minutes arg; (2) win via
-- patch_window_index(v_now, off). NO phase gate on submit (unchanged); a session
-- whose local window has rolled over refuses with no_open_rooting as before.
-- Every other line — finds validation, carry resolution, mint, drain, race
-- attribution, milestones — is byte-for-byte identical.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int, p_missed text[], p_utc_offset_minutes int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	off         int := COALESCE(p_utc_offset_minutes, 0);
	my_crew     uuid;
	win         bigint;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	n_credited  int := 0;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[];
	drain_total bigint;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
	v_cycle     text;
	claimed_unique boolean := false;   -- did the payload validly claim the relic?
	uniq_new    boolean := false;      -- first catch (fresh Book entry)?
	uniq_count  int := 0;              -- found_count after this catch
	unique_found jsonb := NULL;
	-- ── carry-over locals ────────────────────────────────────────────────────
	the_carry     record;             -- the caller's carry slot before this dig
	missed_clean  text[];             -- validated, claimed-subtracted p_missed
	m             text;
	carry_gild    int := 0;           -- gild the carried find pays this dig, if caught
	carry_caught  jsonb := NULL;      -- {kind, gild} when the carried find was claimed
	carry_next    jsonb := NULL;      -- {kind, gild} when a new miss takes/bumps the slot
	best_miss     text;               -- the best carry-eligible miss (unique>truffle)
	new_gild      int;
BEGIN
	win := public.patch_window_index(v_now, off);
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');
	END IF;

	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_actions');
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win FOR UPDATE;
	IF row_r.user_id IS NULL THEN
		-- Also the stale-session path: a dig opened in a PREVIOUS window refuses
		-- here because win moved on (unchanged pre-phase behavior).
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;

	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		-- 'unique' is valid ONLY when this board actually carries a relic; the
		-- board's rooting_finds() (seed-derived) never contains 'unique', so it is
		-- validated against the row's unique_id here instead.
		IF f = 'unique' THEN
			IF row_r.unique_id IS NULL THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			claimed_unique := true;
		ELSIF NOT (f = ANY (valid)) THEN
			-- Still pre-write: a forged find rejects the whole submit, no side effects.
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	-- Every claimed find (truffles, shimmer, junk, AND the relic) counts toward
	-- the meter drain — the relic is a credited find like any other.
	n_credited := COALESCE(array_length(claimed, 1), 0);

	-- ── p_missed validation (still pre-write) ────────────────────────────────
	-- A miss must be a carry-eligible id (truffle_l/truffle_d/unique), actually on
	-- THIS board (a truffle is always present; 'unique' only when unique_id set),
	-- and NOT also in `claimed` (a claimed find is caught, not missed). A forged
	-- miss is silently dropped (not a submit-killer — the miss is advisory presence
	-- state, not a scored find), so an old or buggy client can't wedge a valid dig.
	missed_clean := ARRAY[]::text[];
	IF p_missed IS NOT NULL THEN
		FOREACH m IN ARRAY p_missed LOOP
			IF m = ANY (claimed) THEN CONTINUE; END IF;                 -- caught, not missed
			IF m = 'unique' THEN
				IF row_r.unique_id IS NOT NULL AND NOT (m = ANY (missed_clean)) THEN
					missed_clean := missed_clean || m;
				END IF;
			ELSIF m IN ('truffle_l', 'truffle_d') THEN
				IF NOT (m = ANY (missed_clean)) THEN missed_clean := missed_clean || m; END IF;
			END IF;
			-- anything else (shimmer/junk/stone/forged) is dropped: never carries.
		END LOOP;
	END IF;

	-- The caller's carry slot BEFORE this dig (drives the catch/keep decision).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = caller_id;

	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'dig', NULL);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'dig_echo', NULL);
			my_echo := true;
		END IF;
		IF blessed THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'blessed_dig', NULL);
		END IF;
	END IF;

	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE user_id = r.user_id AND window_index = win;
		BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;

	IF minted > 0 THEN
		BEGIN PERFORM public.try_claim_achievements(caller_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	-- ── UNIQUE CATCH ─────────────────────────────────────────────────────────
	-- Light the Burrow Book: first catch inserts (new=true), a dupe bumps count.
	IF claimed_unique THEN
		INSERT INTO public.user_uniques (user_id, unique_id, found_count, first_found_at)
			VALUES (caller_id, row_r.unique_id, 1, v_now)
			ON CONFLICT (user_id, unique_id)
			DO UPDATE SET found_count = public.user_uniques.found_count + 1
			RETURNING (xmax = 0) AS was_insert, found_count INTO uniq_new, uniq_count;
		unique_found := jsonb_build_object(
			'id', row_r.unique_id, 'new', uniq_new, 'found_count', uniq_count);
	END IF;

	-- ── THE ONE THAT GOT AWAY — carry resolution ─────────────────────────────
	-- (1) CAUGHT: the carried find was claimed this dig. The gild pays extra
	--     drain (NEVER minted truffles), records best_gild for a relic, and the
	--     carry slot clears. A truffle carry is caught when EITHER truffle cluster
	--     is claimed (the miss is a truffle — the one you almost had); a unique
	--     carry is caught when THIS board's relic (which open_rooting re-buried to
	--     the carried one) is claimed.
	IF the_carry.kind IS NOT NULL THEN
		IF (the_carry.kind IN ('truffle_l', 'truffle_d')
			AND ('truffle_l' = ANY (claimed) OR 'truffle_d' = ANY (claimed)))
		   OR (the_carry.kind = 'unique' AND claimed_unique
			AND row_r.unique_id = the_carry.unique_id)
		THEN
			carry_gild := the_carry.gild;
			IF the_carry.kind = 'unique' AND claimed_unique THEN
				UPDATE public.user_uniques
					SET best_gild = GREATEST(best_gild, the_carry.gild)
					WHERE user_id = caller_id AND unique_id = row_r.unique_id;
			END IF;
			DELETE FROM public.user_patch_carry WHERE user_id = caller_id;
			carry_caught := jsonb_build_object('kind', the_carry.kind, 'gild', the_carry.gild);
		END IF;
	END IF;

	-- (2) NEXT: pick the best NEW miss (unique beats a truffle). If the slot is
	--     empty (or was just cleared by a catch), take it; if the same kind is
	--     re-missed, bump gild (cap 3). A different-kind miss when the slot is
	--     occupied does NOT displace it (newest wins only when empty or same-kind).
	IF array_length(missed_clean, 1) IS NOT NULL THEN
		IF 'unique' = ANY (missed_clean) THEN best_miss := 'unique';
		ELSIF 'truffle_l' = ANY (missed_clean) THEN best_miss := 'truffle_l';
		ELSIF 'truffle_d' = ANY (missed_clean) THEN best_miss := 'truffle_d';
		END IF;

		IF best_miss IS NOT NULL THEN
			-- Re-read the slot: a catch above may have cleared it this same dig.
			SELECT kind, unique_id, gild INTO the_carry
				FROM public.user_patch_carry WHERE user_id = caller_id;
			IF the_carry.kind IS NULL THEN
				-- Empty slot → take this miss at gild 1.
				INSERT INTO public.user_patch_carry (user_id, kind, unique_id, gild, updated_at)
					VALUES (caller_id, best_miss,
						CASE WHEN best_miss = 'unique' THEN row_r.unique_id ELSE NULL END,
						1, v_now);
				carry_next := jsonb_build_object('kind', best_miss, 'gild', 1);
			ELSIF the_carry.kind = best_miss THEN
				-- Same kind re-missed → bump gild (cap 3), refresh updated_at. For a
				-- unique, keep it pinned to THIS board's relic (the one re-missed).
				new_gild := LEAST(3, the_carry.gild + 1);
				UPDATE public.user_patch_carry
					SET gild = new_gild,
					    unique_id = CASE WHEN best_miss = 'unique' THEN row_r.unique_id ELSE NULL END,
					    updated_at = v_now
					WHERE user_id = caller_id;
				carry_next := jsonb_build_object('kind', best_miss, 'gild', new_gild);
			END IF;
			-- Occupied by a DIFFERENT kind → leave it (newest wins only if empty/same).
		END IF;
	END IF;

	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- ── DRAIN + RACE ATTRIBUTION ─────────────────────────────────────────────
	-- Instant drain; the race cycle is derived from the SAME clock as the
	-- window (race_cycle_at(v_now), not race_current_cycle()). A caught carry's
	-- gild adds EXTRA drain (value, not currency) on top of the credited finds.
	UPDATE public.hunger_drain SET total = total + n_credited + carry_gild WHERE id = true
		RETURNING total INTO drain_total;
	SELECT rc.cycle_key INTO v_cycle FROM public.race_cycle_at(v_now) rc;
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
		VALUES (v_cycle, caller_id, win, my_crew, n_credited)
		ON CONFLICT (cycle_key, user_id, window_index)
		DO UPDATE SET finds = public.race_digs.finds + EXCLUDED.finds;

	SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = my_crew FOR UPDATE;
	old_life := COALESCE(old_life, 0);
	new_life := old_life + n_credited;
	UPDATE public.crews SET lifetime_finds = new_life WHERE id = my_crew;

	FOR t IN SELECT * FROM (VALUES
		(150,  'mud_champion', 200,  'Root Rustler'),
		(600,  'mud_veteran',  1000, 'Truffle Baron'),
		(1800, 'mud_legend',   2000, 'Hunger''s Bane')
	) AS v(thresh, title_id, purse, title_name)
	LOOP
		IF old_life < t.thresh AND new_life >= t.thresh THEN
			INSERT INTO public.crew_milestones (crew_id, threshold)
				VALUES (my_crew, t.thresh) ON CONFLICT DO NOTHING;
			GET DIAGNOSTICS landed = ROW_COUNT;
			IF landed > 0 THEN
				FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
					INSERT INTO public.user_titles (user_id, title_id)
						VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
					UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
					BEGIN
						INSERT INTO public.system_announcements (user_id, kind, title, body, data)
						VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
							'Your Sounder has rooted ' || t.thresh ||
							' truffles out from under the Great Hungerer. The title "' ||
							t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
							jsonb_build_object('crew_id', my_crew, 'threshold', t.thresh, 'title_id', t.title_id));
					EXCEPTION WHEN OTHERS THEN NULL; END;
				END LOOP;
				milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
			END IF;
		END IF;
	END LOOP;

	UPDATE public.war_rootings SET
		submitted_at    = v_now,
		finds           = claimed,
		actions         = p_actions,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited
		WHERE user_id = caller_id AND window_index = win;

	PERFORM public.grant_season_xp(caller_id, 20);

	RETURN jsonb_build_object(
		'ok',           true,
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', unique_found,
		'carry_caught', carry_caught,
		'carry_next',   carry_next);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int, text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int, text[], int) TO authenticated;

-- ── 4. Back-compat wrapper — old clients call submit_rooting(finds, actions,
--      missed) with no offset → offset 0 (UTC-anchored commuter schedule). The
--      existing 2-arg wrapper (finds, actions) still delegates through this. ──
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int, p_missed text[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.submit_rooting(p_finds, p_actions, p_missed, 0);
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int, text[]) TO authenticated;
