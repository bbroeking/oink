-- Bullion's Market launch fixes smoke (20261102200000_market_launch_fixes.sql).
-- Runs after C1 and C2 on the stand-alone prep (00x_market_prep.sql; see its
-- header). Each section turns one of the 2026-11-02 audit's proofs into
-- assertions:
--   0. (fix 10) the balance pass landed in app_settings (nothing else moved)
--      and in the compiled defaults; the fairness invariant holds; a listing
--      lasts 48 hours.
--   1. (fix 1) a one-friend listing's friend deletes their account: it comes
--      down, its set comes home, the poster is told; it never goes public.
--   2. (fix 2) commons become sets of six with listings up: a take, a wanted
--      ad, a swap, a counter crossing and a wanted-ad crossing each move
--      exactly what was held (or asked for), priced by the listing's own qty;
--      nothing minted or lost; a new post meets only listings of its size.
--   3. (fix 3) the audit's bad edits (fractional daily_listings, a partial
--      price, a negative buy_factor, an unfair cut, garbage, not an object,
--      tick_minutes 60) leave the market working; quotes and spends are never
--      free; a shelf that fails to build is an empty shelf.
--   4. (fix 4) closed with listings up: your own stay in reach and come down,
--      time still brings held sets home, nothing crosses, market_find closed.
--   5. (fix 5) one shelf set a pig a day, then two, then no cap.
--   6. (fix 6) after an advance nothing is due (the re-check under the lock);
--      the two-session race is run separately (two psql sessions).
--   7. (fix 7) housekeeping on the day's first advance only, keeping what a
--      notice, the shelf or an unflip still needs.
--   8. (fix 8) the flip wrapper ends a listing pinned in the flip's own
--      window (after its now()), which the reset guard alone misses.
--   9. (fix 9) pushes: for you, filled, crossed, swapped; named friends,
--      "A pig" otherwise; never your own doing; a failed push never rolls
--      back a trade; no em dashes.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-00000000c301'),
	('00000000-0000-0000-0000-00000000c302'),
	('00000000-0000-0000-0000-00000000c303'),
	('00000000-0000-0000-0000-00000000c304'),
	('00000000-0000-0000-0000-00000000c305');
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000c301', 'Pip'),
	('00000000-0000-0000-0000-00000000c302', 'Maya'),
	('00000000-0000-0000-0000-00000000c303', 'Wanderer'),
	('00000000-0000-0000-0000-00000000c304', 'Gone'),
	('00000000-0000-0000-0000-00000000c305', 'Shelfie');
INSERT INTO public.user_items (user_id, item_count) VALUES
	('00000000-0000-0000-0000-00000000c301', 500),
	('00000000-0000-0000-0000-00000000c302', 500),
	('00000000-0000-0000-0000-00000000c303', 500),
	('00000000-0000-0000-0000-00000000c304', 500),
	('00000000-0000-0000-0000-00000000c305', 500);
INSERT INTO public.friendships VALUES
	('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000c302', 'accepted'),
	('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000c304', 'accepted');

CREATE OR REPLACE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
	SELECT set_config('smoke.uid', COALESCE(u::text, ''), false) $$;
CREATE OR REPLACE FUNCTION pg_temp.give(u uuid, f text, n int) RETURNS void LANGUAGE sql AS $$
	INSERT INTO public.satchel_items (user_id, find_id) SELECT u, f FROM generate_series(1, n) $$;
CREATE OR REPLACE FUNCTION pg_temp.held(u uuid, f text) RETURNS int LANGUAGE sql AS $$
	SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = u AND find_id = f $$;
CREATE OR REPLACE FUNCTION pg_temp.coin(u uuid) RETURNS int LANGUAGE sql AS $$
	SELECT item_count FROM public.user_items WHERE user_id = u $$;
CREATE OR REPLACE FUNCTION pg_temp.price(f text) RETURNS numeric LANGUAGE sql AS $$
	SELECT price FROM public.market_prices WHERE find_id = f $$;
CREATE OR REPLACE FUNCTION pg_temp.bid(f text) RETURNS int LANGUAGE sql AS $$
	SELECT public._market_bid(public._market_usual(f, t.v), mp.price, t.v)
	FROM public.market_prices mp, (SELECT public._market_tuning() AS v) t WHERE mp.find_id = f $$;
-- Every unit of a find in the world: in bags, plus held on open listings.
CREATE OR REPLACE FUNCTION pg_temp.world(f text) RETURNS int LANGUAGE sql AS $$
	SELECT (SELECT COUNT(*)::int FROM public.satchel_items WHERE find_id = f)
	     + (SELECT COALESCE(SUM(jsonb_array_length(escrow)), 0)::int FROM public.market_offers
	        WHERE find_id = f AND status = 'open') $$;
CREATE OR REPLACE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	IF cond IS NOT TRUE THEN RAISE EXCEPTION 'SMOKE FAIL: %', msg; END IF;
END $$;
-- Ids carried between sections.
CREATE TEMP TABLE c3_ids (k text PRIMARY KEY, v text);
CREATE OR REPLACE FUNCTION pg_temp.put(k text, v text) RETURNS void LANGUAGE sql AS $$
	INSERT INTO c3_ids VALUES (k, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v $$;
CREATE OR REPLACE FUNCTION pg_temp.got(k text) RETURNS text LANGUAGE sql AS $$
	SELECT v FROM c3_ids WHERE c3_ids.k = got.k $$;

-- ── 0. The balance pass ──────────────────────────────────────────────────────
SELECT set_config('ttp.fake_now', '2026-11-20 10:10:00+00', false);
DO $s0$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	v jsonb; t jsonb; res jsonb;
	lo numeric; hi numeric; sf numeric; bf numeric; impact numeric;
BEGIN
	SELECT value INTO v FROM public.app_settings WHERE key = 'market_tuning';
	PERFORM pg_temp.ok((v->'price'->>'impact')::numeric = 0.05 AND (v->'price'->>'wiggle')::numeric = 0.02
		AND (v->>'offer_hours')::int = 48, '0 balance pass stored');
	PERFORM pg_temp.ok(v->'set_size' = '{"common": 4, "uncommon": 3, "rare": 3}'::jsonb
		AND (v->'price'->>'lo')::numeric = 0.85 AND (v->'price'->>'hi')::numeric = 1.15
		AND (v->'price'->>'sell_factor')::numeric = 1.2 AND (v->'price'->>'buy_factor')::numeric = 0.8
		AND (v->'price'->>'home')::numeric = 0.05 AND (v->'price'->>'pig_pull')::numeric = 0.3333333333
		AND (v->>'list_multiple')::int = 3 AND (v->>'open_offers')::int = 4 AND (v->>'daily_posts')::int = 30
		AND (v->>'tick_minutes')::int = 30 AND (v->>'catch_up_ticks')::int = 144 AND (v->>'enabled')::boolean
		AND jsonb_typeof(v->'counter_caps') = 'null'
		AND v->'print_chance' = '{"common": 0.2, "uncommon": 0.1, "rare": 0.03}'::jsonb, '0 nothing else touched');

	t := public._market_tuning();
	lo := (t->'price'->>'lo')::numeric; hi := (t->'price'->>'hi')::numeric;
	sf := (t->'price'->>'sell_factor')::numeric; bf := (t->'price'->>'buy_factor')::numeric;
	impact := (t->'price'->>'impact')::numeric;
	PERFORM pg_temp.ok(sf * lo > bf * hi, '0 fairness: Bullion''s lowest ask above his highest bid');
	PERFORM pg_temp.ok(impact < (sf - bf) * lo / bf AND (sf - bf) * lo / bf = 0.425, '0 impact 0.05 under the 0.425 ride limit');

	-- The compiled defaults carry the same numbers.
	DELETE FROM public.app_settings WHERE key = 'market_tuning';
	t := public._market_tuning();
	PERFORM pg_temp.ok((t->'price'->>'impact')::numeric = 0.05 AND (t->'price'->>'wiggle')::numeric = 0.02
		AND (t->>'offer_hours')::int = 48 AND (t->>'tick_minutes')::int = 30 AND (t->>'enabled')::boolean
		AND t->'set_size' = '{"common": 4, "uncommon": 3, "rare": 3}'::jsonb
		AND t->'bullion_board' = '{"daily_listings": 3, "per_pig": 1}'::jsonb
		AND t->'base' = '{"common": 3, "uncommon": 8, "rare": 20}'::jsonb, '0 compiled defaults');
	INSERT INTO public.app_settings (key, value) VALUES ('market_tuning', v);

	-- A listing pinned now lasts 48 hours.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'tin_whistle', 3);
	res := public.market_post('sell', 'tin_whistle', 150, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false'
		AND (res->'offer'->>'expires_at')::timestamptz = '2026-11-22 10:10:00+00', '0 48-hour listing');
	PERFORM pg_temp.ok(public.market_cancel((res->'offer'->>'id')::bigint)->>'returned' = 'find', '0 taken down');

	-- The target FK now lets go instead of cascading.
	PERFORM pg_temp.ok((SELECT confdeltype FROM pg_constraint
		WHERE conrelid = 'public.market_offers'::regclass AND conname = 'market_offers_target_id_fkey') = 'n', '0 target FK is SET NULL');
	-- Every new helper is the server's alone.
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
		WHERE ns.nspname = 'public' AND pr.proname IN ('_market_jsonb_merge', '_market_num', '_market_int',
			'_market_clamp_num', '_market_bid_n', '_market_ask_n', '_market_due', '_market_prune',
			'_market_find_plural', '_market_push', '_market_offers_target_gone', '_season2_flip_market_locked',
			'_market_tuning', '_market_notice', '_market_advance', '_market_bullion_take')
		AND (has_function_privilege('anon', pr.oid, 'EXECUTE') OR has_function_privilege('authenticated', pr.oid, 'EXECUTE'))),
		'0 helpers inaccessible to clients');
	RAISE NOTICE 'C3 section 0 (balance pass): green';
END
$s0$;

-- ── 1. A one-friend listing outlives its friend's account ─────────────────────
DO $s1$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	c uuid := '00000000-0000-0000-0000-00000000c303';
	g uuid := '00000000-0000-0000-0000-00000000c304';
	st jsonb; res jsonb; l_sell bigint; l_buy bigint; bid int;
BEGIN
	PERFORM pg_temp.as_user(a);
	st := public.market_state();
	PERFORM pg_temp.give(a, 'pinecone', 4);
	bid := pg_temp.bid('pinecone');
	res := public.market_post('sell', 'pinecone', bid + 1, NULL, NULL, g, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '1 pinned for Gone');
	l_sell := (res->'offer'->>'id')::bigint;
	res := public.market_post('buy', 'pinecone', bid + 1, NULL, NULL, g, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '1 a wanted ad for Gone');
	l_buy := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.ok(pg_temp.held(a, 'pinecone') = 0, '1 set held aside');

	-- Gone deletes the account (delete_my_account: DELETE FROM auth.users; on
	-- production every other FK cascades, here the stubs are cleared by hand).
	DELETE FROM public.friendships WHERE requester_id = g OR receiver_id = g;
	DELETE FROM public.user_items WHERE user_id = g;
	DELETE FROM public.profiles WHERE id = g;
	DELETE FROM auth.users WHERE id = g;

	PERFORM pg_temp.ok((SELECT status = 'cancelled' AND target_id IS NULL AND closed_at IS NOT NULL
		FROM public.market_offers WHERE id = l_sell), '1 the listing came down');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = l_buy) = 'cancelled', '1 the wanted ad came down');
	PERFORM pg_temp.ok(pg_temp.held(a, 'pinecone') = 4, '1 the set came home');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_notices WHERE user_id = a AND kind = 'expired'
		AND offer->>'ended' = 'target_left' AND (offer->>'id')::bigint IN (l_sell, l_buy)) = 2, '1 Pip told, for each');
	PERFORM pg_temp.as_user(c);
	st := public.market_state();
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(st->'board') x
		WHERE (x->>'id')::bigint IN (l_sell, l_buy)), '1 never public');
	-- A tick later the bag is still whole (nothing given twice).
	PERFORM set_config('ttp.fake_now', '2026-11-20 10:40:00+00', false);
	PERFORM pg_temp.as_user(a);
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true' AND pg_temp.held(a, 'pinecone') = 4, '1 still four, the market reads');
	RAISE NOTICE 'C3 section 1 (target gone): green';
END
$s1$;

-- ── 2. Set sizes change with listings up ─────────────────────────────────────
DO $s2$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	b uuid := '00000000-0000-0000-0000-00000000c302';
	c uuid := '00000000-0000-0000-0000-00000000c303';
	st jsonb; res jsonb; tr public.market_trades;
	l1 bigint; l2 bigint; l3 bigint; l4 bigint; l5 bigint; l6 bigint; l7 bigint;
	pr1 int; pr3 int; pr6 int;
	w0 int; w1 int; ca int; cb int; cc int; hb int; hs int;
BEGIN
	-- Pinned while commons are sets of four.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'river_pebble', 4);
	pr1 := pg_temp.bid('river_pebble') + 1;
	res := public.market_post('sell', 'river_pebble', pr1, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '2 L1 rests'); l1 := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.give(a, 'blue_feather', 4);
	UPDATE public.market_prices SET price = 12 WHERE find_id = 'blue_feather';
	res := public.market_post('sell', 'blue_feather', 10, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '2 L2 rests'); l2 := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.give(a, 'clover', 4);
	res := public.market_post('swap', 'clover', NULL, 'marble', 1, b, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true', '2 L4 swap pinned'); l4 := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.as_user(b);
	pr3 := pg_temp.bid('pinecone') + 1;
	res := public.market_post('buy', 'pinecone', pr3, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '2 L3 rests'); l3 := (res->'offer'->>'id')::bigint;
	UPDATE public.market_prices SET price = 12 WHERE find_id = 'snail_shell';
	res := public.market_post('buy', 'snail_shell', 13, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '2 L5 rests (ask 15)'); l5 := (res->'offer'->>'id')::bigint;
	pr6 := pg_temp.bid('brass_button') + 1;
	res := public.market_post('buy', 'brass_button', pr6, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '2 L6 rests'); l6 := (res->'offer'->>'id')::bigint;

	-- Commons become sets of six.
	UPDATE public.app_settings SET value = jsonb_set(value, '{set_size,common}', '6') WHERE key = 'market_tuning';
	PERFORM pg_temp.ok(public._market_set_size('river_pebble', public._market_tuning()) = 6, '2 commons are sixes now');

	-- (a) A pig buys a held set of four: exactly four move, the seller is paid.
	PERFORM pg_temp.as_user(b);
	w0 := pg_temp.world('river_pebble'); ca := pg_temp.coin(a); cb := pg_temp.coin(b); hb := pg_temp.held(b, 'river_pebble');
	res := public.market_take(l1, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'qty')::int = 4, '2a bought as four');
	PERFORM pg_temp.ok(pg_temp.held(b, 'river_pebble') = hb + 4, '2a the buyer got exactly the four held');
	PERFORM pg_temp.ok(pg_temp.coin(a) = ca + pr1 AND pg_temp.coin(b) = cb - pr1, '2a paid and was paid');
	PERFORM pg_temp.ok(pg_temp.world('river_pebble') = w0, '2a nothing minted or lost');

	-- (c) A wanted ad for four, filled by a pig holding six: four move.
	PERFORM pg_temp.as_user(c);
	PERFORM pg_temp.give(c, 'pinecone', 6);
	w0 := pg_temp.world('pinecone'); cb := pg_temp.coin(b); cc := pg_temp.coin(c); hb := pg_temp.held(b, 'pinecone');
	res := public.market_take(l3, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'qty')::int = 4, '2c filled as four');
	PERFORM pg_temp.ok(pg_temp.held(c, 'pinecone') = 2 AND pg_temp.held(b, 'pinecone') = hb + 4, '2c four handed over, not six');
	PERFORM pg_temp.ok(pg_temp.coin(c) = cc + pr3 AND pg_temp.coin(b) = cb - pr3, '2c paid');
	PERFORM pg_temp.ok(pg_temp.world('pinecone') = w0, '2c nothing minted or lost');

	-- (d) A swap of four clovers taken after the switch: the taker gets four.
	PERFORM pg_temp.as_user(b);
	PERFORM pg_temp.give(b, 'marble', 1);
	w0 := pg_temp.world('clover'); hb := pg_temp.held(b, 'clover');
	res := public.market_take(l4, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'qty')::int = 4, '2d swapped as four');
	PERFORM pg_temp.ok(pg_temp.held(b, 'clover') = hb + 4 AND pg_temp.world('clover') = w0, '2d exactly the four held');

	-- (f) A new post (a set of six now) never meets an ad for four.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'brass_button', 6);
	res := public.market_post('sell', 'brass_button', pr6, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false' AND (res->'offer'->>'qty')::int = 6, '2f a six rests');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = l6) = 'open', '2f the ad for four still waits');
	l7 := (res->'offer'->>'id')::bigint;
	PERFORM public.market_cancel(l7);
	PERFORM pg_temp.ok(pg_temp.held(a, 'brass_button') = 6, '2f the six came home');

	-- (b) + (e) Bullion crosses after the switch, each listing by its own qty.
	UPDATE public.market_prices SET price = 20.7, tick = tick - 1 WHERE find_id = 'blue_feather';
	w0 := pg_temp.world('blue_feather'); w1 := pg_temp.world('snail_shell');
	ca := pg_temp.coin(a); cb := pg_temp.coin(b); hs := pg_temp.held(b, 'snail_shell');
	PERFORM pg_temp.as_user(c);
	st := public.market_state();
	SELECT * INTO tr FROM public.market_trades WHERE offer_id = l2;
	PERFORM pg_temp.ok(tr.id IS NOT NULL AND tr.kind = 'counter' AND tr.side = 'sell' AND tr.qty = 4, '2b crossed as four');
	PERFORM pg_temp.ok(tr.price = public._market_bid_n('blue_feather', 4, tr.from_price, public._market_tuning())
		AND tr.price <= 12, '2b paid Bullion''s price for four, not for a set of six');
	PERFORM pg_temp.ok(pg_temp.coin(a) = ca + tr.price, '2b the seller got exactly that');
	PERFORM pg_temp.ok(pg_temp.world('blue_feather') = w0 - 4, '2b exactly the four held went to Bullion');
	SELECT * INTO tr FROM public.market_trades WHERE offer_id = l5;
	PERFORM pg_temp.ok(tr.id IS NOT NULL AND tr.kind = 'counter' AND tr.side = 'buy' AND tr.qty = 4
		AND tr.price = public._market_ask_n('snail_shell', 4, tr.from_price, public._market_tuning()), '2e the ad for four crossed as four');
	PERFORM pg_temp.ok(pg_temp.held(b, 'snail_shell') = hs + 4 AND pg_temp.coin(b) = cb - tr.price, '2e four arrived, paid for');
	PERFORM pg_temp.ok(pg_temp.world('snail_shell') = w1 + 4, '2e Bullion sold exactly four');

	-- Back to sets of four; Maya takes her ad down.
	UPDATE public.app_settings SET value = jsonb_set(value, '{set_size,common}', '4') WHERE key = 'market_tuning';
	PERFORM pg_temp.as_user(b);
	PERFORM pg_temp.ok(public.market_cancel(l6)->>'ok' = 'true', '2 cleanup');
	RAISE NOTICE 'C3 section 2 (set sizes): green';
END
$s2$;

-- ── 3. Bad edits to market_tuning ────────────────────────────────────────────
SELECT set_config('ttp.fake_now', '2026-11-21 10:10:00+00', false);
DO $s3$
DECLARE
	e uuid := '00000000-0000-0000-0000-00000000c305';
	v jsonb; t jsonb; st jsonb; res jsonb; card jsonb; f jsonb; c0 int;
BEGIN
	SELECT value INTO v FROM public.app_settings WHERE key = 'market_tuning';
	PERFORM pg_temp.as_user(e);

	-- (a) A fractional daily_listings: the day's first read builds two.
	UPDATE public.app_settings SET value = value || '{"bullion_board": {"daily_listings": 2.5}}' WHERE key = 'market_tuning';
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true', '3a reads with daily_listings 2.5');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_bullion_offers WHERE day = '2026-11-21') = 2
		AND (SELECT COUNT(*) FROM jsonb_array_elements(st->'board') x WHERE x->>'source' = 'bullion') = 2
		AND (st->'tuning'->'bullion_board'->>'daily_listings')::int = 2, '3a two on the shelf');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- (b) A partial "price" (a shallow || drops the rest) with a tick due.
	UPDATE public.app_settings SET value = value || '{"price": {"impact": 0.05}}' WHERE key = 'market_tuning';
	PERFORM set_config('ttp.fake_now', '2026-11-21 10:40:00+00', false);
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true', '3b reads with a partial price');
	t := public._market_tuning();
	PERFORM pg_temp.ok((t->'price'->>'lo')::numeric = 0.85 AND (t->'price'->>'hi')::numeric = 1.15
		AND (t->'price'->>'sell_factor')::numeric = 1.2 AND (t->'price'->>'buy_factor')::numeric = 0.8
		AND (t->'price'->>'wiggle')::numeric = 0.02 AND (t->'price'->>'home')::numeric = 0.05
		AND (t->'price'->>'pig_pull')::numeric = 0.3333333333 AND (t->'price'->>'impact')::numeric = 0.05, '3b the rest of price from the defaults');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_prices mp
		WHERE mp.price IS NULL OR mp.tick <> (st->>'tick')::bigint
		   OR mp.price < 0.85 * public._market_usual(mp.find_id, t) - 0.000001
		   OR mp.price > 1.15 * public._market_usual(mp.find_id, t) + 0.000001), '3b every price walked, in the band');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- (c) A negative buy_factor: back to the default cut; a shelf set is never free.
	UPDATE public.app_settings SET value = jsonb_set(value, '{price,buy_factor}', '-2') WHERE key = 'market_tuning';
	PERFORM pg_temp.ok((public._market_tuning()->'price'->>'buy_factor')::numeric = 0.8, '3c buy_factor falls back');
	st := public.market_state();
	FOR card IN SELECT y FROM jsonb_array_elements(st->'board') y WHERE y->>'source' = 'bullion' LOOP
		SELECT y INTO f FROM jsonb_array_elements(st->'finds') y WHERE y->>'id' = card->>'find_id';
		PERFORM pg_temp.ok((card->>'price')::int >= 1
			AND (card->>'price')::int = ((f->>'bid')::int + (f->>'ask')::int) / 2, '3c shelf quote from the default cut');
	END LOOP;
	SELECT y INTO card FROM jsonb_array_elements(st->'board') y WHERE y->>'source' = 'bullion' ORDER BY (y->>'id')::bigint DESC LIMIT 1;
	c0 := pg_temp.coin(e);
	res := public.market_take((card->>'id')::bigint, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND (res->'trade'->>'price')::int = (card->>'price')::int
		AND pg_temp.coin(e) = c0 - (card->>'price')::int AND (card->>'price')::int >= 1, '3c the set cost its quote, not nothing');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- (d) An unfair cut, each value in range: all four back to the defaults.
	UPDATE public.app_settings SET value = jsonb_set(value, '{price}',
		(value->'price') || '{"sell_factor": 1.05, "buy_factor": 0.95}') WHERE key = 'market_tuning';
	t := public._market_tuning();
	PERFORM pg_temp.ok((t->'price'->>'sell_factor')::numeric = 1.2 AND (t->'price'->>'buy_factor')::numeric = 0.8
		AND (t->'price'->>'lo')::numeric = 0.85 AND (t->'price'->>'hi')::numeric = 1.15, '3d unfair cut falls back');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- (e) Garbage and out-of-range values, one each.
	UPDATE public.app_settings SET value = value || '{"offer_hours": "soon", "daily_posts": -5, "open_offers": 2.9,
		"catch_up_ticks": 99999, "list_multiple": "4", "counter_caps": {"buy": "x", "sell": 2.5}, "enabled": "nope",
		"set_size": {"common": 0, "rare": "two"}, "print_chance": {"rare": 7},
		"price": {"impact": 0.9, "wiggle": -1, "home": "far", "pig_pull": 2},
		"bullion_board": {"per_pig": "lots"}}' WHERE key = 'market_tuning';
	t := public._market_tuning();
	PERFORM pg_temp.ok((t->>'offer_hours')::int = 48 AND (t->>'daily_posts')::int = 0 AND (t->>'open_offers')::int = 2
		AND (t->>'catch_up_ticks')::int = 336 AND (t->>'list_multiple')::int = 4
		AND t->'counter_caps' = '{"sell": 2}'::jsonb AND (t->>'enabled')::boolean
		AND t->'set_size' = '{"common": 1, "uncommon": 3, "rare": 3}'::jsonb
		AND (t->'print_chance'->>'rare')::numeric = 1 AND (t->'print_chance'->>'common')::numeric = 0.2
		AND (t->'price'->>'impact')::numeric = 0.2 AND (t->'price'->>'wiggle')::numeric = 0
		AND (t->'price'->>'home')::numeric = 0.05 AND (t->'price'->>'pig_pull')::numeric = 1
		AND t->'bullion_board' = '{"daily_listings": 3, "per_pig": 1}'::jsonb, '3e coerced and clamped: ' || t::text);
	PERFORM pg_temp.ok(public.market_state()->>'ok' = 'true', '3e the market reads');
	-- (f) Not even an object.
	UPDATE public.app_settings SET value = '"oops"' WHERE key = 'market_tuning';
	t := public._market_tuning();
	PERFORM pg_temp.ok((t->>'offer_hours')::int = 48 AND (t->'price'->>'impact')::numeric = 0.05, '3f all defaults');
	PERFORM pg_temp.ok(public.market_state()->>'ok' = 'true', '3f the market reads');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- (g) Never free: quotes floor at 1, a spend of nothing is refused.
	t := public._market_tuning();
	PERFORM pg_temp.ok(public._market_bid(1, 0.1, t) = 1 AND public._market_ask(1, 0.1, t) >= 2, '3g quotes floor at 1');
	c0 := pg_temp.coin(e);
	PERFORM pg_temp.ok(NOT public._market_spend(e, 0) AND NOT public._market_spend(e, -3) AND pg_temp.coin(e) = c0, '3g a spend of nothing is refused');
	RAISE NOTICE 'C3 section 3 (bad tuning edits): green';
END
$s3$;

-- (h) A shelf that fails to build is an empty shelf, and the market reads.
CREATE FUNCTION public._smoke_shelf_boom() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'shelf boom'; END $$;
CREATE TRIGGER smoke_shelf_boom BEFORE INSERT ON public.market_bullion_offers
	FOR EACH ROW EXECUTE FUNCTION public._smoke_shelf_boom();
SELECT set_config('ttp.fake_now', '2026-11-22 00:10:00+00', false);
DO $s3h$
DECLARE
	st jsonb;
BEGIN
	PERFORM pg_temp.as_user('00000000-0000-0000-0000-00000000c303');
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(st->'board') x
		WHERE x->>'source' = 'bullion'), '3h a broken shelf is an empty shelf');
	RAISE NOTICE 'C3 section 3h (shelf builder fails soft): green';
END
$s3h$;
DROP TRIGGER smoke_shelf_boom ON public.market_bullion_offers;
DROP FUNCTION public._smoke_shelf_boom();

-- ── 4. Closed with listings up ───────────────────────────────────────────────
SELECT set_config('ttp.fake_now', '2026-11-22 10:10:00+00', false);
DO $s4$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	c uuid := '00000000-0000-0000-0000-00000000c303';
	st jsonb; res jsonb; la bigint; lb bigint; lc bigint; n0 int;
BEGIN
	PERFORM pg_temp.as_user(a);
	st := public.market_state();
	PERFORM pg_temp.give(a, 'old_key', 6);
	PERFORM pg_temp.give(a, 'honeycomb', 3);
	res := public.market_post('sell', 'old_key', 70, NULL, NULL, NULL, gen_random_uuid());
	la := (res->'offer'->>'id')::bigint;
	res := public.market_post('sell', 'old_key', 71, NULL, NULL, NULL, gen_random_uuid());
	lb := (res->'offer'->>'id')::bigint;
	UPDATE public.market_prices SET price = 24 WHERE find_id = 'honeycomb';
	res := public.market_post('sell', 'honeycomb', 20, NULL, NULL, NULL, gen_random_uuid());
	lc := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.ok(la IS NOT NULL AND lb IS NOT NULL AND lc IS NOT NULL
		AND pg_temp.held(a, 'old_key') = 0 AND pg_temp.held(a, 'honeycomb') = 0, '4 three listings up, sets held');

	UPDATE public.app_settings SET value = value || '{"enabled": false}' WHERE key = 'market_tuning';
	n0 := (SELECT COUNT(*) FROM public.market_notices WHERE user_id = a AND delivered_at IS NULL);
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'false' AND st->>'reason' = 'closed', '4 closed');
	PERFORM pg_temp.ok((SELECT array_agg((x->>'id')::bigint ORDER BY (x->>'id')::bigint) FROM jsonb_array_elements(st->'me'->'offers') x)
		= ARRAY[la, lb, lc], '4 your own listings in reach');
	PERFORM pg_temp.ok((st->'me'->'holdings'->'old_key'->>'on_offer')::int = 6, '4 holdings say what is held');
	PERFORM pg_temp.ok(public.market_find('pinecone')->>'reason' = 'closed', '4 market_find honours the switch');
	PERFORM pg_temp.ok(public.market_ping()->>'open' = 'false' AND (public.market_ping()->>'listings')::int = 3, '4 ping');
	PERFORM pg_temp.ok(public.market_post('sell', 'old_key', 70, NULL, NULL, NULL, gen_random_uuid())->>'reason' = 'closed'
		AND public.market_counter('old_key', 'buy', NULL, gen_random_uuid())->>'reason' = 'closed'
		AND public.market_take(la, NULL, gen_random_uuid())->>'reason' = 'closed', '4 no trading');
	res := public.market_cancel(lb);
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND pg_temp.held(a, 'old_key') = 3, '4 take one down while closed');
	-- Nothing crosses while closed (honeycomb's bid would now be 22 >= 20).
	UPDATE public.market_prices SET price = 27.6, tick = tick - 1 WHERE find_id = 'honeycomb';
	PERFORM pg_temp.as_user(c);
	st := public.market_state();
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = lc) = 'open', '4 nothing crosses while closed');
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public.market_notices WHERE user_id = a AND delivered_at IS NULL) = n0, '4 notices wait');
	PERFORM pg_temp.put('4.la', la::text);
	PERFORM pg_temp.put('4.lc', lc::text);
END
$s4$;
-- Three days on, past 48 hours, still closed.
SELECT set_config('ttp.fake_now', '2026-11-25 10:10:00+00', false);
DO $s4b$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	la bigint := pg_temp.got('4.la')::bigint;
	lc bigint := pg_temp.got('4.lc')::bigint;
	st jsonb;
BEGIN
	PERFORM pg_temp.as_user(a);
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'reason' = 'closed' AND jsonb_array_length(st->'me'->'offers') = 0, '4 still closed, nothing up');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = la) = 'expired'
		AND (SELECT status FROM public.market_offers WHERE id = lc) = 'expired', '4 time still passes');
	PERFORM pg_temp.ok(pg_temp.held(a, 'old_key') = 6 AND pg_temp.held(a, 'honeycomb') = 3, '4 held sets came home while closed');
	UPDATE public.app_settings SET value = value || '{"enabled": true}' WHERE key = 'market_tuning';
	st := public.market_state();
	PERFORM pg_temp.ok(st->>'ok' = 'true' AND (SELECT COUNT(*) FROM jsonb_array_elements(st->'notices') x
		WHERE x->>'kind' = 'expired' AND (x->'offer'->>'id')::bigint IN (la, lc)) = 2, '4 reopened, the notices handed over');
	RAISE NOTICE 'C3 section 4 (closed market): green';
END
$s4b$;

-- ── 5. One shelf set a pig a day ─────────────────────────────────────────────
SELECT set_config('ttp.fake_now', '2026-11-26 10:10:00+00', false);
DO $s5$
DECLARE
	e uuid := '00000000-0000-0000-0000-00000000c305';
	v jsonb; st jsonb; res jsonb; ids bigint[]; c0 int;
BEGIN
	SELECT value INTO v FROM public.app_settings WHERE key = 'market_tuning';
	PERFORM pg_temp.as_user(e);
	st := public.market_state();
	PERFORM pg_temp.ok((st->'tuning'->'bullion_board'->>'per_pig')::int = 1 AND (st->'me'->>'shelf_today')::int = 0, '5 one a pig, none yet');
	SELECT array_agg((x->>'id')::bigint ORDER BY (x->>'id')::bigint DESC) INTO ids
	FROM jsonb_array_elements(st->'board') x WHERE x->>'source' = 'bullion';
	PERFORM pg_temp.ok(array_length(ids, 1) = 3, '5 three on the shelf');
	PERFORM pg_temp.ok(public.market_take(ids[1], NULL, gen_random_uuid())->>'ok' = 'true', '5 the first');
	c0 := pg_temp.coin(e);
	res := public.market_take(ids[2], NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'reason' = 'shelf_limit' AND (res->>'limit')::int = 1, '5 the second refused');
	PERFORM pg_temp.ok(pg_temp.coin(e) = c0 AND (SELECT status FROM public.market_bullion_offers WHERE id = -ids[2]) = 'open', '5 nothing charged, still on the shelf');
	PERFORM pg_temp.ok((public.market_state()->'me'->>'shelf_today')::int = 1, '5 shelf_today');
	UPDATE public.app_settings SET value = jsonb_set(value, '{bullion_board}', '{"per_pig": 2}') WHERE key = 'market_tuning';
	PERFORM pg_temp.ok(public.market_take(ids[2], NULL, gen_random_uuid())->>'ok' = 'true', '5 two a pig: the second');
	PERFORM pg_temp.ok(public.market_take(ids[3], NULL, gen_random_uuid())->>'reason' = 'shelf_limit', '5 two a pig: not a third');
	UPDATE public.app_settings SET value = jsonb_set(value, '{bullion_board}', '{"per_pig": null}') WHERE key = 'market_tuning';
	PERFORM pg_temp.ok(public.market_take(ids[3], NULL, gen_random_uuid())->>'ok' = 'true', '5 no cap: the third');
	UPDATE public.app_settings SET value = v WHERE key = 'market_tuning';

	-- 6. Nothing is due right after an advance: a read queued behind it at
	-- the lock re-checks this and leaves.
	PERFORM pg_temp.ok(NOT public._market_due(public._market_tick(public._patch_now(), public._market_tuning()),
		public._patch_now(), public._market_reset_at()), '6 nothing due after an advance');
	RAISE NOTICE 'C3 sections 5-6 (shelf cap, due re-check): green';
END
$s5$;

-- ── 7. Housekeeping, once a day ──────────────────────────────────────────────
SELECT set_config('ttp.fake_now', '2026-11-26 10:40:00+00', false);
DO $s7$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	t jsonb := public._market_tuning();
	old_tick bigint := public._market_tick('2026-10-01 12:00:00+00', public._market_tuning());
	rid bigint; r_old uuid := gen_random_uuid(); r_new uuid := gen_random_uuid();
BEGIN
	INSERT INTO public.market_trades (kind, side, find_id, qty, price, tick, created_at)
	VALUES ('counter', 'sell', 'pinecone', 4, 9, old_tick, '2026-10-01 12:00:00+00') RETURNING market_trades.id INTO rid;
	PERFORM pg_temp.put('7.t_old', rid::text);
	INSERT INTO public.market_trades (kind, side, find_id, qty, price, tick, created_at)
	VALUES ('counter', 'buy', 'pinecone', 4, 15, old_tick, '2026-10-01 12:00:00+00') RETURNING market_trades.id INTO rid;
	PERFORM pg_temp.put('7.t_ref', rid::text);
	INSERT INTO public.market_notices (user_id, kind, trade_id, created_at)
	VALUES (a, 'crossed', rid, '2026-10-01 12:00:00+00') RETURNING market_notices.id INTO rid;
	PERFORM pg_temp.put('7.n_undelivered', rid::text);
	INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, tick, created_at)
	VALUES ('counter', 'buy', 'board', 'pinecone', 4, 13, old_tick, '2026-10-01 12:00:00+00') RETURNING market_trades.id INTO rid;
	PERFORM pg_temp.put('7.t_shelf', rid::text);
	INSERT INTO public.market_bullion_offers (day, slot, find_id, status, trade_id, buyer_id, created_at)
	VALUES ('2026-10-01', 1, 'pinecone', 'filled', rid, a, '2026-10-01 00:00:00+00');
	INSERT INTO public.market_trades (kind, side, find_id, qty, price, tick, created_at)
	VALUES ('counter', 'sell', 'pinecone', 4, 9, public._market_tick(public._patch_now(), t), public._patch_now()) RETURNING market_trades.id INTO rid;
	PERFORM pg_temp.put('7.t_new', rid::text);
	INSERT INTO public.market_notices (user_id, kind, created_at, delivered_at)
	VALUES (a, 'expired', '2026-10-01 12:00:00+00', '2026-10-01 13:00:00+00') RETURNING market_notices.id INTO rid;
	PERFORM pg_temp.put('7.n_old', rid::text);
	INSERT INTO public.market_notices (user_id, kind, created_at, delivered_at)
	VALUES (a, 'expired', '2026-11-20 12:00:00+00', '2026-11-20 13:00:00+00') RETURNING market_notices.id INTO rid;
	PERFORM pg_temp.put('7.n_recent', rid::text);
	INSERT INTO public.market_requests (nonce, user_id, result, created_at)
	VALUES (r_old, a, '{}', '2026-10-01 12:00:00+00'), (r_new, a, '{}', '2026-11-26 10:00:00+00');
	PERFORM pg_temp.put('7.r_old', r_old::text);
	PERFORM pg_temp.put('7.r_new', r_new::text);
	INSERT INTO public.market_offers (user_id, find_id, side, price, qty, status, created_at, posted_at, expires_at, closed_at)
	VALUES (a, 'pinecone', 'buy', 10, 4, 'expired', '2026-09-30', '2026-09-30', '2026-10-01', '2026-10-01') RETURNING market_offers.id INTO rid;
	PERFORM pg_temp.put('7.o_old', rid::text);
	-- A tick later, the same day: the advance runs, the housekeeping does not.
	PERFORM pg_temp.as_user(a);
	PERFORM public.market_state();
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_notices WHERE market_notices.id = pg_temp.got('7.n_old')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_trades WHERE market_trades.id = pg_temp.got('7.t_old')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_offers WHERE market_offers.id = pg_temp.got('7.o_old')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_requests WHERE nonce = r_old), '7 not before the day turns');
END
$s7$;
SELECT set_config('ttp.fake_now', '2026-11-27 10:10:00+00', false);
DO $s7b$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	t jsonb := public._market_tuning();
	rid bigint; o_reset bigint; o_cancelled bigint;
BEGIN
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.ok(public.market_state()->>'ok' = 'true', '7 the day''s first read');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_notices WHERE market_notices.id = pg_temp.got('7.n_old')::bigint), '7 an old delivered notice goes');
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_notices WHERE market_notices.id = pg_temp.got('7.n_recent')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_notices WHERE market_notices.id = pg_temp.got('7.n_undelivered')::bigint), '7 recent and undelivered notices stay');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_requests WHERE nonce = pg_temp.got('7.r_old')::uuid)
		AND EXISTS (SELECT 1 FROM public.market_requests WHERE nonce = pg_temp.got('7.r_new')::uuid), '7 old nonce replays go');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_offers WHERE market_offers.id = pg_temp.got('7.o_old')::bigint), '7 an old closed listing goes');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_trades WHERE market_trades.id = pg_temp.got('7.t_old')::bigint), '7 an old trade goes');
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_trades WHERE market_trades.id = pg_temp.got('7.t_ref')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_trades WHERE market_trades.id = pg_temp.got('7.t_shelf')::bigint)
		AND EXISTS (SELECT 1 FROM public.market_trades WHERE market_trades.id = pg_temp.got('7.t_new')::bigint), '7 trades a notice or the shelf points at stay, and recent ones');
	-- A 'reset' listing is never pruned (an undone flip gives its set back from it).
	INSERT INTO public.market_offers (user_id, find_id, side, price, qty, status, created_at, posted_at, expires_at, closed_at)
	VALUES (a, 'pinecone', 'sell', 10, 4, 'reset', '2026-09-30', '2026-09-30', '2026-10-01', '2026-10-01') RETURNING market_offers.id INTO o_reset;
	INSERT INTO public.market_offers (user_id, find_id, side, price, qty, status, created_at, posted_at, expires_at, closed_at)
	VALUES (a, 'pinecone', 'buy', 10, 4, 'cancelled', '2026-09-30', '2026-09-30', '2026-10-01', '2026-10-01') RETURNING market_offers.id INTO o_cancelled;
	PERFORM public._market_prune(public._patch_now(), public._market_tick(public._patch_now(), t) - 30 * 48);
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_offers WHERE market_offers.id = o_reset)
		AND NOT EXISTS (SELECT 1 FROM public.market_offers WHERE market_offers.id = o_cancelled), '7 a reset listing stays');
	DELETE FROM public.market_offers WHERE market_offers.id = o_reset;
	-- Once a day: an old row that turns up now waits for tomorrow.
	INSERT INTO public.market_notices (user_id, kind, created_at, delivered_at)
	VALUES (a, 'expired', '2026-10-02 12:00:00+00', '2026-10-02 13:00:00+00') RETURNING market_notices.id INTO rid;
	PERFORM pg_temp.put('7.n2', rid::text);
	PERFORM set_config('ttp.fake_now', '2026-11-27 10:40:00+00', false);
	PERFORM public.market_state();
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_notices WHERE market_notices.id = rid), '7 once a day');
END
$s7b$;
SELECT set_config('ttp.fake_now', '2026-11-28 10:10:00+00', false);
DO $s7c$
BEGIN
	PERFORM pg_temp.as_user('00000000-0000-0000-0000-00000000c301');
	PERFORM public.market_state();
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_notices WHERE id = pg_temp.got('7.n2')::bigint), '7 the next day it goes');
	RAISE NOTICE 'C3 section 7 (housekeeping): green';
END
$s7c$;

-- ── 3i. tick_minutes is pinned at 30 ─────────────────────────────────────────
DO $s3i$
DECLARE
	st jsonb;
BEGIN
	UPDATE public.app_settings SET value = value || '{"tick_minutes": 60}' WHERE key = 'market_tuning';
	PERFORM pg_temp.ok((public._market_tuning()->>'tick_minutes')::int = 30, '3i tick_minutes pinned');
	PERFORM set_config('ttp.fake_now', '2026-12-05 10:10:00+00', false);
	PERFORM pg_temp.as_user('00000000-0000-0000-0000-00000000c303');
	st := public.market_state();
	PERFORM pg_temp.ok((st->>'tick')::bigint = FLOOR(EXTRACT(EPOCH FROM '2026-12-05 10:10:00+00'::timestamptz) / 1800)
		AND (SELECT tick FROM public.market_prices WHERE find_id = 'tin_whistle') = (st->>'tick')::bigint
		AND (SELECT COUNT(*) FROM public.market_price_points WHERE find_id = 'tin_whistle'
		     AND tick > (st->>'tick')::bigint - 48) = 48, '3i a week on, the walk kept up, a point a tick');
	UPDATE public.app_settings SET value = value || '{"tick_minutes": 30}' WHERE key = 'market_tuning';
	RAISE NOTICE 'C3 section 3i (tick pinned): green';
END
$s3i$;

-- ── 8. The Season 2 flip, under the market lock ──────────────────────────────
-- A stub of flip_season_2 (20261029190000): the guard it writes is all the
-- market reads (ran_at = now(), this transaction's start, as the real one).
CREATE OR REPLACE FUNCTION public.flip_season_2(p_at timestamptz DEFAULT now(), p_weeks int DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE state jsonb;
BEGIN
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RETURN jsonb_build_object('ok', true, 'already_flipped', true);
	END IF;
	state := jsonb_build_object('flipped_at', p_at, 'ran_at', now(), 'scope', '{"satchel": true}'::jsonb);
	INSERT INTO public.app_settings (key, value) VALUES ('season2_flip', state)
	ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
	INSERT INTO public.app_config (key, enabled) VALUES ('season2_flipped', true)
	ON CONFLICT (key) DO UPDATE SET enabled = true;
	RETURN jsonb_build_object('ok', true, 'already_flipped', false, 'state', state);
END $$;
DO $s8$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	res jsonb; o public.market_offers; lf bigint; lw bigint; ln bigint; h0 int;
BEGIN
	PERFORM pg_temp.ok(to_regclass('cron.job') IS NULL
		AND to_regprocedure('public._season2_flip_market_locked(timestamptz)') IS NOT NULL, '8 applied without pg_cron; the wrapper is there');
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'marble', 3);
	h0 := pg_temp.held(a, 'marble');
	-- Pinned in the flip's own window: after its now(), before it runs.
	res := public.market_post('sell', 'marble', 70, NULL, NULL, NULL, gen_random_uuid());
	lf := (res->'offer'->>'id')::bigint;
	res := public.market_post('buy', 'wool_tuft', pg_temp.bid('wool_tuft') + 1, NULL, NULL, NULL, gen_random_uuid());
	lw := (res->'offer'->>'id')::bigint;
	PERFORM pg_temp.ok(lf IS NOT NULL AND lw IS NOT NULL AND pg_temp.held(a, 'marble') = h0 - 3, '8 pinned');
	res := public._season2_flip_market_locked('2026-12-05 10:00:00+00'::timestamptz);
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND res->>'already_flipped' = 'false' AND (res->>'market_reset')::int >= 2, '8 flipped: ' || res::text);
	SELECT * INTO o FROM public.market_offers WHERE id = lf;
	PERFORM pg_temp.ok(NOT public._market_pre_reset(o, public._market_reset_at()), '8 the race is real: the guard alone misses it');
	PERFORM pg_temp.ok(o.status = 'reset' AND pg_temp.held(a, 'marble') = h0 - 3, '8 it ended anyway, its set did not come home');
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = lw) = 'reset', '8 the wanted ad too');
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'open'), '8 nothing open survives the flip');
	PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.market_notices WHERE user_id = a AND kind = 'reset' AND (offer->>'id')::bigint = lf), '8 told');
	res := public._season2_flip_market_locked('2026-12-05 10:00:00+00'::timestamptz);
	PERFORM pg_temp.ok(res->>'already_flipped' = 'true' AND (res->>'market_reset')::int = 0, '8 twice is a no-op');
	-- After the flip a listing behaves normally.
	PERFORM pg_temp.give(a, 'marble', 2);
	res := public.market_post('sell', 'marble', 70, NULL, NULL, NULL, gen_random_uuid());
	ln := (res->'offer'->>'id')::bigint;
	PERFORM public.market_state();
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = ln) = 'open', '8 a post-flip listing stands');
	PERFORM pg_temp.ok(public.market_cancel(ln)->>'returned' = 'find', '8 and comes home');
	PERFORM pg_temp.put('8.lf', lf::text);
	PERFORM pg_temp.put('8.h0', h0::text);
END
$s8$;
-- Undo the flip: the listings it ended give their sets back (F's step 1b).
DELETE FROM public.app_config WHERE key = 'season2_flipped';
DO $s8b$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
BEGIN
	PERFORM pg_temp.as_user(a);
	PERFORM public.market_state();
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = pg_temp.got('8.lf')::bigint) = 'cancelled'
		AND pg_temp.held(a, 'marble') = pg_temp.got('8.h0')::int + 2, '8 unflip gives the set back');
	PERFORM pg_temp.ok(NOT has_function_privilege('authenticated', 'public._season2_flip_market_locked(timestamptz)', 'EXECUTE')
		AND NOT has_function_privilege('anon', 'public._season2_flip_market_locked(timestamptz)', 'EXECUTE'), '8 owner-only');
	RAISE NOTICE 'C3 section 8 (flip under the market lock): green';
END
$s8b$;
DROP FUNCTION public.flip_season_2(timestamptz, int);

-- ── 9. Pushes ────────────────────────────────────────────────────────────────
TRUNCATE public._smoke_pushes;
DO $s9$
DECLARE
	a uuid := '00000000-0000-0000-0000-00000000c301';
	b uuid := '00000000-0000-0000-0000-00000000c302';
	c uuid := '00000000-0000-0000-0000-00000000c303';
	res jsonb; st jsonb; l bigint; pr int; n0 int; c0 int; p public._smoke_pushes;
	mkt jsonb := '{"kind": "market", "screen": "market"}';
BEGIN
	-- An offer for you, from a friend.
	PERFORM pg_temp.as_user(a);
	PERFORM public.market_state();
	PERFORM pg_temp.give(a, 'pinecone', 4);
	pr := pg_temp.bid('pinecone') + 1;
	res := public.market_post('sell', 'pinecone', pr, NULL, NULL, b, gen_random_uuid());
	l := (res->'offer'->>'id')::bigint;
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = b AND p.title = 'An offer for you'
		AND p.body = 'Pip pinned 4 pinecones for you at ' || pr || '.' AND p.data = mkt, '9 for you: ' || COALESCE(p.body, '-'));
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public._smoke_pushes WHERE user_id = a), '9 never your own post');
	-- Maya buys it: Pip hears, Maya (her own tap) does not.
	PERFORM pg_temp.as_user(b);
	PERFORM pg_temp.ok(public.market_take(l, NULL, gen_random_uuid())->>'ok' = 'true', '9 Maya buys');
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = a AND p.title = 'Your pinecones sold'
		AND p.body = 'Maya bought your 4 pinecones for ' || pr || '.', '9 filled, a friend named: ' || COALESCE(p.body, '-'));
	PERFORM pg_temp.ok((SELECT COUNT(*) FROM public._smoke_pushes WHERE user_id = b) = 1, '9 never your own take');
	-- A stranger buys one: "A pig".
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'pinecone', 4);
	pr := pg_temp.bid('pinecone') + 1;
	res := public.market_post('sell', 'pinecone', pr, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.as_user(c);
	PERFORM public.market_take((res->'offer'->>'id')::bigint, NULL, gen_random_uuid());
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = a AND p.body = 'A pig bought your 4 pinecones for ' || pr || '.', '9 a stranger is a pig: ' || COALESCE(p.body, '-'));
	-- A wanted ad filled by a new post.
	PERFORM pg_temp.as_user(b);
	pr := pg_temp.bid('wool_tuft') + 1;
	res := public.market_post('buy', 'wool_tuft', pr, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'filled' = 'false', '9 Maya''s wanted ad rests');
	PERFORM pg_temp.as_user(c);
	PERFORM pg_temp.give(c, 'wool_tuft', 4);
	res := public.market_post('sell', 'wool_tuft', pr, NULL, NULL, NULL, gen_random_uuid());
	PERFORM pg_temp.ok(res->>'via' = 'pig', '9 the post meets the ad');
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = b AND p.title = 'Your wanted ad filled'
		AND p.body = 'A pig sold you 4 tufts of wool for ' || pr || '.', '9 wanted ad filled: ' || COALESCE(p.body, '-'));
	-- Crossed on someone else's read: pushed.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'blue_feather', 4);
	UPDATE public.market_prices SET price = 12 WHERE find_id = 'blue_feather';
	res := public.market_post('sell', 'blue_feather', 10, NULL, NULL, NULL, gen_random_uuid());
	l := (res->'offer'->>'id')::bigint;
	UPDATE public.market_prices SET price = 13.8, tick = tick - 1 WHERE find_id = 'blue_feather';
	PERFORM pg_temp.as_user(c);
	PERFORM public.market_state();
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = l) = 'crossed' AND p.user_id = a
		AND p.title = 'Sold to Bullion'
		AND p.body = 'Bullion bought your 4 blue feathers for ' || (SELECT price FROM public.market_trades WHERE offer_id = l) || '.', '9 crossed: ' || COALESCE(p.body, '-'));
	-- Crossed on your own read: you are looking at it, no push.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'blue_feather', 4);
	UPDATE public.market_prices SET price = 12 WHERE find_id = 'blue_feather';
	res := public.market_post('sell', 'blue_feather', 10, NULL, NULL, NULL, gen_random_uuid());
	l := (res->'offer'->>'id')::bigint;
	UPDATE public.market_prices SET price = 13.8, tick = tick - 1 WHERE find_id = 'blue_feather';
	n0 := (SELECT COUNT(*) FROM public._smoke_pushes WHERE user_id = a);
	PERFORM public.market_state();
	PERFORM pg_temp.ok((SELECT status FROM public.market_offers WHERE id = l) = 'crossed'
		AND (SELECT COUNT(*) FROM public._smoke_pushes WHERE user_id = a) = n0, '9 never your own read');
	-- A swap pinned for Maya, then taken.
	PERFORM pg_temp.give(a, 'red_berries', 4);
	res := public.market_post('swap', 'red_berries', NULL, 'marble', 1, b, gen_random_uuid());
	l := (res->'offer'->>'id')::bigint;
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = b
		AND p.body = 'Pip pinned 4 sprigs of red berries for you, straight up for 1 glass marble.', '9 a swap for you: ' || COALESCE(p.body, '-'));
	PERFORM pg_temp.as_user(b);
	PERFORM pg_temp.give(b, 'marble', 1);
	PERFORM pg_temp.ok(public.market_take(l, NULL, gen_random_uuid())->>'ok' = 'true', '9 Maya swaps');
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(p.user_id = a AND p.title = 'Your swap went through'
		AND p.body = 'Maya swapped 1 glass marble for your 4 sprigs of red berries.', '9 swapped: ' || COALESCE(p.body, '-'));
	-- A wanted ad for you.
	pr := pg_temp.bid('snail_shell') + 1;
	res := public.market_post('buy', 'snail_shell', pr, NULL, NULL, a, gen_random_uuid());
	SELECT * INTO p FROM public._smoke_pushes ORDER BY id DESC LIMIT 1;
	PERFORM pg_temp.ok(res->>'filled' = 'false' AND p.user_id = a
		AND p.body = 'Maya wants to buy 4 snail shells from you at ' || pr || '.', '9 a wanted ad for you: ' || COALESCE(p.body, '-'));
	PERFORM public.market_cancel((res->'offer'->>'id')::bigint);
	-- A push that fails is only a NOTICE: the trade stands.
	PERFORM pg_temp.as_user(a);
	PERFORM pg_temp.give(a, 'pinecone', 4);
	pr := pg_temp.bid('pinecone') + 1;
	res := public.market_post('sell', 'pinecone', pr, NULL, NULL, NULL, gen_random_uuid());
	l := (res->'offer'->>'id')::bigint;
	PERFORM set_config('smoke.push_fail', 'on', false);
	PERFORM pg_temp.as_user(c);
	c0 := pg_temp.coin(a); n0 := (SELECT COUNT(*) FROM public._smoke_pushes);
	res := public.market_take(l, NULL, gen_random_uuid());
	PERFORM set_config('smoke.push_fail', 'off', false);
	PERFORM pg_temp.ok(res->>'ok' = 'true' AND pg_temp.coin(a) = c0 + pr
		AND (SELECT status FROM public.market_offers WHERE id = l) = 'filled'
		AND (SELECT COUNT(*) FROM public._smoke_pushes) = n0, '9 a failed push never rolls back the trade');
	-- House voice.
	PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public._smoke_pushes
		WHERE title LIKE '%' || chr(8212) || '%' OR body LIKE '%' || chr(8212) || '%'), '9 no em dashes');
	RAISE NOTICE 'C3 section 9 (pushes): green';
	RAISE NOTICE 'C3 market launch fixes: all green';
END
$s9$;
