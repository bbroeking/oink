-- Trough nudge: SUPERSEDE before insert (spec 04 / issue #10, part A).
--
-- 20260623000000 defined nudge_trough to INSERT one trough_nudge
-- system_announcement per accepted friend, gated only by a 6h per-drive
-- cooldown (last_nudge_at). Unseen identical nudges for the SAME drive pile
-- up and drip through the While-Away LIMIT 20 — a Monday sign-in surfaced
-- 8-16 identical "needs your help!" rows.
--
-- Fix: mark any still-UNSEEN trough_nudge rows for this drive as seen before
-- inserting the fresh batch, so the newest nudge replaces the stale ones
-- instead of stacking. Reconciles with the server-side seen tracking
-- (mark_announcement_seen sets seen_at) — supersede touches UNSEEN rows only,
-- so a nudge the player already dismissed is never resurrected or double-counted.
--
-- Carries the LATEST nudge_trough definition (20260623000000 — 20260626 only
-- MENTIONS it in a comment, 20260662 strips emoji via a trigger and explicitly
-- does NOT redefine the body). Signature is kept EXACTLY p_drive_id (deployed
-- builds call nudge_trough(uuid)). INSERT stays inlined — never
-- send_system_announcement(), which raises admin_only for non-admins →
-- silent rollback (see CLAUDE.md memory / 20260618/20260619).
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

	-- ── Supersede: retire the previous UNSEEN batch for THIS drive ───────────
	-- One row per drive per recipient survives — the fresh insert below. Unseen
	-- only, so a dismissed nudge (seen_at set by mark_announcement_seen) is left
	-- alone. Covers ex-friends too (recipients no longer in the loop below).
	UPDATE public.system_announcements
	SET seen_at = now()
	WHERE kind = 'trough_nudge'
	  AND seen_at IS NULL
	  AND data->>'drive_id' = p_drive_id::text;

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
