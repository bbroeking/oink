-- ════════════════════════════════════════════════════════════════════════
-- Sounder Spirit — the crew ranking that measures what we actually want
-- crews to be: ACTIVE in the war and KIND to each other. Complements (does
-- not replace) the war-elo crew_ratings, which stays the matchmaking signal.
--
--   friends_crews()       — which Sounder each of the caller's friends is
--                           in. Powers the friends-list crew chip and the
--                           invite picker's "already in a Sounder" state.
--   invite_to_crew()      — relaxed from leader-only to ANY crew member
--                           (carried verbatim from 20260647 otherwise).
--                           Join-first Sounders made the leader gate a
--                           bottleneck: every snout should be able to
--                           rally friends. Reason 'not_leader' → 'no_crew'.
--   sounder_standings()   — the spirit leaderboard. Per crew, over the
--                           last 7 days:
--                             kindness  = intra-crew warmth (both parties
--                                         crewmates): blessings ×3,
--                                         fulfilled trades ×2, barn
--                                         visits ×1
--                             activity  = war effort: mud-sling points ×1,
--                                         submitted truffle digs ×3
--                             spirit    = (kindness + activity) per snout
--                           Per-snout so a duo can out-spirit a lazy five;
--                           kindness is pairwise so it only counts inside
--                           the herd.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.friends_crews()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'friend_id', f.fid,
		'crew_id',   c.id,
		'crew_name', c.name,
		'memberCount', (SELECT count(*) FROM public.crew_members mc WHERE mc.crew_id = c.id)
	)), '[]'::jsonb)
	FROM (
		SELECT CASE WHEN requester_id = auth.uid() THEN receiver_id ELSE requester_id END AS fid
		FROM public.friendships
		WHERE status = 'accepted'
		  AND (requester_id = auth.uid() OR receiver_id = auth.uid())
	) f
	JOIN public.crew_members m ON m.user_id = f.fid
	JOIN public.crews c ON c.id = m.crew_id AND c.is_bot = false;
$function$;

-- Any member can invite now, not just the leader. Carried from 20260647
-- (the only prior definition); the ONLY changes are the caller-crew lookup
-- and the corresponding reason string.
CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	member_count int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name
		FROM public.crew_members mm
		JOIN public.crews c ON c.id = mm.crew_id AND c.is_bot = false
		WHERE mm.user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	IF NOT public.are_friends(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = my_crew;
	IF member_count >= 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invitee_in_crew');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
	END IF;
	INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id) VALUES (my_crew, caller_id, p_invitee);
	-- Inline announce, savepoint-guarded.
	BEGIN
		SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_invitee, 'crew_invite', 'Sounder invite',
			COALESCE(caller_name, 'A friend') || ' invited you to join ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sounder_standings(p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	WITH crew_stats AS (
		SELECT c.id, c.name,
			(SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id) AS member_count,
			(
				(SELECT count(*) * 3 FROM public.blessings b
				  WHERE b.sent_at > now() - interval '7 days'
				    AND EXISTS (SELECT 1 FROM public.crew_members x
				                WHERE x.crew_id = c.id AND x.user_id = b.sender_id)
				    AND EXISTS (SELECT 1 FROM public.crew_members y
				                WHERE y.crew_id = c.id AND y.user_id = b.receiver_id))
				+
				(SELECT count(*) * 2 FROM public.tickle_trades tt
				  WHERE tt.status = 'fulfilled' AND tt.fulfilled_at > now() - interval '7 days'
				    AND EXISTS (SELECT 1 FROM public.crew_members x
				                WHERE x.crew_id = c.id AND x.user_id = tt.requester_id)
				    AND EXISTS (SELECT 1 FROM public.crew_members y
				                WHERE y.crew_id = c.id AND y.user_id = tt.target_id))
				+
				(SELECT count(*) FROM public.barn_visits v
				  WHERE v.created_at > now() - interval '7 days'
				    AND EXISTS (SELECT 1 FROM public.crew_members x
				                WHERE x.crew_id = c.id AND x.user_id = v.visitor_id)
				    AND EXISTS (SELECT 1 FROM public.crew_members y
				                WHERE y.crew_id = c.id AND y.user_id = v.target_id))
			) AS kindness,
			(
				COALESCE((SELECT sum(s.slings) FROM public.mud_slings s
				  WHERE s.crew_id = c.id AND s.created_at > now() - interval '7 days'), 0)
				+
				(SELECT count(*) * 3 FROM public.war_rootings r
				  WHERE r.crew_id = c.id AND r.submitted_at IS NOT NULL
				    AND r.opened_at > now() - interval '7 days')
			) AS activity
		FROM public.crews c
		WHERE c.is_bot = false
	)
	SELECT COALESCE(jsonb_agg(q.j ORDER BY q.spirit DESC, q.kindness DESC, q.nm ASC), '[]'::jsonb)
	FROM (
		SELECT jsonb_build_object(
			'crew_id', s.id, 'name', s.name, 'memberCount', s.member_count,
			'kindness', s.kindness, 'activity', s.activity,
			'spirit', round((s.kindness + s.activity)::numeric / GREATEST(1, s.member_count)),
			'rating', r.rating,
			'wars', r.wars_played,
			-- Roster for the expandable leaderboard rows — leader first.
			'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
					'username', p.username, 'role', m.role)
					ORDER BY m.role ASC, p.username ASC), '[]'::jsonb)
				FROM public.crew_members m
				JOIN public.profiles p ON p.id = m.user_id
				WHERE m.crew_id = s.id)
		) AS j,
		round((s.kindness + s.activity)::numeric / GREATEST(1, s.member_count)) AS spirit,
		s.kindness AS kindness, s.name AS nm
		FROM crew_stats s
		LEFT JOIN public.crew_ratings r ON r.crew_id = s.id
		WHERE s.member_count > 0
		ORDER BY spirit DESC, kindness DESC, nm ASC
		LIMIT GREATEST(1, LEAST(200, p_limit))
	) q;
$function$;

GRANT EXECUTE ON FUNCTION public.friends_crews()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sounder_standings(int) TO authenticated;
