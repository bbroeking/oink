-- Every Snout Deep find pays tickles — the receipt becomes a tally.
-- Spec: docs/dig-redesign/a-snout-deep-spec.md §2 (the tickle table), §4 (the
-- ledger rule: applied tickles are never bankable or tradeable), §5.7 / §5.8
-- (the tally). SKILL.md decision 2026-09-13 "Everything you dig up pays tickles".
--
-- What lands here:
--   1. app_settings.dig_finds grows a `tickles` value per find kind. The row
--      reshapes from {kind: [n, d]} to {kind: {odds: [n, d], tickles: t}} so
--      one key holds everything the server knows about a find (spec §2:
--      `app_settings.dig_finds[kind].tickles`). Kinds that are always present
--      (the truffles, the Boom, the junk keepsake, stones) carry only
--      `tickles`. constants/dig.ts DIG_FIND_TICKLES is the compiled fallback
--      and MUST match. Nothing reads the odds off this row yet (open_rooting
--      echoes it; the client's board still generates from DIG_FINDS).
--   2. apply_tickles(uid, n) — the ONE applied-tickles path, named. It is the
--      20260812010000 auto-apply rule (the season-pass Boom's rule, reused by
--      the weekly Dig-Off spoils in 20260817000000): tickles_earned + counter,
--      never user_items.item_count. So a dig's tickles land exactly like a
--      tap's do on the Barn's count, and are never bankable (grant_tickles is
--      the bank; it is deliberately NOT this).
--   3. _dig_boom_tickles(uid) — the Boom's amount: the base 3 plus the
--      catch-up's gap (§4 boom(H)). The catch-up cycle tables have not shipped
--      (spec §11 step 6), so the gap is 0 today; this is the one seam the
--      catch-up migration fills in.
--   4. _submit_rooting_deep_core — CARRIED from 20260913060000 (the latest
--      def; the carry-latest-def footgun applies). DIFF: after the mints and
--      the carry resolution it sums every find's tickles (a truffle he took
--      pays 0; a lost truffle is listed at 0 so the tally can read "his"),
--      applies the sum through apply_tickles, and the receipt gains
--      `tickles` [{id, kind, tickles}] in the order of the finds,
--      `tickles_total`, `tickled_before` and `tickled_now` (profiles.
--      tickles_earned — what the Barn's earned stamp reads through
--      home_stats). Idempotent per (uid, window_index) like every other grant
--      in the function: the stored receipt short-circuits a re-submit before
--      any write. Uncrewed digs pay tickles too (§1.7 / §2). `things` keeps
--      the client's order (was array_agg(DISTINCT) — sorted).
--
-- Authored for review; do not push without Brian's explicit go.

-- ── 1. The find table: odds + tickles per kind ───────────────────────────────
UPDATE public.app_settings SET
	value = '{
		"truffle_d":  {"tickles": 10},
		"boom":       {"tickles": 3},
		"pouch":      {"odds": [1, 2],  "tickles": 5},
		"apple":      {"odds": [1, 3],  "tickles": 4},
		"junk":       {"tickles": 3},
		"truffle_l":  {"tickles": 15},
		"shimmer":    {"odds": [1, 2],  "tickles": 8},
		"acorn":      {"odds": [1, 2],  "tickles": 12},
		"tea":        {"odds": [1, 3],  "tickles": 8},
		"scroll":     {"odds": [1, 3],  "tickles": 10},
		"relic":      {"odds": [2, 5],  "tickles": 15},
		"furnishing": {"odds": [1, 4],  "tickles": 20},
		"bow":        {"odds": [1, 12], "tickles": 25},
		"charm":      {"odds": [1, 3],  "tickles": 12},
		"stone":      {"tickles": 0}
	}'::jsonb,
	description = 'Snout Deep finds (spec §2): per kind, `odds` as an "n in d" pair (absent = always present) and `tickles` = the applied tickles the find pays on the receipt (the Boom''s 3 is the base; the catch-up gap is added by _dig_boom_tickles). constants/dig.ts DIG_FINDS / DIG_FIND_TICKLES are the compiled fallbacks.'
WHERE key = 'dig_finds';
-- A database that never seeded the row (the harness stub chain does through
-- 20260913060000; production does too) still gets it.
INSERT INTO public.app_settings (key, value, description)
SELECT 'dig_finds', '{}'::jsonb, ''
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'dig_finds');

-- ── 2. apply_tickles — the applied-tickles rule, named ───────────────────────
-- The 20260812010000 rule verbatim: tickles_earned (the count, the
-- leaderboard, every trigger that hangs off it) and counter (the snouts a
-- tickle also pays), never the spendable bank. Returns the new count.
CREATE OR REPLACE FUNCTION public.apply_tickles(p_user uuid, p_n int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	after int;
BEGIN
	IF p_n IS NULL OR p_n <= 0 THEN
		SELECT COALESCE(tickles_earned, 0) INTO after FROM public.profiles WHERE id = p_user;
		RETURN COALESCE(after, 0);
	END IF;
	UPDATE public.profiles
	SET tickles_earned = COALESCE(tickles_earned, 0) + p_n,
	    counter = COALESCE(counter, 0) + p_n
	WHERE id = p_user
	RETURNING tickles_earned INTO after;
	RETURN COALESCE(after, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.apply_tickles(uuid, int) FROM PUBLIC, anon, authenticated;

-- ── 3. The Boom's amount: 3 + the catch-up gap ───────────────────────────────
-- boom(H) = 0.6 · H_day / F (§4). Until the catch-up cycles ship the gap is 0
-- and a Boom is its base (§10 "Boom size when H = 0: 3 tickles").
CREATE OR REPLACE FUNCTION public._dig_boom_tickles(p_user uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((value -> 'boom' ->> 'tickles')::int, 3)
	FROM public.app_settings WHERE key = 'dig_finds';
$function$;
REVOKE ALL ON FUNCTION public._dig_boom_tickles(uuid) FROM PUBLIC, anon, authenticated;

-- The tickles one find kind pays, by the table; a Boom through its own rule.
CREATE OR REPLACE FUNCTION public._dig_find_tickles(p_user uuid, p_kind text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE
		WHEN p_kind = 'boom' THEN public._dig_boom_tickles(p_user)
		ELSE COALESCE(
			(SELECT (value -> p_kind ->> 'tickles')::int
			 FROM public.app_settings WHERE key = 'dig_finds'), 0)
	END;
$function$;
REVOKE ALL ON FUNCTION public._dig_find_tickles(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── 4. _submit_rooting_deep_core — CARRIED from 20260913060000 + the tally ──
CREATE OR REPLACE FUNCTION public._submit_rooting_deep_core(
	p_user_id uuid, p_window_index bigint, p_actions text[], p_layer smallint,
	p_finds text[], p_missed text[], p_things text[], p_close boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v_now       timestamptz := public._patch_now();
	prior       jsonb;
	row_r       record;
	crewed      boolean;
	log         text[] := COALESCE(p_actions, ARRAY[]::text[]);
	n           int;
	i           int;
	e           text;
	lyr         int;
	verb        text;
	last_layer  int := 0;
	seen        text[] := ARRAY[]::text[];
	draws       int[];
	thr         int;
	v_woke        boolean := false;
	v_woke_on     text := NULL;
	woke_layer  int := NULL;
	tied_layer  int;
	end_reason  text;
	valid       text[];
	claimed     text[] := ARRAY[]::text[];
	f           text;
	k           text;
	lost        text := NULL;           -- the truffle he took on a wake
	lost_id     text := NULL;           -- as the client named it
	missed_clean text[] := ARRAY[]::text[];
	m           text;
	things_clean text[];
	-- crewed economy (carried from _submit_rooting_reward_v1)
	prior_cnt   int := 0;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[] := ARRAY[]::text[];
	n_credited  int := 0;
	drain_total bigint := NULL;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
	v_cycle     text;
	the_carry   record;
	carry_gild  int := 0;
	carry_caught jsonb := NULL;
	carry_next  jsonb := NULL;
	best_miss   text;
	new_gild    int;
	-- the tally (2026-09-13): every find's tickles, applied once
	tickle_rows   jsonb := '[]'::jsonb;
	tickle_total  int := 0;
	tickled_before int := 0;
	tickled_now   int := 0;
	find_id     text;
	find_kind   text;
	find_tix    int;
	result      jsonb;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_window_index::text,0));
	SELECT receipt INTO prior FROM public.rooting_receipts
		WHERE user_id = p_user_id AND window_index = p_window_index;
	IF prior IS NOT NULL THEN RETURN prior; END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = p_user_id AND window_index = p_window_index FOR UPDATE;
	IF row_r.user_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.mode <> 'snout_deep' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'wrong_mode');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;
	crewed := row_r.crew_id IS NOT NULL;

	-- ── validate the log (pre-write: a bad log rejects with no side effects) ──
	n := COALESCE(array_length(log, 1), 0);
	IF n > 45 OR p_layer IS NULL OR p_layer < 0 OR p_layer > 2 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
	END IF;
	FOR i IN 1..n LOOP
		e := log[i];
		IF e IS NULL OR e !~ '^[srh][0-2]:([0-9]|[12][0-9])$' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
		END IF;
		lyr := substr(e, 2, 1)::int;
		IF lyr < last_layer THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
		END IF;
		last_layer := lyr;
		IF substr(e, 1, 1) = 's' THEN
			k := substr(e, 2);   -- "2:14" — one sniff per (layer, tile)
			IF k = ANY (seen) THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
			END IF;
			seen := seen || k;
		END IF;
	END LOOP;
	IF p_layer < last_layer THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
	END IF;

	-- ── replay the wake stream: the k-th entry takes the k-th draw ────────────
	IF n > 0 THEN
		draws := public._snout_deep_wake_draws(row_r.seed, n);
		FOR i IN 1..n LOOP
			e := log[i];
			lyr := substr(e, 2, 1)::int;
			verb := substr(e, 1, 1);
			thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open);
			IF draws[i] < thr THEN
				v_woke := true;
				v_woke_on := e;
				woke_layer := lyr;
				log := log[1:i];   -- the waking action is IN the log; nothing after it
				n := i;
				EXIT;
			END IF;
		END LOOP;
	END IF;
	tied_layer := CASE WHEN v_woke THEN woke_layer ELSE p_layer::int END;
	end_reason := CASE WHEN v_woke THEN 'wake' WHEN p_close THEN 'close' ELSE 'tie' END;

	-- ── finds: the banked truffles, checked against the board's parity set ────
	valid := public.rooting_finds(row_r.seed);
	FOREACH f IN ARRAY COALESCE(p_finds, ARRAY[]::text[]) LOOP
		k := regexp_replace(f, '^l[0-2]:', '');
		IF k NOT IN ('truffle_d', 'truffle_l') OR NOT (k = ANY (valid)) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		-- A layer's truffle can only have banked once the dig reached that layer.
		IF k = 'truffle_l' AND tied_layer < 1 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF NOT (k = ANY (claimed)) THEN claimed := claimed || k; END IF;
	END LOOP;
	-- A wake takes the CURRENT layer's loose truffle: not credited, carried gilded.
	IF v_woke THEN
		k := CASE woke_layer WHEN 0 THEN 'truffle_d' WHEN 1 THEN 'truffle_l' ELSE NULL END;
		IF k IS NOT NULL AND k = ANY (claimed) THEN
			claimed := array_remove(claimed, k);
			lost := k;
		END IF;
	END IF;
	-- p_missed: truffles only, never something that was banked (carried def's rule).
	FOREACH m IN ARRAY COALESCE(p_missed, ARRAY[]::text[])
		|| CASE WHEN lost IS NULL THEN ARRAY[]::text[] ELSE ARRAY[lost] END LOOP
		k := regexp_replace(m, '^l[0-2]:', '');
		IF k IN ('truffle_l', 'truffle_d') AND NOT (k = ANY (claimed))
		   AND NOT (k = ANY (missed_clean)) THEN
			missed_clean := missed_clean || k;
		END IF;
	END LOOP;
	-- Things: recorded on the receipt (paid through their own paths in a later
	-- pass). Sanitised to board-shaped ids, in the order the client sent them
	-- (the order they surfaced — the tally lands them in that order).
	SELECT COALESCE(array_agg(x ORDER BY ord), ARRAY[]::text[]) INTO things_clean
		FROM (
			SELECT DISTINCT ON (x) x, ord
			FROM unnest(COALESCE(p_things, ARRAY[]::text[])) WITH ORDINALITY AS u(x, ord)
			WHERE x ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$'
			ORDER BY x, ord
		) AS firsts;

	-- The caller's carry slot BEFORE this dig (drives the catch/keep decision).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = p_user_id;

	IF crewed THEN
		SELECT count(*) INTO prior_cnt FROM public.war_rootings
			WHERE crew_id = row_r.crew_id AND window_index = p_window_index
			  AND user_id <> p_user_id AND submitted_at IS NOT NULL;
		blessed := EXISTS (SELECT 1 FROM public.blessings
			WHERE receiver_id = p_user_id AND cleared_at IS NULL AND expires_at > v_now);

		-- Mints by layers banked (spec §4): 'dig' for the topsoil truffle,
		-- 'dig_deep' for the mud's, 'dig_root' when the mud truffle banked AND
		-- the dig tied at the root (the root has no truffle of its own).
		IF 'truffle_d' = ANY (claimed) THEN
			minted := minted + public.mint_truffles(p_user_id, 1, 'dig', NULL);
		END IF;
		IF 'truffle_l' = ANY (claimed) THEN
			minted := minted + public.mint_truffles(p_user_id, 1, 'dig_deep', NULL);
		END IF;
		IF 'truffle_l' = ANY (claimed) AND tied_layer = 2 AND NOT v_woke THEN
			minted := minted + public.mint_truffles(p_user_id, 1, 'dig_root', NULL);
		END IF;
		-- Sounder Bonus + blessed dig: as the classic submit — a dig that banked
		-- a truffle gets +1 'dig_echo' when a crewmate submitted first, and +1
		-- 'blessed_dig' under an active blessing.
		IF array_length(claimed, 1) >= 1 THEN
			IF prior_cnt >= 1 THEN
				minted := minted + public.mint_truffles(p_user_id, 1, 'dig_echo', NULL);
				my_echo := true;
			END IF;
			IF blessed THEN
				minted := minted + public.mint_truffles(p_user_id, 1, 'blessed_dig', NULL);
			END IF;
		END IF;

		-- Pay back the earlier crewmates (either order): every submitted,
		-- minting, not-yet-echoed row in the crew this window.
		FOR r IN SELECT user_id FROM public.war_rootings
			WHERE crew_id = row_r.crew_id AND window_index = p_window_index
			  AND user_id <> p_user_id AND submitted_at IS NOT NULL
			  AND echo_credited = false AND truffles_minted >= 1
		LOOP
			PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
			UPDATE public.war_rootings SET echo_credited = true,
				truffles_minted = truffles_minted + 1
				WHERE user_id = r.user_id AND window_index = p_window_index;
			BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;

		IF minted > 0 THEN
			BEGIN PERFORM public.try_claim_achievements(p_user_id, 'truffles_dug');
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END IF;

		n_credited := COALESCE(array_length(claimed, 1), 0);   -- truffles only
	END IF;

	-- ── THE ONE THAT GOT AWAY — carry resolution (truffles; both modes) ───────
	-- (1) CAUGHT: a carried truffle is caught when either truffle banked this
	--     dig; its gild pays extra drain (crewed) and the slot clears.
	IF the_carry.kind IS NOT NULL THEN
		IF the_carry.kind IN ('truffle_l', 'truffle_d')
			AND ('truffle_l' = ANY (claimed) OR 'truffle_d' = ANY (claimed)) THEN
			carry_gild := the_carry.gild;
			DELETE FROM public.user_patch_carry WHERE user_id = p_user_id;
			carry_caught := jsonb_build_object('kind', the_carry.kind, 'gild', the_carry.gild);
		END IF;
	END IF;
	-- (2) NEXT: the best new miss (the fat one beats the domino) takes an
	--     empty slot at gild 1, or bumps a same-kind slot (cap 3).
	IF array_length(missed_clean, 1) IS NOT NULL THEN
		IF 'truffle_l' = ANY (missed_clean) THEN best_miss := 'truffle_l';
		ELSIF 'truffle_d' = ANY (missed_clean) THEN best_miss := 'truffle_d';
		END IF;
		IF best_miss IS NOT NULL THEN
			SELECT kind, unique_id, gild INTO the_carry
				FROM public.user_patch_carry WHERE user_id = p_user_id;
			IF the_carry.kind IS NULL THEN
				INSERT INTO public.user_patch_carry (user_id, kind, unique_id, gild, updated_at)
					VALUES (p_user_id, best_miss, NULL, 1, v_now);
				carry_next := jsonb_build_object('kind', best_miss, 'gild', 1);
			ELSIF the_carry.kind = best_miss THEN
				new_gild := LEAST(3, the_carry.gild + 1);
				UPDATE public.user_patch_carry
					SET gild = new_gild, unique_id = NULL, updated_at = v_now
					WHERE user_id = p_user_id;
				carry_next := jsonb_build_object('kind', best_miss, 'gild', new_gild);
			END IF;
		END IF;
	END IF;

	IF crewed THEN
		SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
			FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
			WHERE r2.crew_id = row_r.crew_id AND r2.window_index = p_window_index
			  AND r2.user_id <> p_user_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

		-- ── DRAIN + RACE ATTRIBUTION (crewed only; truffles are the herd's) ───
		UPDATE public.hunger_drain SET total = total + n_credited + carry_gild WHERE id = true
			RETURNING total INTO drain_total;
		SELECT rc.cycle_key INTO v_cycle FROM public.race_cycle_at(v_now) rc;
		INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
			VALUES (v_cycle, p_user_id, p_window_index, row_r.crew_id, n_credited)
			ON CONFLICT (cycle_key, user_id, window_index)
			DO UPDATE SET finds = public.race_digs.finds + EXCLUDED.finds;

		SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = row_r.crew_id FOR UPDATE;
		old_life := COALESCE(old_life, 0);
		new_life := old_life + n_credited;
		UPDATE public.crews SET lifetime_finds = new_life WHERE id = row_r.crew_id;

		FOR t IN SELECT * FROM (VALUES
			(150,  'mud_champion', 200,  'Root Rustler'),
			(600,  'mud_veteran',  1000, 'Truffle Baron'),
			(1800, 'mud_legend',   2000, 'Hunger''s Bane')
		) AS v(thresh, title_id, purse, title_name)
		LOOP
			IF old_life < t.thresh AND new_life >= t.thresh THEN
				INSERT INTO public.crew_milestones (crew_id, threshold)
					VALUES (row_r.crew_id, t.thresh) ON CONFLICT DO NOTHING;
				GET DIAGNOSTICS landed = ROW_COUNT;
				IF landed > 0 THEN
					FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = row_r.crew_id LOOP
						INSERT INTO public.user_titles (user_id, title_id)
							VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
						UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
						BEGIN
							INSERT INTO public.system_announcements (user_id, kind, title, body, data)
							VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
								'Your Sounder has rooted ' || t.thresh ||
								' truffles out from under the Great Hungerer. The title "' ||
								t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
								jsonb_build_object('crew_id', row_r.crew_id, 'threshold', t.thresh, 'title_id', t.title_id));
						EXCEPTION WHEN OTHERS THEN NULL; END;
					END LOOP;
					milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
				END IF;
			END IF;
		END LOOP;
	END IF;

	-- ── THE TALLY — every find pays tickles (§2), both modes ─────────────────
	-- One row per find in the order they surfaced: the truffle he took (0 —
	-- it reads "his"), the banked truffles, then every thing. The sum lands
	-- through apply_tickles: the count and the snouts, never the bank (§4).
	SELECT COALESCE(tickles_earned, 0) INTO tickled_before
		FROM public.profiles WHERE id = p_user_id;
	tickled_before := COALESCE(tickled_before, 0);
	IF lost IS NOT NULL THEN
		SELECT x INTO lost_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = lost LIMIT 1;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(lost_id, lost), 'kind', lost, 'tickles', 0, 'lost', true);
	END IF;
	FOREACH find_kind IN ARRAY claimed LOOP
		SELECT x INTO find_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = find_kind LIMIT 1;
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(find_id, find_kind), 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	FOREACH find_id IN ARRAY things_clean LOOP
		-- "l1:acorn" → acorn · "l0:stone:2" → stone (never sent, pays 0 anyway)
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', find_id, 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	tickled_now := public.apply_tickles(p_user_id, tickle_total);

	UPDATE public.war_rootings SET
		submitted_at    = v_now,
		finds           = claimed,
		actions         = n,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited,
		action_log      = log,
		layer_tied      = tied_layer,
		woke            = v_woke,
		woke_on         = v_woke_on
		WHERE user_id = p_user_id AND window_index = p_window_index;

	-- +20 Pass XP on every submitted dig, tied or woken, crewed or not.
	PERFORM public.grant_season_xp(p_user_id, 20);

	result := jsonb_build_object(
		'ok',           true,
		'mode',         'snout_deep',
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'echo',         my_echo,
		'blessed',      blessed,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', NULL,
		'carry_caught', carry_caught,
		'carry_next',   carry_next,
		'layer_tied',   tied_layer,
		'woke',         v_woke,
		'woke_on',      v_woke_on,
		'things',       things_clean,
		'actions',      n,
		'end_reason',   end_reason,
		'uncrewed',     NOT crewed,
		'closed',       p_close,
		-- the tally (2026-09-13)
		'tickles',        tickle_rows,
		'tickles_total',  tickle_total,
		'tickled_before', tickled_before,
		'tickled_now',    tickled_now);
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt)
		VALUES (p_user_id, p_window_index, result)
		ON CONFLICT (user_id, window_index) DO NOTHING;
	SELECT receipt INTO result FROM public.rooting_receipts
		WHERE user_id = p_user_id AND window_index = p_window_index;
	RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public._submit_rooting_deep_core(uuid, bigint, text[], smallint, text[], text[], text[], boolean)
	FROM PUBLIC, anon, authenticated;
