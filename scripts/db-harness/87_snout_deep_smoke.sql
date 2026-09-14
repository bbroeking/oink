-- Snout Deep (20260913060000): flag off leaves open_rooting classic; flag on
-- opens snout_deep rows (uncrewed included); submit_rooting_deep replays the
-- wake stream, mints by layers banked, carries a woken truffle, writes the
-- durable receipt; sync_rooting + close_open_rootings tie a stale open row.
\set ON_ERROR_STOP on

-- Record XP grants so the +20 path is observable (the stub's grant_season_xp
-- is a no-op; smoke 52, which records it, is not in the chain).
CREATE TABLE IF NOT EXISTS public.xp_ledger (user_id uuid, amount int);
DROP FUNCTION IF EXISTS public.grant_season_xp(uuid, integer);
CREATE FUNCTION public.grant_season_xp(p_user uuid, p_amount int)
RETURNS void LANGUAGE sql AS
$$ INSERT INTO public.xp_ledger VALUES (p_user, p_amount) $$;

DO $snout_deep$
DECLARE
	pig_a uuid := '00000000-0000-0000-0000-000000087001';  -- crew X, ties at the root
	pig_b uuid := '00000000-0000-0000-0000-000000087002';  -- crew X, wakes him in the mud
	pig_c uuid := '00000000-0000-0000-0000-000000087003';  -- crew Y, bad logs + the close cron
	pig_u uuid := '00000000-0000-0000-0000-000000087004';  -- uncrewed
	pig_o uuid := '00000000-0000-0000-0000-000000087005';  -- crew Z, flag-off control
	crew_x uuid := '00000000-0000-0000-0000-000000087010';
	crew_y uuid := '00000000-0000-0000-0000-000000087011';
	crew_z uuid := '00000000-0000-0000-0000-000000087012';
	opened jsonb; res jsonb; again jsonb; win bigint; ends timestamptz;
	seed_b int; draws int[]; i int; wake_at int := NULL; log text[]; k int;
	n_before int; closed int;
BEGIN
	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (pig_a),(pig_b),(pig_c),(pig_u),(pig_o) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone) VALUES
		(pig_a,'deep-a','America/New_York'),(pig_b,'deep-b','America/New_York'),
		(pig_c,'deep-c','America/New_York'),(pig_u,'deep-u','America/New_York'),
		(pig_o,'deep-o','America/New_York')
		ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES
		(crew_x,'Deep X',pig_a,false),(crew_y,'Deep Y',pig_c,false),(crew_z,'Deep Z',pig_o,false)
		ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES
		(crew_x,pig_a,'leader'),(crew_x,pig_b,'member'),(crew_y,pig_c,'leader'),(crew_z,pig_o,'leader')
		ON CONFLICT DO NOTHING;
	DELETE FROM public.user_patch_carry WHERE user_id IN (pig_a,pig_b,pig_c,pig_u,pig_o);
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb WHERE key='feeding_schedule';
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);   -- 08:01 ET: window 0 open

	-- ── the wake stream + table, pinned against utils/rooting.ts ────────────
	IF public._snout_deep_wake_draws(20260913,12) <> ARRAY[79,75,20,0,47,50,4,59,80,22,114,9] THEN
		RAISE EXCEPTION 'wake stream parity (seed 20260913): %', public._snout_deep_wake_draws(20260913,12);
	END IF;
	IF public._snout_deep_wake_draws(1,6) <> ARRAY[113,104,6,38,104,77]
		OR public._snout_deep_wake_draws(2147483646,6) <> ARRAY[14,23,1,89,23,50] THEN
		RAISE EXCEPTION 'wake stream parity (edge seeds)';
	END IF;
	IF public._snout_deep_wake_threshold(0,'s',false) <> 0 OR public._snout_deep_wake_threshold(0,'r',false) <> 1
		OR public._snout_deep_wake_threshold(0,'h',false) <> 10 OR public._snout_deep_wake_threshold(1,'s',false) <> 3
		OR public._snout_deep_wake_threshold(1,'r',false) <> 6 OR public._snout_deep_wake_threshold(1,'h',false) <> 20
		OR public._snout_deep_wake_threshold(2,'s',false) <> 7 OR public._snout_deep_wake_threshold(2,'r',false) <> 15
		OR public._snout_deep_wake_threshold(2,'h',false) <> 40
		OR public._snout_deep_wake_threshold(2,'s',true) <> 4 OR public._snout_deep_wake_threshold(2,'r',true) <> 8
		OR public._snout_deep_wake_threshold(2,'h',true) <> 40 OR public._snout_deep_wake_threshold(1,'r',true) <> 6 THEN
		RAISE EXCEPTION 'wake table drifted from WAKE_TABLE';
	END IF;

	-- ── flag OFF: open_rooting is the classic dig ───────────────────────────
	IF public.snout_deep_on(pig_o) THEN RAISE EXCEPTION 'snout_deep flag should seed false'; END IF;
	PERFORM set_config('smoke.uid',pig_o::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean OR opened->>'mode' <> 'classic' THEN
		RAISE EXCEPTION 'flag off: crewed open not classic: %', opened;
	END IF;
	IF (SELECT mode FROM public.war_rootings WHERE user_id=pig_o AND window_index=(opened->>'window_index')::bigint) <> 'classic' THEN
		RAISE EXCEPTION 'flag off: row mode not classic';
	END IF;
	PERFORM set_config('smoke.uid',pig_u::text,true);
	opened := public.open_rooting();
	IF (opened->>'ok')::boolean OR opened->>'reason' <> 'no_crew' THEN
		RAISE EXCEPTION 'flag off: uncrewed open should be no_crew: %', opened;
	END IF;
	PERFORM set_config('smoke.uid',pig_o::text,true);
	res := public.submit_rooting_deep(pig_o,(SELECT window_index FROM public.war_rootings WHERE user_id=pig_o LIMIT 1),ARRAY[]::text[],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'wrong_mode' THEN
		RAISE EXCEPTION 'submit_rooting_deep accepted a classic row: %', res;
	END IF;

	-- ── flag ON ─────────────────────────────────────────────────────────────
	UPDATE public.app_config SET enabled=true WHERE key='snout_deep';
	IF NOT public.snout_deep_on(pig_a) THEN RAISE EXCEPTION 'snout_deep flag did not flip'; END IF;

	-- crewed open: mode / coop / uncrewed / dig_finds
	PERFORM set_config('smoke.uid',pig_a::text,true);
	opened := public.open_rooting(); win := (opened->>'window_index')::bigint; ends := (opened->>'window_ends_at')::timestamptz;
	IF NOT (opened->>'ok')::boolean OR opened->>'mode' <> 'snout_deep' OR (opened->>'coop')::boolean
		OR (opened->>'uncrewed')::boolean OR opened->'dig_finds'->'relic' IS DISTINCT FROM '[2,5]'::jsonb
		OR opened->>'seed' IS NULL THEN
		RAISE EXCEPTION 'flag on: crewed open payload wrong: %', opened;
	END IF;
	IF (SELECT mode FROM public.war_rootings WHERE user_id=pig_a AND window_index=win) <> 'snout_deep' THEN
		RAISE EXCEPTION 'flag on: row not snout_deep';
	END IF;
	-- re-open echoes the same row (already=false, still open)
	again := public.open_rooting();
	IF (again->>'already')::boolean OR again->>'seed' <> opened->>'seed' OR again->>'mode' <> 'snout_deep' THEN
		RAISE EXCEPTION 'flag on: re-open drifted: %', again;
	END IF;

	-- uncrewed open: ok, crew_id NULL
	PERFORM set_config('smoke.uid',pig_u::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean OR NOT (opened->>'uncrewed')::boolean OR opened->>'mode' <> 'snout_deep' THEN
		RAISE EXCEPTION 'flag on: uncrewed open refused: %', opened;
	END IF;
	IF (SELECT crew_id FROM public.war_rootings WHERE user_id=pig_u AND window_index=win) IS NOT NULL THEN
		RAISE EXCEPTION 'uncrewed row carries a crew';
	END IF;

	-- ── pig A: tie at the root with both truffles banked → 3 mints ──────────
	PERFORM set_config('smoke.uid',pig_a::text,true);
	res := public.submit_rooting_deep(pig_a,win,ARRAY['s0:0','s0:1','s1:7','s2:3'],2::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l'],ARRAY[]::text[],ARRAY['l0:boom','l1:acorn']);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'root tie refused: %', res; END IF;
	IF (res->>'truffles')::int <> 3 OR (res->>'layer_tied')::int <> 2 OR (res->>'woke')::boolean
		OR res->>'end_reason' <> 'tie' OR (res->>'uncrewed')::boolean
		OR res->'things' IS DISTINCT FROM '["l0:boom","l1:acorn"]'::jsonb THEN
		RAISE EXCEPTION 'root tie receipt wrong: %', res;
	END IF;
	IF (SELECT array_agg(reason ORDER BY reason) FROM public.war_truffles WHERE user_id=pig_a)
		<> ARRAY['dig','dig_deep','dig_root'] THEN
		RAISE EXCEPTION 'root tie mints wrong: %', (SELECT array_agg(reason ORDER BY reason) FROM public.war_truffles WHERE user_id=pig_a);
	END IF;
	IF (SELECT finds FROM public.race_digs WHERE user_id=pig_a AND window_index=win) <> 2 THEN
		RAISE EXCEPTION 'root tie race credit wrong';
	END IF;
	IF (SELECT count(*) FROM public.xp_ledger WHERE user_id=pig_a AND amount=20) <> 1 THEN
		RAISE EXCEPTION 'root tie XP not granted';
	END IF;
	IF (SELECT layer_tied FROM public.war_rootings WHERE user_id=pig_a AND window_index=win) <> 2
		OR (SELECT action_log FROM public.war_rootings WHERE user_id=pig_a AND window_index=win) <> ARRAY['s0:0','s0:1','s1:7','s2:3'] THEN
		RAISE EXCEPTION 'root tie row not stamped';
	END IF;
	-- (feeding_state reads now(), not the fake clock — its layer_tied / woke
	-- keys are asserted on the open_rooting crew_dug echo below instead.)

	-- ── idempotent re-submit: the stored receipt, no second mint ────────────
	n_before := (SELECT count(*) FROM public.war_truffles WHERE user_id=pig_a);
	again := public.submit_rooting_deep(pig_a,win,ARRAY['h2:0'],2::smallint,ARRAY['l0:truffle_d'],ARRAY[]::text[],ARRAY[]::text[]);
	IF again IS DISTINCT FROM res THEN RAISE EXCEPTION 're-submit did not return the stored receipt'; END IF;
	IF (SELECT count(*) FROM public.war_truffles WHERE user_id=pig_a) <> n_before THEN
		RAISE EXCEPTION 're-submit minted again';
	END IF;
	IF public.rooting_receipt(win) IS DISTINCT FROM res THEN RAISE EXCEPTION 'receipt not durable'; END IF;

	-- ── pig B: opens after A submitted → coop at open; wakes him in the mud ──
	PERFORM set_config('smoke.uid',pig_b::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean OR NOT (opened->>'coop')::boolean THEN
		RAISE EXCEPTION 'crewmate open should be co-op: %', opened;
	END IF;
	IF NOT (SELECT coop_at_open FROM public.war_rootings WHERE user_id=pig_b AND window_index=win) THEN
		RAISE EXCEPTION 'coop_at_open not stamped';
	END IF;
	IF jsonb_array_length(opened->'crew_dug') <> 1 OR (opened->'crew_dug'->0->>'layer_tied')::int <> 2 THEN
		RAISE EXCEPTION 'crew_dug lacks the layer: %', opened->'crew_dug';
	END IF;
	seed_b := (opened->>'seed')::int;
	-- Build a log that wakes him on a mud SHOVE (threshold 20): topsoil sniffs
	-- (threshold 0 — never) up to the first draw under 20, then the shove.
	draws := public._snout_deep_wake_draws(seed_b,45);
	FOR i IN 1..45 LOOP
		IF draws[i] < 20 THEN wake_at := i; EXIT; END IF;
	END LOOP;
	IF wake_at IS NULL OR wake_at > 31 THEN
		RAISE EXCEPTION 'smoke fixture: seed % has no mud-shove wake within 31 draws (%)', seed_b, draws;
	END IF;
	log := ARRAY[]::text[];
	FOR k IN 0..wake_at-2 LOOP log := log || ('s0:'||k)::text; END LOOP;
	log := log || 'h1:0'::text;
	-- and a trailing entry the server must truncate away
	res := public.submit_rooting_deep(pig_b,win,log || 'r1:1'::text,1::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l'],ARRAY[]::text[],ARRAY['l0:pouch']);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'mud wake refused: %', res; END IF;
	IF NOT (res->>'woke')::boolean OR res->>'woke_on' <> 'h1:0' OR (res->>'layer_tied')::int <> 1
		OR res->>'end_reason' <> 'wake' OR (res->>'actions')::int <> wake_at
		OR res->'credited' IS DISTINCT FROM '["truffle_d"]'::jsonb
		OR res->'carry_next' IS DISTINCT FROM '{"kind":"truffle_l","gild":1}'::jsonb THEN
		RAISE EXCEPTION 'mud wake receipt wrong: %', res;
	END IF;
	-- topsoil 'dig' + the Sounder Bonus (A submitted first); never 'dig_deep'
	IF (SELECT array_agg(reason ORDER BY reason) FROM public.war_truffles WHERE user_id=pig_b)
		<> ARRAY['dig','dig_echo'] THEN
		RAISE EXCEPTION 'mud wake mints wrong: %', (SELECT array_agg(reason ORDER BY reason) FROM public.war_truffles WHERE user_id=pig_b);
	END IF;
	-- A is paid back the echo (either order)
	IF (SELECT count(*) FROM public.war_truffles WHERE user_id=pig_a AND reason='dig_echo') <> 1 THEN
		RAISE EXCEPTION 'earlier crewmate not echoed';
	END IF;
	IF (SELECT kind||':'||gild FROM public.user_patch_carry WHERE user_id=pig_b) <> 'truffle_l:1' THEN
		RAISE EXCEPTION 'woken truffle not carried';
	END IF;
	IF (SELECT woke_on FROM public.war_rootings WHERE user_id=pig_b AND window_index=win) <> 'h1:0'
		OR (SELECT array_length(action_log,1) FROM public.war_rootings WHERE user_id=pig_b AND window_index=win) <> wake_at THEN
		RAISE EXCEPTION 'mud wake row not stamped / log not truncated';
	END IF;
	IF (SELECT count(*) FROM public.xp_ledger WHERE user_id=pig_b AND amount=20) <> 1 THEN
		RAISE EXCEPTION 'mud wake XP not granted';
	END IF;

	-- ── pig U: an uncrewed tie → 0 mints, no race row, +20 XP, receipt ok ───
	PERFORM set_config('smoke.uid',pig_u::text,true);
	res := public.submit_rooting_deep(pig_u,win,ARRAY['s0:5','s0:6'],0::smallint,ARRAY['truffle_d'],ARRAY[]::text[],ARRAY['l0:boom']);
	IF NOT (res->>'ok')::boolean OR (res->>'truffles')::int <> 0 OR NOT (res->>'uncrewed')::boolean
		OR (res->>'layer_tied')::int <> 0 OR res->'credited' IS DISTINCT FROM '["truffle_d"]'::jsonb THEN
		RAISE EXCEPTION 'uncrewed tie receipt wrong: %', res;
	END IF;
	IF EXISTS (SELECT 1 FROM public.war_truffles WHERE user_id=pig_u)
		OR EXISTS (SELECT 1 FROM public.race_digs WHERE user_id=pig_u) THEN
		RAISE EXCEPTION 'uncrewed dig minted or raced';
	END IF;
	IF (SELECT credited_finds FROM public.war_rootings WHERE user_id=pig_u AND window_index=win) <> 0 THEN
		RAISE EXCEPTION 'uncrewed dig credited a find';
	END IF;
	IF (SELECT count(*) FROM public.xp_ledger WHERE user_id=pig_u AND amount=20) <> 1 THEN
		RAISE EXCEPTION 'uncrewed XP not granted';
	END IF;
	IF public.rooting_receipt(win) IS DISTINCT FROM res THEN RAISE EXCEPTION 'uncrewed receipt not durable'; END IF;

	-- ── pig C: bad logs reject with no side effects ─────────────────────────
	PERFORM set_config('smoke.uid',pig_c::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean THEN RAISE EXCEPTION 'pig C open failed: %', opened; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:3','s0:3'],0::smallint,ARRAY['l0:truffle_d'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_log' THEN RAISE EXCEPTION 'double sniff accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['r1:0','r0:0'],1::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_log' THEN RAISE EXCEPTION 'layer regression accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['x0:0'],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_log' THEN RAISE EXCEPTION 'bad verb accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:30'],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_log' THEN RAISE EXCEPTION 'tile 30 accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s1:0'],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_log' THEN RAISE EXCEPTION 'p_layer above the log accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['l1:truffle_l'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_finds' THEN RAISE EXCEPTION 'mud truffle in topsoil accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['shimmer'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_finds' THEN RAISE EXCEPTION 'thing as a find accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_a,win,ARRAY['s0:0'],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'account_changed' THEN RAISE EXCEPTION 'wrong owner accepted: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win+1,ARRAY['s0:0'],0::smallint,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'window_changed' THEN RAISE EXCEPTION 'wrong window accepted: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.war_truffles WHERE user_id=pig_c)
		OR EXISTS (SELECT 1 FROM public.rooting_receipts WHERE user_id=pig_c)
		OR (SELECT submitted_at FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) IS NOT NULL THEN
		RAISE EXCEPTION 'a bad log had side effects';
	END IF;

	-- ── sync + close: the window ends with C's dig open → tied at the mud ────
	-- (topsoil sniffs only — threshold 0 — so the close can never be a wake;
	-- the layer is 1: descended, not yet acted, §10)
	res := public.sync_rooting(win,1::smallint,ARRAY['s0:0','s0:1','s0:2'],ARRAY['l0:truffle_d']);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'synced')::boolean THEN RAISE EXCEPTION 'sync refused: %', res; END IF;
	-- a shorter (stale) sync never regresses the log
	res := public.sync_rooting(win,0::smallint,ARRAY['s0:0'],ARRAY[]::text[]);
	IF (res->>'synced')::boolean THEN RAISE EXCEPTION 'stale sync regressed the log'; END IF;
	IF (SELECT array_length(action_log,1) FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) <> 3
		OR (SELECT layer_tied FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) <> 1
		OR (SELECT synced_finds FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) <> ARRAY['truffle_d'] THEN
		RAISE EXCEPTION 'sync did not land';
	END IF;
	-- Before the window ends nothing closes.
	PERFORM set_config('smoke.uid','',true);
	IF public.close_open_rootings() <> 0 THEN RAISE EXCEPTION 'closed a live dig'; END IF;
	PERFORM set_config('ttp.fake_now',(ends + interval '1 minute')::text,true);
	closed := public.close_open_rootings();
	IF closed <> 1 THEN RAISE EXCEPTION 'close_open_rootings closed % rows, expected 1', closed; END IF;
	IF (SELECT submitted_at FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) IS NULL THEN
		RAISE EXCEPTION 'stale row not tied';
	END IF;
	res := (SELECT receipt FROM public.rooting_receipts WHERE user_id=pig_c AND window_index=win);
	IF res IS NULL OR res->>'end_reason' <> 'close' OR NOT (res->>'closed')::boolean
		OR (res->>'layer_tied')::int <> 1 OR (res->>'truffles')::int < 1
		OR res->'credited' IS DISTINCT FROM '["truffle_d"]'::jsonb THEN
		RAISE EXCEPTION 'close receipt wrong: %', res;
	END IF;
	IF (res->>'woke')::boolean THEN RAISE EXCEPTION 'a topsoil-sniff log woke him'; END IF;
	IF (SELECT count(*) FROM public.war_truffles WHERE user_id=pig_c AND reason='dig') <> 1 THEN
		RAISE EXCEPTION 'close did not mint the banked topsoil truffle';
	END IF;
	-- Idempotent: a second sweep finds nothing.
	IF public.close_open_rootings() <> 0 THEN RAISE EXCEPTION 'close ran twice'; END IF;
	-- And the owner recovers the stored receipt after rollover.
	PERFORM set_config('smoke.uid',pig_c::text,true);
	IF public.rooting_receipt(win) IS DISTINCT FROM res THEN RAISE EXCEPTION 'closed receipt not recoverable'; END IF;

	UPDATE public.app_config SET enabled=false WHERE key='snout_deep';
	RAISE NOTICE 'chk snout deep: flag off classic + uncrewed no_crew · flag on crewed/uncrewed open · root tie 3 mints · mud wake dig+echo+carry · uncrewed 0 mints · idempotent · bad_log/bad_finds · sync + close cron OK';
END;
$snout_deep$;
