-- Snout Deep: the wake meter, DETERMINISTIC — rules v2 (server half).
-- Contract: docs/design/2026-09-17-cumulative-attention.md (the reasoning and
-- the simulation live in docs/design/2026-09-17-wake-meter.md §2–§6). Founder
-- rulings, 2026-09-17, after a first-week player read build 192 right:
-- "there's no progress bar on the guy waking up so it's just random luck?"
-- He was. Under rule 1 every rub, shove and priced sniff was its own coin flip
-- against a fixed table — nothing carried, so a dig had no position to read and
-- "Tie it off" had no state behind it. The founder's amendment at 02:15 ET:
-- "change it to the deterministic version".
--
-- THE RULE (rules = 2). Every action adds its LOUDNESS to a meter; loudness is
-- the wake table exactly as it already stands (the 4-arg
-- _snout_deep_wake_threshold: topsoil 0/1/10, mud 3/6/20, root 7/15/40, the
-- co-op halving, the per-board budget of five free sniffs and +1 per extra).
-- His SLEEP DEPTH T is drawn when a board is ENTERED, uniform over the tuning
-- band: T = lo + floor(draw * (hi - lo + 1) / 120). He wakes on the action that
-- carries the meter to T or past it — attention >= T, evaluated AFTER the add.
-- No roll. Below lo is certain sleep (topsoil can never reach 50, so the
-- tutorial layer is truly safe); hi is a certain wake; the band between them is
-- the whole tension. THIS REPLACES the roll-against-the-meter variant that
-- 20260917180000 carried for forty-five minutes on 2026-09-17 — that file was
-- never pushed, so there is no migration to undo: rules = 2 now means THIS.
--
-- What lands here:
--   1. war_rootings.rules smallint NOT NULL DEFAULT 1, CHECK (1, 2) — the rule
--      set a row was OPENED with, and war_rootings.wake_meter jsonb — the
--      tuning that dig plays by (NULL on a rule-1 row). The replay judges a row
--      by its own stamp, never by today's config, so a retune never re-judges a
--      dig already under way.
--   2. app_settings.snout_deep_rules = {"rules": 2} + _snout_deep_rules() — the
--      newest rules the server hands out (a rollback is {"rules": 1}).
--   3. app_settings.snout_deep_wake_meter =
--      {"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0} +
--      _snout_deep_wake_meter(), which sanitises the row (1 <= lo < hi <= 120,
--      scope 'board'|'dig', dig_root_gt 0|1) and falls back to those defaults.
--      MIRROR: constants/dig.ts WAKE_METER — the parity test pins the four
--      values, so a drift fails loudly. scope 'board' resets the meter and
--      redraws T on every descent (the doc's recommendation and the default);
--      scope 'dig' draws one T at open and carries the meter all the way down.
--   4. open_rooting(p_rules smallint) — a NEW OVERLOAD. CARRY-LATEST-DEF: the
--      zero-arg body carried VERBATIM from 20260913060000_snout_deep.sql (the
--      latest def — nothing since redefines it) with TWO additions: it stamps
--      rules = LEAST(GREATEST(p_rules, 1), _snout_deep_rules()) and, when that
--      is 2, wake_meter = _snout_deep_wake_meter(); and it returns 'rules' and
--      'wake_meter' on both paths (an already-open row returns its OWN stamp; a
--      rule-1 row returns NULL). The zero-arg open_rooting() is left exactly as
--      it is: an old client opens at the column default, 1, and keeps rolling.
--   5. _submit_rooting_deep_core — CARRY-LATEST-DEF: body carried VERBATIM from
--      20260917150000_snout_deep_sniff_budget_per_board.sql (the chain is
--      20260913060000 -> 20260913120000 -> 20260914090000 -> 20260917130000 ->
--      20260917150000) with the meter lines added inside >>> rules 2 / <<< rules
--      2 markers and NOTHING else changed: the stream is asked for n + 3 draws
--      (three board entries at most), a board entry takes the next draw for its
--      T before the board's first action, each action consumes a draw too (so
--      the k-th action still meets the k-th draw and a descent's T lands where
--      the phone's did), and the wake is a compare after the add. Rule 1's
--      branch is its own line, untouched, to the letter. The receipt gains
--      'attention' (the meter as the dig left it) and 'sleep_depth' (the last
--      board's T), which the woke line reads as "pushed the root on a rub at 84
--      — this was the one."
--   6. 'dig_root' (the +1 for tying at the root with the mud's truffle banked)
--      is GATED on the stamp's dig_root_gt under rules 2 — default 0. Under a
--      per-board meter the descent is silent, so a tie on arrival at the root
--      would be a free +1 for walking downstairs (wake-meter doc §5.3). Rule-1
--      rows keep minting it exactly as they did.
--   7. app_settings.dig_finds — deeper pays more (§3). MERGED per kind (the row
--      also holds each kind's odds and every other key; never replace it).
--
-- ROLLOUT. Build 192 phones call the zero-arg open_rooting and replay rule 1 on
-- the phone; their rows stamp 1 and the server replays them under rule 1 —
-- byte-for-byte the behaviour they shipped with. A build 193 phone calls the
-- overload with p_rules = 2, the config hands back 2 and the tuning stamp, and
-- both halves run the same deterministic meter off the same stream. Rows opened
-- before this lands have rules = 1 by the column default and wake_meter NULL,
-- so an open dig at push time is safe.
--
-- ROLLBACK IS THE CONFIG ROWS, no code change and no redeploy:
--   * app_settings.snout_deep_rules -> '{"rules": 1}' — every NEW dig opens at
--     rule 1 (new clients included; they read back r.rules); digs already open
--     finish under the rules they were opened with.
--   * app_settings.snout_deep_wake_meter -> a different band / scope /
--     dig_root_gt — every NEW dig stamps the new tuning; open digs keep theirs.
--
-- Migrations are WRITTEN, NOT PUSHED — never `db push` without the founder's
-- explicit "go".

-- Numbered 20260917180000 (was 160000): another session pushed
-- 20260917170000_ghost_sheep_trader.sql first, and a migration must sort after
-- the latest applied. That file touches none of the dig objects (checked:
-- open_rooting, _submit_rooting_deep_core, war_rootings, the dig_finds row), so
-- the carry-latest-def base below (20260917150000) is still the latest.
-- ── 1. The stamps on the row: the rule set, and the tuning it plays by ───────
ALTER TABLE public.war_rootings
	ADD COLUMN IF NOT EXISTS rules smallint NOT NULL DEFAULT 1;
DO $$
BEGIN
	ALTER TABLE public.war_rootings ADD CONSTRAINT war_rootings_rules_chk CHECK (rules IN (1, 2));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.war_rootings.rules IS
	'The Snout Deep rule set this row was OPENED with (1 = a roll per action against the wake table, 2 = the deterministic wake meter). The submit replays by this stamp, never by today''s app_settings.snout_deep_rules.';

ALTER TABLE public.war_rootings
	ADD COLUMN IF NOT EXISTS wake_meter jsonb;
COMMENT ON COLUMN public.war_rootings.wake_meter IS
	'The wake-meter tuning this dig was OPENED with, stamped from app_settings.snout_deep_wake_meter: {lo, hi, scope, dig_root_gt}. NULL on a rules = 1 row, which has no meter. The replay reads the stamp, so a retune never re-judges a dig already under way.';

-- ── 2. The config: the newest rules the server hands out ─────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'snout_deep_rules', '{"rules": 2}'::jsonb,
	'Snout Deep rule set the server hands to a client that asks for it (docs/design/2026-09-17-cumulative-attention.md §2). 2 = the deterministic wake meter; set to {"rules": 1} to roll back — every NEW dig then opens at rule 1, and digs already open finish under their own stamp.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'snout_deep_rules');

CREATE OR REPLACE FUNCTION public._snout_deep_rules()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT (value ->> 'rules')::int FROM public.app_settings WHERE key = 'snout_deep_rules'),
		1);
$function$;
REVOKE ALL ON FUNCTION public._snout_deep_rules() FROM PUBLIC, anon, authenticated;

-- ── 3. The tuning: his sleep depth's band, the scope, the root-tie lever ─────
-- MIRROR of constants/dig.ts WAKE_METER. lo is where certain sleep ends, hi is
-- the certain wake; the band between them is the game (a fully determined
-- 120–120 is a puzzle, not a press-your-luck — wake-meter doc §5.5). scope
-- 'board' resets the meter and redraws T on every descent; 'dig' draws one T at
-- open and carries the meter down. dig_root_gt 1 restores the root tie's +1
-- Golden Truffle; 0 (the default, doc §5.3) withholds it, because under a
-- per-board meter the descent is silent and the arrival tie would be free.
INSERT INTO public.app_settings (key, value, description)
SELECT 'snout_deep_wake_meter', '{"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0}'::jsonb,
	'Snout Deep wake meter (rules 2, docs/design/2026-09-17-cumulative-attention.md §1): his sleep depth T is drawn per board entry as lo + floor(draw * (hi - lo + 1) / 120) and he wakes when the accumulated loudness reaches it. scope "board" resets the meter and redraws T on every descent; "dig" draws one T at open. dig_root_gt 1 mints the root tie''s +1 Golden Truffle, 0 withholds it. Stamped onto war_rootings.wake_meter at open; constants/dig.ts WAKE_METER is the compiled fallback.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'snout_deep_wake_meter');

-- The sanitised read: a garbled row never judges a dig, and it garbles the same
-- way on both sides — this is utils/snoutDeep.ts sanitizeWakeMeter, in SQL.
-- Every field falls back on its own (a half-written row still plays), each of
-- lo/hi is pulled into [1, 120], and a band that is not a band (lo >= hi) FALLS
-- BACK to 50–110 rather than inventing one. scope is 'board' unless the row
-- says 'dig'; dig_root_gt is 1 only when the row says exactly 1.
CREATE OR REPLACE FUNCTION public._snout_deep_wake_meter()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH raw AS (
		SELECT COALESCE(
			(SELECT value FROM public.app_settings WHERE key = 'snout_deep_wake_meter'),
			'{}'::jsonb) AS v
	), num AS (
		SELECT
			LEAST(120, GREATEST(1,
				CASE WHEN v ->> 'lo' ~ '^-?[0-9]+$' THEN (v ->> 'lo')::int ELSE 50 END)) AS lo,
			LEAST(120, GREATEST(1,
				CASE WHEN v ->> 'hi' ~ '^-?[0-9]+$' THEN (v ->> 'hi')::int ELSE 110 END)) AS hi,
			CASE WHEN v ->> 'scope' = 'dig' THEN 'dig' ELSE 'board' END AS scope,
			CASE WHEN v ->> 'dig_root_gt' ~ '^-?[0-9]+$' AND (v ->> 'dig_root_gt')::int = 1
				THEN 1 ELSE 0 END AS dig_root_gt
		FROM raw
	)
	SELECT jsonb_build_object(
		'lo', CASE WHEN lo < hi THEN lo ELSE 50 END,
		'hi', CASE WHEN lo < hi THEN hi ELSE 110 END,
		'scope', scope,
		'dig_root_gt', dig_root_gt)
	FROM num;
$function$;
REVOKE ALL ON FUNCTION public._snout_deep_wake_meter() FROM PUBLIC, anon, authenticated;

-- ── 4. open_rooting(p_rules) — the zero-arg body, carried, + the stamps ──────
-- CARRY-LATEST-DEF from 20260913060000_snout_deep.sql, verbatim, with the two
-- stamps of §2: the rule set the caller asked for (capped by the config) and,
-- when that is 2, the wake-meter tuning as it stands right now. Both ride the
-- reply on BOTH paths — an already-open row answers with its own stamps, so a
-- client that reopens mid-dig replays under the tuning it started with.
CREATE OR REPLACE FUNCTION public.open_rooting(p_rules smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	clock       record;
	win         bigint;
	today       date;
	the_seed    int;
	existing    record;
	coop_now    boolean := false;
	blessed_now boolean;
	crew_dug    jsonb := '[]'::jsonb;
	phase_ends  timestamptz;
	opens       timestamptz;
	the_unique  text;   -- the relic this NEW board carries, or NULL
	the_carry   record; -- the caller's carry slot (kind, unique_id, gild), or none
	carry_json  jsonb := NULL;  -- {kind, unique_id, gild} echoed to the client
	deep        boolean;        -- snout_deep_on() for this caller
	the_mode    text;
	dig_finds   jsonb;
	the_rules   smallint;      -- the rule set this row plays by (§2)
	the_meter   jsonb;         -- the wake-meter tuning it plays by (§1); NULL at rule 1
BEGIN
	SELECT * INTO clock FROM public._patch_clock(v_now);
	win := clock.window_index;
	today := clock.dig_day;
	opens := clock.opens_at;
	phase_ends := clock.phase_ends_at;

	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Phase gate: the patch is guarded during the tail of each block.
	IF NOT clock.phase_open THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'patch_closed',
			'phase_ends_at', phase_ends, 'opens_at', opens);
	END IF;

	deep := public.snout_deep_on(caller_id);
	the_mode := CASE WHEN deep THEN 'snout_deep' ELSE 'classic' END;
	SELECT value INTO dig_finds FROM public.app_settings WHERE key = 'dig_finds';

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL AND NOT deep THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');   -- the classic dig is Sounder-gated
	END IF;

	IF my_crew IS NOT NULL THEN
		coop_now := EXISTS (SELECT 1 FROM public.war_rootings
			WHERE crew_id = my_crew AND window_index = win
			  AND user_id <> caller_id AND submitted_at IS NOT NULL);
		SELECT COALESCE(jsonb_agg(jsonb_build_object(
				'user_id', r.user_id, 'display_name', p.username,
				'layer_tied', r.layer_tied, 'woke', r.woke)), '[]'::jsonb)
			INTO crew_dug
			FROM public.war_rootings r JOIN public.profiles p ON p.id = r.user_id
			WHERE r.crew_id = my_crew AND r.window_index = win
			  AND r.submitted_at IS NOT NULL AND r.user_id <> caller_id;
	END IF;
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);

	-- The caller's carry slot, if any (echoed to the client; drives the re-bury).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = caller_id;
	IF the_carry.kind IS NOT NULL THEN
		carry_json := jsonb_build_object(
			'kind', the_carry.kind, 'unique_id', the_carry.unique_id, 'gild', the_carry.gild);
	END IF;

	-- SEEDED CREW BOARDS (wedge 5a): the board seed is keyed on the caller's CREW,
	-- so every pig in the Sounder gets the IDENTICAL patch layout this window (the
	-- comparability unlock). f(window, crew_id) here; f(window, user_id) on the
	-- crewless branch (reachable now for an uncrewed Snout Deep dig). Normalized
	-- Park–Miller seed in [1, 2147483646] (client receives it; parity is in board
	-- generation from the seed). Reward math / find tables / the per-user relic
	-- roll below are all unchanged.
	the_seed := (abs(hashtext(win::text || ':' || COALESCE(my_crew, caller_id)::text)) % 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win;
	IF existing.user_id IS NOT NULL THEN
		-- Existing row: echo its stored relic (never re-rolled — the board is fixed).
		-- A snout_deep row's coop is the flag AS OF OPEN (the replay's contract).
		RETURN jsonb_build_object(
			'ok', true,
			'already', existing.submitted_at IS NOT NULL,
			'window_index', win, 'seed', existing.seed, 'opened_at', existing.opened_at,
			'coop', CASE WHEN existing.mode = 'snout_deep' THEN existing.coop_at_open ELSE coop_now END,
			'blessed', blessed_now, 'crew_dug', crew_dug,
			'phase_ends_at', phase_ends, 'opens_at', opens,
			'window_ends_at', clock.window_ends_at,
			'unique_id', existing.unique_id,
			'carry', carry_json,
			'mode', existing.mode,
			'uncrewed', existing.crew_id IS NULL,
			'dig_finds', dig_finds,
			'rules', COALESCE(existing.rules, 1),
			'wake_meter', existing.wake_meter,
			'synced_layer', existing.layer_tied,
			'synced_actions', to_jsonb(existing.action_log),
			'synced_finds', to_jsonb(existing.synced_finds));
	END IF;

	-- New board: if the caller carries a RELIC, re-bury that exact relic (the one
	-- that got away) and skip the random roll. Otherwise roll whether the board
	-- carries a relic (~2 in 5) and which — unchanged from 20260728.
	IF the_carry.kind = 'unique' AND the_carry.unique_id IS NOT NULL THEN
		the_unique := the_carry.unique_id;
	ELSIF random() < 0.4 THEN
		the_unique := public.roll_unique();
	END IF;

	-- THE ADDITION (§2): the caller asks for the newest rules it understands;
	-- the server config caps it. A row is stamped once, at open — the rule set
	-- and, at rule 2, the meter's tuning — and the replay reads the stamps,
	-- never the config, so a rollback or a retune never re-judges a dig that is
	-- already under way. A rule-1 row has no meter: its stamp stays NULL.
	the_rules := LEAST(GREATEST(COALESCE(p_rules, 1)::int, 1), public._snout_deep_rules())::smallint;
	the_meter := CASE WHEN the_rules >= 2 THEN public._snout_deep_wake_meter() ELSE NULL END;
	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day, opened_at, unique_id, mode, coop_at_open, rules, wake_meter)
		VALUES (caller_id, my_crew, win, the_seed, today, v_now, the_unique, the_mode, deep AND coop_now, the_rules, the_meter);
	RETURN jsonb_build_object(
		'ok', true,
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', v_now,
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
		'phase_ends_at', phase_ends, 'opens_at', opens,
			'window_ends_at', clock.window_ends_at,
		'unique_id', the_unique,
		'carry', carry_json,
		'mode', the_mode,
		'uncrewed', my_crew IS NULL,
		'dig_finds', dig_finds,
		'rules', the_rules,
		'wake_meter', the_meter,
		'synced_layer', NULL,
		'synced_actions', '[]'::jsonb,
		'synced_finds', '[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting(smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting(smallint) TO authenticated;

-- ── 5. The core submit — carried, with the wake meter in the replay ─────────
-- CARRY-LATEST-DEF from 20260917150000_snout_deep_sniff_budget_per_board.sql,
-- VERBATIM. Every line the meter adds sits inside a >>> rules 2 / <<< rules 2
-- marker, and the parity test strips those markers' contents and asserts what
-- is left is the 150000 body character for character — so a future carry can
-- see exactly what rule 2 costs. Rule 1 keeps its own line and its own roll.
CREATE OR REPLACE FUNCTION public._submit_rooting_deep_core(
	p_user_id uuid, p_window_index bigint, p_actions text[], p_layer smallint,
	p_finds text[], p_missed text[], p_things text[], p_close boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	prior_sniffs int := 0;
	sniff_layer int := 0;   -- the layer prior_sniffs counts; reset on descent
	-- >>> rules 2 (the wake meter, §1)
	attention   int := 0;      -- the meter, in 120ths; reset per board under scope 'board'
	sleep_depth int := NULL;   -- T — his depth on the board the dig is on
	board_layer int := 0;      -- the layer the meter's T was drawn for
	di          int := 0;      -- draws consumed: board entries AND actions
	wm          jsonb;         -- the row's wake-meter stamp (never today's config)
	m_lo        int;
	m_hi        int;
	m_scope     text;
	-- <<< rules 2
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

	-- >>> rules 2 (the wake meter, §1)
	-- The tuning THIS dig was opened under. A rule-1 row has no stamp and never
	-- reads these; the fallback is the live row only so a stampless rule-2 row
	-- (there should be none) still plays a sane band instead of no band at all.
	wm      := COALESCE(row_r.wake_meter, public._snout_deep_wake_meter());
	m_lo    := COALESCE((wm ->> 'lo')::int, 50);
	m_hi    := COALESCE((wm ->> 'hi')::int, 110);
	m_scope := COALESCE(wm ->> 'scope', 'board');
	-- <<< rules 2

	-- ── replay the wake stream: the k-th entry takes the k-th draw ────────────
	IF n > 0 THEN
		draws := public._snout_deep_wake_draws(row_r.seed, n + 3);
		-- >>> rules 2 (the wake meter, §1)
		-- A board is ENTERED before anything happens on it, and the entry draws
		-- his sleep depth off the same stream: topsoil's T is the FIRST draw,
		-- taken BEFORE the first action, exactly where the kernel's initialState
		-- takes it. Three entries at most, hence n + 3 above.
		IF row_r.rules >= 2 THEN
			di := di + 1;
			sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);
		END IF;
		-- <<< rules 2
		FOR i IN 1..n LOOP
			e := log[i];
			lyr := substr(e, 2, 1)::int;
			verb := substr(e, 1, 1);
			-- The sniff budget (20260917130000), per BOARD (20260917150000):
			-- the k-th sniff past the budget draws his attention. prior_sniffs
			-- counts THIS LAYER's sniffs BEFORE this entry, the way the
			-- client's sniffCount(actions, layer) does — it refills on descent.
			IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;
			-- >>> rules 2 (the wake meter, §1)
			-- A descent enters a NEW board: one draw per layer entered (the
			-- kernel's descend() takes one), and under scope 'board' the meter
			-- starts again from 0 on it — the descent is quiet, which is what
			-- makes topsoil truly safe. Under scope 'dig' there is ONE T, taken
			-- at open, and the meter carries all the way down: no redraw, no
			-- reset. Then the action consumes its own draw — it decides nothing
			-- under the meter, but the stream has to advance exactly as the
			-- phone's wakeIndex does or a later board's T lands on the wrong
			-- number.
			IF row_r.rules >= 2 AND m_scope = 'board' THEN
				WHILE board_layer < lyr LOOP
					board_layer := board_layer + 1;
					di := di + 1;
					sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);
					attention := 0;
				END LOOP;
			END IF;
			IF row_r.rules >= 2 THEN di := di + 1; END IF;
			-- <<< rules 2
			-- The wake table IS the loudness under rule 2 (§1): one table, one
			-- tuning, read the same way by both rules.
			thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);
			IF verb = 's' THEN prior_sniffs := prior_sniffs + 1; END IF;
			-- >>> rules 2 (the wake meter, §1)
			-- The loudness LANDS first, then the compare: he wakes on the action
			-- that carries the meter to T or past it. No roll — draws[i] is not
			-- even read on this branch.
			IF row_r.rules >= 2 THEN
				attention := attention + thr;
				IF attention >= sleep_depth THEN
					v_woke := true;
					v_woke_on := e;
					woke_layer := lyr;
					log := log[1:i];   -- the waking action is IN the log; nothing after it
					n := i;
					EXIT;
				END IF;
			-- <<< rules 2
			ELSIF draws[i] < thr THEN
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
			-- >>> rules 2 (the wake meter, doc §5.3)
			-- Under a per-board meter the descent is SILENT, so tying the moment
			-- you arrive at the root would be a free +1 for walking downstairs.
			-- The stamp's dig_root_gt decides — default 0, withheld. A rule-1 row
			-- has no stamp and mints it exactly as it always did, and the client's
			-- gtReasons reads the same stamp, so the tie button's "+N Golden
			-- Truffles" and this mint never disagree.
			IF row_r.rules < 2 OR COALESCE((row_r.wake_meter ->> 'dig_root_gt')::int, 1) = 1 THEN
			-- <<< rules 2
				minted := minted + public.mint_truffles(p_user_id, 1, 'dig_root', NULL);
			-- >>> rules 2
			END IF;
			-- <<< rules 2
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
		-- >>> rules 2 (the wake meter, §1): the meter as the dig left it and the
		-- last board's T — the woke line reads "pushed the root on a rub at 84".
		-- 0 / NULL on a rule-1 row, which has no meter.
		'attention',      attention,
		'sleep_depth',    sleep_depth,
		-- <<< rules 2
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

-- ── 6. Deeper pays more (§3) — MERGED per kind, never a replace ──────────────
-- The dig_finds row holds each kind's odds too (and any key a later migration
-- adds), so each kind's object is merged with its new tickles and put back.
-- Topsoil is unchanged; the mud and the root pay for the walk down.
UPDATE public.app_settings SET
	value = value
		|| jsonb_build_object('truffle_l',  COALESCE(value -> 'truffle_l',  '{}'::jsonb) || '{"tickles": 20}'::jsonb)
		|| jsonb_build_object('shimmer',    COALESCE(value -> 'shimmer',    '{}'::jsonb) || '{"tickles": 10}'::jsonb)
		|| jsonb_build_object('acorn',      COALESCE(value -> 'acorn',      '{}'::jsonb) || '{"tickles": 15}'::jsonb)
		|| jsonb_build_object('tea',        COALESCE(value -> 'tea',        '{}'::jsonb) || '{"tickles": 10}'::jsonb)
		|| jsonb_build_object('scroll',     COALESCE(value -> 'scroll',     '{}'::jsonb) || '{"tickles": 12}'::jsonb)
		|| jsonb_build_object('relic',      COALESCE(value -> 'relic',      '{}'::jsonb) || '{"tickles": 25}'::jsonb)
		|| jsonb_build_object('furnishing', COALESCE(value -> 'furnishing', '{}'::jsonb) || '{"tickles": 30}'::jsonb)
		|| jsonb_build_object('bow',        COALESCE(value -> 'bow',        '{}'::jsonb) || '{"tickles": 40}'::jsonb)
		|| jsonb_build_object('charm',      COALESCE(value -> 'charm',      '{}'::jsonb) || '{"tickles": 20}'::jsonb),
	description = 'Snout Deep finds (spec §2): per kind, `odds` as an "n in d" pair (absent = always present) and `tickles` = the applied tickles the find pays on the receipt. Deeper pays more (2026-09-17, cumulative-attention §3): the mud and the root went up, topsoil is unchanged. constants/dig.ts DIG_FINDS / DIG_FIND_TICKLES are the compiled fallbacks.'
WHERE key = 'dig_finds';
