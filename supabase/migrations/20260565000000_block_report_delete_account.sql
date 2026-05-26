-- App Store compliance: block / report / in-app account deletion.
--
-- Apple Guideline 5.1.1(v) — apps that create accounts must offer
-- in-app account deletion. "Email us" is not enough.
--
-- Apple Guideline 1.2 — apps with user-to-user social features
-- must let users report other users + block them.
--
-- This migration adds:
--   1. user_blocks(blocker_id, blocked_id) — symmetric one-way blocks
--   2. user_reports(id, reporter_id, reported_id, reason)
--   3. block_user / unblock_user / report_user / delete_my_account RPCs
--   4. are_blocked() helper used by friend/trade/bless/curse RPCs to
--      refuse interaction between blocked pairs
--   5. Updates to send_friend_request + request_tickles + cast_blessing +
--      cast_curse to enforce the block

-- ── 1. Tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
	blocker_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	blocked_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (blocker_id, blocked_id),
	CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
	ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view own blocks" ON public.user_blocks;
CREATE POLICY "view own blocks"
	ON public.user_blocks FOR SELECT
	USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.user_reports (
	id          bigserial   PRIMARY KEY,
	reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reported_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reason      text        NOT NULL,
	created_at  timestamptz NOT NULL DEFAULT now(),
	CHECK (reporter_id <> reported_id)
);

CREATE INDEX IF NOT EXISTS user_reports_reported_idx
	ON public.user_reports(reported_id, created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — server-only state for moderation review.

-- ── 2. are_blocked helper ────────────────────────────────────────
-- True if either user has blocked the other.
CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.user_blocks
		WHERE (blocker_id = a AND blocked_id = b)
		   OR (blocker_id = b AND blocked_id = a)
	);
$function$;

GRANT EXECUTE ON FUNCTION public.are_blocked(uuid, uuid) TO authenticated;

-- ── 3. block_user ────────────────────────────────────────────────
-- Inserts the block row + tears down the existing friendship if
-- any. Pending trades between the pair are cancelled. Active
-- blessings/curses between them are left to expire naturally
-- (they don't strictly require friendship to remain valid).
CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;

	INSERT INTO public.user_blocks (blocker_id, blocked_id)
		VALUES (caller_id, target_user_id)
		ON CONFLICT DO NOTHING;

	-- Tear down any friendship (either direction).
	DELETE FROM public.friendships
		WHERE (requester_id = caller_id AND receiver_id = target_user_id)
		   OR (requester_id = target_user_id AND receiver_id = caller_id);

	-- Cancel any pending trades between the pair.
	UPDATE public.tickle_trades
		SET status = 'cancelled', cancelled_at = now(), cancelled_by = caller_id
		WHERE status = 'pending'
		  AND ((requester_id = caller_id AND target_id = target_user_id)
		    OR (requester_id = target_user_id AND target_id = caller_id));

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- ── 4. unblock_user ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	DELETE FROM public.user_blocks
		WHERE blocker_id = caller_id AND blocked_id = target_user_id;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ── 5. report_user ──────────────────────────────────────────────
-- Records a report for later moderator review. No auto-action.
CREATE OR REPLACE FUNCTION public.report_user(
	target_user_id uuid,
	reason text DEFAULT 'unspecified'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	clean_reason text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	clean_reason := COALESCE(NULLIF(TRIM(reason), ''), 'unspecified');
	INSERT INTO public.user_reports (reporter_id, reported_id, reason)
		VALUES (caller_id, target_user_id, LEFT(clean_reason, 500));
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.report_user(uuid, text) TO authenticated;

-- ── 6. delete_my_account ────────────────────────────────────────
-- App Store 5.1.1(v) compliance: in-app account deletion. Hard
-- deletes the auth.users row, which cascades through every public
-- table via the ON DELETE CASCADE foreign keys.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	DELETE FROM auth.users WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ── 7. Enforce blocks in friend-request + trade RPCs ────────────
-- Patches send_friend_request to refuse if a block exists either way.
CREATE OR REPLACE FUNCTION public.send_friend_request(target_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	target_id uuid;
	existing  record;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT id INTO target_id FROM public.profiles WHERE username = target_username;
	IF target_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_user');
	END IF;
	IF target_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF public.are_blocked(caller_id, target_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;

	SELECT * INTO existing FROM public.friendships
		WHERE (requester_id = caller_id AND receiver_id = target_id)
		   OR (requester_id = target_id AND receiver_id = caller_id);

	IF existing.requester_id IS NOT NULL THEN
		IF existing.status = 'accepted' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'already_friends');
		ELSIF existing.requester_id = target_id THEN
			UPDATE public.friendships SET status = 'accepted', updated_at = now()
				WHERE requester_id = target_id AND receiver_id = caller_id;
			RETURN jsonb_build_object('ok', true, 'state', 'accepted');
		ELSE
			RETURN jsonb_build_object('ok', false, 'reason', 'pending');
		END IF;
	END IF;

	INSERT INTO public.friendships (requester_id, receiver_id)
		VALUES (caller_id, target_id);
	RETURN jsonb_build_object('ok', true, 'state', 'pending');
END;
$function$;

-- request_tickles: are_friends check is sufficient because block
-- tears down friendship. But add an explicit block guard for the
-- belt-and-suspenders case where a block races with an in-flight
-- request.
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
	IF public.are_blocked(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
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
