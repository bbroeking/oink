-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH PHASE — the Truffle Patch alternates 4h OPEN / 4h CLOSED inside each
-- 8h feeding window.
--
-- MECHANIC: windows stay 8h UTC-anchored blocks (00/08/16 UTC). The patch is
-- OPEN during the FIRST 4 hours of each block, guarded during the second 4.
-- A pig can only OPEN a rooting in the open phase; a session opened in-phase
-- may still be SUBMITTED until the window ends (a dig started at 3:59 into
-- the phase finishes normally). submit_rooting has NO phase gate — the only
-- time gate on submit remains the window itself (a stale session refuses with
-- 'no_open_rooting' as before, because win is derived from the current time).
--
-- CONSTANTS (MUST match client constants/dig.ts):
--   ROOTING_WINDOW_SECS = 28800, PATCH_OPEN_SECS = 14400
--   open ⟺ (epoch(T) mod 28800) < 14400
--
-- PAYLOAD ADDITIONS (both success AND the patch_closed refusal, server truth
-- for client countdowns):
--   phase_ends_at — end of the CURRENT phase (open → block+4h, closed → block+8h)
--   opens_at      — the NEXT opening instant (always the next block start,
--                   block+8h; while closed this equals phase_ends_at)
--
-- TESTABLE CLOCK: _patch_now() = COALESCE(NULLIF(current_setting('ttp.fake_now',
-- true), '')::timestamptz, now()). Production behavior is identical (the GUC is
-- never set; PostgREST clients cannot set arbitrary GUCs); the harness pins it
-- with set_config('ttp.fake_now', …, true) for deterministic phase tests. ALL
-- time derivations in open_rooting/submit_rooting (window_index, dig_day,
-- opened/submitted stamps, blessing-expiry checks, race-cycle attribution) now
-- flow through _patch_now().
--
-- FOOTGUNS honored: carry-latest-def — open_rooting carried VERBATIM from
-- 20260716, submit_rooting from 20260719 (20260720 did not touch it), with
-- ONLY the phase gate / payload keys / _patch_now() substitutions described
-- above. Refusals stay {ok:false, reason} envelopes, all pre-write.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Pure phase math ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.patch_phase_open(p_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$
	-- (epoch mod ROOTING_WINDOW_SECS) < PATCH_OPEN_SECS  — see header constants.
	SELECT (floor(extract(epoch FROM p_at))::bigint % 28800) < 14400;
$function$;
GRANT EXECUTE ON FUNCTION public.patch_phase_open(timestamptz) TO authenticated;

-- ── 2. Testable clock ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._patch_now()
RETURNS timestamptz LANGUAGE sql STABLE
AS $function$
	SELECT COALESCE(NULLIF(current_setting('ttp.fake_now', true), '')::timestamptz, now());
$function$;

-- ── 3. open_rooting — carried from 20260716; + phase gate, phase payload,
--      _patch_now() ───────────────────────────────────────────────────────────
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

	-- Normalized Park–Miller seed in [1, 2147483646] (client receives it; parity
	-- is in board generation from the seed, not the seed derivation).
	the_seed := (abs(hashtext(win::text || ':' || caller_id::text)) % 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win;
	IF existing.user_id IS NOT NULL THEN
		RETURN jsonb_build_object(
			'ok', true,
			'already', existing.submitted_at IS NOT NULL,
			'window_index', win, 'seed', existing.seed, 'opened_at', existing.opened_at,
			'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
			'phase_ends_at', phase_ends, 'opens_at', opens);
	END IF;

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day, opened_at)
		VALUES (caller_id, my_crew, win, the_seed, today, v_now);
	RETURN jsonb_build_object(
		'ok', true,
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', v_now,
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
		'phase_ends_at', phase_ends, 'opens_at', opens);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 4. submit_rooting — carried from 20260719; NO phase gate, time through
--      _patch_now() (window derivation, stamps, blessing check, race cycle) ────
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
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
		IF NOT (f = ANY (valid)) THEN
			-- Still pre-write: a forged find rejects the whole submit, no side effects.
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	n_credited := COALESCE(array_length(claimed, 1), 0);

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

	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- ── DRAIN + RACE ATTRIBUTION ─────────────────────────────────────────────
	-- Instant drain; the race cycle is derived from the SAME clock as the
	-- window (race_cycle_at(v_now), not race_current_cycle()).
	UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
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
		'ok',          true,
		'credited',    claimed,
		'truffles',    minted,
		'echo_names',  echo_names,
		'drain_total', drain_total,
		'milestone',   milestone);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;
