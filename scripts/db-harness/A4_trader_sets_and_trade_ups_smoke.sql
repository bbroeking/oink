-- The Ghost Sheep v2: sets and trade-ups
-- (20261029210000_trader_sets_and_trade_ups.sql, on top of 20260917170000 +
-- 20260920100000).
--
-- Asserts:
--   1. Tuning: his bag is nine a visit; pair_multiplier 1.5, trade_up on, three
--      alike; the Satchel's own cap is still the unbounded sentinel.
--   2. Pairs, judged over the visit's ledger: the 2nd of one find pays half
--      again on the two (3 + 6 = 9), the 3rd opens a new pair at the single
--      price, another find never completes it, the fancied find pairs at its
--      doubled price (16 + 32 = 48). Count only, never snouts. Status shows
--      `unpaired`. The replay answers the original pair receipt and pays
--      nothing twice.
--   3. Trade-up refusals: rare (no_trade_up, nothing moves), an unknown find,
--      fewer than three in the bag (not_enough with the bag), before he
--      arrives (not_here).
--   4. Trade-up 3 -> 1: three pebbles leave, ONE find of the next rarity comes
--      back (his seeded pick, the one status showed), source 'trader', met,
--      new_to_bag; one ledger row kind 'trade_up', tickles 0; the count and
--      the snouts untouched; the three count against the visit.
--   5. Nonce idempotency: the replay is the original receipt (same bag row
--      back, nothing else moves); a trade-up nonce is not a sale's and a
--      sale's is not a trade-up's (bad_nonce); another pig's nonce is bad.
--   6. Cap: with the nine spent, a trade-up and a single both answer
--      had_enough and nothing moves.
--   7. Uncommon -> rare for a second pig, and a friend's gift is spent last.
--   8. tickle_breakdown's trader lane counts the pair bonuses and no trade-up.
--
-- Fixture ids live in the ...0C000n block (98 uses ...0B000n). Pigs have no
-- feeding zone, so the trader keeps America/New_York time (2026-06-01, EDT).
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $sets$
DECLARE
	p uuid := '00000000-0000-0000-0000-0000000c0001'; -- the seller
	q uuid := '00000000-0000-0000-0000-0000000c0002'; -- uncommon -> rare
	res jsonb; res2 jsonb;
	visit_id bigint; arrives timestamptz; leaves timestamptz;
	q_arrives timestamptz;
	t0 timestamptz := '2026-06-01 12:00+00';
	peb bigint[]; keys bigint[]; clov bigint[]; whis bigint[]; shells bigint[];
	gift_id bigint; got bigint; pick text; q_pick text;
	n int; earned int; cnt int;
	s1 uuid := 'a3000000-0000-0000-0000-000000000001';
	s2 uuid := 'a3000000-0000-0000-0000-000000000002';
	s3 uuid := 'a3000000-0000-0000-0000-000000000003';
	s4 uuid := 'a3000000-0000-0000-0000-000000000004';
	s5 uuid := 'a3000000-0000-0000-0000-000000000005';
	s6 uuid := 'a3000000-0000-0000-0000-000000000006';
	s7 uuid := 'a3000000-0000-0000-0000-000000000007';
	u1 uuid := 'a3000000-0000-0000-0000-0000000000a1';
	u2 uuid := 'a3000000-0000-0000-0000-0000000000a2';
	u3 uuid := 'a3000000-0000-0000-0000-0000000000a3';
	u4 uuid := 'a3000000-0000-0000-0000-0000000000a4';
	u5 uuid := 'a3000000-0000-0000-0000-0000000000a5';
BEGIN
	-- ── fixtures ─────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (p),(q) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id, username, discriminator, tickles_earned, counter, alignment_score) VALUES
		(p,'sets-seller','0001',100,100,0), (q,'sets-upper','0002',0,0,0)
		ON CONFLICT(id) DO UPDATE SET username = EXCLUDED.username,
			discriminator = EXCLUDED.discriminator,
			tickles_earned = EXCLUDED.tickles_earned,
			counter = EXCLUDED.counter, alignment_score = EXCLUDED.alignment_score;
	UPDATE public.profiles SET is_test = false WHERE id IN (p,q);
	DELETE FROM public.trader_sales WHERE user_id IN (p,q);
	DELETE FROM public.trader_visits WHERE user_id IN (p,q);
	DELETE FROM public.satchel_items WHERE user_id IN (p,q);
	DELETE FROM public.satchel_met WHERE user_id IN (p,q);
	WITH ins AS (INSERT INTO public.satchel_items(user_id, find_id)
		SELECT p, 'river_pebble' FROM generate_series(1, 6) RETURNING id)
	SELECT array_agg(id ORDER BY id) INTO peb FROM ins;
	WITH ins AS (INSERT INTO public.satchel_items(user_id, find_id)
		SELECT p, 'old_key' FROM generate_series(1, 2) RETURNING id)
	SELECT array_agg(id ORDER BY id) INTO keys FROM ins;
	WITH ins AS (INSERT INTO public.satchel_items(user_id, find_id)
		SELECT p, 'clover' FROM generate_series(1, 2) RETURNING id)
	SELECT array_agg(id ORDER BY id) INTO clov FROM ins;
	WITH ins AS (INSERT INTO public.satchel_items(user_id, find_id)
		SELECT p, 'tin_whistle' FROM generate_series(1, 3) RETURNING id)
	SELECT array_agg(id ORDER BY id) INTO whis FROM ins;
	WITH ins AS (INSERT INTO public.satchel_items(user_id, find_id)
		SELECT p, 'snail_shell' FROM generate_series(1, 3) RETURNING id)
	SELECT array_agg(id ORDER BY id) INTO shells FROM ins;

	PERFORM set_config('ttp.fake_now', t0::text, true);
	PERFORM set_config('smoke.uid', p::text, true);

	-- ── 1. tuning ────────────────────────────────────────────────────────────
	res := public.trader_status();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'trader_status: %', res; END IF;
	IF (res->>'finds_per_visit')::int <> 9 OR (res->'visit'->>'finds_left')::int <> 9 THEN
		RAISE EXCEPTION 'his bag is nine a visit: %', res; END IF;
	IF (res->>'pair_multiplier')::numeric <> 1.5 OR NOT (res->>'trade_up')::boolean
		OR (res->>'trade_up_count')::int <> 3 THEN
		RAISE EXCEPTION 'pair / trade-up tuning: %', res; END IF;
	IF (public._satchel_tuning()->>'cap')::int <> 9999 THEN
		RAISE EXCEPTION 'the Satchel stays unbounded: %', public._satchel_tuning(); END IF;
	arrives := (res->'visit'->>'arrives_at')::timestamptz;
	leaves := (res->'visit'->>'leaves_at')::timestamptz;
	visit_id := (res->'visit'->>'id')::bigint;

	-- ── 3a. before he arrives ────────────────────────────────────────────────
	PERFORM set_config('ttp.fake_now', (arrives - interval '1 minute')::text, true);
	res := public.trader_status();
	IF res->'visit'->'trade_ups' <> '{}'::jsonb OR res->'visit'->'unpaired' <> '[]'::jsonb THEN
		RAISE EXCEPTION 'his picks are his to say, once he is here: %', res; END IF;
	res := public.trade_up_with_trader('river_pebble', u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_here' THEN RAISE EXCEPTION 'expected not_here: %', res; END IF;
	IF (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = p) <> 16 THEN RAISE EXCEPTION 'nothing may move before he is here'; END IF;

	PERFORM set_config('ttp.fake_now', (arrives + interval '1 minute')::text, true);
	UPDATE public.trader_visits SET want_find_id = 'old_key' WHERE id = visit_id;
	res := public.trader_status();
	IF NOT (res->>'present')::boolean THEN RAISE EXCEPTION 'he should be here: %', res; END IF;
	pick := res->'visit'->'trade_ups'->>'common';
	IF pick IS NULL OR pick <> public._trader_trade_up_pick(p, '2026-06-01', 'uncommon') THEN
		RAISE EXCEPTION 'status must show his common -> uncommon pick: %', res; END IF;
	IF (SELECT rarity FROM public.satchel_finds WHERE id = pick) <> 'uncommon' THEN
		RAISE EXCEPTION 'the pick must be one rarity up: %', pick; END IF;
	IF res->'visit'->'trade_ups'->>'uncommon' <> 'tin_whistle' THEN
		RAISE EXCEPTION 'uncommon -> the rare: %', res; END IF;
	IF res->'visit'->'trade_ups' ? 'rare' THEN RAISE EXCEPTION 'rare has no trade-up: %', res; END IF;

	-- ── 2. pairs ─────────────────────────────────────────────────────────────
	res := public.trade_with_trader(peb[1], s1);
	IF NOT (res->>'ok')::boolean OR (res->>'tickles')::int <> 3 OR (res->>'pair')::boolean
		OR (res->>'pair_bonus')::int <> 0 THEN
		RAISE EXCEPTION 'the first pebble is a single: %', res; END IF;
	res := public.trader_status();
	IF res->'visit'->'unpaired' <> '["river_pebble"]'::jsonb THEN RAISE EXCEPTION 'one pebble waits for its pair: %', res; END IF;
	res := public.trade_with_trader(peb[2], s2);
	IF NOT (res->>'ok')::boolean OR (res->>'tickles')::int <> 6 OR NOT (res->>'pair')::boolean
		OR (res->>'pair_bonus')::int <> 3 THEN
		RAISE EXCEPTION 'the second pebble completes the pair, 3 + 3 then half again: %', res; END IF;
	IF (res->>'before')::int <> 103 OR (res->>'after')::int <> 109 THEN RAISE EXCEPTION 'pair tally: %', res; END IF;
	SELECT tickles_earned, counter INTO earned, cnt FROM public.profiles WHERE id = p;
	IF earned <> 109 OR cnt <> 100 THEN RAISE EXCEPTION 'a pair pays the count only: earned=% counter=%', earned, cnt; END IF;
	res := public.trader_status();
	IF res->'visit'->'unpaired' <> '[]'::jsonb THEN RAISE EXCEPTION 'the pair is closed: %', res; END IF;
	-- replay of the pair: the original receipt, nothing twice
	res2 := public.trade_with_trader(peb[2], s2);
	IF NOT (res2->>'replay')::boolean OR NOT (res2->>'pair')::boolean OR (res2->>'tickles')::int <> 6
		OR (res2->>'after')::int <> 109 THEN
		RAISE EXCEPTION 'pair replay: %', res2; END IF;
	-- a clover never completes a pebble's pair
	res := public.trade_with_trader(clov[1], s3);
	IF (res->>'tickles')::int <> 3 OR (res->>'pair')::boolean THEN RAISE EXCEPTION 'a lone clover: %', res; END IF;
	-- the third pebble opens a new pair at the single price
	res := public.trade_with_trader(peb[3], s4);
	IF (res->>'tickles')::int <> 3 OR (res->>'pair')::boolean THEN RAISE EXCEPTION 'the third pebble is a single: %', res; END IF;
	res := public.trader_status();
	IF res->'visit'->'unpaired' <> '["clover", "river_pebble"]'::jsonb THEN
		RAISE EXCEPTION 'clover and pebble each wait: %', res->'visit'->'unpaired'; END IF;
	-- the fancied find pairs at its doubled price: 16, then 16 + 16 = 32
	res := public.trade_with_trader(keys[1], s5);
	IF (res->>'tickles')::int <> 16 OR NOT (res->>'was_want')::boolean THEN RAISE EXCEPTION 'fancied key: %', res; END IF;
	res := public.trade_with_trader(keys[2], s6);
	IF (res->>'tickles')::int <> 32 OR (res->>'pair_bonus')::int <> 16 THEN RAISE EXCEPTION 'fancied pair, 48 in all: %', res; END IF;
	IF (res->>'finds_left')::int <> 3 OR (res->>'visit_tickles')::int <> 63 THEN RAISE EXCEPTION 'six sold, 63 paid: %', res; END IF;

	-- ── 3b. refusals ─────────────────────────────────────────────────────────
	res := public.trade_up_with_trader('tin_whistle', u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'no_trade_up' THEN RAISE EXCEPTION 'rare has no trade-up: %', res; END IF;
	IF (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = p AND find_id = 'tin_whistle') <> 3 THEN
		RAISE EXCEPTION 'the whistles stay'; END IF;
	res := public.trade_up_with_trader('not_a_find', u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'no_trade_up' THEN RAISE EXCEPTION 'unknown find: %', res; END IF;
	res := public.trade_up_with_trader('clover', u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_enough' OR jsonb_array_length(res->'bag') <> 10 THEN
		RAISE EXCEPTION 'one clover is not three (with the bag): %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.trader_sales WHERE nonce = u1) THEN RAISE EXCEPTION 'a refusal wrote the ledger'; END IF;

	-- ── 4. three pebbles, one up ─────────────────────────────────────────────
	res := public.trade_up_with_trader('river_pebble', u1);
	IF NOT (res->>'ok')::boolean OR (res->>'replay')::boolean THEN RAISE EXCEPTION 'trade-up: %', res; END IF;
	IF res->>'gave_find_id' <> 'river_pebble' OR (res->>'count')::int <> 3 OR res->>'got_find_id' <> pick THEN
		RAISE EXCEPTION 'trade-up receipt: %', res; END IF;
	got := (res->>'got_item_id')::bigint;
	IF NOT (res->>'new_to_bag')::boolean THEN RAISE EXCEPTION 'no uncommon was left in the bag, so it is new: %', res; END IF;
	IF (res->>'finds_left')::int <> 0 THEN RAISE EXCEPTION 'the three count against the visit: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.satchel_items WHERE user_id = p AND find_id = 'river_pebble') THEN
		RAISE EXCEPTION 'the three pebbles must be gone'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = got AND user_id = p AND find_id = pick AND source = 'trader') THEN
		RAISE EXCEPTION 'one % came back from the trader', pick; END IF;
	IF jsonb_array_length(res->'bag') <> 8 THEN RAISE EXCEPTION 'whole bag after (10 - 3 + 1): %', res->'bag'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_met WHERE user_id = p AND find_id = pick) THEN
		RAISE EXCEPTION 'the find that came back is met'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_sales WHERE user_id = p AND kind = 'trade_up';
	IF n <> 1 THEN RAISE EXCEPTION 'one trade_up ledger row: %', n; END IF;
	IF (SELECT tickles FROM public.trader_sales WHERE nonce = u1) <> 0
		OR (SELECT array_length(item_ids, 1) FROM public.trader_sales WHERE nonce = u1) <> 3 THEN
		RAISE EXCEPTION 'a trade-up pays nothing and names its three'; END IF;
	SELECT tickles_earned, counter INTO earned, cnt FROM public.profiles WHERE id = p;
	IF earned <> 163 OR cnt <> 100 THEN RAISE EXCEPTION 'a trade-up is a sink, never a faucet: earned=% counter=%', earned, cnt; END IF;

	-- ── 5. nonce idempotency ─────────────────────────────────────────────────
	res2 := public.trade_up_with_trader('river_pebble', u1);
	IF NOT (res2->>'ok')::boolean OR NOT (res2->>'replay')::boolean
		OR (res2->>'got_item_id')::bigint <> got OR res2->>'got_find_id' <> pick THEN
		RAISE EXCEPTION 'trade-up replay must be the original receipt: %', res2; END IF;
	IF (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = p) <> 8 THEN RAISE EXCEPTION 'a replay moved the bag'; END IF;
	IF (SELECT sold FROM public.trader_visits WHERE id = visit_id) <> 9 THEN RAISE EXCEPTION 'a replay counted again'; END IF;
	res := public.trade_with_trader(clov[2], u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_nonce' THEN RAISE EXCEPTION 'a trade-up nonce is not a sale: %', res; END IF;
	res := public.trade_up_with_trader('river_pebble', s1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_nonce' THEN RAISE EXCEPTION 'a sale nonce is not a trade-up: %', res; END IF;

	-- ── 6. the cap ───────────────────────────────────────────────────────────
	res := public.trade_up_with_trader('snail_shell', u2);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'had_enough' OR (res->>'leaves_at')::timestamptz <> leaves THEN
		RAISE EXCEPTION 'nine taken: a trade-up is had_enough: %', res; END IF;
	res := public.trade_with_trader(shells[1], s7);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'had_enough' THEN RAISE EXCEPTION 'nine taken: a single too: %', res; END IF;
	IF (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = p AND find_id = 'snail_shell') <> 3 THEN
		RAISE EXCEPTION 'the shells stay'; END IF;
	-- one short of the cap is still had_enough for three
	UPDATE public.trader_visits SET sold = 7 WHERE id = visit_id;
	res := public.trade_up_with_trader('snail_shell', u2);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'had_enough' OR (res->>'finds_left')::int <> 2 THEN
		RAISE EXCEPTION 'two left is not room for three: %', res; END IF;
	UPDATE public.trader_visits SET sold = 9 WHERE id = visit_id;
	-- another pig's trade-up nonce
	PERFORM set_config('smoke.uid', q::text, true);
	res := public.trade_up_with_trader('river_pebble', u1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_nonce' THEN RAISE EXCEPTION 'someone else''s nonce: %', res; END IF;

	-- ── 7. uncommon -> rare, a gift spent last ───────────────────────────────
	INSERT INTO public.satchel_items(user_id, find_id, source, created_at)
		VALUES (q, 'honeycomb', 'gift', '2026-01-01 00:00+00') RETURNING id INTO gift_id;
	INSERT INTO public.satchel_items(user_id, find_id) SELECT q, 'honeycomb' FROM generate_series(1, 3);
	PERFORM set_config('ttp.fake_now', t0::text, true);
	res := public.trader_status();
	q_arrives := (res->'visit'->>'arrives_at')::timestamptz;
	PERFORM set_config('ttp.fake_now', (q_arrives + interval '1 minute')::text, true);
	res := public.trader_status();
	IF NOT (res->>'present')::boolean THEN RAISE EXCEPTION 'q: he should be here: %', res; END IF;
	q_pick := res->'visit'->'trade_ups'->>'uncommon';
	res := public.trade_up_with_trader('honeycomb', u3);
	IF NOT (res->>'ok')::boolean OR res->>'got_find_id' <> 'tin_whistle' OR q_pick <> 'tin_whistle'
		OR NOT (res->>'new_to_bag')::boolean THEN
		RAISE EXCEPTION 'three honeycomb -> the whistle: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = gift_id) THEN
		RAISE EXCEPTION 'the friend''s gift is spent last'; END IF;
	IF (res->>'finds_left')::int <> 6 THEN RAISE EXCEPTION 'q took three of nine: %', res; END IF;
	-- the whistle is rare: it goes no further
	INSERT INTO public.satchel_items(user_id, find_id) SELECT q, 'tin_whistle' FROM generate_series(1, 2);
	res := public.trade_up_with_trader('tin_whistle', u4);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'no_trade_up' THEN RAISE EXCEPTION 'three whistles stay whistles: %', res; END IF;
	-- switched off by tuning: no trade-ups, no picks in status
	UPDATE public.app_settings SET value = value || '{"trade_up": false}'::jsonb WHERE key = 'trader_tuning';
	res := public.trade_up_with_trader('honeycomb', u5);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'no_trade_up' THEN RAISE EXCEPTION 'trade_up off: %', res; END IF;
	res := public.trader_status();
	IF (res->>'trade_up')::boolean OR res->'visit'->'trade_ups' <> '{}'::jsonb THEN RAISE EXCEPTION 'off hides the picks: %', res; END IF;
	UPDATE public.app_settings SET value = value || '{"trade_up": true}'::jsonb WHERE key = 'trader_tuning';

	-- ── 8. the glass box ─────────────────────────────────────────────────────
	res := public.tickle_breakdown(p);
	IF (res->>'trader')::int <> 63 THEN RAISE EXCEPTION 'trader lane = singles + pair bonuses, no trade-up: %', res; END IF;
	res := public.tickle_breakdown(q);
	IF (res->>'trader')::int <> 0 THEN RAISE EXCEPTION 'a trade-up pays no lane: %', res; END IF;

	PERFORM set_config('ttp.fake_now', '', true);
	RAISE NOTICE 'chk A4 trader sets and trade-ups: ok';
END;
$sets$;
