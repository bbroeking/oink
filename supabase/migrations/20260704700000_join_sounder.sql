-- ════════════════════════════════════════════════════════════════════════
-- Join-first Sounders.
--
-- A 5-cap crew game fragments if every pig founds their own banner — most
-- players should JOIN an existing Sounder, not create one. Two RPCs:
--
--   find_joinable_crews()  — open Sounders anyone can slip into: a real
--                            crew (not the bot), at least one member, a free
--                            slot, and not mid-war. Fullest-first so herds
--                            fill up instead of spreading thin.
--   join_crew(p_crew)      — invite-less join. Mirrors accept_crew_invite's
--                            membership INSERT (the crew_members_cap trigger
--                            stays the race backstop) and leave_crew's war
--                            gate for symmetry: you can't hop into (or out
--                            of) a Sounder while its war is live, so there's
--                            no mid-war payout hopping.
--
-- Deliberately NOT friend-gated (unlike invite_to_crew): joining a stranger's
-- Sounder is the point — the war introduces you. Discovery decision D7
-- (friend-gated → open) resolves toward open here.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.find_joinable_crews()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE(jsonb_agg(
		jsonb_build_object(
			'id', j.id, 'name', j.name,
			'memberCount', j.member_count,
			'leaderName', j.leader_name
		) ORDER BY j.member_count DESC, j.created_at ASC), '[]'::jsonb)
	FROM (
		SELECT c.id, c.name, c.created_at,
		       (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id) AS member_count,
		       (SELECT p.username FROM public.profiles p WHERE p.id = c.leader_id) AS leader_name
		FROM public.crews c
		WHERE c.is_bot = false
		  AND c.id <> COALESCE(
		        (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()),
		        '00000000-0000-0000-0000-000000000000'::uuid)
		  AND NOT EXISTS (SELECT 1 FROM public.mud_wars w
		        WHERE (w.challenger_crew = c.id OR w.defender_crew = c.id)
		          AND w.status IN ('pending', 'active'))
	) j
	WHERE j.member_count BETWEEN 1 AND 4;
$function$;

CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	joiner_name  text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	-- FOR UPDATE pairs with the cap trigger's crews-row lock: concurrent joins
	-- to the same crew serialize here instead of racing to the trigger error.
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false FOR UPDATE;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars w
	           WHERE (w.challenger_crew = p_crew OR w.defender_crew = p_crew)
	             AND w.status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'crew_in_war');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF member_count >= 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (p_crew, caller_id, 'member');
	-- Joining moots the joiner's other pending invites (mirrors accept_crew_invite).
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	-- Tell the leader a new snout arrived. Inline announce, savepoint-guarded
	-- (send_system_announcement is admin-gated and would roll the join back).
	BEGIN
		SELECT username INTO joiner_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (target.leader_id, 'crew_join', 'A new snout',
			COALESCE(joiner_name, 'A pig') || ' joined ' || target.name || '.',
			jsonb_build_object('crew_id', p_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'crew_id', p_crew);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_joinable_crews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_crew(uuid)       TO authenticated;
