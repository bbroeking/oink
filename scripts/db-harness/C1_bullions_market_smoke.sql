-- Bullion's Market smoke (20261031100000_bullions_market.sql).
-- Runs on the stand-alone prep (00x_market_prep.sql); see its header.
--
-- Asserts:
--   1. market_state seeds every find near its usual price; Bullion's two
--      prices follow max(U+1, ceil(1.2P)) / min(U, floor(0.8P)).
--   2. Counter sell: price_moved guard, the set leaves, the bank gets his
--      price, P drops 3% of U, the ledger and the tape learn it; a replayed
--      nonce answers the same receipt and moves nothing; not_a_set.
--   3. Counter buy: not_enough_tickles; the set arrives with its cost basis;
--      P rises 3% of U.
--   4. A listing between his prices rests with its set held aside; a pig
--      buys it, the price moves a third of the way, the poster is told.
--   5. A sell listing at or under his buying price sells to him at once; a
--      wanted ad at or over his selling price buys from him at once; a sell
--      meets a resting wanted ad (the better of pig and counter).
--   6. Swaps: one friend only (a stranger cannot see or take it), straight up,
--      no tickles, the price stays put, a not_a_friend target refused.
--   7. Cancel brings the set home; too_many_offers at the fifth listing.
--   8. A wanted ad whose pig tickled its tickles away lapses when a seller comes.
--   9. The counter crosses a resting listing once its price reaches it.
--  10. A day later: the walk caught up (one point per tick), listings
--      expired with their sets home, notices handed over once; market_ping.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-00000000c101'),
	('00000000-0000-0000-0000-00000000c102'),
	('00000000-0000-0000-0000-00000000c103');
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000c101', 'rosie'),
	('00000000-0000-0000-0000-00000000c102', 'maya'),
	('00000000-0000-0000-0000-00000000c103', 'stranger');
INSERT INTO public.user_items (user_id, item_count) VALUES
	('00000000-0000-0000-0000-00000000c101', 25),
	('00000000-0000-0000-0000-00000000c102', 25),
	('00000000-0000-0000-0000-00000000c103', 25);
INSERT INTO public.friendships VALUES
	('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c102', 'accepted');

CREATE OR REPLACE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
	SELECT set_config('smoke.uid', u::text, false) $$;
CREATE OR REPLACE FUNCTION pg_temp.give(u uuid, f text, n int) RETURNS void LANGUAGE sql AS $$
	INSERT INTO public.satchel_items (user_id, find_id) SELECT u, f FROM generate_series(1, n) $$;
CREATE OR REPLACE FUNCTION pg_temp.held(u uuid, f text) RETURNS int LANGUAGE sql AS $$
	SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = u AND find_id = f $$;
CREATE OR REPLACE FUNCTION pg_temp.coin(u uuid) RETURNS int LANGUAGE sql AS $$
	SELECT item_count FROM public.user_items WHERE user_id = u $$;
CREATE OR REPLACE FUNCTION pg_temp.price(f text) RETURNS numeric LANGUAGE sql AS $$
	SELECT price FROM public.market_prices WHERE find_id = f $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	IF cond IS NOT TRUE THEN RAISE EXCEPTION 'SMOKE FAIL: %', msg; END IF;
END $$;

SELECT set_config('ttp.fake_now', '2026-11-05 14:10:00+00', false);

DO $smoke$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c101';
	b uuid := '00000000-0000-0000-0000-00000000c102';
	c uuid := '00000000-0000-0000-0000-00000000c103';
	st jsonb; res jsonb; res2 jsonb; f jsonb;
	n1 uuid := gen_random_uuid();
	p0 numeric; p1 numeric; bid int; ask int; c0 int; oid bigint; oid2 bigint;
BEGIN
	-- 1. The market seeds itself.
	PERFORM pg_temp.as_user(a);
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true', '1 state ok');
	PERFORM pg_temp.ok(jsonb_array_length(st->'finds') = 12, '1 twelve finds');
	FOR f IN SELECT * FROM jsonb_array_elements(st->'finds') LOOP
		PERFORM pg_temp.ok((f->>'price')::numeric BETWEEN 0.85 * (f->>'usual')::int AND 1.15 * (f->>'usual')::int, '1 band ' || (f->>'id'));
		PERFORM pg_temp.ok((f->>'ask')::int = GREATEST((f->>'usual')::int + 1, CEIL(1.2 * (f->>'price')::numeric - 0.000000001)::int), '1 ask ' || (f->>'id'));
		PERFORM pg_temp.ok((f->>'bid')::int = LEAST((f->>'usual')::int, FLOOR(0.8 * (f->>'price')::numeric + 0.000000001)::int), '1 bid ' || (f->>'id'));
	END LOOP;
	PERFORM pg_temp.ok((st->'finds'->7->>'id') = 'pinecone' AND (st->'finds'->7->>'usual')::int = 12, '1 pinecone U 12');
	PERFORM pg_temp.ok((st->'finds'->11->>'usual')::int = 60, '1 whistle U = 20 x 3');
	PERFORM pg_temp.ok((st->'me'->>'coin')::int = 25, '1 coin');

	-- 2. Counter sell.
	PERFORM pg_temp.give(a, 'pinecone', 5);
	p0 := pg_temp.price('pinecone');
	bid := LEAST(12, FLOOR(0.8 * p0 + 0.000000001)::int);
	res := public.market_counter('pinecone', 'sell', bid + 1, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'price_moved' AND (res->>'now')::int = bid, '2 price_moved');
	res := public.market_counter('pinecone', 'sell', bid, n1);
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'price')::int = bid, '2 sold at bid');
	PERFORM pg_temp.ok(pg_temp.held(a, 'pinecone') = 1, '2 four left the bag');
	PERFORM pg_temp.ok(pg_temp.coin(a) = 25 + bid, '2 bank paid (past nothing)');
	PERFORM pg_temp.ok(abs(pg_temp.price('pinecone') - (p0 - 0.36)) < 0.0001 OR pg_temp.price('pinecone') = 0.85 * 12, '2 P down 3% of U');
	PERFORM pg_temp.ok((res->'trade'->>'dug')::int = 4 AND res->'trade'->'cost' IS NULL, '2 all dug up');
	PERFORM pg_temp.ok((SELECT took_in FROM public.market_ledgers WHERE user_id = a) = bid, '2 ledger');
	res2 := public.market_counter('pinecone', 'sell', bid, n1);
	PERFORM pg_temp.ok(res2->>'replay' = 'true' AND res2->'trade'->>'id' = res->'trade'->>'id', '2 replay same receipt');
	PERFORM pg_temp.ok(pg_temp.coin(a) = 25 + bid AND pg_temp.held(a, 'pinecone') = 1, '2 replay moved nothing');
	res := public.market_counter('pinecone', 'sell', NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_a_set' AND (res->>'held')::int = 1 AND (res->>'set_size')::int = 4, '2 not_a_set');
	PERFORM pg_temp.as_user(b);
	res := public.market_counter('pinecone', 'sell', bid, n1);
	PERFORM pg_temp.ok(res->>'reason' = 'bad_nonce', '2 another pig''s nonce');

	-- 3. Counter buy.
	PERFORM pg_temp.as_user(c);
	UPDATE public.user_items SET item_count = 3 WHERE user_id = c;
	res := public.market_counter('old_key', 'buy', NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_enough_tickles' AND (res->>'ready')::int = 3, '3 short');
	UPDATE public.user_items SET item_count = 80 WHERE user_id = c;
	p0 := pg_temp.price('old_key');
	ask := GREATEST(25, CEIL(1.2 * p0 - 0.000000001)::int);
	res := public.market_counter('old_key', 'buy', ask, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'price')::int = ask, '3 bought at ask');
	PERFORM pg_temp.ok(pg_temp.coin(c) = 80 - ask AND pg_temp.held(c, 'old_key') = 3, '3 spent, three keys');
	PERFORM pg_temp.ok((SELECT ROUND(SUM(market_cost)) FROM public.satchel_items WHERE user_id = c AND find_id = 'old_key') = ask, '3 cost basis');
	PERFORM pg_temp.ok(abs(pg_temp.price('old_key') - LEAST(1.15 * 24, p0 + 0.72)) < 0.0001, '3 P up 3% of U');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.satchel_met WHERE user_id = c AND find_id = 'old_key') = 1, '3 met');

	-- 4. A listing between his prices rests, and a pig buys it.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'snail_shell', 4);
	p0 := pg_temp.price('snail_shell');
	bid := LEAST(12, FLOOR(0.8 * p0 + 0.000000001)::int);
	ask := GREATEST(13, CEIL(1.2 * p0 - 0.000000001)::int);
	res := public.market_post('sell', 'snail_shell', bid + 1, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND res->>'filled' = 'false', '4 rests');
	oid := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.ok(pg_temp.held(a, 'snail_shell') = 0, '4 set held aside');
	st := public.market_state();
	PERFORM pg_temp.ok((st->'me'->'holdings'->'snail_shell'->>'on_offer')::int = 4, '4 on offer');
	PERFORM pg_temp.as_user(c);
	st := public.market_state();
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(st->'board') x WHERE (x->>'id')::bigint = oid AND x->'poster'->>'name' IS NULL), '4 stranger sees it, poster unnamed');
	c0 := pg_temp.coin(c);
	res := public.market_take(oid, bid + 1, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND res->'trade'->>'kind' = 'pig', '4 bought from a pig');
	PERFORM pg_temp.ok(pg_temp.coin(c) = c0 - (bid + 1) AND pg_temp.held(c, 'snail_shell') = 4, '4 buyer');
	PERFORM pg_temp.ok(pg_temp.coin(a) = 25 + LEAST(12, FLOOR(0.8 * (SELECT from_price FROM public.market_trades WHERE kind = 'counter' AND seller_id = a ORDER BY id LIMIT 1) + 0.000000001)::int) + bid + 1, '4 seller paid');
	PERFORM pg_temp.ok(abs(pg_temp.price('snail_shell') - (p0 + ((bid + 1) - p0) / 3)) < 0.001, '4 P pulled a third');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_notices WHERE user_id = a AND kind = 'filled') = 1, '4 poster told');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = oid) = 'filled', '4 filled');
	res := public.market_take(oid, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_found', '4 gone');

	-- 5. Crossing at the post.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'clover', 4);
	p0 := pg_temp.price('clover');
	bid := LEAST(12, FLOOR(0.8 * p0 + 0.000000001)::int);
	res := public.market_post('sell', 'clover', 2, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'true' AND res->>'via' = 'counter' AND (res->'trade'->>'price')::int = bid, '5 sell under bid sells to Bullion at his price');
	PERFORM pg_temp.as_user(b);
	p0 := pg_temp.price('clover');
	ask := GREATEST(13, CEIL(1.2 * p0 - 0.000000001)::int);
	res := public.market_post('buy', 'clover', ask, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'true' AND res->>'via' = 'counter' AND (res->'trade'->>'price')::int = ask, '5 wanted over ask buys from Bullion at his price');
	PERFORM pg_temp.ok(pg_temp.held(b, 'clover') = 4, '5 wanted got the set');
	-- b rests a wanted ad for wool between the prices; a's sell listing meets it.
	UPDATE public.user_items SET item_count = 25 WHERE user_id = b;
	p0 := pg_temp.price('wool_tuft');
	bid := LEAST(12, FLOOR(0.8 * p0 + 0.000000001)::int);
	res := public.market_post('buy', 'wool_tuft', bid + 2, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '5 wanted rests');
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'wool_tuft', 4);
	res := public.market_post('sell', 'wool_tuft', bid, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'via' = 'pig' AND (res->'trade'->>'price')::int = bid + 2, '5 sell meets the wanted ad, at the ad''s price');
	PERFORM pg_temp.ok(pg_temp.held(b, 'wool_tuft') = 4 AND pg_temp.held(a, 'wool_tuft') = 0, '5 set moved');

	-- 6. Swaps, to one friend.
	PERFORM pg_temp.give(a, 'red_berries', 4);
	res := public.market_post('swap', 'red_berries', NULL, 'marble', 1, c, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_a_friend', '6 a stranger is not a target');
	res := public.market_post('swap', 'red_berries', NULL, 'marble', 4, b, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'bad_want', '6 more than a set of marbles');
	res := public.market_post('swap', 'red_berries', NULL, 'marble', 1, b, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '6 swap pinned to maya');
	oid := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.as_user(c);
	PERFORM pg_temp.give(c, 'marble', 1);
	res := public.market_take(oid, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_found', '6 stranger cannot take it');
	PERFORM pg_temp.as_user(b);
	st := public.market_state();
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(st->'board') x WHERE (x->>'id')::bigint = oid AND x->>'for_you' = 'true' AND x->'poster'->>'name' = 'rosie'), '6 maya sees it, for her, named');
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(st->'notices') x WHERE x->>'kind' = 'for_you'), '6 maya told');
	res := public.market_take(oid, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'not_enough', '6 maya has no marble');
	PERFORM pg_temp.give(b, 'marble', 1);
	c0 := pg_temp.coin(b); p0 := pg_temp.price('red_berries');
	res := public.market_take(oid, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND res->'trade'->>'kind' = 'swap', '6 swapped');
	PERFORM pg_temp.ok(pg_temp.held(b, 'red_berries') = 4 AND pg_temp.held(b, 'marble') = 0 AND pg_temp.held(a, 'marble') = 1, '6 both sides moved');
	PERFORM pg_temp.ok(pg_temp.coin(b) = c0 AND pg_temp.price('red_berries') = p0, '6 no tickles, price put');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_notices WHERE user_id = a AND kind = 'swapped') = 1, '6 poster told');

	-- 7. Cancel, and the four-listing limit.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'river_pebble', 20);
	FOR i IN 1..4 LOOP
		res := public.market_post('sell', 'river_pebble', 14, NULL, NULL, NULL, gen_random_uuid());
		PERFORM pg_temp.ok(res->>'filled' = 'false', '7 rests ' || i);
	END LOOP;
	oid := (res->'offer'->>'id')::bigint;
	res := public.market_post('sell', 'river_pebble', 14, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'too_many_offers', '7 fifth refused');
	PERFORM pg_temp.ok(pg_temp.held(a, 'river_pebble') = 4, '7 sixteen pinned');
	res := public.market_cancel(oid);
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->>'held')::int = 8, '7 cancelled, set home');
	res := public.market_cancel(oid);
	PERFORM pg_temp.ok(res->>'reason' = 'not_found', '7 cancel twice');

	-- 8. A wanted ad lapses when its pig is short.
	PERFORM pg_temp.as_user(b);
	p0 := pg_temp.price('brass_button');
	bid := LEAST(12, FLOOR(0.8 * p0 + 0.000000001)::int);
	res := public.market_post('buy', 'brass_button', bid + 1, NULL, NULL, NULL, gen_random_uuid());
	oid := (res->'offer'->>'id')::bigint;
	UPDATE public.user_items SET item_count = 0 WHERE user_id = b;
	PERFORM pg_temp.as_user(c);
	PERFORM pg_temp.give(c, 'brass_button', 4);
	res := public.market_take(oid, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'lapsed', '8 lapsed');
	PERFORM pg_temp.ok(pg_temp.held(c, 'brass_button') = 4, '8 seller kept the set');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = oid) = 'lapsed', '8 status');
	UPDATE public.user_items SET item_count = 25 WHERE user_id = b;

	-- 9. The counter crosses a resting listing once its price reaches it.
	PERFORM pg_temp.as_user(c);
	PERFORM pg_temp.give(c, 'blue_feather', 4);
	UPDATE public.market_prices SET price = 12 WHERE find_id = 'blue_feather';
	res := public.market_post('sell', 'blue_feather', 10, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '9 rests at 10 (bid 9)');
	oid2 := (res->'offer'->>'id')::bigint;
	UPDATE public.market_prices SET price = 13.8, tick = tick - 1 WHERE find_id = 'blue_feather';
	c0 := pg_temp.coin(c);
	st := public.market_state();
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = oid2) = 'crossed', '9 crossed');
	PERFORM pg_temp.ok(pg_temp.coin(c) = c0 + (SELECT price FROM public.market_trades WHERE offer_id = oid2 AND how = 'crossed')
		AND (SELECT price FROM public.market_trades WHERE offer_id = oid2) >= 10, '9 paid HIS price, at least the listing''s');
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(st->'notices') x WHERE x->>'kind' = 'crossed'), '9 told');
END
$smoke$;

-- 10. A day later.
SELECT set_config('ttp.fake_now', '2026-11-06 15:10:00+00', false);
DO $later$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c101';
	st jsonb; st2 jsonb; t0 bigint;
BEGIN
	PERFORM pg_temp.as_user(a);
	t0 := (SELECT MAX(tick) FROM public.market_price_points WHERE find_id = 'tin_whistle');
	st := public.market_state();
	PERFORM pg_temp.ok((SELECT tick FROM public.market_prices WHERE find_id = 'tin_whistle') = (st->>'tick')::bigint, '10 caught up');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_price_points WHERE find_id = 'tin_whistle' AND tick > t0) = (st->>'tick')::bigint - t0, '10 a point a tick');
	PERFORM pg_temp.ok(pg_temp.held(a, 'river_pebble') = 20, '10 expired listings came home');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_offers WHERE user_id = a AND status = 'open') = 0, '10 none open');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM jsonb_array_elements(st->'notices') x WHERE x->>'kind' = 'expired') = 3, '10 three expiry notices');
	PERFORM pg_temp.ok(jsonb_array_length((st->'finds'->0->'spark')) >= 48, '10 a day of sparkline');
	st2 := public.market_state();
	PERFORM pg_temp.ok(jsonb_array_length(st2->'notices') = 0, '10 notices handed over once');
	PERFORM pg_temp.ok(st->'yesterday'->>'find_id' IS NOT NULL, '10 yesterday''s busiest find');
	st2 := public.market_find('pinecone');
	PERFORM pg_temp.ok(st2->>'ok' = 'true' AND jsonb_array_length(st2->'hist') > 48 AND jsonb_array_length(st2->'recent') > 0, '10 market_find');
	PERFORM pg_temp.ok(public.market_find('nope')->>'reason' = 'unknown_find', '10 unknown find');
	st2 := public.market_ping();
	PERFORM pg_temp.ok(st2->>'ok' = 'true' AND st2->>'open' = 'true' AND (st2->>'notices')::int = 0 AND (st2->>'listings')::int = 0, '10 ping');
	RAISE NOTICE 'C1 bullions market smoke: all green';
END
$later$;
