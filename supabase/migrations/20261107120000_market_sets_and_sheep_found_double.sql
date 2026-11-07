-- Bullion's Market: sets of three, two and one, and the Ghost Sheep doubles
-- only what you didn't buy (2026-11-07).
--
-- The founder's calls on the 2026-11-02 balance pass
-- (docs/design/market-2026-10-31/balance-pass-2026-11-02.md): set sizes
-- 3 / 2 / 1, the Sheep's x2 for his fancy only on a find you did not buy, and
-- his fancy a real 70 / 25 / 5 draw by rarity. Carried defs (each from its
-- latest):
--   _market_tuning, _market_push        from 20261102200000_market_launch_fixes.sql
--   _satchel_bag_json                   from 20260917100000_satchel_swaps.sql
--   trade_with_trader, trade_up_with_trader, _trader_status_json
--                                       from 20261029210000_trader_sets_and_trade_ups.sql
--   _trader_want_for                    from 20260917170000_ghost_sheep_trader.sql
--
-- Shape:
--   1. Set sizes 3 / 2 / 1 (common / uncommon / rare). Under the market lock,
--      app_settings.market_tuning.set_size moves and every stored price (and
--      its seven days of points) is rescaled by new size / old size: the
--      usual price U is the Sheep's price x the set size, so P keeps its
--      place in the band (0.85U..1.15U), the sparkline keeps its shape and
--      "since yesterday" stays honest. Open listings settle by what they
--      hold (20261102200000), so a switch with listings open neither makes
--      nor loses a find.
--   2. _market_tuning(): the compiled defaults follow (3 / 2 / 1).
--   3. _market_push: one find reads as one ("your tin whistle", "a tin
--      whistle", not "1 tin whistles"), via _market_qty_words.
--   4. "Bought" is a bag row with a market cost basis (market_cost IS NOT
--      NULL): from Bullion's counter, his shelf or a pig's listing. Dug,
--      given, errand, swapped (straight up is a trade, not a buy) and
--      traded-up finds are not bought. _satchel_bag_json gains `bought`.
--   5. trade_with_trader: the x2 for his fancy only when the row is not
--      bought. A bought one pays the plain price; the pair judge is
--      unchanged (each sale's own price, then half again on the two).
--   6. trade_up_with_trader: bought rows are spent last, and the find that
--      comes back carries what the three cost (null when none was bought),
--      so three bought commons can't come back as an uncommon he doubles.
--   7. _trader_status_json: visit.unpaired_paid {find_id: base}, the open
--      sale's price before any bonus, so the sheet prices a pair of one
--      bought and one found exactly.
--   8. _trader_want_for: from the pig's local day 2026-11-09 (Season 2 day
--      one), a seeded draw of the rarity (70 / 25 / 5), then his seeded pick
--      within it, never yesterday's. Earlier days keep the old order
--      exactly (unit x weight, which fancied a common on 99.995% of days),
--      so no visit already rolled, and no "not the same as yesterday" check
--      on the boundary, changes under Season 1's last weekend.
--   9. Checks: the sizes landed, the fairness invariant holds, the defaults
--      agree.

-- ── 1. Set sizes 3 / 2 / 1, prices rescaled ─────────────────────────────────
DO $sets$
DECLARE
	old_sz jsonb;
	new_sz jsonb;
	n_prices int := 0;
	n_points int := 0;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	old_sz := public._market_tuning()->'set_size';

	INSERT INTO public.app_settings (key, value, description)
	VALUES ('market_tuning', '{"set_size": {"common": 3, "uncommon": 2, "rare": 1}}'::jsonb,
		'Bullion''s Market tuning (merged over _market_tuning() defaults)')
	ON CONFLICT (key) DO UPDATE
	SET value = CASE WHEN jsonb_typeof(public.app_settings.value) = 'object'
		             THEN public.app_settings.value ELSE '{}'::jsonb END
		|| '{"set_size": {"common": 3, "uncommon": 2, "rare": 1}}'::jsonb,
		updated_at = now();
	new_sz := public._market_tuning()->'set_size';

	UPDATE public.market_prices mp
	SET price = ROUND(mp.price * (new_sz->>sf.rarity)::numeric / (old_sz->>sf.rarity)::numeric, 6)
	FROM public.satchel_finds sf
	WHERE sf.id = mp.find_id
	  AND sf.rarity IN ('common', 'uncommon', 'rare')
	  AND (new_sz->>sf.rarity)::numeric <> (old_sz->>sf.rarity)::numeric;
	GET DIAGNOSTICS n_prices = ROW_COUNT;

	UPDATE public.market_price_points pp
	SET price = ROUND(pp.price * (new_sz->>sf.rarity)::numeric / (old_sz->>sf.rarity)::numeric, 6)
	FROM public.satchel_finds sf
	WHERE sf.id = pp.find_id
	  AND sf.rarity IN ('common', 'uncommon', 'rare')
	  AND (new_sz->>sf.rarity)::numeric <> (old_sz->>sf.rarity)::numeric;
	GET DIAGNOSTICS n_points = ROW_COUNT;

	RAISE NOTICE 'market set sizes % -> %: % prices and % points rescaled', old_sz, new_sz, n_prices, n_points;
END
$sets$;

-- ── 2. The tuning's compiled defaults follow ────────────────────────────────
CREATE OR REPLACE FUNCTION public._market_tuning()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	d jsonb := '{"enabled": true,
	             "set_size": {"common": 3, "uncommon": 2, "rare": 1},
	             "list_multiple": 3, "open_offers": 4, "daily_posts": 30,
	             "offer_hours": 48, "tick_minutes": 30, "catch_up_ticks": 144,
	             "price": {"lo": 0.85, "hi": 1.15, "sell_factor": 1.2, "buy_factor": 0.8,
	                       "impact": 0.05, "pig_pull": 0.3333333333, "wiggle": 0.02, "home": 0.05},
	             "print_chance": {"common": 0.2, "uncommon": 0.1, "rare": 0.03},
	             "counter_caps": null,
	             "bullion_board": {"daily_listings": 3, "per_pig": 1}}'::jsonb;
	base_d jsonb := '{"common": 3, "uncommon": 8, "rare": 20}'::jsonb;
	raw jsonb;
	t jsonb;
	x jsonb;
	lo numeric;
	hi numeric;
	sf numeric;
	bf numeric;
	caps jsonb;
BEGIN
	BEGIN
		SELECT value INTO raw FROM public.app_settings WHERE key = 'market_tuning';
		IF jsonb_typeof(raw) IS DISTINCT FROM 'object' THEN raw := '{}'::jsonb; END IF;
		t := public._market_jsonb_merge(d, raw);

		-- The band and Bullion's cut: each in range, and together fair (his
		-- lowest selling price above his highest buying price), or all four
		-- go back to the defaults. Impact stays under half the ride limit
		-- (a set bought and sold straight back can't ride the cut:
		-- impact < (sell_factor - buy_factor) x lo / buy_factor).
		x := t->'price';
		lo := public._market_num(x->'lo');
		hi := public._market_num(x->'hi');
		sf := public._market_num(x->'sell_factor');
		bf := public._market_num(x->'buy_factor');
		IF lo IS NULL OR lo <= 0 OR lo >= 1 THEN lo := 0.85; END IF;
		IF hi IS NULL OR hi <= 1 OR hi > 3 THEN hi := 1.15; END IF;
		IF sf IS NULL OR sf <= 1 OR sf > 3 THEN sf := 1.2; END IF;
		IF bf IS NULL OR bf <= 0 OR bf >= 1 THEN bf := 0.8; END IF;
		IF sf * lo <= bf * hi THEN
			lo := 0.85; hi := 1.15; sf := 1.2; bf := 0.8;
		END IF;
		t := t || jsonb_build_object('price', jsonb_build_object(
			'lo', lo, 'hi', hi, 'sell_factor', sf, 'buy_factor', bf,
			'impact', LEAST(public._market_clamp_num(x->'impact', 0.05, 0, 0.2), 0.5 * (sf - bf) * lo / bf),
			'pig_pull', public._market_clamp_num(x->'pig_pull', 0.3333333333, 0, 1),
			'wiggle', public._market_clamp_num(x->'wiggle', 0.02, 0, 0.1),
			'home', public._market_clamp_num(x->'home', 0.05, 0, 0.5)));

		x := t->'set_size';
		t := t || jsonb_build_object('set_size', jsonb_build_object(
			'common', public._market_int(x->'common', 3, 1, 20),
			'uncommon', public._market_int(x->'uncommon', 2, 1, 20),
			'rare', public._market_int(x->'rare', 1, 1, 20)));

		x := t->'print_chance';
		t := t || jsonb_build_object('print_chance', jsonb_build_object(
			'common', public._market_clamp_num(x->'common', 0.2, 0, 1),
			'uncommon', public._market_clamp_num(x->'uncommon', 0.1, 0, 1),
			'rare', public._market_clamp_num(x->'rare', 0.03, 0, 1)));

		-- Counter caps: {sell, buy} whole numbers >= 0 (0 = none today), or
		-- null (off).
		x := t->'counter_caps';
		caps := NULL;
		IF jsonb_typeof(x) = 'object' THEN
			caps := jsonb_strip_nulls(jsonb_build_object(
				'sell', CASE WHEN public._market_num(x->'sell') IS NOT NULL THEN public._market_int(x->'sell', 0, 0, 1000) END,
				'buy', CASE WHEN public._market_num(x->'buy') IS NOT NULL THEN public._market_int(x->'buy', 0, 0, 1000) END));
			IF caps = '{}'::jsonb THEN caps := NULL; END IF;
		END IF;

		-- Bullion's shelf: 0..6 a day; per pig a day, null = off.
		x := t->'bullion_board';
		t := t || jsonb_build_object(
			'counter_caps', caps,
			'bullion_board', jsonb_build_object(
				'daily_listings', public._market_int(x->'daily_listings', 3, 0, 6),
				'per_pig', CASE WHEN jsonb_typeof(x->'per_pig') = 'null' THEN NULL
				                ELSE public._market_int(x->'per_pig', 1, 0, 6) END),
			'enabled', CASE
				WHEN jsonb_typeof(t->'enabled') = 'boolean' THEN (t->>'enabled')::boolean
				WHEN lower(btrim(t->>'enabled')) IN ('true', 'false') THEN lower(btrim(t->>'enabled'))::boolean
				ELSE true END,
			'list_multiple', public._market_int(t->'list_multiple', 3, 1, 10),
			'open_offers', public._market_int(t->'open_offers', 4, 0, 20),
			'daily_posts', public._market_int(t->'daily_posts', 30, 0, 500),
			'offer_hours', public._market_int(t->'offer_hours', 48, 1, 168),
			-- Pinned: every stored tick (prices, points, prints, the day's
			-- counts) is a 30-minute tick. A change would orphan them all.
			'tick_minutes', 30,
			'catch_up_ticks', public._market_int(t->'catch_up_ticks', 144, 1, 336));

		SELECT value->'prices' INTO x FROM public.app_settings WHERE key = 'trader_tuning';
		RETURN t || jsonb_build_object('base', jsonb_build_object(
			'common', public._market_int(x->'common', 3, 1, 1000),
			'uncommon', public._market_int(x->'uncommon', 8, 1, 1000),
			'rare', public._market_int(x->'rare', 20, 1, 1000)));
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'market: market_tuning unreadable, using the defaults: %', SQLERRM;
		RETURN d || jsonb_build_object('base', base_d);
	END;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_tuning() FROM PUBLIC, anon, authenticated;

-- ── 3. One find reads as one ────────────────────────────────────────────────
-- "3 pinecones" / "a tin whistle"; after "your", "tin whistle".
CREATE OR REPLACE FUNCTION public._market_qty_words(p_find text, p_n int, p_your boolean)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE
		WHEN COALESCE(p_n, 0) <> 1 THEN COALESCE(p_n, 0) || ' ' || public._market_find_plural(p_find, COALESCE(p_n, 0))
		WHEN p_your THEN public._market_find_plural(p_find, 1)
		WHEN lower(left(public._market_find_plural(p_find, 1), 1)) IN ('a', 'e', 'i', 'o', 'u')
			THEN 'an ' || public._market_find_plural(p_find, 1)
		ELSE 'a ' || public._market_find_plural(p_find, 1) END;
$function$;
REVOKE ALL ON FUNCTION public._market_qty_words(text, int, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._market_push(p_user uuid, p_kind text, p_offer public.market_offers, p_trade bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	tr public.market_trades;
	who text;
	what text;
	yours text;
	ttl text;
	body text;
BEGIN
	IF p_user IS NULL OR p_user IS NOT DISTINCT FROM auth.uid() THEN
		RETURN;
	END IF;
	BEGIN
		IF p_kind = 'for_you' THEN
			who := COALESCE((SELECT NULLIF(btrim(pr.username), '') FROM public.profiles pr WHERE pr.id = p_offer.user_id), 'A friend');
			what := public._market_qty_words(p_offer.find_id, p_offer.qty, false);
			ttl := 'An offer for you';
			body := CASE p_offer.side
				WHEN 'sell' THEN who || ' pinned ' || what || ' for you at ' || p_offer.price || '.'
				WHEN 'buy' THEN who || ' wants to buy ' || what || ' from you at ' || p_offer.price || '.'
				ELSE who || ' pinned ' || what || ' for you, straight up for '
					|| public._market_qty_words(p_offer.want_find_id, p_offer.want_qty, false) || '.' END;
		ELSE
			SELECT * INTO tr FROM public.market_trades WHERE id = p_trade;
			IF NOT FOUND THEN RETURN; END IF;
			what := public._market_qty_words(tr.find_id, tr.qty, false);
			yours := public._market_qty_words(tr.find_id, tr.qty, true);
			IF p_kind = 'crossed' THEN
				IF tr.side = 'sell' THEN
					ttl := 'Sold to Bullion';
					body := 'Bullion bought your ' || yours || ' for ' || tr.price || '.';
				ELSE
					ttl := 'Bought from Bullion';
					body := 'Bullion sold you ' || what || ' for ' || tr.price || '.';
				END IF;
			ELSE
				who := COALESCE(public._market_who(p_user,
					CASE WHEN tr.seller_id = p_user THEN tr.buyer_id ELSE tr.seller_id END)->>'name', 'A pig');
				IF p_kind = 'swapped' THEN
					ttl := 'Your swap went through';
					body := who || ' swapped ' || public._market_qty_words(tr.want_find_id, tr.want_qty, false)
						|| ' for your ' || yours || '.';
				ELSIF tr.seller_id = p_user THEN
					ttl := 'Your ' || public._market_find_plural(tr.find_id, tr.qty) || ' sold';
					body := who || ' bought your ' || yours || ' for ' || tr.price || '.';
				ELSE
					ttl := 'Your wanted ad filled';
					body := who || ' sold you ' || what || ' for ' || tr.price || '.';
				END IF;
			END IF;
		END IF;
		PERFORM public.send_push_to_user(p_user, ttl, body,
			jsonb_build_object('kind', 'market', 'screen', 'market'));
	EXCEPTION WHEN OTHERS THEN
		RAISE NOTICE 'market: push to % failed: %', p_user, SQLERRM;
	END;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_push(uuid, text, public.market_offers, bigint) FROM PUBLIC, anon, authenticated;

-- ── 4. The bag says what was bought ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._satchel_bag_json(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((
		SELECT jsonb_agg(jsonb_build_object('id', s.id, 'find_id', s.find_id, 'source', s.source,
		                                    'bought', s.market_cost IS NOT NULL)
		                 ORDER BY s.created_at, s.id)
		FROM public.satchel_items s WHERE s.user_id = p_user), '[]'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._satchel_bag_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── 5. The Sheep doubles only what you didn't buy ───────────────────────────
CREATE OR REPLACE FUNCTION public.trade_with_trader(p_item_id bigint, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	pair_mult numeric := GREATEST(1, COALESCE((t->>'pair_multiplier')::numeric, 1.5));
	prices jsonb := public._trader_prices_json(t);
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	rarity text;
	was_want boolean;
	price int;
	bonus int := 0;
	prior_n int;
	prior_base int;
	before_count int;
	after_count int;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay: the original receipt, never a second find.
	SELECT * INTO prior FROM public.trader_sales WHERE nonce = p_nonce;
	IF FOUND THEN
		IF prior.user_id <> uid OR prior.kind <> 'sale' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
		END IF;
		SELECT * INTO v FROM public.trader_visits WHERE id = prior.visit_id;
		SELECT COALESCE(tickles_earned, 0) INTO after_count FROM public.profiles WHERE id = uid;
		RETURN jsonb_build_object(
			'ok', true,
			'replay', true,
			'find_id', prior.find_id,
			'tickles', prior.tickles,
			'was_want', prior.was_want,
			'pair', prior.pair_bonus > 0,
			'pair_bonus', prior.pair_bonus,
			'before', GREATEST(0, COALESCE(after_count, 0) - prior.tickles),
			'after', COALESCE(after_count, 0),
			'finds_left', GREATEST(0, per_visit - COALESCE(v.sold, per_visit)),
			'visit_tickles', COALESCE(v.tickles, 0),
			'bag', public._satchel_bag_json(uid));
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);

	-- 1. He has to be here.
	v := public._trader_ensure_visit(uid);
	IF NOT (v.arrives_at <= v_now AND v.leaves_at > v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_here',
			'arrives_at', CASE WHEN v.arrives_at > v_now THEN v.arrives_at ELSE NULL END);
	END IF;
	SELECT * INTO v FROM public.trader_visits WHERE id = v.id FOR UPDATE;

	-- 2. He only takes so many a visit.
	IF v.sold >= per_visit THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'had_enough', 'leaves_at', v.leaves_at);
	END IF;

	-- 3. The find, locked, from THIS bag.
	SELECT * INTO item FROM public.satchel_items
		WHERE id = p_item_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_bag',
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 4. The price: by rarity, doubled for the find he fancies, unless it was
	-- bought (20261107120000: a bag row with a market cost basis pays the
	-- plain price; dug, given, swapped and traded-up ones still double).
	SELECT f.rarity INTO rarity FROM public.satchel_finds f WHERE f.id = item.find_id;
	price := GREATEST(0, COALESCE((prices->>COALESCE(rarity, 'common'))::int, 0));
	was_want := item.find_id = v.want_find_id AND item.market_cost IS NULL;
	IF was_want THEN
		price := FLOOR(price * mult)::int;
	END IF;

	-- 4b. The pair (20261029210000): one sale of this find already sits
	-- unpaired in this visit's ledger, so this one completes a pair and the
	-- two together pay half again. The unpaired sale is the latest of them
	-- (an odd count means the last one opened a pair); its base price is what
	-- it paid less any bonus it carried.
	IF pair_mult > 1 THEN
		SELECT COUNT(*)::int,
		       (array_agg(s.tickles - s.pair_bonus ORDER BY s.id DESC))[1]
			INTO prior_n, prior_base
			FROM public.trader_sales s
			WHERE s.visit_id = v.id AND s.kind = 'sale' AND s.find_id = item.find_id;
		IF COALESCE(prior_n, 0) % 2 = 1 THEN
			bonus := GREATEST(0, FLOOR((COALESCE(prior_base, 0) + price) * (pair_mult - 1))::int);
		END IF;
	END IF;
	price := price + bonus;

	-- 5. The find leaves the world; the ledger remembers; the tickles land.
	SELECT COALESCE(tickles_earned, 0) INTO before_count FROM public.profiles WHERE id = uid;
	DELETE FROM public.satchel_items WHERE id = item.id;
	INSERT INTO public.trader_sales (nonce, user_id, visit_id, item_id, find_id, tickles, was_want, kind, pair_bonus)
		VALUES (p_nonce, uid, v.id, item.id, item.find_id, price, was_want, 'sale', bonus);
	UPDATE public.trader_visits SET sold = sold + 1, tickles = tickles + price WHERE id = v.id
		RETURNING * INTO v;
	-- Tickles, never Snouts (20260920100000): apply_tickles() is the "applied
	-- tickle" — a count AND a snout, the tap's own rule — and the trader is not
	-- a tap. He pays the count alone; the bank and the snouts stay untouched.
	UPDATE public.profiles
	SET tickles_earned = COALESCE(tickles_earned, 0) + price
	WHERE id = uid
	RETURNING tickles_earned INTO after_count;

	RETURN jsonb_build_object(
		'ok', true,
		'replay', false,
		'find_id', item.find_id,
		'tickles', price,
		'was_want', was_want,
		'pair', bonus > 0,
		'pair_bonus', bonus,
		'before', COALESCE(before_count, 0),
		'after', COALESCE(after_count, 0),
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;
REVOKE ALL ON FUNCTION public.trade_with_trader(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_with_trader(bigint, uuid) TO authenticated;

-- ── 6. A trade-up keeps what the three cost ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.trade_up_with_trader(p_find_id text, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	up_on boolean := COALESCE((t->>'trade_up')::boolean, true);
	up_count int := GREATEST(2, COALESCE((t->>'trade_up_count')::int, 3));
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	from_rarity text;
	to_rarity text;
	pick text;
	taken bigint[];
	got_id bigint;
	is_new boolean;
	cost numeric;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay: the original receipt, never a second hand.
	SELECT * INTO prior FROM public.trader_sales WHERE nonce = p_nonce;
	IF FOUND THEN
		IF prior.user_id <> uid OR prior.kind <> 'trade_up' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
		END IF;
		SELECT * INTO v FROM public.trader_visits WHERE id = prior.visit_id;
		RETURN jsonb_build_object(
			'ok', true,
			'replay', true,
			'gave_find_id', prior.find_id,
			'count', COALESCE(array_length(prior.item_ids, 1), up_count),
			'got_find_id', prior.got_find_id,
			'got_item_id', prior.got_item_id,
			'new_to_bag', prior.new_to_bag,
			'finds_left', GREATEST(0, per_visit - COALESCE(v.sold, per_visit)),
			'visit_tickles', COALESCE(v.tickles, 0),
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 1. Is there anything above it (and is he trading up at all)?
	SELECT f.rarity INTO from_rarity FROM public.satchel_finds f WHERE f.id = p_find_id;
	to_rarity := public._trader_next_rarity(from_rarity);
	IF NOT up_on OR from_rarity IS NULL OR to_rarity IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_trade_up');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);

	-- 2. He has to be here.
	v := public._trader_ensure_visit(uid);
	IF NOT (v.arrives_at <= v_now AND v.leaves_at > v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_here',
			'arrives_at', CASE WHEN v.arrives_at > v_now THEN v.arrives_at ELSE NULL END);
	END IF;
	SELECT * INTO v FROM public.trader_visits WHERE id = v.id FOR UPDATE;

	-- 3. The three count against what he takes this visit.
	IF v.sold + up_count > per_visit THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'had_enough', 'leaves_at', v.leaves_at,
			'finds_left', GREATEST(0, per_visit - v.sold));
	END IF;

	-- 4. Three of that find, locked, from THIS bag. Dug ones go first, then a
	-- friend's gift, and a bought one last (20261107120000), so what comes
	-- back is a found find whenever the bag can make it one.
	taken := ARRAY(
		SELECT s.id
		FROM public.satchel_items s
		WHERE s.user_id = uid AND s.find_id = p_find_id
		ORDER BY (s.market_cost IS NOT NULL), (s.source IN ('swap', 'gift', 'migrated_shelf')), s.created_at, s.id
		LIMIT up_count
		FOR UPDATE);
	IF COALESCE(array_length(taken, 1), 0) < up_count THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_enough',
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 5. His pick of the next rarity, seeded for the day.
	pick := public._trader_trade_up_pick(uid, v.day, to_rarity);
	IF pick IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_trade_up');
	END IF;

	-- 6. Three go into his satchel; one comes back. No tickles move. What
	-- the three cost at the market rides on the one (null when none was
	-- bought), so a bought set can't come back as a find he doubles.
	is_new := NOT EXISTS (
		SELECT 1 FROM public.satchel_items s WHERE s.user_id = uid AND s.find_id = pick);
	SELECT SUM(s.market_cost) INTO cost FROM public.satchel_items s WHERE s.id = ANY (taken);
	DELETE FROM public.satchel_items WHERE id = ANY (taken);
	INSERT INTO public.satchel_items (user_id, find_id, source, created_at, market_cost)
		VALUES (uid, pick, 'trader', v_now, cost)
		RETURNING id INTO got_id;
	INSERT INTO public.satchel_met (user_id, find_id)
		VALUES (uid, pick) ON CONFLICT DO NOTHING;
	INSERT INTO public.trader_sales
		(nonce, user_id, visit_id, item_id, find_id, tickles, was_want, kind,
		 item_ids, got_find_id, got_item_id, new_to_bag)
		VALUES (p_nonce, uid, v.id, taken[1], p_find_id, 0, false, 'trade_up',
		        taken, pick, got_id, is_new);
	UPDATE public.trader_visits SET sold = sold + up_count WHERE id = v.id
		RETURNING * INTO v;

	RETURN jsonb_build_object(
		'ok', true,
		'replay', false,
		'gave_find_id', p_find_id,
		'count', up_count,
		'got_find_id', pick,
		'got_item_id', got_id,
		'new_to_bag', is_new,
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;
REVOKE ALL ON FUNCTION public.trade_up_with_trader(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_up_with_trader(text, uuid) TO authenticated;

-- ── 7. The open pair's price, for the sheet ─────────────────────────────────
CREATE OR REPLACE FUNCTION public._trader_status_json(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	pair_mult numeric := GREATEST(1, COALESCE((t->>'pair_multiplier')::numeric, 1.5));
	up_on boolean := COALESCE((t->>'trade_up')::boolean, true);
	up_count int := GREATEST(2, COALESCE((t->>'trade_up_count')::int, 3));
	v public.trader_visits%ROWTYPE;
	present boolean;
	sales int;
	unpaired jsonb := '[]'::jsonb;
	unpaired_paid jsonb := '{}'::jsonb;
	ups jsonb := '{}'::jsonb;
BEGIN
	v := public._trader_ensure_visit(p_user);
	present := v.arrives_at <= v_now AND v.leaves_at > v_now;
	SELECT COUNT(*)::int INTO sales FROM public.trader_sales s WHERE s.user_id = p_user;
	IF present THEN
		-- Finds sold an odd number of times this visit: the next one makes a
		-- pair. `unpaired_paid` is what the open one paid before any bonus
		-- (the pair judge's base), so the sheet prices the pair exactly when
		-- a bought one and a found one meet.
		SELECT COALESCE(jsonb_agg(x.find_id ORDER BY x.find_id), '[]'::jsonb),
		       COALESCE(jsonb_object_agg(x.find_id, x.base), '{}'::jsonb)
			INTO unpaired, unpaired_paid
		FROM (
			SELECT s.find_id, (array_agg(s.tickles - s.pair_bonus ORDER BY s.id DESC))[1] AS base
			FROM public.trader_sales s
			WHERE s.visit_id = v.id AND s.kind = 'sale'
			GROUP BY s.find_id HAVING COUNT(*) % 2 = 1
		) x;
		IF up_on THEN
			ups := jsonb_strip_nulls(jsonb_build_object(
				'common', public._trader_trade_up_pick(p_user, v.day, 'uncommon'),
				'uncommon', public._trader_trade_up_pick(p_user, v.day, 'rare')));
		END IF;
	END IF;
	RETURN jsonb_build_object(
		'ok', true,
		'present', present,
		'now', v_now,
		'visit', jsonb_build_object(
			'id', v.id,
			'day', v.day,
			'arrives_at', v.arrives_at,
			'leaves_at', v.leaves_at,
			-- What he fancies is his to say: only once he is here.
			'want_find_id', CASE WHEN present THEN v.want_find_id ELSE NULL END,
			'sold', v.sold,
			'tickles', v.tickles,
			'finds_left', GREATEST(0, per_visit - v.sold),
			'unpaired', unpaired,
			'unpaired_paid', unpaired_paid,
			'trade_ups', ups),
		'prices', public._trader_prices_json(t),
		'want_multiplier', mult,
		'finds_per_visit', per_visit,
		'pair_multiplier', pair_mult,
		'trade_up', up_on,
		'trade_up_count', up_count,
		'met', sales > 0,
		'sales', sales);
END;
$function$;
REVOKE ALL ON FUNCTION public._trader_status_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── 8. His fancy, a real 70 / 25 / 5 from Season 2 ──────────────────────────
-- Seeded per (pig, day) like everything he does. From day 2026-11-09 the
-- rarity is drawn first (a common 70%, an uncommon 25%, the rare 5%), then
-- his pick within it; when that rarity holds nothing but yesterday's fancy
-- he picks from the rest. Earlier days order exactly as before.
CREATE OR REPLACE FUNCTION public._trader_want_for(p_user uuid, p_day date, p_not text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH draw AS (
		SELECT CASE
			WHEN p_day < DATE '2026-11-09' THEN NULL
			WHEN d.u < 0.70 THEN 'common'
			WHEN d.u < 0.95 THEN 'uncommon'
			ELSE 'rare' END AS rarity
		FROM (SELECT public._trader_unit(p_user::text || ':' || p_day::text || ':fancy') AS u) d
	)
	SELECT f.id
	FROM public.satchel_finds f CROSS JOIN draw
	WHERE f.id IS DISTINCT FROM p_not
	ORDER BY
		(draw.rarity IS NOT NULL AND f.rarity IS DISTINCT FROM draw.rarity),
		public._trader_unit(p_user::text || ':' || p_day::text || ':' || f.id)
			* (CASE WHEN draw.rarity IS NOT NULL THEN 1
			        ELSE CASE f.rarity WHEN 'common' THEN 70 WHEN 'uncommon' THEN 25 ELSE 5 END END) DESC,
		f.sort
	LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public._trader_want_for(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- ── 9. Checks ────────────────────────────────────────────────────────────────
DO $checks$
DECLARE
	t jsonb := public._market_tuning();
	lo numeric := (t->'price'->>'lo')::numeric;
	hi numeric := (t->'price'->>'hi')::numeric;
	sf numeric := (t->'price'->>'sell_factor')::numeric;
	bf numeric := (t->'price'->>'buy_factor')::numeric;
BEGIN
	IF t->'set_size' IS DISTINCT FROM '{"common": 3, "uncommon": 2, "rare": 1}'::jsonb THEN
		RAISE EXCEPTION 'market set sizes did not land: %', t->'set_size';
	END IF;
	IF NOT (sf * lo > bf * hi) THEN
		RAISE EXCEPTION 'market fairness invariant broken: % x % <= % x %', sf, lo, bf, hi;
	END IF;
	IF EXISTS (SELECT 1 FROM public.market_prices mp
	           WHERE mp.price < lo * public._market_usual(mp.find_id, t) - 0.000001
	              OR mp.price > hi * public._market_usual(mp.find_id, t) + 0.000001) THEN
		RAISE EXCEPTION 'a rescaled market price left its band';
	END IF;
END
$checks$;
