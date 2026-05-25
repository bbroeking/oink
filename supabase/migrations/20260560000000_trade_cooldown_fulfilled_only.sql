-- Bug fix: cancelled trades shouldn't lock the pair into a 24h
-- cooldown.
--
-- request_tickles (20260527000000_trade_economy_flip.sql) computed
-- the cooldown anchor as MAX(created_at) of ANY prior trade between
-- the pair, including cancelled ones. Result: if A asked B for
-- tickles and the trade got cancelled (declined by B or withdrawn
-- by A), A couldn't ask B again for 24 hours — even though no
-- actual exchange happened.
--
-- Multiple users reported "I can't send tickles, even with enough
-- balance" — this is almost certainly the path: ask → declined →
-- silent cooldown.
--
-- Fix: only count `status = 'fulfilled'` rows toward the 24h
-- pair cooldown. The cooldown's intent is to space ACTUAL trades,
-- per the original comment ("The 24h pair cooldown spaces repeat
-- trades"). Cancelled trades aren't trades.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.request_tickles(
	target_user_id uuid,
	amount int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id        uuid := auth.uid();
	new_id           uuid;
	last_trade_at    timestamptz;
	hours_remaining  numeric;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF amount IS NULL OR amount < 1 OR amount > 5 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.tickle_trades
		WHERE status = 'pending'
		  AND (
		    (requester_id = caller_id AND target_id = target_user_id)
		    OR (requester_id = target_user_id AND target_id = caller_id)
		  )
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_active');
	END IF;

	-- 24h cooldown is ONLY against fulfilled trades. Cancelled
	-- trades don't lock the pair — a decline/withdraw is not a
	-- completed exchange.
	SELECT MAX(fulfilled_at) INTO last_trade_at
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		  AND ((requester_id = caller_id AND target_id = target_user_id)
		    OR (requester_id = target_user_id AND target_id = caller_id));

	IF last_trade_at IS NOT NULL
	   AND last_trade_at > now() - interval '24 hours' THEN
		hours_remaining := EXTRACT(EPOCH FROM (
			last_trade_at + interval '24 hours' - now()
		)) / 3600.0;
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'cooldown',
			'hours_remaining', ROUND(hours_remaining::numeric, 1),
			'next_available_at', last_trade_at + interval '24 hours'
		);
	END IF;

	INSERT INTO public.tickle_trades (requester_id, target_id, amount)
		VALUES (caller_id, target_user_id, amount)
		RETURNING id INTO new_id;

	RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$function$;
