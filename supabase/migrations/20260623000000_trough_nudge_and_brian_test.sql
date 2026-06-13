-- Trough: (1) a "nudge your Sounder" RPC so an opener can ask friends to chip
-- in, and (2) un-own one shop item for Brian so the open-a-Trough flow (which
-- only shows for UNowned items, ItemPreviewModal:292) is testable on his
-- everything-unlocked account.

-- ── 1. Track the last nudge per drive so we can rate-limit ───────────────────
ALTER TABLE public.item_drives
	ADD COLUMN IF NOT EXISTS last_nudge_at timestamptz;

-- ── 2. nudge_trough(p_drive_id): opener asks their Sounder to chip in ────────
-- Drops a system_announcement into every accepted friend's WhileAway feed.
-- Opener-only, 6h cooldown per drive (so it can't spam the Sounder). Inline
-- INSERT (NOT send_system_announcement, which is admin-gated → would roll back
-- for non-admins; see 20260618/20260619).
CREATE OR REPLACE FUNCTION public.nudge_trough(p_drive_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	d         public.item_drives;
	op_name   text;
	item_name text;
	fr        record;
	sent      int := 0;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO d FROM public.item_drives WHERE id = p_drive_id FOR UPDATE;
	IF d.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_drive');
	END IF;
	IF d.opener_user_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_opener');
	END IF;
	IF d.status <> 'open' OR d.closes_at <= now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'drive_closed');
	END IF;
	IF d.last_nudge_at IS NOT NULL AND d.last_nudge_at > now() - interval '6 hours' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'nudge_cooldown',
			'next_at', d.last_nudge_at + interval '6 hours');
	END IF;

	SELECT username INTO op_name FROM public.profiles WHERE id = caller_id;
	SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;

	FOR fr IN
		SELECT CASE WHEN requester_id = caller_id THEN receiver_id ELSE requester_id END AS fid
		FROM public.friendships
		WHERE status = 'accepted'
		  AND (requester_id = caller_id OR receiver_id = caller_id)
	LOOP
		-- Don't nudge someone a block exists with, in either direction.
		IF public.are_blocked(caller_id, fr.fid) THEN CONTINUE; END IF;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			fr.fid, 'trough_nudge',
			COALESCE(op_name, 'A friend') || ' needs your help! 🐽',
			COALESCE(op_name, 'A friend') || ' is filling a Trough for the '
				|| COALESCE(item_name, 'item') || ' — chip in to help land it!',
			jsonb_build_object('drive_id', p_drive_id));
		sent := sent + 1;
	END LOOP;

	UPDATE public.item_drives SET last_nudge_at = now() WHERE id = p_drive_id;

	RETURN jsonb_build_object('ok', true, 'sent', sent);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.nudge_trough(uuid) TO authenticated;

-- ── 3. Un-own Cowboy Hat for Brian so the Trough open-flow is testable ───────
-- Brian's account has every item (20260515_unlock_all_for_brian), so the
-- "…or open a Trough" link (only shown for UNowned, cost>0 items) never appears.
-- Remove one recognizable mid-tier hat; Brian can then open a Trough for it,
-- have a test-friend account chip in, and exercise fund → claim end to end.
-- (He re-earns it when the Trough funds — which is the point.)
DELETE FROM public.user_hats
WHERE hat_id = 'cowboy'
  AND user_id = (SELECT id FROM public.profiles WHERE username = 'Brian');
