-- Snout Deep — the press-your-luck dig with a nose (server half).
-- Spec: docs/dig-redesign/a-snout-deep-spec.md §6. Steps 3 of §11.
--
-- FLAG OFF BY DEFAULT. app_config.snout_deep = false, so open_rooting keeps its
-- classic behaviour (crew-gated, the stir-budget board) until the flag flips —
-- globally, or per tester via profiles.feature_overrides (the same merge
-- feature_flags() does, so the client and the server agree on who is in).
--
-- What lands here:
--   1. war_rootings grows the Snout Deep columns and lets crew_id be NULL —
--      an uncrewed player digs the same board (things, XP, regen; no Golden
--      Truffles, no Sounder Bonus, no race find). Every existing reader keys
--      on crew_id = <a crew>, so a NULL-crew row never joins a crew tally,
--      an echo pairing, or race_digs (the race row is simply never written).
--   2. snout_deep_on(uid) — the server-side flag read open_rooting uses.
--   3. app_settings.dig_finds — the per-layer find odds (constants/dig.ts
--      DIG_FINDS is the compiled fallback), echoed by open_rooting.
--   4. open_rooting — CARRIED from 20260799000000 (the latest def); when the
--      flag is on, opens a mode='snout_deep' row (uncrewed players included)
--      and returns mode / coop / uncrewed / dig_finds on top of every field
--      it already returned.
--   5. feeding_state — CARRIED from 20260913030000; crew_dug entries and the
--      caller's own dig gain layer_tied / woke for the Feeding card line.
--   6. submit_rooting_deep — validates the action log, replays the seed's wake
--      stream (Park–Miller over seed × 7919, exactly utils/rooting.ts's
--      WakeStream), mints by layers banked, carries a woken truffle, writes the
--      durable receipt (the 20260913010000 shell).
--   7. sync_rooting — the every-5-actions / on-background log sync.
--   8. close_open_rootings — the window-close cron: every open snout_deep row
--      whose window has ended is submitted as a tie at its synced log.
--
-- NOT in this pass (follow-ups, named in the build report): a full server-side
-- board replay (rejecting an action on a cleared tile), paying `things`
-- through their own paths (recorded on the receipt only), and the find odds
-- driving the layered board's generation (the client still uses DIG_FINDS).
--
-- Authored for review; do not push without Brian's explicit go.

-- ── 1. war_rootings: the Snout Deep columns; crew_id may be NULL ─────────────
ALTER TABLE public.war_rootings ALTER COLUMN crew_id DROP NOT NULL;
ALTER TABLE public.war_rootings
	ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'classic'
		CHECK (mode IN ('classic', 'snout_deep')),
	ADD COLUMN IF NOT EXISTS action_log text[] NOT NULL DEFAULT '{}',
	ADD COLUMN IF NOT EXISTS layer_tied smallint
		CHECK (layer_tied BETWEEN 0 AND 2),
	ADD COLUMN IF NOT EXISTS woke boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS woke_on text,
	ADD COLUMN IF NOT EXISTS coop_at_open boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS synced_at timestamptz,
	-- The banked truffle ids as of the last sync — what the close cron ties
	-- with (the server does not replay the board in this pass).
	ADD COLUMN IF NOT EXISTS synced_finds text[] NOT NULL DEFAULT '{}';
-- The close cron's scan: open Snout Deep rows only.
CREATE INDEX IF NOT EXISTS war_rootings_open_deep_idx
	ON public.war_rootings (opened_at)
	WHERE mode = 'snout_deep' AND submitted_at IS NULL;
-- RLS: "View rootings in your crew" is is_crew_member(crew_id, auth.uid()),
-- which is false for a NULL crew — an uncrewed row is reachable only through
-- the SECURITY DEFINER RPCs (open_rooting / rooting_receipt), never directly.

-- ── 2. The flag + its server-side read ───────────────────────────────────────
INSERT INTO public.app_config (key, enabled, description)
VALUES ('snout_deep', false,
	'Snout Deep — the three-layer press-your-luck dig replaces the classic Truffle Patch (open_rooting mode). Per-user overrides in profiles.feature_overrides apply.')
ON CONFLICT (key) DO NOTHING;

-- The same merge as feature_flags(): a per-user override wins, else the
-- global. NULL user → the global alone.
CREATE OR REPLACE FUNCTION public.snout_deep_on(p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT COALESCE((p.feature_overrides ->> 'snout_deep')::boolean, c.enabled)
		 FROM public.app_config c
		 LEFT JOIN public.profiles p ON p.id = p_user
		 WHERE c.key = 'snout_deep'),
		false);
$function$;
REVOKE ALL ON FUNCTION public.snout_deep_on(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. The find odds (server config; constants/dig.ts DIG_FINDS mirrors it) ──
INSERT INTO public.app_settings (key, value, description)
VALUES ('dig_finds',
	'{"pouch":[1,2],"apple":[1,3],"shimmer":[1,2],"acorn":[1,2],"tea":[1,3],"scroll":[1,3],"relic":[2,5],"furnishing":[1,4],"bow":[1,12],"charm":[1,3]}'::jsonb,
	'Snout Deep per-layer find odds as "n in d" pairs (spec §2). Kinds with no entry are always present. constants/dig.ts DIG_FINDS is the compiled fallback.')
ON CONFLICT (key) DO NOTHING;

-- ── 4. open_rooting — CARRIED from 20260799000000 + the Snout Deep branch ────
-- DIFF from the carried body, all under snout_deep_on():
--   · the no_crew gate is skipped — an uncrewed player opens a crew_id NULL row;
--   · the new row is mode 'snout_deep' with coop_at_open = a crewmate has
--     already submitted this window;
--   · the payload gains mode / coop (coop_at_open on a snout_deep row — the
--     replay must use the flag as of open, §10) / uncrewed / dig_finds, and on
--     an open row synced_layer / synced_actions for a restore.
-- Everything else — the phase gate, the crew-keyed seed, the relic roll, the
-- carry echo, crew_dug — is byte-for-byte the carried behaviour.
CREATE OR REPLACE FUNCTION public.open_rooting()
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

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day, opened_at, unique_id, mode, coop_at_open)
		VALUES (caller_id, my_crew, win, the_seed, today, v_now, the_unique, the_mode, deep AND coop_now);
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
		'synced_layer', NULL,
		'synced_actions', '[]'::jsonb,
		'synced_finds', '[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 5. feeding_state — CARRIED from 20260913030000 + layer_tied / woke ───────
-- DIFF: crew_dug entries carry layer_tied / woke, and the caller's own
-- submitted dig is echoed as layer_tied / woke (NULL / false on a classic dig).
CREATE OR REPLACE FUNCTION public.feeding_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid(); my_crew uuid; clock record; p public.profiles%ROWTYPE;
	v_now timestamptz := now(); schedule jsonb;
	dug boolean := false; crew_dug jsonb := '[]'::jsonb;
	my_layer smallint := NULL; my_woke boolean := false;
BEGIN
	SELECT * INTO clock FROM public._patch_clock_for_user(v_now,caller_id);
	SELECT * INTO p FROM public.profiles WHERE id=caller_id;
	SELECT value INTO schedule FROM public.app_settings WHERE key='feeding_schedule';
	IF caller_id IS NOT NULL THEN
		SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id=caller_id;
		SELECT true, r.layer_tied, r.woke INTO dug, my_layer, my_woke
			FROM public.war_rootings r WHERE r.user_id=caller_id
			AND r.window_index=clock.window_index AND r.submitted_at IS NOT NULL;
		dug := COALESCE(dug,false);
		IF my_crew IS NOT NULL THEN
			SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',r.user_id,'display_name',pr.username,
					'layer_tied',r.layer_tied,'woke',r.woke)),'[]'::jsonb)
			INTO crew_dug FROM public.war_rootings r JOIN public.profiles pr ON pr.id=r.user_id
			WHERE r.crew_id=my_crew AND r.window_index=clock.window_index
				AND r.submitted_at IS NOT NULL AND r.user_id<>caller_id;
		END IF;
	END IF;
	RETURN jsonb_build_object('server_now',v_now,'feeding_schedule',schedule,
		'window_index',clock.window_index,'window_ends_at',clock.window_ends_at,
		'phase_open',clock.phase_open,'phase_ends_at',clock.phase_ends_at,'opens_at',clock.opens_at,
		'dug',dug,'crew_dug',crew_dug,
		'layer_tied',my_layer,'woke',COALESCE(my_woke,false),
		'feeding_time_zone',COALESCE(public._feeding_zone_at(caller_id,v_now),'America/New_York'),
		'pending_feeding_time_zone',p.pending_feeding_time_zone,
		'pending_effective_at',p.feeding_time_zone_effective_at,
		'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.feeding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feeding_state() TO authenticated;

-- ── 6a. The wake stream — Park–Miller minstd, EXACTLY utils/rooting.ts ───────
-- WakeStream = new Minstd(wakeSeed(seed)); wakeSeed = (seed × 7919) mod
-- 2147483647; Minstd normalises an out-of-range state to (|t| mod 2147483646)
-- + 1; next() = state × 16807 mod 2147483647; a draw = next() mod 120
-- (WAKE_DIE). The k-th non-no-op action takes the k-th draw.
-- __tests__/snoutDeepServerParity.test.ts pins these constants against the
-- client's.
CREATE OR REPLACE FUNCTION public._snout_deep_wake_draws(p_seed int, p_n int)
RETURNS int[] LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	state bigint;
	draws int[] := ARRAY[]::int[];
	i int;
BEGIN
	-- wakeSeed: (seed * 7919) % 2147483647
	state := (p_seed::bigint * 7919) % 2147483647;
	-- Minstd normalisation: (|t| % 2147483646) + 1 when out of [1, 2147483646]
	IF state < 1 OR state > 2147483646 THEN
		state := (abs(state) % 2147483646) + 1;
	END IF;
	FOR i IN 1..COALESCE(p_n, 0) LOOP
		state := (state * 16807) % 2147483647;
		draws := draws || (state % 120)::int;
	END LOOP;
	RETURN draws;
END;
$function$;
REVOKE ALL ON FUNCTION public._snout_deep_wake_draws(int, int) FROM PUBLIC, anon, authenticated;

-- ── 6b. The wake table — constants/dig.ts WAKE_TABLE, in 120ths ──────────────
-- (layer, verb letter, threshold). Co-op halves the ROOT's sniff and rub
-- (integer floor + 1: 7 → 4, 15 → 8); shove is unchanged (spec §1.4).
CREATE OR REPLACE FUNCTION public._snout_deep_wake_threshold(p_layer int, p_verb text, p_coop boolean)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE
		WHEN p_coop AND t.layer = 2 AND t.verb IN ('s', 'r') AND t.thr > 0 THEN (t.thr / 2) + 1
		ELSE t.thr END
	FROM (VALUES
		(0, 's', 0), (0, 'r', 1), (0, 'h', 10),
		(1, 's', 3), (1, 'r', 6), (1, 'h', 20),
		(2, 's', 7), (2, 'r', 15), (2, 'h', 40)
	) AS t(layer, verb, thr)
	WHERE t.layer = p_layer AND t.verb = p_verb;
$function$;
REVOKE ALL ON FUNCTION public._snout_deep_wake_threshold(int, text, boolean) FROM PUBLIC, anon, authenticated;

-- ── 6c. The core submit — shared by the RPC and the close cron ───────────────
-- The reward body for a Snout Deep row. Assumes the caller has established
-- WHO is submitting (the RPC checks auth; the cron acts for the row's owner).
-- Serialised per (user, window) by the same advisory lock the durable-receipt
-- shell takes; an existing receipt is returned unchanged (idempotent).
--
-- Log contract (spec §1.2 / §6): entries are "s2:14" / "r2:14" / "h2:14"
-- (verb letter, layer 0–2, tile 0–29); ≤ 45; layers non-decreasing; a tile
-- is sniffed at most once per layer; p_layer is the layer the dig ended on
-- (≥ the last entry's layer — a player may descend and tie without acting,
-- §10). A full board replay against cleared tiles is a follow-up.
--
-- Finds contract: p_finds are the BANKED truffle ids ('l0:truffle_d' /
-- 'l1:truffle_l', or the bare kinds); p_missed the carry-eligible ones;
-- p_things the revealed thing ids — recorded on the receipt, not paid here.
-- A wake drops the woken layer's truffle from p_finds into the carry path.
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
	-- pass). Sanitised to board-shaped ids.
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO things_clean
		FROM unnest(COALESCE(p_things, ARRAY[]::text[])) AS x
		WHERE x ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$';

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
		'closed',       p_close);
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

-- ── 6d. submit_rooting_deep — the RPC (the 20260913010000 checked shell) ─────
CREATE OR REPLACE FUNCTION public.submit_rooting_deep(
	p_user_id uuid, p_window_index bigint, p_actions text[], p_layer smallint,
	p_finds text[], p_missed text[], p_things text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid(); clock record; prior jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id IS DISTINCT FROM p_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'account_changed');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text||':'||p_window_index::text,0));
	SELECT receipt INTO prior FROM public.rooting_receipts
	WHERE user_id = caller_id AND window_index = p_window_index;
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	SELECT * INTO clock FROM public._patch_clock(public._patch_now());
	IF clock.window_index IS DISTINCT FROM p_window_index THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'window_changed');
	END IF;
	RETURN public._submit_rooting_deep_core(
		caller_id, p_window_index, p_actions, p_layer, p_finds, p_missed, p_things, false);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting_deep(uuid, bigint, text[], smallint, text[], text[], text[])
	FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting_deep(uuid, bigint, text[], smallint, text[], text[], text[])
	TO authenticated;

-- ── 7. sync_rooting — the mid-dig log sync (every 5 actions, on background) ──
-- Writes the log, the current layer and the banked truffle ids onto the OPEN
-- snout_deep row so the close cron can tie the dig where it stood. A shorter
-- log never overwrites a longer one (an out-of-order sync can't regress).
CREATE OR REPLACE FUNCTION public.sync_rooting(
	p_window_index bigint, p_layer smallint, p_actions text[],
	p_finds text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	log text[] := COALESCE(p_actions, ARRAY[]::text[]);
	e text;
	n int;
	banked text[] := ARRAY[]::text[];
	f text;
	k text;
	touched int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	n := COALESCE(array_length(log, 1), 0);
	IF n > 45 OR p_layer IS NULL OR p_layer < 0 OR p_layer > 2 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
	END IF;
	FOREACH e IN ARRAY log LOOP
		IF e IS NULL OR e !~ '^[srh][0-2]:([0-9]|[12][0-9])$' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
		END IF;
	END LOOP;
	FOREACH f IN ARRAY COALESCE(p_finds, ARRAY[]::text[]) LOOP
		k := regexp_replace(f, '^l[0-2]:', '');
		IF k IN ('truffle_d', 'truffle_l') AND NOT (k = ANY (banked)) THEN
			banked := banked || k;
		END IF;
	END LOOP;
	UPDATE public.war_rootings SET
		action_log = log,
		layer_tied = p_layer,
		synced_finds = banked,
		synced_at = now()
		WHERE user_id = caller_id AND window_index = p_window_index
		  AND mode = 'snout_deep' AND submitted_at IS NULL
		  AND COALESCE(array_length(action_log, 1), 0) <= n;
	GET DIAGNOSTICS touched = ROW_COUNT;
	RETURN jsonb_build_object('ok', true, 'synced', touched > 0, 'actions', n, 'layer', p_layer);
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_rooting(bigint, smallint, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_rooting(bigint, smallint, text[], text[]) TO authenticated;

-- ── 8. close_open_rootings — the window-close sweep (spec §1.6 / §6) ─────────
-- Every open snout_deep row whose window has ENDED (the owner's own clock —
-- the same _patch_clock_for_user arithmetic open/feeding_state use, evaluated
-- at the row's opened_at) is submitted as a tie at its synced layer, with its
-- synced banked truffles. The wake replay still runs over the synced log, so
-- a log that already woke him closes as a wake. Returns the number closed.
CREATE OR REPLACE FUNCTION public.close_open_rootings()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v_now timestamptz := public._patch_now();
	r record;
	ends timestamptz;
	last_layer int;
	res jsonb;
	closed int := 0;
BEGIN
	FOR r IN SELECT wr.user_id, wr.window_index, wr.opened_at, wr.layer_tied,
			wr.action_log, wr.synced_finds
		FROM public.war_rootings wr
		WHERE wr.mode = 'snout_deep' AND wr.submitted_at IS NULL
		ORDER BY wr.opened_at
	LOOP
		SELECT c.window_ends_at INTO ends
			FROM public._patch_clock_for_user(r.opened_at, r.user_id) c;
		IF ends IS NULL OR v_now < ends THEN CONTINUE; END IF;
		-- The layer the dig stood on: the synced layer, never above the log's last.
		SELECT COALESCE(max(substr(a, 2, 1)::int), 0) INTO last_layer
			FROM unnest(r.action_log) AS a WHERE a ~ '^[srh][0-2]:';
		BEGIN
			res := public._submit_rooting_deep_core(
				r.user_id, r.window_index, r.action_log,
				GREATEST(COALESCE(r.layer_tied, 0), last_layer)::smallint,
				r.synced_finds, ARRAY[]::text[], ARRAY[]::text[], true);
			IF COALESCE((res->>'ok')::boolean, false) THEN closed := closed + 1; END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE NOTICE 'close_open_rootings: % / % failed: %', r.user_id, r.window_index, SQLERRM;
		END;
	END LOOP;
	RETURN closed;
END;
$function$;
REVOKE ALL ON FUNCTION public.close_open_rootings() FROM PUBLIC, anon, authenticated;

-- The production project already has pg_cron. The exception guard keeps the
-- plain-Postgres test harness usable when its cron stub is absent.
DO $schedule$
BEGIN
	PERFORM cron.schedule('snout-deep-close', '*/5 * * * *', 'SELECT public.close_open_rootings()');
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'snout-deep-close cron was not scheduled in this environment: %', SQLERRM;
END;
$schedule$;
