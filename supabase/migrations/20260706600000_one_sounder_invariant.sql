-- ════════════════════════════════════════════════════════════════════════
-- One Sounder at a time — for sure.
--
-- The invariant already holds structurally (crew_members_one_per_user
-- unique index; already_in_crew checks in join_crew / accept_crew_invite /
-- create_crew). The remaining leak was hygiene: FOUNDING a crew left the
-- caller's incoming invites pending forever, so the UI kept showing
-- actionable "Join" buttons that could only fail. join_crew and
-- accept_crew_invite already moot the joiner's other pending invites —
-- create_crew now does the same.
--
-- Carried: create_crew ← 20260647 (only prior def); ONE addition marked.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_crew(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	clean_name text := btrim(COALESCE(p_name, ''));
	new_id     uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF char_length(clean_name) < 1 OR char_length(clean_name) > 24 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_name');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	INSERT INTO public.crews (name, leader_id, is_bot) VALUES (clean_name, caller_id, false)
		RETURNING id INTO new_id;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (new_id, caller_id, 'leader');
	-- CARRY DIFF: founding moots the founder's pending invites (mirrors
	-- accept_crew_invite / join_crew) — one Sounder at a time, no stale asks.
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	RETURN jsonb_build_object('ok', true, 'crew_id', new_id);
END;
$function$;
