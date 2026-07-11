-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH CARRYOVER — "The One That Got Away" — the personal miss carry-over.
--
-- WHAT: a find you left HALF-DUG (a truffle cluster or a relic with a cell
-- cleared but the whole find never collected) comes back NEXT feeding GILDED.
-- Gild stacks to 3. A gild pays in PRESENCE (the silhouette shows a layer
-- earlier — client math) and VALUE (meter drain + Burrow Book tier) — NEVER in
-- minted truffles (that would resurrect the leave-one-behind farming exploit).
--
-- ONE carry slot per user (user_patch_carry, PK user_id). The newest miss wins
-- ONLY when the slot is empty; a same-kind re-miss bumps gild (cap 3). Carry
-- kinds are truffle_l / truffle_d / unique ONLY — shimmer is a parity-locked
-- board draw (draw #3) and can never be FORCED onto a board, so it can't carry.
--
-- DELTAS on the two RPCs (carried VERBATIM from 20260728000000_patch_uniques —
-- the LATEST defs of open_rooting + submit_rooting: phase gate + _patch_now() +
-- race_digs attribution + unique roll/claim):
--   open_rooting  — if the caller's carry is kind='unique', FORCE the board's
--                   unique_id to the carried relic (skip the random roll); return
--                   `carry` {kind, unique_id, gild} in BOTH return paths.
--   submit_rooting — NEW signature adds p_missed text[] (a 2-arg wrapper delegates
--                   with p_missed => NULL for old clients). p_missed is validated
--                   ⊆ (board finds ∪ 'unique' when the row carries a relic) minus
--                   claimed. If the CARRIED find was CLAIMED this dig: add `gild`
--                   extra to the drain, set user_uniques.best_gild = GREATEST(...)
--                   when the carry kind is 'unique', CLEAR the carry, and return
--                   `carry_caught` {kind, gild}. Else if p_missed names a
--                   carry-eligible kind: a same-kind re-miss bumps gild (cap 3),
--                   an empty slot takes the best miss (unique > truffle_l/d); return
--                   `carry_next` {kind, gild}. GILD NEVER MINTS.
--
-- WHY: Collect (the miss you almost had returns shinier — value grows as catalog
-- tier, never as currency) + Contend (the extra drain the gild pays makes the
-- co-op dig matter) + a warm personal beat. See SKILL.md decision log (2026-07-11).
--
-- FOOTGUNS honored — carry-latest-def: open_rooting AND submit_rooting are carried
-- VERBATIM from 20260728000000_patch_uniques with ONLY the carry deltas layered
-- on. The unique roll/claim path (user_uniques upsert, drain crediting, race
-- attribution) is preserved byte-for-byte. All refusals stay pre-write
-- {ok:false, reason} envelopes. The board-PRNG parity contract is untouched: the
-- carry only PICKS which relic (a value already in the parity-neutral unique_id
-- server state), it never changes a draw.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. user_patch_carry — the one carry slot per pig ─────────────────────────
CREATE TABLE IF NOT EXISTS public.user_patch_carry (
	user_id    uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	kind       text NOT NULL CHECK (kind IN ('truffle_l', 'truffle_d', 'unique')),
	-- The specific relic when kind='unique' (so open_rooting can re-bury the exact
	-- one you almost had); NULL for a truffle carry.
	unique_id  text,
	gild       int  NOT NULL DEFAULT 1 CHECK (gild BETWEEN 1 AND 3),
	updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_patch_carry ENABLE ROW LEVEL SECURITY;
-- RLS: a pig may SELECT only its own carry; ALL writes go through the
-- SECURITY DEFINER RPCs (no write policy = none allowed to the client).
DROP POLICY IF EXISTS user_patch_carry_select_own ON public.user_patch_carry;
CREATE POLICY user_patch_carry_select_own ON public.user_patch_carry
	FOR SELECT USING (user_id = auth.uid());
REVOKE ALL ON public.user_patch_carry FROM PUBLIC, anon;
GRANT SELECT ON public.user_patch_carry TO authenticated;

-- ── 2. user_uniques gains best_gild — the highest gild you've ever caught ─────
-- Landed in the Burrow Book: a relic caught while gilded records its best gild
-- (the ★ count on the discovered entry). 0 = caught but never gilded.
ALTER TABLE public.user_uniques ADD COLUMN IF NOT EXISTS best_gild int NOT NULL DEFAULT 0;

-- ── 3. open_rooting — carried VERBATIM from 20260728; + carried-relic force + carry payload ──
-- DELTA vs 20260728: (a) if the caller has a carry with kind='unique', force
-- this NEW board's unique_id to the carried relic (skip the random roll); (b)
-- return `carry` {kind, unique_id, gild} in BOTH return paths.
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
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
	win   := floor(extract(epoch FROM v_now) / 28800)::bigint;
	today := (v_now AT TIME ZONE 'UTC')::date;
	block_start := to_timestamp(win * 28800);
	opens       := block_start + interval '8 hours';   -- the next opening instant
	phase_ends  := CASE WHEN public.patch_phase_open(v_now)
	                    THEN block_start + interval '4 hours'   -- open phase ends
	                    ELSE opens END;                          -- guard ends = next open

	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Phase gate: the patch is guarded during the second 4h of each block.
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
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 4. submit_rooting(text[], int, text[]) — carried VERBATIM from 20260728;
--      + p_missed validation, carry-caught gild payout, carry-next bump ────────
-- DELTA vs 20260728: new p_missed arg. If the carried find was CLAIMED this dig,
-- add gild to the drain, record best_gild (unique), clear the carry, return
-- carry_caught. Else if p_missed names a carry-eligible kind, take/bump the carry
-- (same-kind re-miss → gild+1 cap 3; empty slot → best miss unique>truffle),
-- return carry_next. GILD NEVER MINTS.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int, p_missed text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
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
	win := floor(extract(epoch FROM v_now) / 28800)::bigint;
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
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int, text[]) TO authenticated;

-- ── 5. 2-arg wrapper — old clients call submit_rooting(finds, actions) ────────
-- Delegates to the new 3-arg def with p_missed => NULL (no carry-next this dig;
-- a caught carry still resolves off the claimed finds). Keeps deployed builds
-- that don't yet send p_missed working unchanged.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.submit_rooting(p_finds, p_actions, NULL::text[]);
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;
