-- Bug fix: fulfill_tickle_trade was rejecting trades using the
-- RAW stored item_count, ignoring regen catch-up. The Barn HUD +
-- Inbox affordance both display tickle_info().balance, which IS
-- regen-adjusted — so the user saw "you have 9" everywhere
-- except the actual trade fulfillment, which insisted they had 3
-- and refused with `insufficient_bank`.
--
-- Reproducer: Brian's user_items had item_count=3, last_increment
-- ~7h ago. tickle_balance() = LEAST(cap, 3 + floor(7h / regen)) = 9.
-- A request_tickles(brian, 5) → fulfill_tickle_trade rejected
-- with `insufficient_bank` (3 < 5) even though Brian effectively
-- had 9.
--
-- Fix: materialize the regen catch-up into item_count BEFORE
-- checking against the requested amount. After deduction, reset
-- last_increment to now() so the next regen cycle starts from a
-- clean baseline. All atomic under SELECT FOR UPDATE.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.fulfill_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	trade        record;
	raw_count    int;
	last_inc     timestamptz;
	cap          int;
	regen_secs   int;
	current_bal  int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO trade FROM public.tickle_trades
		WHERE id = trade_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF trade.target_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_target');
	END IF;
	IF trade.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	-- Lock the user_items row and compute the regen-adjusted balance.
	-- Mirror the math in public.tickle_balance() exactly so the
	-- number we check against matches what the UI shows.
	SELECT item_count, last_increment INTO raw_count, last_inc
		FROM public.user_items WHERE user_id = caller_id FOR UPDATE;
	IF raw_count IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;

	SELECT CASE WHEN COALESCE(is_vip, false) THEN 50 ELSE 25 END INTO cap
		FROM public.profiles WHERE id = caller_id;
	regen_secs := public.regen_secs_for(caller_id);

	current_bal := LEAST(
		cap,
		raw_count + GREATEST(0, FLOOR(
			EXTRACT(EPOCH FROM (now() - last_inc)) / regen_secs
		)::int)
	);

	IF current_bal < trade.amount THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient_bank',
			'balance', current_bal, 'needed', trade.amount
		);
	END IF;

	-- Atomic update: bake regen catch-up into item_count, deduct
	-- the trade amount, reset last_increment so the next regen
	-- cycle starts from now. Single UPDATE so no other writer can
	-- interleave between read and write.
	UPDATE public.user_items
		SET item_count    = current_bal - trade.amount,
		    last_increment = now()
		WHERE user_id = caller_id;

	UPDATE public.profiles
		SET counter        = counter        + trade.amount * 2,
		    tickles_earned = tickles_earned + trade.amount * 2
		WHERE id = trade.requester_id;

	UPDATE public.tickle_trades
		SET status = 'fulfilled', fulfilled_at = now()
		WHERE id = trade.id;

	RETURN jsonb_build_object(
		'ok', true,
		'trade_id', trade.id,
		'new_bank', current_bal - trade.amount,
		'asker_gained', trade.amount * 2
	);
END;
$function$;
