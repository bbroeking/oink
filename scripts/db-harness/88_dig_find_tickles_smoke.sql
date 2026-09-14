-- Every find pays tickles (20260913120000): the dig_finds row carries a
-- tickles value per kind; submit_rooting_deep sums the finds, applies them
-- through apply_tickles (tickles_earned + counter, never the bank) once per
-- (uid, window), and the receipt carries the per-find rows and the totals.
-- Uncrewed digs pay too; a truffle he took pays 0 and is listed as lost.
\set ON_ERROR_STOP on

DO $dig_find_tickles$
DECLARE
	pig_a uuid := '00000000-0000-0000-0000-000000088001';  -- crew T, ties at the root
	pig_b uuid := '00000000-0000-0000-0000-000000088002';  -- crew T, wakes him in the mud
	pig_u uuid := '00000000-0000-0000-0000-000000088003';  -- uncrewed
	crew_t uuid := '00000000-0000-0000-0000-000000088010';
	opened jsonb; res jsonb; again jsonb; win bigint;
	seed_b int; draws int[]; i int; wake_at int := NULL; log text[]; k int;
	before_a int; counter_a int; bank_a int; before_u int;
BEGIN
	-- ── the table ───────────────────────────────────────────────────────────
	IF (SELECT value->'truffle_d'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 10
		OR (SELECT value->'boom'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 3
		OR (SELECT value->'pouch'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 5
		OR (SELECT value->'apple'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 4
		OR (SELECT value->'junk'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 3
		OR (SELECT value->'truffle_l'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 15
		OR (SELECT value->'shimmer'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 8
		OR (SELECT value->'acorn'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 12
		OR (SELECT value->'tea'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 8
		OR (SELECT value->'scroll'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 10
		OR (SELECT value->'relic'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 15
		OR (SELECT value->'furnishing'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 20
		OR (SELECT value->'bow'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 25
		OR (SELECT value->'charm'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 12
		OR (SELECT value->'stone'->>'tickles' FROM public.app_settings WHERE key='dig_finds')::int <> 0 THEN
		RAISE EXCEPTION 'dig_finds tickles drifted from spec §2: %', (SELECT value FROM public.app_settings WHERE key='dig_finds');
	END IF;
	-- the odds survived the reshape
	IF (SELECT value->'relic'->'odds' FROM public.app_settings WHERE key='dig_finds') IS DISTINCT FROM '[2,5]'::jsonb
		OR (SELECT value->'bow'->'odds' FROM public.app_settings WHERE key='dig_finds') IS DISTINCT FROM '[1,12]'::jsonb THEN
		RAISE EXCEPTION 'dig_finds odds lost in the reshape';
	END IF;
	IF public._dig_find_tickles(pig_a,'acorn') <> 12 OR public._dig_find_tickles(pig_a,'boom') <> 3
		OR public._dig_find_tickles(pig_a,'nonsense') <> 0 OR public._dig_find_tickles(pig_a,'stone') <> 0 THEN
		RAISE EXCEPTION '_dig_find_tickles wrong';
	END IF;

	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (pig_a),(pig_b),(pig_u) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone,tickles_earned,counter) VALUES
		(pig_a,'tally-a','America/New_York',38,100),(pig_b,'tally-b','America/New_York',0,0),
		(pig_u,'tally-u','America/New_York',5,5)
		ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone,
			tickles_earned=EXCLUDED.tickles_earned, counter=EXCLUDED.counter;
	INSERT INTO public.user_items(user_id,item_count) VALUES (pig_a,4) ON CONFLICT DO NOTHING;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES (crew_t,'Tally T',pig_a,false) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES
		(crew_t,pig_a,'leader'),(crew_t,pig_b,'member') ON CONFLICT DO NOTHING;
	DELETE FROM public.user_patch_carry WHERE user_id IN (pig_a,pig_b,pig_u);
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb WHERE key='feeding_schedule';
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);   -- 08:01 ET: window 0 open
	UPDATE public.app_config SET enabled=true WHERE key='snout_deep';

	-- apply_tickles: the count and the snouts, never the bank; 0 is a read
	before_a := (SELECT tickles_earned FROM public.profiles WHERE id=pig_a);
	IF public.apply_tickles(pig_a,0) <> before_a THEN RAISE EXCEPTION 'apply_tickles(0) should read the count'; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_a) <> before_a THEN RAISE EXCEPTION 'apply_tickles(0) wrote'; END IF;

	-- ── pig A: a root tie — both truffles, boom, junk, scroll, relic ────────
	PERFORM set_config('smoke.uid',pig_a::text,true);
	opened := public.open_rooting(); win := (opened->>'window_index')::bigint;
	IF NOT (opened->>'ok')::boolean OR opened->>'mode' <> 'snout_deep' THEN RAISE EXCEPTION 'open failed: %', opened; END IF;
	IF opened->'dig_finds'->'acorn'->>'tickles' <> '12' THEN RAISE EXCEPTION 'open_rooting does not echo the tickles: %', opened->'dig_finds'; END IF;
	before_a := (SELECT tickles_earned FROM public.profiles WHERE id=pig_a);
	counter_a := (SELECT counter FROM public.profiles WHERE id=pig_a);
	bank_a := (SELECT item_count FROM public.user_items WHERE user_id=pig_a);
	res := public.submit_rooting_deep(pig_a,win,ARRAY['s0:0','s0:1','s1:7','s2:3'],2::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l'],ARRAY[]::text[],ARRAY['l1:scroll','l0:boom','l0:junk','l2:relic','l0:boom']);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'root tie refused: %', res; END IF;
	-- 10 + 15 + 10 + 3 + 3 + 15 = 56
	IF (res->>'tickles_total')::int <> 56 OR (res->>'tickled_before')::int <> before_a
		OR (res->>'tickled_now')::int <> before_a + 56 THEN
		RAISE EXCEPTION 'root tie totals wrong: %', res;
	END IF;
	IF res->'tickles' IS DISTINCT FROM
		'[{"id":"l0:truffle_d","kind":"truffle_d","tickles":10},{"id":"l1:truffle_l","kind":"truffle_l","tickles":15},{"id":"l1:scroll","kind":"scroll","tickles":10},{"id":"l0:boom","kind":"boom","tickles":3},{"id":"l0:junk","kind":"junk","tickles":3},{"id":"l2:relic","kind":"relic","tickles":15}]'::jsonb THEN
		RAISE EXCEPTION 'root tie tickle rows wrong: %', res->'tickles';
	END IF;
	-- things keep the client's order, deduped
	IF res->'things' IS DISTINCT FROM '["l1:scroll","l0:boom","l0:junk","l2:relic"]'::jsonb THEN
		RAISE EXCEPTION 'things lost their order: %', res->'things';
	END IF;
	-- (the snouts read >=: the mints also fire truffles_dug achievements, whose
	-- purses land on the same counter)
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_a) <> before_a + 56
		OR (SELECT counter FROM public.profiles WHERE id=pig_a) < counter_a + 56 THEN
		RAISE EXCEPTION 'tickles did not land on the count + snouts: earned % (before %) counter % (before %)',
			(SELECT tickles_earned FROM public.profiles WHERE id=pig_a), before_a,
			(SELECT counter FROM public.profiles WHERE id=pig_a), counter_a;
	END IF;
	IF (SELECT item_count FROM public.user_items WHERE user_id=pig_a) <> bank_a THEN
		RAISE EXCEPTION 'applied tickles touched the bank (never bankable)';
	END IF;
	IF (res->>'truffles')::int <> 3 THEN RAISE EXCEPTION 'root tie still mints 3: %', res; END IF;
	-- idempotent: the stored receipt, no second grant
	again := public.submit_rooting_deep(pig_a,win,ARRAY['h2:0'],2::smallint,ARRAY['l0:truffle_d'],ARRAY[]::text[],ARRAY['l0:boom']);
	IF again IS DISTINCT FROM res THEN RAISE EXCEPTION 're-submit did not return the stored receipt'; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_a) <> before_a + 56 THEN
		RAISE EXCEPTION 're-submit applied tickles again';
	END IF;

	-- ── pig B: wakes in the mud with the fat one loose → it pays 0, "lost" ──
	PERFORM set_config('smoke.uid',pig_b::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean THEN RAISE EXCEPTION 'pig B open failed: %', opened; END IF;
	seed_b := (opened->>'seed')::int;
	draws := public._snout_deep_wake_draws(seed_b,45);
	FOR i IN 1..45 LOOP
		IF draws[i] < 20 THEN wake_at := i; EXIT; END IF;
	END LOOP;
	IF wake_at IS NULL OR wake_at > 31 THEN
		RAISE EXCEPTION 'smoke fixture: seed % has no mud-shove wake within 31 draws', seed_b;
	END IF;
	log := ARRAY[]::text[];
	FOR k IN 0..wake_at-2 LOOP log := log || ('s0:'||k)::text; END LOOP;
	log := log || 'h1:0'::text;
	res := public.submit_rooting_deep(pig_b,win,log,1::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l'],ARRAY[]::text[],ARRAY['l0:pouch','l1:tea']);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'woke')::boolean THEN RAISE EXCEPTION 'mud wake wrong: %', res; END IF;
	-- domino 10 + pouch 5 + tea 8 = 23; the fat one lost at 0, first
	IF (res->>'tickles_total')::int <> 23 OR (res->>'tickled_before')::int <> 0 OR (res->>'tickled_now')::int <> 23 THEN
		RAISE EXCEPTION 'mud wake totals wrong: %', res;
	END IF;
	IF res->'tickles'->0 IS DISTINCT FROM '{"id":"l1:truffle_l","kind":"truffle_l","tickles":0,"lost":true}'::jsonb
		OR jsonb_array_length(res->'tickles') <> 4 THEN
		RAISE EXCEPTION 'mud wake tickle rows wrong: %', res->'tickles';
	END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_b) <> 23 THEN RAISE EXCEPTION 'mud wake tickles not applied'; END IF;

	-- ── pig U: uncrewed — no truffles minted, every find still pays ─────────
	PERFORM set_config('smoke.uid',pig_u::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean OR NOT (opened->>'uncrewed')::boolean THEN RAISE EXCEPTION 'uncrewed open failed: %', opened; END IF;
	before_u := (SELECT tickles_earned FROM public.profiles WHERE id=pig_u);
	res := public.submit_rooting_deep(pig_u,win,ARRAY['s0:5','s0:6'],0::smallint,ARRAY['truffle_d'],ARRAY[]::text[],ARRAY['l0:apple','l0:boom']);
	IF NOT (res->>'ok')::boolean OR (res->>'truffles')::int <> 0 THEN RAISE EXCEPTION 'uncrewed tie wrong: %', res; END IF;
	-- 10 + 4 + 3 = 17
	IF (res->>'tickles_total')::int <> 17 OR (res->>'tickled_before')::int <> before_u
		OR (res->>'tickled_now')::int <> before_u + 17 THEN
		RAISE EXCEPTION 'uncrewed totals wrong: %', res;
	END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_u) <> before_u + 17 THEN
		RAISE EXCEPTION 'uncrewed tickles not applied';
	END IF;
	IF EXISTS (SELECT 1 FROM public.war_truffles WHERE user_id=pig_u) THEN RAISE EXCEPTION 'uncrewed dig minted'; END IF;
	IF public.rooting_receipt(win)->>'tickles_total' <> '17' THEN RAISE EXCEPTION 'tally not durable'; END IF;

	UPDATE public.app_config SET enabled=false WHERE key='snout_deep';
	RAISE NOTICE 'chk dig find tickles: table · apply_tickles count+snouts never bank · root tie 56 · idempotent · mud wake lost 0 first · uncrewed 17 OK';
END;
$dig_find_tickles$;
