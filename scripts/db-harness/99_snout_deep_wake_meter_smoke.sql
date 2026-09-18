-- 99 — the deterministic wake meter, rules v2
-- (20260917180000_snout_deep_attention_rules.sql). The two stamps, the tuning
-- row and its sanitiser, and string checks on the core's prosrc (as 98 does):
-- the T formula, the entry draw BEFORE the first action, the compare AFTER the
-- add, the scope reset, the dig_root gate and the receipt's keys. The 3- and
-- 4-arg thresholds a rules-1 row still replays with must come out untouched —
-- under rule 2 the 4-arg one IS the loudness, so a drift breaks both rules.
\echo chk 99 snout deep wake meter
DO $$
DECLARE
	body text := (SELECT prosrc FROM pg_proc WHERE proname = '_submit_rooting_deep_core');
	opn  text;
	tix  jsonb := (SELECT value FROM public.app_settings WHERE key = 'dig_finds');
	wm   jsonb;
	keep jsonb;
BEGIN
	IF (SELECT count(*) FROM pg_proc WHERE proname = '_submit_rooting_deep_core') <> 1 THEN
		RAISE EXCEPTION 'expected one core'; END IF;

	-- ── the stamps on the row ────────────────────────────────────────────────
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'war_rootings' AND column_name = 'rules'
		  AND is_nullable = 'NO' AND column_default LIKE '1%') THEN
		RAISE EXCEPTION 'war_rootings.rules is not NOT NULL DEFAULT 1'; END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint
		WHERE conname = 'war_rootings_rules_chk' AND contype = 'c') THEN
		RAISE EXCEPTION 'war_rootings.rules has no CHECK'; END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'war_rootings' AND column_name = 'wake_meter'
		  AND data_type = 'jsonb' AND is_nullable = 'YES') THEN
		RAISE EXCEPTION 'war_rootings.wake_meter is not a nullable jsonb'; END IF;
	-- both stamps are documented (a future carry reads the comment first)
	IF col_description('public.war_rootings'::regclass, (SELECT attnum FROM pg_attribute
		WHERE attrelid = 'public.war_rootings'::regclass AND attname = 'wake_meter')) IS NULL THEN
		RAISE EXCEPTION 'war_rootings.wake_meter has no column comment'; END IF;
	-- and the CHECK names both rule sets, nothing else
	IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'war_rootings_rules_chk')
		NOT LIKE '%rules = ANY (ARRAY[1, 2])%' THEN
		RAISE EXCEPTION 'the rules CHECK is not (1, 2): %',
			(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'war_rootings_rules_chk'); END IF;

	-- ── the config + its reader ──────────────────────────────────────────────
	IF public._snout_deep_rules() <> 2 THEN
		RAISE EXCEPTION 'snout_deep_rules is %, want 2', public._snout_deep_rules(); END IF;

	-- ── the tuning row and its defaults (MIRROR: constants/dig.ts WAKE_METER) ─
	SELECT value INTO keep FROM public.app_settings WHERE key = 'snout_deep_wake_meter';
	IF keep IS NULL THEN RAISE EXCEPTION 'the wake-meter tuning row is missing'; END IF;
	IF keep <> '{"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0}'::jsonb THEN
		RAISE EXCEPTION 'the wake-meter tuning row drifted: %', keep; END IF;
	wm := public._snout_deep_wake_meter();
	IF (wm ->> 'lo')::int <> 50 OR (wm ->> 'hi')::int <> 110
	OR (wm ->> 'scope') <> 'board' OR (wm ->> 'dig_root_gt')::int <> 0 THEN
		RAISE EXCEPTION 'the wake meter reads %, want 50/110/board/0', wm; END IF;

	-- ── the sanitiser: a garbled row never judges a dig ──────────────────────
	-- nonsense in every field → the compiled defaults
	UPDATE public.app_settings
		SET value = '{"lo": "deep", "hi": null, "scope": "sideways", "dig_root_gt": "yes"}'::jsonb
		WHERE key = 'snout_deep_wake_meter';
	wm := public._snout_deep_wake_meter();
	IF wm <> '{"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0}'::jsonb THEN
		RAISE EXCEPTION 'garbage did not fall back to the defaults: %', wm; END IF;
	-- out of range → each end pulled into [1, 120]; dig_root_gt is 1 only when
	-- the row says exactly 1, and scope 'dig' is the one alternative there is.
	UPDATE public.app_settings
		SET value = '{"lo": 0, "hi": 999, "scope": "dig", "dig_root_gt": 1}'::jsonb
		WHERE key = 'snout_deep_wake_meter';
	wm := public._snout_deep_wake_meter();
	IF wm <> '{"lo": 1, "hi": 120, "scope": "dig", "dig_root_gt": 1}'::jsonb THEN
		RAISE EXCEPTION 'the clamp let a bad band through: %', wm; END IF;
	UPDATE public.app_settings
		SET value = '{"lo": 40, "hi": 80, "scope": "board", "dig_root_gt": 7}'::jsonb
		WHERE key = 'snout_deep_wake_meter';
	wm := public._snout_deep_wake_meter();
	IF wm <> '{"lo": 40, "hi": 80, "scope": "board", "dig_root_gt": 0}'::jsonb THEN
		RAISE EXCEPTION 'the tighter band or the gt flag drifted: %', wm; END IF;
	-- a band that is not a band FALLS BACK rather than inventing one (the
	-- kernel's sanitizeWakeMeter does exactly this).
	UPDATE public.app_settings
		SET value = '{"lo": 200, "hi": 5}'::jsonb WHERE key = 'snout_deep_wake_meter';
	wm := public._snout_deep_wake_meter();
	IF (wm ->> 'lo')::int <> 50 OR (wm ->> 'hi')::int <> 110
	OR (wm ->> 'scope') <> 'board' OR (wm ->> 'dig_root_gt')::int <> 0 THEN
		RAISE EXCEPTION 'an inverted band did not fall back: %', wm; END IF;
	UPDATE public.app_settings
		SET value = '{"lo": 70, "hi": 70}'::jsonb WHERE key = 'snout_deep_wake_meter';
	IF (public._snout_deep_wake_meter() ->> 'lo')::int <> 50 THEN
		RAISE EXCEPTION 'a zero-width band did not fall back: %', public._snout_deep_wake_meter(); END IF;
	-- an empty row is the defaults too
	UPDATE public.app_settings SET value = '{}'::jsonb WHERE key = 'snout_deep_wake_meter';
	IF public._snout_deep_wake_meter() <> '{"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0}'::jsonb THEN
		RAISE EXCEPTION 'an empty row did not fall back: %', public._snout_deep_wake_meter(); END IF;
	-- … and the row goes back exactly as the migration left it.
	UPDATE public.app_settings SET value = keep WHERE key = 'snout_deep_wake_meter';
	IF public._snout_deep_wake_meter() <> keep THEN
		RAISE EXCEPTION 'the tuning row was not restored: %', public._snout_deep_wake_meter(); END IF;

	-- ── rule 1 is untouched: the 3-arg base and the 4-arg budget overload ────
	-- Under rule 2 the 4-arg one IS the loudness (§1), so these are both rules'
	-- numbers now: topsoil 0/1/10, mud 3/6/20, root 7/15/40, co-op floor + 1.
	IF public._snout_deep_wake_threshold(0,'s',false,5) <> 1
	OR public._snout_deep_wake_threshold(1,'s',false,0) <> 3
	OR public._snout_deep_wake_threshold(2,'s',false,7) <> 10
	OR public._snout_deep_wake_threshold(2,'s',true,5) <> 5
	OR public._snout_deep_wake_threshold(0,'r',false,0) <> 1
	OR public._snout_deep_wake_threshold(1,'h',false,0) <> 20
	OR public._snout_deep_wake_threshold(2,'r',true) <> 8
	OR public._snout_deep_wake_threshold(2,'h',false) <> 40 THEN
		RAISE EXCEPTION 'the wake table drifted with the carry'; END IF;
	-- the roll variant's loudness helper is GONE (rule 2 has no table of its own)
	IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_snout_deep_loudness') THEN
		RAISE EXCEPTION 'the roll variant''s _snout_deep_loudness is still defined'; END IF;

	-- ── the core's rules-2 lines ─────────────────────────────────────────────
	IF position('IF row_r.rules >= 2 THEN' IN body) = 0 THEN
		RAISE EXCEPTION 'the core has no rules branch'; END IF;
	-- the stream is asked for three board entries beyond the log
	IF position('draws := public._snout_deep_wake_draws(row_r.seed, n + 3);' IN body) = 0 THEN
		RAISE EXCEPTION 'the core does not ask for the entry draws'; END IF;
	-- T = lo + floor(draw * (hi - lo + 1) / 120), twice: the open and the descent
	IF (length(body) - length(replace(body,
		'sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);', ''))) /
		length('sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);') <> 2 THEN
		RAISE EXCEPTION 'the T formula is not drawn at the open AND at each descent'; END IF;
	-- topsoil's T is drawn after the stream is asked for and BEFORE the loop
	-- ever reaches an action (the sniff reset is the loop's first line).
	IF position('draws := public._snout_deep_wake_draws(row_r.seed, n + 3);' IN body)
		> position('sleep_depth := m_lo' IN body)
	OR position('sleep_depth := m_lo' IN body)
		> position('IF lyr <> sniff_layer THEN' IN body) THEN
		RAISE EXCEPTION 'topsoil''s T is not drawn before the first action'; END IF;
	-- one draw per layer ENTERED, and the meter starts again on the new board
	IF position('IF row_r.rules >= 2 AND m_scope = ''board'' THEN' IN body) = 0
	OR position('WHILE board_layer < lyr LOOP' IN body) = 0
	OR position('board_layer := board_layer + 1;' IN body) = 0
	OR position('attention := 0;' IN body) = 0 THEN
		RAISE EXCEPTION 'the per-board entry draw / reset is missing'; END IF;
	-- every action consumes a draw too (the k-th action, the k-th draw after it)
	IF position('IF row_r.rules >= 2 THEN di := di + 1; END IF;' IN body) = 0 THEN
		RAISE EXCEPTION 'an action does not advance the stream'; END IF;
	-- the loudness lands, THEN the compare — no roll on this branch
	IF position('attention := attention + thr;' IN body) = 0
	OR position('IF attention >= sleep_depth THEN' IN body) = 0 THEN
		RAISE EXCEPTION 'the core does not compare the meter against T'; END IF;
	IF position('attention := attention + thr;' IN body)
		> position('IF attention >= sleep_depth THEN' IN body) THEN
		RAISE EXCEPTION 'the compare happens before the add'; END IF;
	-- the stamp, never today's config
	IF position('wm      := COALESCE(row_r.wake_meter, public._snout_deep_wake_meter());' IN body) = 0 THEN
		RAISE EXCEPTION 'the core does not replay under the row''s own stamp'; END IF;
	-- rule 1's line survived the carry, unchanged, on its own branch …
	IF position('thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);' IN body) = 0
	OR position('ELSIF draws[i] < thr THEN' IN body) = 0 THEN
		RAISE EXCEPTION 'rule 1 lost its roll'; END IF;
	-- … and so did the per-board sniff reset, still before the threshold read.
	IF position('IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;' IN body) = 0 THEN
		RAISE EXCEPTION 'the per-board sniff reset did not survive the carry'; END IF;
	IF position('IF lyr <> sniff_layer THEN' IN body)
		> position('thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);' IN body) THEN
		RAISE EXCEPTION 'the reset comes after the threshold read'; END IF;
	-- the root tie's +1 is gated by the stamp under rule 2 only
	IF position('IF row_r.rules < 2 OR COALESCE((row_r.wake_meter ->> ''dig_root_gt'')::int, 1) = 1 THEN' IN body) = 0 THEN
		RAISE EXCEPTION 'dig_root is not gated by the stamp'; END IF;
	IF position('''dig_root'', NULL' IN body) = 0
	OR position('IF ''truffle_l'' = ANY (claimed) AND tied_layer = 2 AND NOT v_woke THEN' IN body) = 0 THEN
		RAISE EXCEPTION 'dig_root stopped minting altogether'; END IF;
	-- the meter and his depth ride the receipt
	IF position('''attention'',      attention,' IN body) = 0
	OR position('''sleep_depth'',    sleep_depth,' IN body) = 0 THEN
		RAISE EXCEPTION 'the receipt does not carry the meter and T'; END IF;

	-- ── open_rooting: the overload exists beside the zero-arg, and stamps ────
	IF (SELECT count(*) FROM pg_proc WHERE proname = 'open_rooting') <> 2 THEN
		RAISE EXCEPTION 'expected two open_rooting defs, found %',
			(SELECT count(*) FROM pg_proc WHERE proname = 'open_rooting'); END IF;
	SELECT prosrc INTO opn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE p.proname = 'open_rooting' AND n.nspname = 'public' AND p.pronargs = 1
		  AND pg_get_function_identity_arguments(p.oid) LIKE '%smallint%';
	IF opn IS NULL THEN RAISE EXCEPTION 'no open_rooting(smallint) overload'; END IF;
	IF position('the_rules := LEAST(GREATEST(COALESCE(p_rules, 1)::int, 1), public._snout_deep_rules())::smallint;' IN opn) = 0 THEN
		RAISE EXCEPTION 'the overload does not stamp the rules'; END IF;
	IF position('the_meter := CASE WHEN the_rules >= 2 THEN public._snout_deep_wake_meter() ELSE NULL END;' IN opn) = 0 THEN
		RAISE EXCEPTION 'the overload does not stamp the wake meter at rule 2'; END IF;
	IF position('rules, wake_meter)' IN opn) = 0
	OR position('the_rules, the_meter);' IN opn) = 0 THEN
		RAISE EXCEPTION 'the overload does not write both stamps'; END IF;
	IF position('''rules'', the_rules,' IN opn) = 0
	OR position('''wake_meter'', the_meter,' IN opn) = 0
	OR position('''rules'', COALESCE(existing.rules, 1),' IN opn) = 0
	OR position('''wake_meter'', existing.wake_meter,' IN opn) = 0 THEN
		RAISE EXCEPTION 'the overload does not return both stamps on both paths'; END IF;
	-- the zero-arg stays rule 1 (it never names rules at all)
	IF strpos((SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE p.proname = 'open_rooting' AND n.nspname = 'public' AND p.pronargs = 0), 'rules') <> 0 THEN
		RAISE EXCEPTION 'the zero-arg open_rooting was touched'; END IF;

	-- ── deeper pays more (§3), merged — the odds are still there ─────────────
	IF (tix -> 'relic' ->> 'tickles')::int <> 25
	OR (tix -> 'truffle_l' ->> 'tickles')::int <> 20
	OR (tix -> 'bow' ->> 'tickles')::int <> 40
	OR (tix -> 'furnishing' ->> 'tickles')::int <> 30
	OR (tix -> 'charm' ->> 'tickles')::int <> 20
	OR (tix -> 'scroll' ->> 'tickles')::int <> 12
	OR (tix -> 'tea' ->> 'tickles')::int <> 10
	OR (tix -> 'acorn' ->> 'tickles')::int <> 15
	OR (tix -> 'shimmer' ->> 'tickles')::int <> 10 THEN
		RAISE EXCEPTION 'the deeper purse did not land: %', tix; END IF;
	-- topsoil untouched, and the merge kept every other key on the row
	IF (tix -> 'truffle_d' ->> 'tickles')::int <> 10
	OR (tix -> 'pouch' ->> 'tickles')::int <> 5
	OR (tix -> 'boom' ->> 'tickles')::int <> 3
	OR (tix -> 'relic' -> 'odds') <> '[2, 5]'::jsonb
	OR (tix -> 'bow' -> 'odds') <> '[1, 12]'::jsonb THEN
		RAISE EXCEPTION 'the merge replaced the row: %', tix; END IF;
	IF public._dig_find_tickles(NULL, 'relic') <> 25 THEN
		RAISE EXCEPTION 'the find-tickles reader disagrees: %', public._dig_find_tickles(NULL, 'relic'); END IF;

	RAISE NOTICE 'chk 99 ok: the meter, both stamps, the sanitiser, the overload, rule 1 untouched, deeper pays more';
END $$;
