-- The Ghost Sheep Trader pays tickles, never Snouts (2026-09-20).
--
-- The Stranger spec (§3.4) lists what he never does — "pay Snouts" among them —
-- and the 20260917170000 sale paid him through apply_tickles(), the applied-
-- tickle path that a dig find and a swap use: +N to the count AND +N snouts,
-- because a real tap mints a snout. The trader is not a tap: a find handed
-- over pays the COUNT (tickles_earned — the "tickled now" tally, the season
-- and the breakdown's `trader` lane), and nothing else. Founder ruling
-- 2026-09-20: "we don't need to give snouts with the trader — give tickles".
--
-- trade_with_trader is carried VERBATIM from 20260917170000 (its only prior
-- definition; checked with `grep -l "FUNCTION public.trade_with_trader"`), with
-- one change: the payout line. Prices, the want multiplier, the per-visit cap,
-- the ledger, the replay rule and the returned shape are untouched, so the
-- client needs nothing.
--
-- Authored for review; do not push without Brian's explicit "go".

CREATE OR REPLACE FUNCTION public.trade_with_trader(p_item_id bigint, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 6));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	prices jsonb := public._trader_prices_json(t);
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	rarity text;
	was_want boolean;
	price int;
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
		IF prior.user_id <> uid THEN
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

	-- 4. The price: by rarity, doubled for the find he fancies.
	SELECT f.rarity INTO rarity FROM public.satchel_finds f WHERE f.id = item.find_id;
	price := GREATEST(0, COALESCE((prices->>COALESCE(rarity, 'common'))::int, 0));
	was_want := item.find_id = v.want_find_id;
	IF was_want THEN
		price := FLOOR(price * mult)::int;
	END IF;

	-- 5. The find leaves the world; the ledger remembers; the tickles land.
	SELECT COALESCE(tickles_earned, 0) INTO before_count FROM public.profiles WHERE id = uid;
	DELETE FROM public.satchel_items WHERE id = item.id;
	INSERT INTO public.trader_sales (nonce, user_id, visit_id, item_id, find_id, tickles, was_want)
		VALUES (p_nonce, uid, v.id, item.id, item.find_id, price, was_want);
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
		'before', COALESCE(before_count, 0),
		'after', COALESCE(after_count, 0),
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;
REVOKE ALL ON FUNCTION public.trade_with_trader(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_with_trader(bigint, uuid) TO authenticated;
