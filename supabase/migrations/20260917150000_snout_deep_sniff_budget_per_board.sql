-- Snout Deep: the sniff budget is per BOARD, not per dig (founder,
-- 2026-09-17: "we should get some denominator back when we are moving from
-- one level to the new"). SKILL.md decision log 2026-09-17.
--
-- The rule: the first 5 sniffs on EACH layer roll at the table's odds; every
-- sniff past that adds +1 (in 120ths) per extra sniff, capped at the layer's
-- shove — unchanged from 20260917130000. What changes: descending wipes the
-- scent map, so the sniffs that read a board come back — the running sniff
-- count RESETS when the layer changes. Sniffs are counted per layer from the
-- action log (each entry carries its layer: "s1:14"), so client
-- (utils/snoutDeep.ts sniffCount(actions, layer), utils/rooting.ts
-- wakeThreshold / sniffAttention) and server count the same sniffs. Mirror:
-- constants/dig.ts SNIFF_FREE_PER_BOARD = 5, SNIFF_ATTENTION_STEP = 1 —
-- __tests__/snoutDeepServerParity.test.ts pins the budget, the step and the
-- reset line.
--
-- What lands here:
--   _submit_rooting_deep_core — CARRY-LATEST-DEF: body carried VERBATIM from
--   20260917130000_snout_deep_sniff_attention.sql (the latest definition;
--   the chain is 20260913060000 → 20260913120000 → 20260914090000 →
--   20260917130000) with ONE change: `sniff_layer` beside `prior_sniffs`,
--   and the count reset to 0 when the entry's layer differs. Nothing else in
--   the dig changes; the 4-arg threshold is untouched.
--
-- Open digs at push time: a row opened before this lands replays under the
-- new rule on submit — strictly kinder (a count only ever resets down), so
-- no dig that slept on the phone can wake on the server. A 192 client (per-
-- dig budget) sniffing past five on a deeper board rolls a louder sniff on
-- the phone than the server does; the server's kinder replay never
-- contradicts a phone-side sleep. Safe to push with digs open.
--
-- Migrations are WRITTEN, NOT PUSHED — never `db push` without the founder's
-- explicit "go".

-- ── The core submit — carried, the loop counts sniffs PER LAYER ─────────────────────
CREATE OR REPLACE FUNCTION public._submit_rooting_deep_core(
	p_user_id uuid, p_window_index bigint, p_actions text[], p_layer smallint,
	p_finds text[], p_missed text[], p_things text[], p_close boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	prior_sniffs int := 0;
	sniff_layer int := 0;   -- the layer prior_sniffs counts; reset on descent
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
	-- the loose pouch (2026-09-14)
	consumable_kinds text[] := ARRAY['boom','pouch','apple','shimmer','acorn','tea','scroll','charm'];
	collection_kinds text[] := ARRAY['junk','relic','furnishing','bow'];
	banked_things text[] := ARRAY[]::text[];   -- consumable ids the tie banked, client order
	lost_things   text[] := ARRAY[]::text[];   -- consumable ids lost with the pouch on a wake
	kept_things   text[] := ARRAY[]::text[];   -- collection ids, kept either way
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
			-- The sniff budget (20260917130000), per BOARD (20260917150000):
			-- the k-th sniff past the budget draws his attention. prior_sniffs
			-- counts THIS LAYER's sniffs BEFORE this entry, the way the
			-- client's sniffCount(actions, layer) does — it refills on descent.
			IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;
			thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);
			IF verb = 's' THEN prior_sniffs := prior_sniffs + 1; END IF;
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

	-- ── finds: the BANKED list — truffles against the board's parity set, ─────
	--    consumables by kind. Nothing banks without a tie: on a wake every
	--    consumable claimed is forced into the lost pouch (the loose pouch,
	--    2026-09-14), as the current layer's truffle is forced out below.
	valid := public.rooting_finds(row_r.seed);
	FOREACH f IN ARRAY COALESCE(p_finds, ARRAY[]::text[]) LOOP
		k := split_part(regexp_replace(f, '^l[0-2]:', ''), ':', 1);
		IF k IN ('truffle_d', 'truffle_l') THEN
			IF NOT (k = ANY (valid)) THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			-- A layer's truffle can only have banked once the dig reached that layer.
			IF k = 'truffle_l' AND tied_layer < 1 THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF NOT (k = ANY (claimed)) THEN claimed := claimed || k; END IF;
		ELSIF k = ANY (consumable_kinds) THEN
			-- Board-shaped ("l1:acorn" · "l0:boom"), from a layer the dig reached.
			IF f !~ '^l[0-2]:[a-z_]+(:[0-9]+)?$' THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF substr(f, 2, 1)::int > tied_layer THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF v_woke THEN
				IF NOT (f = ANY (lost_things)) THEN lost_things := lost_things || f; END IF;
			ELSIF NOT (f = ANY (banked_things)) THEN
				banked_things := banked_things || f;
			END IF;
		ELSE
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
	END LOOP;
	-- A wake takes the CURRENT layer's loose truffle: not credited, carried gilded.
	IF v_woke THEN
		k := CASE woke_layer WHEN 0 THEN 'truffle_d' WHEN 1 THEN 'truffle_l' ELSE NULL END;
		IF k IS NOT NULL AND k = ANY (claimed) THEN
			claimed := array_remove(claimed, k);
			lost := k;
		END IF;
	END IF;
	-- p_missed: truffles never something that was banked (carried def's rule);
	-- consumables only on a wake — the pouch he took (a tie banked everything
	-- loose, so a consumable missed on a tie is dropped).
	FOREACH m IN ARRAY COALESCE(p_missed, ARRAY[]::text[])
		|| CASE WHEN lost IS NULL THEN ARRAY[]::text[] ELSE ARRAY[lost] END LOOP
		k := split_part(regexp_replace(m, '^l[0-2]:', ''), ':', 1);
		IF k IN ('truffle_l', 'truffle_d') AND NOT (k = ANY (claimed))
		   AND NOT (k = ANY (missed_clean)) THEN
			missed_clean := missed_clean || k;
		ELSIF k = ANY (consumable_kinds) AND v_woke AND m ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$' THEN
			IF substr(m, 2, 1)::int <= tied_layer AND NOT (m = ANY (lost_things)) THEN
				lost_things := lost_things || m;
			END IF;
		END IF;
	END LOOP;
	-- Things: sanitised to board-shaped ids from a layer the dig reached, in
	-- the order the client sent them (the order they surfaced — the tally
	-- lands them in that order), deduped. Then sorted BY KIND, never by the
	-- list they arrived in: a collection thing is kept; a consumable joins the
	-- banked / lost lane; anything else is dropped.
	SELECT COALESCE(array_agg(x ORDER BY ord), ARRAY[]::text[]) INTO things_clean
		FROM (
			SELECT DISTINCT ON (x) x, ord
			FROM unnest(COALESCE(p_things, ARRAY[]::text[])) WITH ORDINALITY AS u(x, ord)
			WHERE x ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$'
			  AND CASE WHEN x ~ '^l[0-2]:' THEN substr(x, 2, 1)::int ELSE 9 END <= tied_layer
			ORDER BY x, ord
		) AS firsts;
	FOREACH f IN ARRAY things_clean LOOP
		k := split_part(regexp_replace(f, '^l[0-2]:', ''), ':', 1);
		IF k = ANY (collection_kinds) THEN
			IF NOT (f = ANY (kept_things)) THEN kept_things := kept_things || f; END IF;
		ELSIF k = ANY (consumable_kinds) THEN
			IF v_woke THEN
				IF NOT (f = ANY (lost_things)) THEN lost_things := lost_things || f; END IF;
			ELSIF NOT (f = ANY (banked_things)) THEN
				banked_things := banked_things || f;
			END IF;
		END IF;
	END LOOP;
	things_clean := kept_things;

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

	-- ── THE TALLY — every BANKED find pays tickles (§2), both modes ──────────
	-- Rows: the truffle he took (0 — it reads "his"), the consumables lost
	-- with the pouch (0 — they read "lost"), the banked truffles, the banked
	-- consumables, then the collection things — paid when the dig tied, kept
	-- at 0 when he woke (they read "kept"). The sum lands through
	-- apply_tickles: the count and the snouts, never the bank (§4).
	SELECT COALESCE(tickles_earned, 0) INTO tickled_before
		FROM public.profiles WHERE id = p_user_id;
	tickled_before := COALESCE(tickled_before, 0);
	IF lost IS NOT NULL THEN
		SELECT x INTO lost_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = lost LIMIT 1;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(lost_id, lost), 'kind', lost, 'tickles', 0, 'lost', true);
	END IF;
	FOREACH find_id IN ARRAY lost_things LOOP
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', find_id, 'kind', find_kind, 'tickles', 0, 'lost', true);
	END LOOP;
	FOREACH find_kind IN ARRAY claimed LOOP
		SELECT x INTO find_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = find_kind LIMIT 1;
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(find_id, find_kind), 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	FOREACH find_id IN ARRAY banked_things LOOP
		-- "l1:acorn" → acorn · "l0:boom" → boom (the catch-up's amount)
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', find_id, 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	FOREACH find_id IN ARRAY things_clean LOOP
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		IF v_woke THEN
			-- Kept — a Barn piece is a Barn piece — but its tickles rode the tie.
			tickle_rows := tickle_rows || jsonb_build_object(
				'id', find_id, 'kind', find_kind, 'tickles', 0, 'kept', true);
		ELSE
			find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
			tickle_total := tickle_total + find_tix;
			tickle_rows := tickle_rows || jsonb_build_object(
				'id', find_id, 'kind', find_kind, 'tickles', find_tix);
		END IF;
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
		'tickled_now',    tickled_now,
		-- the loose pouch (2026-09-14)
		'banked_things',  banked_things,
		'lost_things',    lost_things);
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
