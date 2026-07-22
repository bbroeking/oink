-- Dig-receipt mint breakdown — expose the echo + blessing flags to the client.
--
-- The end-of-dig receipt (EndCard in components/mudwar/TrufflePatch.tsx) itemizes
-- every minted Golden Truffle, but two of the three mint lanes were invisible to
-- the client: the crew-echo +1 (dig_echo) and the blessing +1 (blessed_dig).
-- Both flags already exist inside submit_rooting — `my_echo` and `blessed` — but
-- the returned jsonb never surfaced them, so:
--   • a receipt could show "+2 minted" with no explanation of the extra truffle;
--   • the echo callout leaned on `echo_names`, which lists only crewmates who
--     MINTED (truffles_minted >= 1), while the caller's +1 fires whenever a
--     crewmate merely SUBMITTED (prior_cnt >= 1) — so a legit +1 could appear
--     with an empty name list and no line at all.
--
-- Fix: return `my_echo` as `echo` and `blessed` as `blessed`. The client
-- (hooks/useRooting.ts) reads them server-authoritatively and fail-softs to the
-- old signals (echo_names non-empty / session.blessed) against an un-pushed
-- server, so this is a pure additive dark-launch — no behavior change until the
-- fields are read.
--
-- CARRY-LATEST-DEF: submit_rooting(text[], int, text[]) is carried VERBATIM from
-- 20260744100000_feeding_schedule_config.sql (the alphabetically-latest def — the
-- config-driven window derivation; NOT the older 20260730000000 carryover base).
-- The ONLY diff from that body is the two extra keys appended to the final
-- RETURN jsonb_build_object(...): `'echo', my_echo` and `'blessed', blessed`.
-- Everything else — locals, validation, carry resolution, drain/race, milestones,
-- the row UPDATE — is byte-for-byte the carried source.
--
-- Migration AUTHORED ONLY — never `db push` autonomously.

CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int, p_missed text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	sched       int[] := public._feeding_sched();
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
	win := floor((extract(epoch FROM v_now) - sched[3]) / sched[1])::bigint;
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

	-- DIFF from the carried body: 'echo' (my_echo) and 'blessed' (blessed) added
	-- so the receipt can account for the crew-echo +1 and the blessing +1.
	RETURN jsonb_build_object(
		'ok',           true,
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'echo',         my_echo,
		'blessed',      blessed,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', unique_found,
		'carry_caught', carry_caught,
		'carry_next',   carry_next);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int, text[]) TO authenticated;
