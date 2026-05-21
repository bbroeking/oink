-- Tickle Trade — request/fulfill flow for friend-to-friend tickle
-- transfers. The ASKER gets DOUBLE what they request; the giver
-- spends N from their own bank and gets nothing material back —
-- only a social promise. Greed is the mechanically profitable move;
-- alignment + reputation is the only counterweight.
-- See docs/season-1-goblins-vs-angels.md.
--
-- Lifecycle:
--   pending   A→B  — A asked B for N tickles. Either side can cancel.
--   fulfilled A→B  — B spent N from their bank; A got +2N score.
--                    Terminal. No repayment — the promise is social.
--   cancelled      — terminal, no transfer happened.
--
-- Constraints:
--   - Max 1 PENDING from A→B at a time (you can't spam-request)
--   - Friends-only (requester + target must both be in an accepted
--     friendship)
--   - Amount 1-5 (UI-enforced + DB CHECK)
--
-- Resource model:
--   Spending is from user_items.item_count (the regenerating bank).
--   The benefit is to profiles.tickles_earned + profiles.counter
--   (matches what a normal tickle does — see update_profile_and_item_count).

CREATE TABLE IF NOT EXISTS public.tickle_trades (
	id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	requester_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	target_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	amount       int         NOT NULL CHECK (amount BETWEEN 1 AND 5),
	status       text        NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
	created_at   timestamptz NOT NULL DEFAULT now(),
	fulfilled_at timestamptz,
	cancelled_at timestamptz,
	CHECK (requester_id <> target_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tickle_trades_one_pending
	ON public.tickle_trades (requester_id, target_id) WHERE status = 'pending';
-- No one-fulfilled uniqueness: fulfilled is terminal + historical now
-- (no repay step), so a pair trades repeatedly across cooldown windows.
CREATE INDEX IF NOT EXISTS tickle_trades_target_pending_idx
	ON public.tickle_trades (target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS tickle_trades_requester_fulfilled_idx
	ON public.tickle_trades (requester_id) WHERE status = 'fulfilled';
CREATE INDEX IF NOT EXISTS tickle_trades_target_fulfilled_idx
	ON public.tickle_trades (target_id) WHERE status = 'fulfilled';

ALTER TABLE public.tickle_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own tickle trades" ON public.tickle_trades;
CREATE POLICY "View own tickle trades"
	ON public.tickle_trades FOR SELECT
	USING (auth.uid() = requester_id OR auth.uid() = target_id);
-- Mutations go through SECURITY DEFINER RPCs below; no direct writes.

-- ── helper: confirm two users are friends ──────────────────────────
CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.friendships
		WHERE status = 'accepted'
		  AND (
			(requester_id = user_a AND receiver_id = user_b)
			OR (requester_id = user_b AND receiver_id = user_a)
		  )
	);
$function$;

-- ── request_tickles: A asks B for N ────────────────────────────────
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
	caller_id uuid := auth.uid();
	new_id    uuid;
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
		WHERE requester_id = caller_id
		  AND target_id = target_user_id
		  AND status IN ('pending', 'fulfilled')
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_active');
	END IF;

	INSERT INTO public.tickle_trades (requester_id, target_id, amount)
		VALUES (caller_id, target_user_id, amount)
		RETURNING id INTO new_id;

	RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_tickles(uuid, int) TO authenticated;

-- ── fulfill_tickle_trade: B answers A's request ────────────────────
-- Resource flow: B's bank -= N; A's score (counter + tickles_earned)
-- += 2N. The asker gets DOUBLE; the giver gets only a social promise.
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

	-- Caller (B) needs enough bank to spend.
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

	-- Asker gets DOUBLE what they asked for (see header). The giver
	-- spent only `amount` above and gets nothing material — by design.
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

GRANT EXECUTE ON FUNCTION public.fulfill_tickle_trade(uuid) TO authenticated;

-- ── cancel_tickle_trade: either side cancels a pending trade ───────
CREATE OR REPLACE FUNCTION public.cancel_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	trade     record;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO trade FROM public.tickle_trades
		WHERE id = trade_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF caller_id NOT IN (trade.requester_id, trade.target_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_involved');
	END IF;
	IF trade.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	UPDATE public.tickle_trades
		SET status = 'cancelled', cancelled_at = now()
		WHERE id = trade.id;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_tickle_trade(uuid) TO authenticated;

-- ── my_tickle_trades: list trades involving the caller ─────────────
-- Returns every open trade where the caller is requester or target.
-- The UI filters by status + direction to surface action prompts:
--   incoming pending: actionable (fulfill / cancel)
--   outgoing fulfilled: actionable (repay!)
--   outgoing pending: passive (cancel)
--   incoming fulfilled: passive (waiting on partner's thanks)
CREATE OR REPLACE FUNCTION public.my_tickle_trades()
RETURNS TABLE (
	id            uuid,
	requester_id  uuid,
	target_id     uuid,
	amount        int,
	status        text,
	created_at    timestamptz,
	fulfilled_at  timestamptz,
	partner_username      text,
	partner_discriminator text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT t.id, t.requester_id, t.target_id, t.amount, t.status,
		t.created_at, t.fulfilled_at,
		p.username, p.discriminator
	FROM public.tickle_trades t
	JOIN public.profiles p ON p.id = CASE
		WHEN t.requester_id = auth.uid() THEN t.target_id
		ELSE t.requester_id
	END
	WHERE (t.requester_id = auth.uid() OR t.target_id = auth.uid())
	  AND t.status IN ('pending', 'fulfilled')
	ORDER BY t.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.my_tickle_trades() TO authenticated;
