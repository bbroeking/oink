-- Bullion pins three public one-set offers per UTC day, shared by all pigs.
-- Authored after the founder chose option B (2026-11-01). No production push
-- without a fresh explicit go. Player escrow and matching stay unchanged.
-- Daily stock is finite, not a fake player account. A board purchase is a
-- discounted counter purchase: bank sink, market cost basis, normal impact.
-- Carry-latest-def: market_state from 20261031110000; market_take from
-- 20261031100000. The added functions are private; no new public RPC.

CREATE TABLE public.market_bullion_offers (
    id bigserial PRIMARY KEY CHECK (id > 0),
    day date NOT NULL,
    slot int NOT NULL CHECK (slot BETWEEN 1 AND 6),
    find_id text NOT NULL REFERENCES public.satchel_finds(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    trade_id bigint REFERENCES public.market_trades(id),
    buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (day, slot)
);
ALTER TABLE public.market_bullion_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_bullion_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.market_bullion_offers_id_seq FROM PUBLIC, anon, authenticated;

-- The midpoint is quoted from live counter prices. Hide the offer if tuning
-- leaves no whole tickle strictly between the two prices.
CREATE OR REPLACE FUNCTION public._market_bullion_price(p_find text, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
    SELECT CASE WHEN q.ask - q.bid >= 2 THEN (q.ask + q.bid) / 2 END
    FROM (SELECT public._market_bid(public._market_usual(p_find, p_t), mp.price, p_t) AS bid,
                 public._market_ask(public._market_usual(p_find, p_t), mp.price, p_t) AS ask
          FROM public.market_prices mp WHERE mp.find_id = p_find) q;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_price(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._market_bullion_board(p_tick bigint, p_t jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
    v_now timestamptz := public._patch_now();
    today date := (v_now AT TIME ZONE 'UTC')::date;
    n int := LEAST(6, GREATEST(0, COALESCE((p_t->'bullion_board'->>'daily_listings')::int, 3)));
    board jsonb;
BEGIN
    IF n = 0 THEN RETURN '[]'::jsonb; END IF;
    -- Only the current day is materialised. Filled slots still count, so a
    -- poll, another player, a quiet week or a restart never refills stock.
    IF (SELECT COUNT(*) FROM public.market_bullion_offers WHERE day = today) < n THEN
        PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
        INSERT INTO public.market_bullion_offers (day, slot, find_id, created_at)
        SELECT today, x.slot, x.id, v_now
        FROM (SELECT sf.id,
                     row_number() OVER (ORDER BY md5(today::text || ':' || sf.id), sf.id)::int AS slot
              FROM public.satchel_finds sf) x
        WHERE x.slot <= n
        ON CONFLICT (day, slot) DO NOTHING;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        -- Player offer ids are positive. Negative ids select this separate
        -- stock table through the existing market_take RPC.
        'id', -o.id, 'find_id', o.find_id, 'side', 'sell', 'price', q.price,
        'qty', public._market_set_size(o.find_id, p_t), 'source', 'bullion',
        'poster', jsonb_build_object('id', 'bullion', 'kind', 'bullion', 'name', 'Bullion'),
        'for_you', false, 'created_at', o.created_at,
        'expires_at', (today + 1)::timestamp AT TIME ZONE 'UTC', 'status', 'open')
        ORDER BY o.slot), '[]'::jsonb)
    INTO board
    FROM public.market_bullion_offers o
    CROSS JOIN LATERAL (SELECT public._market_bullion_price(o.find_id, p_t) AS price) q
    WHERE o.day = today AND o.slot <= n AND o.status = 'open' AND q.price IS NOT NULL;
    RETURN board;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_board(bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Called only after market_take's auth, bank, lock, nonce replay and advance.
CREATE OR REPLACE FUNCTION public._market_bullion_take(p_user uuid, p_id bigint, p_limit int,
    p_nonce uuid, p_tick bigint, p_t jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
    v_now timestamptz := public._patch_now();
    today date := (v_now AT TIME ZONE 'UTC')::date;
    n int := LEAST(6, GREATEST(0, COALESCE((p_t->'bullion_board'->>'daily_listings')::int, 3)));
    o public.market_bullion_offers;
    quote int;
    bal int;
    sz int;
    u int;
    p numeric;
    np numeric;
    tr public.market_trades;
BEGIN
    SELECT * INTO o FROM public.market_bullion_offers WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR o.day <> today OR o.status <> 'open' OR o.slot > n THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    quote := public._market_bullion_price(o.find_id, p_t);
    IF quote IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
    IF p_limit IS NOT NULL AND quote > p_limit THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', quote);
    END IF;
    IF NOT public._market_counter_open(p_user, 'buy', p_tick, p_t) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'counter_limit', 'side', 'buy');
    END IF;
    bal := public.settle_tickles(p_user);
    IF bal < quote THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', quote);
    END IF;
    IF NOT public._market_spend(p_user, quote) THEN
        RAISE EXCEPTION 'market: daily shelf purchase without the tickles';
    END IF;
    sz := public._market_set_size(o.find_id, p_t);
    u := public._market_usual(o.find_id, p_t);
    SELECT price INTO p FROM public.market_prices WHERE find_id = o.find_id FOR UPDATE;
    PERFORM public._market_ledger(p_user, quote, 0);
    PERFORM public._market_give_units(p_user, o.find_id, public._market_costs(sz, quote), v_now);
    np := public._market_set_price(o.find_id, p + (p_t->'price'->>'impact')::numeric * u, p_tick, true, p_t);
    INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, buyer_id,
        from_price, to_price, bid, ask, tick, created_at)
    VALUES ('counter', 'buy', 'board', o.find_id, sz, quote, p_user, p, np,
        public._market_bid(u, p, p_t), public._market_ask(u, p, p_t), p_tick, v_now)
    RETURNING * INTO tr;
    UPDATE public.market_bullion_offers SET status = 'filled', trade_id = tr.id, buyer_id = p_user WHERE id = o.id;
    RETURN public._market_done(p_user, p_nonce,
        jsonb_build_object('ok', true, 'trade', public._market_tape_json(p_user, tr)));
END;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_take(uuid, bigint, int, uuid, bigint, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.market_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	per_day int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	day0 bigint;
	cap_val int;
	finds jsonb;
	board jsonb;
	mine jsonb;
	tape jsonb;
	notices jsonb;
	friends jsonb;
	led public.market_ledgers%ROWTYPE;
	posts int;
	yest jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'closed');
	END IF;
	now_t := public._market_advance();
	day0 := (now_t / per_day) * per_day;

	SELECT jsonb_agg(jsonb_build_object(
		'id', sf.id,
		'rarity', sf.rarity,
		'size', public._market_set_size(sf.id, t),
		'usual', public._market_usual(sf.id, t),
		'price', mp.price,
		'ask', public._market_ask(public._market_usual(sf.id, t), mp.price, t),
		'bid', public._market_bid(public._market_usual(sf.id, t), mp.price, t),
		'prev', COALESCE((SELECT pp.price FROM public.market_price_points pp
		                  WHERE pp.find_id = sf.id AND pp.tick <= now_t - per_day
		                  ORDER BY pp.tick DESC LIMIT 1),
		                 (SELECT pp.price FROM public.market_price_points pp
		                  WHERE pp.find_id = sf.id ORDER BY pp.tick LIMIT 1)),
		'quiet_for', now_t - mp.last_active_tick,
		'spark', (SELECT COALESCE(jsonb_agg(jsonb_build_array(x.tick, ROUND(x.price, 3)) ORDER BY x.tick), '[]'::jsonb)
		          FROM (SELECT pp.tick, pp.price FROM public.market_price_points pp
		                WHERE pp.find_id = sf.id AND pp.tick >= now_t - per_day ORDER BY pp.tick) x))
		ORDER BY sf.sort)
	INTO finds
	FROM public.satchel_finds sf JOIN public.market_prices mp ON mp.find_id = sf.id;

	SELECT COALESCE(jsonb_agg(public._market_offer_json(o) ORDER BY o.id), '[]'::jsonb) INTO mine
	FROM public.market_offers o WHERE o.user_id = uid AND o.status = 'open';

	SELECT COALESCE(jsonb_agg(public._market_offer_json(o) || jsonb_build_object(
		'poster', public._market_who(uid, o.user_id),
		'for_you', o.target_id IS NOT DISTINCT FROM uid,
		-- Kept for the client's shape: every wanted ad shown is payable.
		'poster_coin_ok', CASE WHEN o.side = 'buy' THEN true END)
		ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC), '[]'::jsonb) INTO board
	-- Cut the candidates cheaply first (open, not mine, public or for me; the
	-- newest 120), then run the per-row friendship / block checks on those.
	FROM (SELECT c.* FROM (
	          SELECT * FROM public.market_offers o
	          WHERE o.status = 'open' AND o.user_id <> uid AND (o.target_id IS NULL OR o.target_id = uid)
	          ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC LIMIT 120) c
	      -- A wanted ad its pig can't pay right now is not shown (it would only
	      -- lapse on the taker); nobody learns a stranger's bank, only that an
	      -- ad is up.
	      WHERE public._market_visible(uid, c)
	        AND (c.side <> 'buy' OR COALESCE(public.tickle_balance(c.user_id), 0) >= c.price)
	      ORDER BY (c.target_id IS NOT DISTINCT FROM uid) DESC, c.id DESC LIMIT 80) o;

	-- Player pins keep their ordering (For you first); Bullion is clearly named.
	board := board || public._market_bullion_board(now_t, t);

	-- By tick: a catch-up after a quiet spell inserts backdated prints find by
	-- find, so id order is not time order.
	SELECT COALESCE(jsonb_agg(public._market_tape_json(uid, x) ORDER BY x.tick DESC, x.id DESC), '[]'::jsonb) INTO tape
	FROM (SELECT * FROM public.market_trades tr ORDER BY tr.tick DESC, tr.id DESC LIMIT 24) x;

	WITH pending AS (
		UPDATE public.market_notices SET delivered_at = v_now
		-- Once: two overlapping reads (focus + poll, two devices) must not both
		-- hand the same notice over.
		WHERE id IN (SELECT n.id FROM public.market_notices n
		             WHERE n.user_id = uid AND n.delivered_at IS NULL ORDER BY n.id LIMIT 20
		             FOR UPDATE SKIP LOCKED)
		  AND delivered_at IS NULL
		RETURNING *)
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'id', n.id, 'kind', n.kind, 'offer', n.offer,
		'trade', (SELECT public._market_tape_json(uid, tr) FROM public.market_trades tr WHERE tr.id = n.trade_id))
		ORDER BY n.id), '[]'::jsonb) INTO notices
	FROM pending n;

	SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.username, 'pig_id', pr.active_pig_id)
		ORDER BY lower(pr.username)), '[]'::jsonb) INTO friends
	FROM (SELECT pr.* FROM public.friendships fs
	      JOIN public.profiles pr ON pr.id = CASE WHEN fs.requester_id = uid THEN fs.receiver_id ELSE fs.requester_id END
	      WHERE fs.status = 'accepted' AND (fs.requester_id = uid OR fs.receiver_id = uid)
	      ORDER BY lower(pr.username) LIMIT 100) pr;

	SELECT * INTO led FROM public.market_ledgers WHERE user_id = uid;
	SELECT COUNT(*)::int INTO posts FROM public.market_offers o
	WHERE o.user_id = uid AND public._market_tick(o.created_at, t) >= day0;

	-- Yesterday's busiest find (counter + pig sales), with its price range.
	SELECT jsonb_build_object('find_id', x.find_id, 'sets', x.n,
		'lo', (SELECT MIN(pp.price) FROM public.market_price_points pp
		       WHERE pp.find_id = x.find_id AND pp.tick >= day0 - per_day AND pp.tick < day0),
		'hi', (SELECT MAX(pp.price) FROM public.market_price_points pp
		       WHERE pp.find_id = x.find_id AND pp.tick >= day0 - per_day AND pp.tick < day0))
	INTO yest
	FROM (SELECT tr.find_id, COUNT(*)::int AS n FROM public.market_trades tr
	      WHERE tr.kind IN ('counter', 'pig') AND tr.tick >= day0 - per_day AND tr.tick < day0
	      GROUP BY tr.find_id ORDER BY COUNT(*) DESC, tr.find_id LIMIT 1) x;

	cap_val := CASE WHEN COALESCE((SELECT is_vip FROM public.profiles WHERE id = uid), false) THEN 50 ELSE 25 END;

	RETURN jsonb_build_object(
		'ok', true,
		'now', v_now,
		'tick', now_t,
		'tuning', jsonb_build_object(
			'set_size', t->'set_size', 'base', t->'base', 'price', t->'price',
			'list_multiple', t->'list_multiple', 'open_offers', t->'open_offers',
			'daily_posts', t->'daily_posts', 'offer_hours', t->'offer_hours',
			'tick_minutes', t->'tick_minutes', 'counter_caps', t->'counter_caps'),
		'finds', COALESCE(finds, '[]'::jsonb),
		'me', jsonb_build_object(
			'id', uid,
			'coin', public.tickle_balance(uid),
			'cap', cap_val,
			'spent', COALESCE(led.spent, 0),
			'took_in', COALESCE(led.took_in, 0),
			'posts_today', posts,
			'holdings', public._market_holdings(uid),
			'offers', mine),
		'board', board,
		'tape', tape,
		'notices', notices,
		'friends', friends,
		'yesterday', yest);
END;
$function$;
REVOKE ALL ON FUNCTION public.market_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.market_take(p_offer_id bigint, p_limit int, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	o public.market_offers;
	sz int;
	bal int;
	held int;
	costs jsonb;
	tr public.market_trades;
	prior jsonb;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
	IF p_nonce IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce'); END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN RETURN jsonb_build_object('ok', false, 'reason', 'closed'); END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	prior := public._market_replay(uid, p_nonce);
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	IF NOT public._market_has_bank(uid) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;
	now_t := public._market_advance();
	IF p_offer_id < 0 THEN
		-- Reject bigint's minimum before negation so a malformed id fails
		-- closed instead of overflowing. Real ids are positive.
		IF p_offer_id = '-9223372036854775808'::bigint THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
		END IF;
		RETURN public._market_bullion_take(uid, -p_offer_id, p_limit, p_nonce, now_t, t);
	END IF;

	SELECT * INTO o FROM public.market_offers WHERE id = p_offer_id FOR UPDATE;
	IF NOT FOUND OR o.status <> 'open' OR NOT public._market_visible(uid, o) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF o.user_id = uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'own_offer');
	END IF;
	IF NOT public._market_has_bank(o.user_id) THEN
		-- Its pig can't be paid (or pay): take it down rather than fail every taker.
		PERFORM public._market_close(o, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, v_now);
		PERFORM public._market_notice(o.user_id, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, o, NULL);
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	sz := public._market_set_size(o.find_id, t);

	IF o.side = 'sell' THEN
		IF p_limit IS NOT NULL AND o.price > p_limit THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', o.price);
		END IF;
		bal := public.settle_tickles(uid);
		IF bal < o.price THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', o.price);
		END IF;
		tr := public._market_settle_pig(o.user_id, uid, o.find_id, o.price, o.escrow, 'listing', o, now_t, t);
	ELSIF o.side = 'buy' THEN
		SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = o.find_id;
		IF held < sz THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'held', held, 'set_size', sz);
		END IF;
		IF public.tickle_balance(o.user_id) < o.price THEN
			PERFORM public._market_close(o, 'lapsed', v_now);
			PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', false, 'reason', 'lapsed'));
		END IF;
		costs := public._market_take_units(uid, o.find_id, sz);
		IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', sz,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = o.find_id));
		END IF;
		tr := public._market_settle_pig(uid, o.user_id, o.find_id, o.price, costs, 'wanted', o, now_t, t);
	ELSE
		-- Straight up: both sides move at once; no tickles; a swapped find
		-- carries no cost; the price stays put.
		SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = o.want_find_id;
		IF held < o.want_qty THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'held', held, 'needed', o.want_qty);
		END IF;
		costs := public._market_take_units(uid, o.want_find_id, o.want_qty);
		IF costs IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'needed', o.want_qty,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = o.want_find_id));
		END IF;
		PERFORM public._market_give_units(uid, o.find_id, public._market_costs(o.qty, NULL), v_now);
		PERFORM public._market_give_units(o.user_id, o.want_find_id, public._market_costs(o.want_qty, NULL), v_now);
		INSERT INTO public.market_trades (kind, find_id, qty, seller_id, buyer_id, want_find_id, want_qty,
			give_val, want_val, cost, gave_cost, offer_id, target_id, poster_id, tick, created_at)
		VALUES ('swap', o.find_id, o.qty, o.user_id, uid, o.want_find_id, o.want_qty,
			(SELECT price FROM public.market_prices WHERE find_id = o.find_id),
			(SELECT price FROM public.market_prices WHERE find_id = o.want_find_id)
				/ public._market_set_size(o.want_find_id, t) * o.want_qty,
			(public._market_lots_cost(o.escrow)->>'cost')::int,
			(public._market_lots_cost(costs)->>'cost')::int,
			o.id, o.target_id, o.user_id, now_t, v_now)
		RETURNING * INTO tr;
		UPDATE public.market_offers SET status = 'filled', closed_at = v_now, trade_id = tr.id WHERE id = o.id;
		PERFORM public._market_notice(o.user_id, 'swapped', o, tr.id);
	END IF;
	RETURN public._market_done(uid, p_nonce,
		jsonb_build_object('ok', true, 'trade', public._market_tape_json(uid, tr)));
END;
$function$;
REVOKE ALL ON FUNCTION public.market_take(bigint, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_take(bigint, int, uuid) TO authenticated;
