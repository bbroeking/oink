-- Bullion's Market sets of 3 / 2 / 1, and the Ghost Sheep doubles only what
-- you didn't buy (20261107120000). Run order: 00x2_market_trader_prep.sql's
-- header (C4_market_sets_sheep_before.sql seeds the "before").
--
-- Asserts:
--   1. Sizes: tuning set_size 3 / 2 / 1, every other market lever as it was;
--      market_state answers the new sizes and usual prices (9 / 16 / 20).
--   2. Rescale: every price and every point is old x new size / old size, so
--      P / U is unchanged for every find and every price is in its band.
--   3. Words: _market_qty_words says "a tin whistle", "an old key", "tin
--      whistle" after "your", "3 pinecones"; a pig sale of one whistle
--      pushes "Your tin whistle sold" / "Bo bought your tin whistle for N."
--   4. The bag says bought: a counter buy's rows are bought, dug ones are not.
--   5. The Sheep: with pebbles his fancy, a bought pebble pays 3 (was_want
--      false), the status shows unpaired_paid 3, a dug one completes the
--      pair at 6 + floor((3 + 6) x 0.5) = 10; a dug one opens the next at 6
--      (unpaired_paid 6), a bought one completes it at 3 + 4 = 7; a friend's
--      gift still doubles (6). Count 32, snouts and bank untouched.
--   6. Trade-up: dug go first and bought last; three found come back found
--      (cost null), two bought among three come back carrying their cost.
--   7. His fancy: days before 2026-11-09 exactly as before; from 11-09 a
--      draw near 70 / 25 / 5 across 400 pigs x 30 days, and never yesterday's.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
	SELECT set_config('smoke.uid', COALESCE(u::text, ''), false) $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	IF cond IS NOT TRUE THEN RAISE EXCEPTION 'SMOKE FAIL: %', msg; END IF;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.before(k text) RETURNS jsonb LANGUAGE sql AS $$
	SELECT v FROM public._c4_before WHERE _c4_before.k = before.k $$;

SELECT set_config('ttp.fake_now', '2026-11-20 15:00:00+00', false);

-- 1 + 2. Sizes and the rescale.
DO $sizes$
DECLARE
	a uuid := '00000000-0000-0000-0000-0000000d0001';
	t jsonb := public._market_tuning();
	old_t jsonb := pg_temp.before('tuning');
	old_p jsonb := pg_temp.before('prices');
	old_r jsonb := pg_temp.before('ratios');
	old_pts jsonb := pg_temp.before('points');
	res jsonb;
	f record;
	bad int;
BEGIN
	PERFORM pg_temp.ok(t->'set_size' = '{"common": 3, "uncommon": 2, "rare": 1}'::jsonb, '1 set sizes 3 / 2 / 1');
	PERFORM pg_temp.ok((t - 'set_size') = (old_t - 'set_size'), '1 every other lever unchanged');
	PERFORM pg_temp.ok((SELECT value->'set_size' FROM public.app_settings WHERE key = 'market_tuning')
		= '{"common": 3, "uncommon": 2, "rare": 1}'::jsonb, '1 stored in app_settings');
	PERFORM pg_temp.ok(public._market_usual('pinecone', t) = 9 AND public._market_usual('old_key', t) = 16
		AND public._market_usual('tin_whistle', t) = 20, '1 usual prices 9 / 16 / 20');

	FOR f IN SELECT mp.find_id, mp.price, sf.rarity FROM public.market_prices mp
	         JOIN public.satchel_finds sf ON sf.id = mp.find_id LOOP
		PERFORM pg_temp.ok(abs(f.price - (old_p->>f.find_id)::numeric
			* (t->'set_size'->>f.rarity)::numeric / (old_t->'set_size'->>f.rarity)::numeric) < 0.000002,
			'2 price rescaled: ' || f.find_id);
		PERFORM pg_temp.ok(abs(f.price / public._market_usual(f.find_id, t) - (old_r->>f.find_id)::numeric) < 0.000001,
			'2 P / U kept: ' || f.find_id);
		PERFORM pg_temp.ok(f.price >= 0.85 * public._market_usual(f.find_id, t) - 0.000001
			AND f.price <= 1.15 * public._market_usual(f.find_id, t) + 0.000001, '2 in band: ' || f.find_id);
	END LOOP;
	SELECT COUNT(*) INTO bad FROM public.market_price_points pp JOIN public.satchel_finds sf ON sf.id = pp.find_id
	WHERE abs(pp.price - (old_pts->>(pp.find_id || ':' || pp.tick))::numeric
		* (t->'set_size'->>sf.rarity)::numeric / (old_t->'set_size'->>sf.rarity)::numeric) >= 0.000002;
	PERFORM pg_temp.ok(bad = 0 AND (SELECT COUNT(*) FROM public.market_price_points) = (SELECT COUNT(*) FROM jsonb_object_keys(old_pts)),
		'2 every point rescaled, none lost');

	PERFORM pg_temp.as_user(a);
	res := public.market_state();
	PERFORM pg_temp.ok(res->>'ok' = 'true', '1 market_state answers');
	PERFORM pg_temp.ok((SELECT (x->>'size')::int FROM jsonb_array_elements(res->'finds') x WHERE x->>'id' = 'pinecone') = 3
		AND (SELECT (x->>'size')::int FROM jsonb_array_elements(res->'finds') x WHERE x->>'id' = 'marble') = 2
		AND (SELECT (x->>'size')::int FROM jsonb_array_elements(res->'finds') x WHERE x->>'id' = 'tin_whistle') = 1,
		'1 market_state sizes 3 / 2 / 1');
	PERFORM pg_temp.ok(res->'tuning'->'set_size' = '{"common": 3, "uncommon": 2, "rare": 1}'::jsonb, '1 market_state tuning');
	PERFORM pg_temp.as_user(NULL);
END
$sizes$;

-- 3. Words, and a one-whistle pig sale's push.
DO $words$
DECLARE
	a uuid := '00000000-0000-0000-0000-0000000d0001';
	b uuid := '00000000-0000-0000-0000-0000000d0002';
	res jsonb;
	ask int;
	push record;
BEGIN
	PERFORM pg_temp.ok(public._market_qty_words('tin_whistle', 1, false) = 'a tin whistle', '3 a tin whistle');
	PERFORM pg_temp.ok(public._market_qty_words('old_key', 1, false) = 'an old key', '3 an old key');
	PERFORM pg_temp.ok(public._market_qty_words('tin_whistle', 1, true) = 'tin whistle', '3 your tin whistle');
	PERFORM pg_temp.ok(public._market_qty_words('pinecone', 3, false) = '3 pinecones', '3 3 pinecones');
	PERFORM pg_temp.ok(public._market_qty_words('wool_tuft', 2, true) = '2 tufts of wool', '3 2 tufts of wool');

	PERFORM pg_temp.as_user(a);
	INSERT INTO public.satchel_items (user_id, find_id) VALUES (a, 'tin_whistle');
	ask := (public._market_tuning()->'base'->>'rare')::int + 2;
	res := public.market_post('sell', 'tin_whistle', ask, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'offer'->>'qty')::int = 1, '3 one whistle pinned: ' || res::text);
	PERFORM pg_temp.as_user(b);
	res := public.market_take((res->'offer'->>'id')::bigint, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '3 Bo takes it: ' || res::text);
	SELECT * INTO push FROM public._smoke_pushes WHERE user_id = a ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(push.title = 'Your tin whistle sold', '3 push title: ' || COALESCE(push.title, 'none'));
	PERFORM pg_temp.ok(push.body = 'A pig bought your tin whistle for ' || ask || '.'
		OR push.body = 'Bo bought your tin whistle for ' || ask || '.', '3 push body: ' || COALESCE(push.body, 'none'));
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.satchel_items WHERE user_id = b AND find_id = 'tin_whistle'
		AND market_cost = ask) = 1, '3 Bo holds one bought whistle');
	PERFORM pg_temp.as_user(NULL);
END
$words$;

-- 4 + 5. The bag says bought; the Sheep doubles only the found.
DO $sheep$
DECLARE
	c uuid := '00000000-0000-0000-0000-0000000d0003';
	g uuid := '00000000-0000-0000-0000-0000000d0004';
	v public.trader_visits;
	res jsonb;
	bag jsonb;
	bought1 bigint; bought2 bigint; dug1 bigint; dug2 bigint; gift1 bigint;
	coin_before int;
BEGIN
	PERFORM pg_temp.as_user(c);
	res := public.market_counter('river_pebble', 'buy', 100, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '4 Cy buys three pebbles: ' || res::text);
	INSERT INTO public.satchel_items (user_id, find_id, created_at) VALUES
		(c, 'river_pebble', '2026-11-19 10:00+00'), (c, 'river_pebble', '2026-11-19 11:00+00');
	INSERT INTO public.satchel_items (user_id, find_id, source, from_user_id, created_at)
		VALUES (c, 'river_pebble', 'gift', g, '2026-11-19 12:00+00');
	bag := public._satchel_bag_json(c);
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM jsonb_array_elements(bag) x WHERE (x->>'bought')::boolean) = 3
		AND (SELECT COUNT(*) FROM jsonb_array_elements(bag) x WHERE NOT (x->>'bought')::boolean) = 3,
		'4 bag: three bought, three not');
	SELECT id INTO bought1 FROM public.satchel_items WHERE user_id = c AND market_cost IS NOT NULL ORDER BY id LIMIT 1;
	SELECT id INTO bought2 FROM public.satchel_items WHERE user_id = c AND market_cost IS NOT NULL ORDER BY id OFFSET 1 LIMIT 1;
	SELECT id INTO dug1 FROM public.satchel_items WHERE user_id = c AND source = 'dig' AND market_cost IS NULL ORDER BY id LIMIT 1;
	SELECT id INTO dug2 FROM public.satchel_items WHERE user_id = c AND source = 'dig' AND market_cost IS NULL ORDER BY id OFFSET 1 LIMIT 1;
	SELECT id INTO gift1 FROM public.satchel_items WHERE user_id = c AND source = 'gift';

	-- He is here, and he fancies pebbles.
	v := public._trader_ensure_visit(c);
	UPDATE public.trader_visits SET arrives_at = '2026-11-20 14:00+00', leaves_at = '2026-11-20 20:00+00',
		want_find_id = 'river_pebble' WHERE id = v.id;
	coin_before := (SELECT item_count FROM public.user_items WHERE user_id = c);

	res := public.trade_with_trader(bought1, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->>'tickles')::int = 3 AND res->>'was_want' = 'false',
		'5 a bought pebble pays the plain 3: ' || res::text);
	res := public.trader_status();
	PERFORM pg_temp.ok(res->'visit'->'unpaired_paid' = '{"river_pebble": 3}'::jsonb, '5 unpaired_paid 3: ' || (res->'visit')::text);
	res := public.trade_with_trader(dug1, gen_random_uuid());
	PERFORM pg_temp.ok((res->>'tickles')::int = 10 AND res->>'was_want' = 'true' AND (res->>'pair_bonus')::int = 4,
		'5 a dug pebble doubles and completes the pair: 6 + 4: ' || res::text);
	res := public.trade_with_trader(dug2, gen_random_uuid());
	PERFORM pg_temp.ok((res->>'tickles')::int = 6 AND res->>'pair' = 'false', '5 the next dug one opens a pair at 6');
	res := public.trader_status();
	PERFORM pg_temp.ok(res->'visit'->'unpaired_paid' = '{"river_pebble": 6}'::jsonb, '5 unpaired_paid 6');
	res := public.trade_with_trader(bought2, gen_random_uuid());
	PERFORM pg_temp.ok((res->>'tickles')::int = 7 AND res->>'was_want' = 'false' AND (res->>'pair_bonus')::int = 4,
		'5 a bought one completes it: 3 + floor((6 + 3) x 0.5): ' || res::text);
	res := public.trade_with_trader(gift1, gen_random_uuid());
	PERFORM pg_temp.ok((res->>'tickles')::int = 6 AND res->>'was_want' = 'true', '5 a friend''s gift still doubles');
	res := public.trader_status();
	PERFORM pg_temp.ok(res->'visit'->'unpaired_paid' = '{"river_pebble": 6}'::jsonb AND res->'visit'->'unpaired' = '["river_pebble"]'::jsonb,
		'5 status unpaired and unpaired_paid agree');
	PERFORM pg_temp.ok((SELECT tickles_earned FROM public.profiles WHERE id = c) = 32, '5 count 3 + 10 + 6 + 7 + 6 = 32');
	PERFORM pg_temp.ok((SELECT item_count FROM public.user_items WHERE user_id = c) = coin_before, '5 the bank untouched');
	PERFORM pg_temp.as_user(NULL);
END
$sheep$;

-- 6. Trade-ups: found first, bought last, the cost rides along.
DO $tradeup$
DECLARE
	c uuid := '00000000-0000-0000-0000-0000000d0003';
	d uuid := '00000000-0000-0000-0000-0000000d0004';
	v public.trader_visits;
	res jsonb;
	cost numeric;
BEGIN
	-- Cy: three found buttons and one bought; the found three go.
	INSERT INTO public.satchel_items (user_id, find_id, created_at) SELECT c, 'brass_button', '2026-11-19 09:00+00'
		FROM generate_series(1, 3);
	INSERT INTO public.satchel_items (user_id, find_id, source, market_cost, created_at)
		VALUES (c, 'brass_button', 'market', 4, '2026-11-18 09:00+00');
	PERFORM pg_temp.as_user(c);
	res := public.trade_up_with_trader('brass_button', gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '6 Cy trades up: ' || res::text);
	PERFORM pg_temp.ok((SELECT market_cost FROM public.satchel_items WHERE id = (res->>'got_item_id')::bigint) IS NULL,
		'6 three found come back found');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.satchel_items WHERE user_id = c AND find_id = 'brass_button'
		AND market_cost = 4) = 1, '6 the bought one stays, even though it is the oldest');

	-- Di: one found button and three bought; the found one and two bought go.
	INSERT INTO public.satchel_items (user_id, find_id, created_at) VALUES (d, 'brass_button', '2026-11-19 09:00+00');
	INSERT INTO public.satchel_items (user_id, find_id, source, market_cost, created_at)
		SELECT d, 'brass_button', 'market', 4 + g.i, '2026-11-18 09:00+00'::timestamptz + make_interval(mins => g.i)
		FROM generate_series(1, 3) g(i);
	PERFORM pg_temp.as_user(d);
	v := public._trader_ensure_visit(d);
	UPDATE public.trader_visits SET arrives_at = '2026-11-20 14:00+00', leaves_at = '2026-11-20 20:00+00' WHERE id = v.id;
	res := public.trade_up_with_trader('brass_button', gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '6 Di trades up: ' || res::text);
	SELECT market_cost INTO cost FROM public.satchel_items WHERE id = (res->>'got_item_id')::bigint;
	PERFORM pg_temp.ok(cost = 5 + 6, '6 the one back carries the two bought costs (5 + 6): ' || COALESCE(cost::text, 'null'));
	PERFORM pg_temp.ok((SELECT market_cost FROM public.satchel_items WHERE user_id = d AND find_id = 'brass_button') = 7,
		'6 the newest bought one stays');
	PERFORM pg_temp.ok((SELECT (x->>'bought')::boolean FROM jsonb_array_elements(res->'bag') x
		WHERE (x->>'id')::bigint = (res->>'got_item_id')::bigint), '6 the bag says it was bought');
	PERFORM pg_temp.as_user(NULL);
END
$tradeup$;

-- 7. His fancy.
DO $fancy$
DECLARE
	old_w jsonb := pg_temp.before('wants_s1');
	same int;
	n int;
	common_n int; uncommon_n int; rare_n int;
	repeats int;
BEGIN
	SELECT COUNT(*) FILTER (WHERE public._trader_want_for(('00000000-0000-0000-0000-0000000e' || lpad(split_part(k, ':', 1), 4, '0'))::uuid,
		split_part(k, ':', 2)::date, NULL) = old_w->>k), COUNT(*)
	INTO same, n FROM jsonb_object_keys(old_w) k;
	PERFORM pg_temp.ok(n = 40 * 21 AND same = n, '7 Season 1 days unchanged: ' || same || ' of ' || n);

	WITH w AS (
		SELECT public._trader_want_for(('00000000-0000-0000-0000-0000000f' || lpad(g.i::text, 4, '0'))::uuid, d::date,
		       public._trader_want_for(('00000000-0000-0000-0000-0000000f' || lpad(g.i::text, 4, '0'))::uuid, d::date - 1, NULL)) AS want,
		       public._trader_want_for(('00000000-0000-0000-0000-0000000f' || lpad(g.i::text, 4, '0'))::uuid, d::date - 1, NULL) AS yday
		FROM generate_series(1, 400) g(i), generate_series(DATE '2026-11-10', DATE '2026-12-09', interval '1 day') d
	)
	SELECT COUNT(*) FILTER (WHERE sf.rarity = 'common'), COUNT(*) FILTER (WHERE sf.rarity = 'uncommon'),
	       COUNT(*) FILTER (WHERE sf.rarity = 'rare'), COUNT(*) FILTER (WHERE w.want = w.yday), COUNT(*)
	INTO common_n, uncommon_n, rare_n, repeats, n
	FROM w JOIN public.satchel_finds sf ON sf.id = w.want;
	RAISE NOTICE 'C4 fancy from Season 2: common %, uncommon %, rare % of %', common_n, uncommon_n, rare_n, n;
	PERFORM pg_temp.ok(n = 12000 AND repeats = 0, '7 never yesterday''s');
	PERFORM pg_temp.ok(common_n BETWEEN 0.65 * n AND 0.75 * n, '7 commons near 70%');
	PERFORM pg_temp.ok(uncommon_n BETWEEN 0.21 * n AND 0.30 * n, '7 uncommons near 25%');
	PERFORM pg_temp.ok(rare_n BETWEEN 0.02 * n AND 0.07 * n, '7 the rare near 5%');
	PERFORM pg_temp.ok((SELECT COUNT(DISTINCT public._trader_want_for(('00000000-0000-0000-0000-0000000f' || lpad(g.i::text, 4, '0'))::uuid,
		DATE '2026-11-09', NULL)) FROM generate_series(1, 400) g(i)) >= 10, '7 day one already varies');
END
$fancy$;

SELECT 'C4 market sets 3/2/1 + the Sheep doubles only the found: PASS' AS result;
