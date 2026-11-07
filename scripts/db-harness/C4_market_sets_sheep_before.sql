-- C4, part one: the market and the Ghost Sheep as they stand BEFORE
-- 20261107120000 (run order in 00x2_market_trader_prep.sql's header). Seeds
-- the prices at the old set sizes (4 / 3 / 3), moves a few of them, and keeps
-- what the smoke compares after the migration in _c4_before.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

CREATE TABLE public._c4_before (k text PRIMARY KEY, v jsonb);

SELECT set_config('ttp.fake_now', '2026-11-20 15:00:00+00', false);

DO $before$
DECLARE
	a uuid := '00000000-0000-0000-0000-0000000d0001';
	res jsonb;
BEGIN
	INSERT INTO auth.users (id) VALUES
		('00000000-0000-0000-0000-0000000d0001'), ('00000000-0000-0000-0000-0000000d0002'),
		('00000000-0000-0000-0000-0000000d0003'), ('00000000-0000-0000-0000-0000000d0004')
	ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		('00000000-0000-0000-0000-0000000d0001', 'Ada'), ('00000000-0000-0000-0000-0000000d0002', 'Bo'),
		('00000000-0000-0000-0000-0000000d0003', 'Cy'), ('00000000-0000-0000-0000-0000000d0004', 'Di')
	ON CONFLICT DO NOTHING;
	INSERT INTO public.user_items (user_id, item_count) VALUES
		('00000000-0000-0000-0000-0000000d0001', 200), ('00000000-0000-0000-0000-0000000d0002', 200),
		('00000000-0000-0000-0000-0000000d0003', 200), ('00000000-0000-0000-0000-0000000d0004', 200)
	ON CONFLICT DO NOTHING;

	PERFORM set_config('smoke.uid', a::text, false);
	res := public.market_state();
	IF res->>'ok' <> 'true' THEN RAISE EXCEPTION 'C4 before: market_state %', res; END IF;
	IF public._market_tuning()->'set_size' <> '{"common": 4, "uncommon": 3, "rare": 3}'::jsonb THEN
		RAISE EXCEPTION 'C4 before: expected the old set sizes, got %', public._market_tuning()->'set_size';
	END IF;
	-- Move two prices off their seed so the rescale has something to keep:
	-- a buy at the counter lifts the pebble, a sell drops the whistle.
	INSERT INTO public.satchel_items (user_id, find_id) SELECT a, 'tin_whistle' FROM generate_series(1, 3);
	res := public.market_counter('river_pebble', 'buy', 100, gen_random_uuid());
	IF res->>'ok' <> 'true' THEN RAISE EXCEPTION 'C4 before: counter buy %', res; END IF;
	res := public.market_counter('tin_whistle', 'sell', 0, gen_random_uuid());
	IF res->>'ok' <> 'true' THEN RAISE EXCEPTION 'C4 before: counter sell %', res; END IF;

	INSERT INTO public._c4_before (k, v) VALUES
		('tuning', public._market_tuning()),
		('prices', (SELECT jsonb_object_agg(mp.find_id, mp.price) FROM public.market_prices mp)),
		('ratios', (SELECT jsonb_object_agg(mp.find_id, mp.price / public._market_usual(mp.find_id, public._market_tuning()))
		            FROM public.market_prices mp)),
		('points', (SELECT jsonb_object_agg(x.k, x.p) FROM (
			SELECT pp.find_id || ':' || pp.tick AS k, pp.price AS p FROM public.market_price_points pp) x)),
		-- His fancy for 40 pigs across Season 1's last three weeks, old formula.
		('wants_s1', (SELECT jsonb_object_agg(x.k, x.w) FROM (
			SELECT g.i || ':' || d::date AS k,
			       public._trader_want_for(('00000000-0000-0000-0000-0000000e' || lpad(g.i::text, 4, '0'))::uuid, d::date, NULL) AS w
			FROM generate_series(1, 40) g(i),
			     generate_series(DATE '2026-10-19', DATE '2026-11-08', interval '1 day') d) x));
	PERFORM set_config('smoke.uid', '', false);
END
$before$;
