-- Disband a crew — the leader tears the whole Sounder down.
-- HELD FOR REVIEW; push only on go.
--
-- WHY: leave_crew (self-exit, auto-succeeds leadership), kick_crew_member
-- (20260705100000) and transfer_crew_leadership already exist, but a leader had
-- no deliberate way to dissolve the crew entirely. This adds it: every member
-- returns to the uncrewed pool and the crew row is deleted. Requested 2026-07-06.
--
-- Mirrors kick_crew_member's conventions: FOR UPDATE on the crews row, an in_war
-- guard (rosters can't shift under a live scuffle), and a gentle inline
-- system_announcement (savepoint-guarded; hard rule — user RPCs must INLINE the
-- INSERT, never call send_system_announcement). crew_members / crew_invites FK
-- ON DELETE CASCADE from crews, so deleting the crew cleans up invites.

CREATE OR REPLACE FUNCTION public.disband_crew()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	crew_name text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	-- Rosters can't shift under a live scuffle (mirrors kick_crew_member/leave_crew).
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'in_war');
	END IF;

	-- Tell every OTHER member, gently. Inline set-based announce, savepoint-guarded.
	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		SELECT cm.user_id, 'crew_disband', 'The Sounder scatters',
			crew_name || ' has been disbanded. No mud lost — the bog is full of banners.',
			jsonb_build_object('crew_id', my_crew)
		FROM public.crew_members cm
		WHERE cm.crew_id = my_crew AND cm.user_id <> caller_id;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	DELETE FROM public.crew_members WHERE crew_id = my_crew;
	DELETE FROM public.crews WHERE id = my_crew;  -- cascades crew_invites

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.disband_crew() TO authenticated;
