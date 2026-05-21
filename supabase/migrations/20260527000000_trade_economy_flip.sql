-- Trade-economy flip — RECONCILIATION migration.
--
-- The flip (asker gets 2N, giver spends N, no repay step) was first
-- written by editing already-applied migrations in place:
--   20260520010000_tickle_trades, _030000_trade_cooldown,
--   _050000_push_delivery, _060000_achievements.
-- Those are in the remote migration history, so `db push` will never
-- re-apply them — the edits never reached the database. This
-- migration carries the flip forward as proper, idempotent DDL.
--
-- See commit "Flip trade economy: asker gets double, no repay step".
-- Left in place deliberately: the dead `repaid_at` column and the
-- status CHECK that still permits 'repaid' — both harmless (nothing
-- writes them), and dropping them is needless risk.

-- ── 1. Tear down the old repay scaffolding ─────────────────────────
DROP INDEX    IF EXISTS public.tickle_trades_one_fulfilled;
DROP FUNCTION IF EXISTS public.repay_tickle_trade(uuid);

-- ── 2. fulfill_tickle_trade — the ASKER now gets 2N ────────────────
-- B's bank -= N; A's score (counter + tickles_earned) += 2N. The
-- giver gets nothing material — only a social promise.
CREATE OR REPLACE FUNCTION public.fulfill_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	trade      record;
	b_bank     int;
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

	SELECT item_count INTO b_bank
		FROM public.user_items WHERE user_id = caller_id FOR UPDATE;
	IF b_bank IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;
	IF b_bank < trade.amount THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient_bank',
			'balance', b_bank, 'needed', trade.amount
		);
	END IF;

	UPDATE public.user_items
		SET item_count = item_count - trade.amount
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
		'new_bank', b_bank - trade.amount,
		'asker_gained', trade.amount * 2
	);
END;
$function$;

-- ── 3. request_tickles — only a PENDING trade blocks a new one ─────
-- 'fulfilled' is terminal now; if it still blocked, a pair could
-- never trade twice. The 24h pair cooldown spaces repeat trades.
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

	SELECT MAX(created_at) INTO last_trade_at
		FROM public.tickle_trades
		WHERE (requester_id = caller_id AND target_id = target_user_id)
		   OR (requester_id = target_user_id AND target_id = caller_id);

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

-- ── 4. Trade-volume views — fulfilled-only; asker counts 2N ────────
CREATE OR REPLACE VIEW public.user_trade_given AS
	SELECT target_id AS user_id, SUM(amount) AS amount
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		GROUP BY target_id;

CREATE OR REPLACE VIEW public.user_trade_received AS
	SELECT requester_id AS user_id, SUM(amount * 2) AS amount
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		GROUP BY requester_id;

-- ── 5. Achievement trigger — fires on 'fulfilled' only ─────────────
CREATE OR REPLACE FUNCTION public.tickle_trades_achievement_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.status = 'fulfilled'
	   AND (OLD.status IS DISTINCT FROM NEW.status) THEN
		PERFORM public.try_claim_achievements(NEW.requester_id, 'trade_giver');
		PERFORM public.try_claim_achievements(NEW.requester_id, 'trade_receiver');
		PERFORM public.try_claim_achievements(NEW.target_id,    'trade_giver');
		PERFORM public.try_claim_achievements(NEW.target_id,    'trade_receiver');
	END IF;
	RETURN NEW;
END;
$function$;

-- ── 6. Push copy — "answered your trade"; no repaid branch ─────────
CREATE OR REPLACE FUNCTION public.tickle_trades_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name      text;
	target_user_id  uuid;
	push_title      text;
	push_body       text;
	push_data       jsonb;
BEGIN
	IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
		target_user_id := NEW.target_id;
		push_title := COALESCE(actor_name, 'A friend') || ' asked for tickles';
		push_body  := NEW.amount || ' tickle' || CASE WHEN NEW.amount > 1 THEN 's' ELSE '' END
			|| '. Tap to fulfill or decline.';
		push_data  := jsonb_build_object(
			'kind', 'trade_requested',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);
	ELSIF TG_OP = 'UPDATE'
	      AND OLD.status = 'pending' AND NEW.status = 'fulfilled' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.target_id;
		target_user_id := NEW.requester_id;
		push_title := COALESCE(actor_name, 'A friend') || ' answered your trade';
		push_body  := '+' || (NEW.amount * 2) || ' tickles landed in your barn.';
		push_data  := jsonb_build_object(
			'kind', 'trade_fulfilled',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);
	ELSE
		RETURN NEW;
	END IF;

	BEGIN
		PERFORM public.send_push_to_user(target_user_id, push_title, push_body, push_data);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN NEW;
END;
$function$;
