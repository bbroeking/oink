-- Bullion's Market follow-ups (2026-10-31), on top of 20261031100000_bullions_market.sql.
-- A separate migration because the market migration may already be applied:
-- Supabase never re-runs an applied file, so changes land here.
--
--   1. market_state: a wanted ad its pig can't pay right now is not shown to
--      anyone else (it would only lapse on the taker), so the board no longer
--      tells a stranger whether another pig can afford its ad;
--      poster_coin_ok stays in the payload (always true) for the client's shape.
--   2. _market_advance: when the Season 2 flip has been undone
--      (unflip_season_2 turns app_config.season2_flipped off), listings the flip
--      ended ('reset') give their held sets back. The escrow stayed on the row
--      for exactly this. They are notified as a plain take-down.
--   3. A partial index for that check.
--   4. A trigger: a Satchel swap or gift that moves a bag row to another pig
--      clears its market cost basis ("a swapped find carries no cost"), without
--      touching the swap functions (carry-latest-def).
--
-- Carry-latest-def: market_state and _market_advance are carried whole from
-- 20261031100000_bullions_market.sql (their only def). Smoke:
-- scripts/db-harness/C1_bullions_market_smoke.sql section 11 (run with both files).
--
-- Authored for review; do not push without Brian's explicit "go".

CREATE INDEX IF NOT EXISTS market_offers_reset_idx
	ON public.market_offers (id) WHERE status = 'reset';

CREATE OR REPLACE FUNCTION public._market_advance()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint := public._market_tick(v_now, t);
	catch_up int := GREATEST(1, COALESCE((t->>'catch_up_ticks')::int, 144));
	keep_ticks int := 7 * (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	print_window int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	townsfolk text[] := ARRAY['the Miller', 'the Baker''s boy', 'Old Mrs Hedge', 'the Tinker', 'Farmer Bramble', 'the Postmistress'];
	f record;
	o public.market_offers;
	u int;
	sz int;
	p numeric;
	w double precision;
	tk bigint;
	a int;
	b int;
	bid int;
	ask int;
	reset_at timestamptz := public._market_reset_at();
	came_home boolean;
BEGIN
	-- Nothing due? (No lock, no writes: the common read.)
	IF NOT EXISTS (SELECT 1 FROM public.satchel_finds sf
	               LEFT JOIN public.market_prices mp ON mp.find_id = sf.id
	               WHERE mp.find_id IS NULL OR mp.tick < now_t)
	   AND NOT EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'open' AND expires_at <= v_now)
	   AND NOT (reset_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.market_offers
	                   WHERE status = 'open' AND posted_at < reset_at))
	   AND NOT (reset_at IS NULL AND EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'reset')) THEN
		RETURN now_t;
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);

	-- 0. A find with no price yet starts near its usual price.
	INSERT INTO public.market_prices (find_id, price, tick, last_active_tick)
	SELECT sf.id,
	       ROUND(public._market_clamp(public._market_usual(sf.id, t),
	           public._market_usual(sf.id, t) * (0.97 + 0.06 * public._market_unit('p0:' || sf.id))::numeric, t), 6),
	       now_t, now_t
	FROM public.satchel_finds sf
	WHERE NOT EXISTS (SELECT 1 FROM public.market_prices mp WHERE mp.find_id = sf.id)
	ON CONFLICT (find_id) DO NOTHING;
	INSERT INTO public.market_price_points (find_id, tick, price)
	SELECT mp.find_id, mp.tick, mp.price FROM public.market_prices mp
	ON CONFLICT (find_id, tick) DO NOTHING;

	-- 1. Quiet hours: every tick, the wiggle and the drift home.
	FOR f IN SELECT mp.find_id, mp.price, mp.tick FROM public.market_prices mp
	         WHERE mp.tick < now_t ORDER BY mp.find_id FOR UPDATE LOOP
		u := public._market_usual(f.find_id, t);
		sz := public._market_set_size(f.find_id, t);
		p := f.price;
		FOR tk IN GREATEST(f.tick + 1, now_t - catch_up + 1) .. now_t LOOP
			w := 2 * public._market_unit('w:' || f.find_id || ':' || tk) - 1;
			p := p + u * (t->'price'->>'wiggle')::numeric * w::numeric;
			p := p + (t->'price'->>'home')::numeric * (u - p);
			p := ROUND(public._market_clamp(u, p, t), 6);
			INSERT INTO public.market_price_points (find_id, tick, price) VALUES (f.find_id, tk, p)
			ON CONFLICT (find_id, tick) DO UPDATE SET price = EXCLUDED.price;
			-- A print on the tape is one of those small trades (only the last day's).
			IF tk > now_t - print_window
			   AND public._market_unit('pr:' || f.find_id || ':' || tk)
			       < COALESCE((t->'print_chance'->>public._market_rarity(f.find_id))::double precision, 0) THEN
				a := FLOOR(public._market_unit('pa:' || f.find_id || ':' || tk) * array_length(townsfolk, 1))::int;
				b := (a + 1 + FLOOR(public._market_unit('pb:' || f.find_id || ':' || tk)
				      * (array_length(townsfolk, 1) - 1))::int) % array_length(townsfolk, 1);
				INSERT INTO public.market_trades (kind, find_id, qty, price, dir, who, other, tick, created_at)
				VALUES ('print', f.find_id, sz, ROUND(p)::int, CASE WHEN w >= 0 THEN 'up' ELSE 'down' END,
				        townsfolk[a + 1], townsfolk[b + 1], tk,
				        to_timestamp(tk * GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30)) * 60));
			END IF;
		END LOOP;
		UPDATE public.market_prices SET price = p, tick = now_t WHERE find_id = f.find_id;
	END LOOP;
	DELETE FROM public.market_price_points WHERE tick < now_t - keep_ticks;
	DELETE FROM public.market_trades WHERE kind = 'print' AND tick < now_t - keep_ticks;

	-- 1b. The flip was undone (unflip_season_2): listings it ended give their
	-- sets back — the escrow was kept on the row for exactly this. Notified as
	-- a plain take-down ("came home").
	IF reset_at IS NULL THEN
		FOR o IN SELECT * FROM public.market_offers WHERE status = 'reset' ORDER BY id FOR UPDATE LOOP
			BEGIN
				came_home := public._market_close(o, 'cancelled', v_now);
				PERFORM public._market_notice(o.user_id, 'expired', o, NULL);
			EXCEPTION WHEN OTHERS THEN
				RAISE WARNING 'market: restoring reset listing % failed: %', o.id, SQLERRM;
			END;
		END LOOP;
	END IF;

	-- 2. Listings older than 24 hours lapse; a set on offer comes home. A
	-- listing pinned before a season's fresh start ends too, its set reset
	-- with the bag it came from (_market_close keeps it from coming home).
	FOR o IN SELECT * FROM public.market_offers
	         WHERE status = 'open'
	           AND (expires_at <= v_now OR (reset_at IS NOT NULL AND posted_at < reset_at))
	         ORDER BY id FOR UPDATE LOOP
		-- Each its own subtransaction: one listing that cannot close must not
		-- stop every pig's read (it stays open and is retried next read).
		BEGIN
			IF public._market_pre_reset(o, reset_at) THEN
				PERFORM public._market_close(o, 'reset', v_now);
				PERFORM public._market_notice(o.user_id, 'reset', o, NULL);
			ELSE
				PERFORM public._market_close(o, 'expired', v_now);
				PERFORM public._market_notice(o.user_id, 'expired', o, NULL);
			END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE WARNING 'market: closing listing % failed: %', o.id, SQLERRM;
		END;
	END LOOP;

	-- 3. The counter keeps the board honest. Each crossing moves the price, so
	-- every listing is judged against the price as it stands when its turn comes.
	FOR o IN SELECT * FROM public.market_offers
	         WHERE status = 'open' AND side IN ('sell', 'buy') ORDER BY id FOR UPDATE LOOP
		u := public._market_usual(o.find_id, t);
		SELECT price INTO p FROM public.market_prices WHERE find_id = o.find_id;
		bid := public._market_bid(u, p, t);
		ask := public._market_ask(u, p, t);
		-- Each crossing is its own subtransaction: one listing that cannot
		-- settle (a pig with no bank row, a bank spent since the check) is
		-- taken down, and the market — every pig's read — keeps working.
		BEGIN
			IF o.side = 'sell' AND o.price <= bid AND public._market_counter_open(o.user_id, 'sell', now_t, t) THEN
				PERFORM public._market_counter_sell(o.user_id, o.find_id, o.escrow, 'crossed', o, now_t, t);
			ELSIF o.side = 'buy' AND o.price >= ask AND public._market_counter_open(o.user_id, 'buy', now_t, t) THEN
				IF COALESCE(public.tickle_balance(o.user_id), 0) < ask THEN
					PERFORM public._market_close(o, 'lapsed', v_now);
					PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
				ELSE
					PERFORM public._market_counter_buy(o.user_id, o.find_id, 'crossed', o, now_t, t);
				END IF;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE WARNING 'market: crossing listing % failed, taking it down: %', o.id, SQLERRM;
			BEGIN
				PERFORM public._market_close(o, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, v_now);
				PERFORM public._market_notice(o.user_id, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, o, NULL);
			EXCEPTION WHEN OTHERS THEN
				RAISE WARNING 'market: taking listing % down failed too: %', o.id, SQLERRM;
			END;
		END;
	END LOOP;

	RETURN now_t;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_advance() FROM PUBLIC, anon, authenticated;

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

-- ── 10. A moved find carries no cost ─────────────────────────────────────────
-- The Satchel swap and gift move a bag row to another pig with an UPDATE of
-- user_id (20260917100000). A market cost basis is its owner's alone ("a
-- swapped find carries no cost"), so it is cleared whenever a row changes
-- hands. A trigger, so the swap functions stay untouched (carry-latest-def).
-- The market itself never moves a row (it deletes and re-inserts).
CREATE OR REPLACE FUNCTION public._satchel_items_clear_market_cost()
RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
	IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
		NEW.market_cost := NULL;
	END IF;
	RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._satchel_items_clear_market_cost() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS satchel_items_clear_market_cost ON public.satchel_items;
CREATE TRIGGER satchel_items_clear_market_cost
	BEFORE UPDATE OF user_id ON public.satchel_items
	FOR EACH ROW EXECUTE FUNCTION public._satchel_items_clear_market_cost();
