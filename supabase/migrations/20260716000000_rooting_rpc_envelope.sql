-- ═══════════════════════════════════════════════════════════════════════════
-- ROOTING RPC ENVELOPE — open_rooting()/submit_rooting() adopt the {ok:...}
-- contract the client's rpcAction wrapper requires.
--
-- WHY: live testing showed every dig failing client-side ("The patch is being
-- stubborn"): rpcAction expects success payloads shaped {ok:true, ...} and
-- treats RAISEd exceptions as generic network failures — so a real no_crew
-- user would silently fall into practice mode. The dig-off RPCs (20260715)
-- already follow the ok-envelope convention; the 20260714 rooting pair did not
-- (raw jsonb success + RAISE for refusals).
--
-- WHAT: recreate both functions carrying their LATEST defs VERBATIM —
--   open_rooting()  ← 20260714000000_coop_dig_rebuild (§5i)
--   submit_rooting  ← 20260715000000_digoff (§12, the banking version — NOT
--                     the 20260714 def; carry-latest-def footgun)
-- with ONLY these changes:
--   1. success returns gain "ok": true.
--   2. RAISE-based refusals become RETURN {ok:false, reason:'<same string>'} —
--      reasons unchanged: unauthenticated, no_crew, bad_actions,
--      no_open_rooting, already_rooted, bad_finds.
--   3. NO other behavior changes (banking, echo, retro-gild, milestones,
--      drain, season XP all identical).
--
-- SAFE: in both functions every refusal check runs BEFORE any write, so the
-- RAISE→RETURN swap does not change what gets rolled back — refusals were and
-- remain side-effect-free.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. open_rooting() — carried from 20260714; envelope only ────────────────
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today       date := (now() AT TIME ZONE 'UTC')::date;
	the_seed    int;
	existing    record;
	coop_now    boolean;
	blessed_now boolean;
	crew_dug    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');   -- the dig is Sounder-gated
	END IF;

	coop_now := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL);
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
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
			'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug);
	END IF;

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day)
		VALUES (caller_id, my_crew, win, the_seed, today);
	RETURN jsonb_build_object(
		'ok', true,
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', now(),
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 2. submit_rooting(finds, actions) — carried from 20260715 (banking def);
--      envelope only ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
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
	active_do   record;   -- the crew's active dig-off covering now (banking)
BEGIN
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
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
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

	-- ── DRAIN vs BANK ────────────────────────────────────────────────────────
	-- If this crew is inside an ACTIVE dig-off covering right now, credited finds
	-- are BANKED into the dig-off pot (per-user, per-window) and slam
	-- hunger_drain all at once at resolution. Otherwise drain instantly (today's
	-- behavior). Lifetime herd + milestones + truffle minting are unaffected.
	SELECT * INTO active_do FROM public.dig_offs
		WHERE status = 'active' AND starts_at <= now() AND ends_at > now()
		  AND (crew_a = my_crew OR crew_b = my_crew)
		ORDER BY starts_at DESC LIMIT 1 FOR UPDATE;
	IF active_do.id IS NOT NULL THEN
		IF active_do.crew_a = my_crew THEN
			UPDATE public.dig_offs SET pot_a = pot_a + n_credited WHERE id = active_do.id;
		ELSE
			UPDATE public.dig_offs SET pot_b = pot_b + n_credited WHERE id = active_do.id;
		END IF;
		INSERT INTO public.dig_off_digs (dig_off_id, user_id, window_index, crew_id, finds)
			VALUES (active_do.id, caller_id, win, my_crew, n_credited)
			ON CONFLICT (dig_off_id, user_id, window_index)
			DO UPDATE SET finds = public.dig_off_digs.finds + EXCLUDED.finds;
		SELECT total INTO drain_total FROM public.hunger_drain WHERE id = true;   -- unchanged (banked)
	ELSE
		UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
			RETURNING total INTO drain_total;
	END IF;

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
		submitted_at    = now(),
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
		'banked',      (active_do.id IS NOT NULL),
		'digoff_id',   active_do.id,
		'milestone',   milestone);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;
