-- 24-hour pair-level cooldown on tickle trades + a backend history RPC.
--
-- Rationale: trades should feel like a deliberate social act, not a
-- ping-pong farming loop. After ANY trade between A and B (regardless
-- of who initiated), neither can open a new one for 24 hours. Applies
-- pair-wise so a busy player can still trade with different friends
-- inside the same day.
--
-- History is already preserved on the existing tickle_trades table
-- (cancel + repay update status, never delete). This migration adds
-- `tickle_trade_history(other_user_id)` for backend / future-UI use.

-- ── 1. Replace request_tickles with cooldown check ────────────────
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

	-- Block if there's an active (pending OR fulfilled) trade either
	-- direction — same constraint as before.
	IF EXISTS (
		SELECT 1 FROM public.tickle_trades
		WHERE status IN ('pending', 'fulfilled')
		  AND (
		    (requester_id = caller_id AND target_id = target_user_id)
		    OR (requester_id = target_user_id AND target_id = caller_id)
		  )
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_active');
	END IF;

	-- Pair-level cooldown: 24h since the most recent trade between
	-- this pair started, regardless of direction or how it ended.
	-- Reads the latest created_at because that's the "first contact"
	-- timestamp regardless of fulfilled/repaid/cancelled state.
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

GRANT EXECUTE ON FUNCTION public.request_tickles(uuid, int) TO authenticated;

-- ── 2. Backend history RPC ─────────────────────────────────────────
-- Returns the full trade ledger between the caller and a friend,
-- including terminal (repaid / cancelled) trades. Ordered newest
-- first. No UI yet — intended for analytics / future "your history
-- with X" screen / reputation surface.
CREATE OR REPLACE FUNCTION public.tickle_trade_history(other_user_id uuid)
RETURNS TABLE (
	id            uuid,
	requester_id  uuid,
	target_id     uuid,
	amount        int,
	status        text,
	created_at    timestamptz,
	fulfilled_at  timestamptz,
	repaid_at     timestamptz,
	cancelled_at  timestamptz,
	direction     text   -- 'sent' (caller requested from other) or 'received' (other requested from caller)
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT
		t.id,
		t.requester_id,
		t.target_id,
		t.amount,
		t.status,
		t.created_at,
		t.fulfilled_at,
		t.repaid_at,
		t.cancelled_at,
		CASE
			WHEN t.requester_id = auth.uid() THEN 'sent'
			ELSE 'received'
		END AS direction
	FROM public.tickle_trades t
	WHERE (t.requester_id = auth.uid() AND t.target_id = other_user_id)
	   OR (t.requester_id = other_user_id AND t.target_id = auth.uid())
	ORDER BY t.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_trade_history(uuid) TO authenticated;

-- ── 3. Helpful index for history scans ─────────────────────────────
CREATE INDEX IF NOT EXISTS tickle_trades_pair_idx
	ON public.tickle_trades (requester_id, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickle_trades_pair_rev_idx
	ON public.tickle_trades (target_id, requester_id, created_at DESC);
