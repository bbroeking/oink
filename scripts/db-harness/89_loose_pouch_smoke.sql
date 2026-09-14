-- The loose pouch (20260914090000): only Tie it off banks a thing. On a
-- wake every consumable — whether the client listed it banked or missed — is
-- lost with the pouch (0, lost); collection things are kept but unpaid (0,
-- kept). On a tie the banked consumables in p_finds pay their table value and
-- the collection things pay too. A collection kind in p_finds, or a thing
-- from a layer the dig never reached, is bad_finds. Idempotent per window.
\set ON_ERROR_STOP on

DO $loose_pouch$
DECLARE
	pig_a uuid := '00000000-0000-0000-0000-000000089001';  -- crew P, ties at the root
	pig_b uuid := '00000000-0000-0000-0000-000000089002';  -- crew P, wakes him in the mud
	pig_c uuid := '00000000-0000-0000-0000-000000089003';  -- crew P, bad finds
	crew_p uuid := '00000000-0000-0000-0000-000000089010';
	opened jsonb; res jsonb; again jsonb; win bigint;
	seed_b int; draws int[]; i int; wake_at int := NULL; log text[]; k int;
	before_a int; before_b int;
BEGIN
	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (pig_a),(pig_b),(pig_c) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone,tickles_earned,counter) VALUES
		(pig_a,'pouch-a','America/New_York',40,100),(pig_b,'pouch-b','America/New_York',7,7),
		(pig_c,'pouch-c','America/New_York',0,0)
		ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone,
			tickles_earned=EXCLUDED.tickles_earned, counter=EXCLUDED.counter;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES (crew_p,'Pouch P',pig_a,false) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES
		(crew_p,pig_a,'leader'),(crew_p,pig_b,'member'),(crew_p,pig_c,'member') ON CONFLICT DO NOTHING;
	DELETE FROM public.user_patch_carry WHERE user_id IN (pig_a,pig_b,pig_c);
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb WHERE key='feeding_schedule';
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);   -- 08:01 ET: window 0 open
	UPDATE public.app_config SET enabled=true WHERE key='snout_deep';

	-- ── pig B: wakes in the mud — the topsoil Boom in p_missed pays 0 ───────
	-- The client's honest payload after a wake: the domino banked on descent,
	-- the fat one it had loose, and the pouch (the Boom from topsoil, the tea
	-- from the mud) in p_missed; the keepsake kept in p_things.
	PERFORM set_config('smoke.uid',pig_b::text,true);
	opened := public.open_rooting(); win := (opened->>'window_index')::bigint;
	IF NOT (opened->>'ok')::boolean OR opened->>'mode' <> 'snout_deep' THEN RAISE EXCEPTION 'pig B open failed: %', opened; END IF;
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
	before_b := (SELECT tickles_earned FROM public.profiles WHERE id=pig_b);
	res := public.submit_rooting_deep(pig_b,win,log,1::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l'],ARRAY['l0:boom','l1:tea'],ARRAY['l0:junk']);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'woke')::boolean THEN RAISE EXCEPTION 'mud wake wrong: %', res; END IF;
	-- Paid: the domino alone (10). The fat one his (0), the Boom and the tea
	-- lost (0), the keepsake kept (0).
	IF (res->>'tickles_total')::int <> 10 OR (res->>'tickled_before')::int <> before_b
		OR (res->>'tickled_now')::int <> before_b + 10 THEN
		RAISE EXCEPTION 'mud wake totals wrong: %', res;
	END IF;
	IF res->'tickles' IS DISTINCT FROM
		'[{"id":"l1:truffle_l","kind":"truffle_l","tickles":0,"lost":true},{"id":"l0:boom","kind":"boom","tickles":0,"lost":true},{"id":"l1:tea","kind":"tea","tickles":0,"lost":true},{"id":"l0:truffle_d","kind":"truffle_d","tickles":10},{"id":"l0:junk","kind":"junk","tickles":0,"kept":true}]'::jsonb THEN
		RAISE EXCEPTION 'mud wake tickle rows wrong: %', res->'tickles';
	END IF;
	IF res->'lost_things' IS DISTINCT FROM '["l0:boom","l1:tea"]'::jsonb
		OR res->'banked_things' IS DISTINCT FROM '[]'::jsonb
		OR res->'things' IS DISTINCT FROM '["l0:junk"]'::jsonb THEN
		RAISE EXCEPTION 'mud wake pouch lists wrong: %', res;
	END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_b) <> before_b + 10 THEN
		RAISE EXCEPTION 'mud wake applied the lost pouch: %', (SELECT tickles_earned FROM public.profiles WHERE id=pig_b);
	END IF;
	-- The fat one still carries gilded; the lost things never do.
	IF (SELECT kind FROM public.user_patch_carry WHERE user_id=pig_b) IS DISTINCT FROM 'truffle_l' THEN
		RAISE EXCEPTION 'mud wake carry wrong';
	END IF;

	-- ── pig A: a root tie — the same Boom in p_finds pays its topsoil value ──
	PERFORM set_config('smoke.uid',pig_a::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean THEN RAISE EXCEPTION 'pig A open failed: %', opened; END IF;
	before_a := (SELECT tickles_earned FROM public.profiles WHERE id=pig_a);
	-- p_finds: the truffles, then the pouch the tie banked (Boom, scroll,
	-- charm) in surfacing order; p_things: the keepsake and the relic. A
	-- consumable misrouted into p_things (the acorn) is sorted by kind and
	-- banks too; a duplicate Boom is deduped.
	res := public.submit_rooting_deep(pig_a,win,ARRAY['s0:0','s0:1','s1:7','s2:3'],2::smallint,
		ARRAY['l0:truffle_d','l1:truffle_l','l0:boom','l1:scroll','l2:charm','l0:boom'],ARRAY[]::text[],
		ARRAY['l0:junk','l1:acorn','l2:relic']);
	IF NOT (res->>'ok')::boolean OR (res->>'woke')::boolean THEN RAISE EXCEPTION 'root tie refused: %', res; END IF;
	-- 10 + 15 + 3 + 10 + 12 + 12 (acorn) + 3 (junk) + 15 (relic) = 80
	IF (res->>'tickles_total')::int <> 80 OR (res->>'tickled_before')::int <> before_a
		OR (res->>'tickled_now')::int <> before_a + 80 THEN
		RAISE EXCEPTION 'root tie totals wrong: %', res;
	END IF;
	IF res->'tickles' IS DISTINCT FROM
		'[{"id":"l0:truffle_d","kind":"truffle_d","tickles":10},{"id":"l1:truffle_l","kind":"truffle_l","tickles":15},{"id":"l0:boom","kind":"boom","tickles":3},{"id":"l1:scroll","kind":"scroll","tickles":10},{"id":"l2:charm","kind":"charm","tickles":12},{"id":"l1:acorn","kind":"acorn","tickles":12},{"id":"l0:junk","kind":"junk","tickles":3},{"id":"l2:relic","kind":"relic","tickles":15}]'::jsonb THEN
		RAISE EXCEPTION 'root tie tickle rows wrong: %', res->'tickles';
	END IF;
	IF res->'banked_things' IS DISTINCT FROM '["l0:boom","l1:scroll","l2:charm","l1:acorn"]'::jsonb
		OR res->'lost_things' IS DISTINCT FROM '[]'::jsonb
		OR res->'things' IS DISTINCT FROM '["l0:junk","l2:relic"]'::jsonb THEN
		RAISE EXCEPTION 'root tie pouch lists wrong: %', res;
	END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_a) <> before_a + 80 THEN
		RAISE EXCEPTION 'root tie tickles not applied';
	END IF;
	-- 3 by layers banked + 1 'dig_echo' (pig B, a crewmate, minted first).
	IF (res->>'truffles')::int <> 4 OR NOT (res->>'echo')::boolean THEN RAISE EXCEPTION 'root tie should mint 3 + the echo: %', res; END IF;
	-- idempotent: the stored receipt, no second grant
	again := public.submit_rooting_deep(pig_a,win,ARRAY['h2:0'],2::smallint,ARRAY['l0:boom'],ARRAY[]::text[],ARRAY[]::text[]);
	IF again IS DISTINCT FROM res THEN RAISE EXCEPTION 're-submit did not return the stored receipt'; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=pig_a) <> before_a + 80 THEN
		RAISE EXCEPTION 're-submit applied tickles again';
	END IF;

	-- ── pig C: bad finds — a collection kind in p_finds; a thing from too deep ─
	PERFORM set_config('smoke.uid',pig_c::text,true);
	opened := public.open_rooting();
	IF NOT (opened->>'ok')::boolean THEN RAISE EXCEPTION 'pig C open failed: %', opened; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['l2:relic'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_finds' THEN RAISE EXCEPTION 'a relic in p_finds should be bad_finds: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['l1:acorn'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_finds' THEN RAISE EXCEPTION 'a mud acorn on a topsoil tie should be bad_finds: %', res; END IF;
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['l0:nonsense'],ARRAY[]::text[],ARRAY[]::text[]);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_finds' THEN RAISE EXCEPTION 'an unknown kind in p_finds should be bad_finds: %', res; END IF;
	-- A bad_finds rejects with no side effects: the row is still open, no tickles landed.
	IF (SELECT submitted_at FROM public.war_rootings WHERE user_id=pig_c AND window_index=win) IS NOT NULL
		OR (SELECT tickles_earned FROM public.profiles WHERE id=pig_c) <> 0 THEN
		RAISE EXCEPTION 'bad_finds had side effects';
	END IF;
	-- Then the honest topsoil tie: a Boom banked pays 3; a consumable in
	-- p_missed on a tie is a client bug and is dropped, not lost.
	res := public.submit_rooting_deep(pig_c,win,ARRAY['s0:0'],0::smallint,ARRAY['l0:boom'],ARRAY['l0:pouch'],ARRAY[]::text[]);
	IF NOT (res->>'ok')::boolean OR (res->>'tickles_total')::int <> 3
		OR res->'lost_things' IS DISTINCT FROM '[]'::jsonb
		OR res->'banked_things' IS DISTINCT FROM '["l0:boom"]'::jsonb THEN
		RAISE EXCEPTION 'topsoil tie wrong: %', res;
	END IF;
	IF public.rooting_receipt(win)->>'tickles_total' <> '3' THEN RAISE EXCEPTION 'tally not durable'; END IF;

	UPDATE public.app_config SET enabled=false WHERE key='snout_deep';
	RAISE NOTICE 'chk loose pouch: mud wake lost Boom+tea 0 · kept junk 0 · paid 10 · root tie banked pouch 80 · idempotent · bad_finds relic/deep/unknown · tie drops missed consumable OK';
END;
$loose_pouch$;
