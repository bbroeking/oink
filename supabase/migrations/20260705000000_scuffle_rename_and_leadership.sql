-- ════════════════════════════════════════════════════════════════════════
-- Mud SCUFFLES + leadership transfer.
--
-- Player-facing rename: "Mud Fight / Mud Wars" → "Mud Scuffle(s)". It's a
-- competition, not a battle — a collaborative joust where the team that
-- cooperates harder wins. Code identifiers (mud_wars tables, RPC names,
-- routes) deliberately stay technical; only player-visible words move.
-- Here that means the three mud-war title descriptions; everything else
-- is client copy.
--
-- transfer_crew_leadership: the leader hands the crown to another member.
-- (leave_crew already auto-succeeds when a leader walks; this is the
-- deliberate version.)
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.titles SET description = 'Won a Sounder Mud Scuffle.'
	WHERE id = 'mud_champion' AND description = 'Won a Sounder Mud Fight.';
UPDATE public.titles SET description = 'Won five Sounder Mud Scuffles.'
	WHERE id = 'mud_veteran' AND description = 'Won five Sounder Mud Fights.';
UPDATE public.titles SET description = 'Won twenty-five Sounder Mud Scuffles.'
	WHERE id = 'mud_legend' AND description = 'Won twenty-five Sounder Mud Fights.';

CREATE OR REPLACE FUNCTION public.transfer_crew_leadership(p_new_leader uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	crew_name   text;
	caller_name text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF caller_id = p_new_leader THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	-- FOR UPDATE so two concurrent transfers (or a transfer racing a leave)
	-- serialize on the crews row.
	SELECT c.id, c.name INTO my_crew, crew_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crew_members
	               WHERE crew_id = my_crew AND user_id = p_new_leader) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
	END IF;

	UPDATE public.crews SET leader_id = p_new_leader WHERE id = my_crew;
	UPDATE public.crew_members SET role = 'member' WHERE crew_id = my_crew AND user_id = caller_id;
	UPDATE public.crew_members SET role = 'leader' WHERE crew_id = my_crew AND user_id = p_new_leader;

	-- Tell the new leader. Inline announce, savepoint-guarded
	-- (send_system_announcement is admin-gated and would roll this back).
	BEGIN
		SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_new_leader, 'crew_leader', 'You lead the Sounder',
			COALESCE(caller_name, 'The old leader') || ' handed you the crown of ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_crew_leadership(uuid) TO authenticated;
