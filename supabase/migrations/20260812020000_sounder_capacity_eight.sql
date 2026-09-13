-- Raise the real-player Sounder capacity from four pigs to eight.
--
-- Capacity is enforced in several layers: the INSERT trigger is the final
-- concurrency-safe backstop; invites and knocks reserve or consume seats with
-- friendly reason envelopes; discovery hides full Sounders. Carry the newest
-- definitions of every capacity-sensitive function so newer poaching,
-- anti-pester, and knock-on-the-door behavior remains intact.

-- Final INSERT backstop (latest definition: 20260707000000).
CREATE OR REPLACE FUNCTION public.enforce_crew_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
	bot boolean;
	cnt int;
BEGIN
	-- Locking the crew row serializes simultaneous joins to the same Sounder.
	SELECT is_bot INTO bot FROM public.crews WHERE id = NEW.crew_id FOR UPDATE;
	IF COALESCE(bot, false) THEN RETURN NEW; END IF;
	SELECT count(*) INTO cnt FROM public.crew_members WHERE crew_id = NEW.crew_id;
	IF cnt >= 8 THEN RAISE EXCEPTION 'crew_full'; END IF;
	RETURN NEW;
END;
$function$;

-- Invite anyone / poaching flow (latest definition: 20260801000000).
CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	seat_count   int;
	is_leader    boolean;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name, (c.leader_id = caller_id) INTO my_crew, crew_name, is_leader
		FROM public.crew_members mm
		JOIN public.crews c ON c.id = mm.crew_id AND c.is_bot = false
		WHERE mm.user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	IF public.are_blocked(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;
	IF NOT public.are_friends(caller_id, p_invitee) AND NOT is_leader THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee
	             AND status = 'declined' AND updated_at > now() - interval '24 hours') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'recently_declined');
	END IF;
	-- Pending outgoing invites reserve seats.
	seat_count := (SELECT count(*) FROM public.crew_members WHERE crew_id = my_crew)
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = my_crew AND status = 'pending');
	IF seat_count >= 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
	END IF;
	INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id) VALUES (my_crew, caller_id, p_invitee);
	BEGIN
		SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_invitee, 'crew_invite', 'Sounder invite',
			COALESCE(caller_name, 'Someone') || ' invited you to join ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	inv          record;
	member_count int;
	old_crew     uuid;
	old_name     text;
	am_leader    boolean;
	remaining    int;
	next_leader  uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO inv FROM public.crew_invites WHERE id = p_invite FOR UPDATE;
	IF inv.id IS NULL OR inv.invitee_id <> caller_id OR inv.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
	END IF;
	-- The pending invite already reserved this seat, so count members only.
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = inv.crew_id;
	IF member_count >= 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;

	SELECT cm.crew_id, c.name, (c.leader_id = caller_id)
		INTO old_crew, old_name, am_leader
		FROM public.crew_members cm JOIN public.crews c ON c.id = cm.crew_id
		WHERE cm.user_id = caller_id;
	IF old_crew IS NOT NULL THEN
		IF old_crew = inv.crew_id THEN
			UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
			RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
		END IF;
		DELETE FROM public.crew_members WHERE crew_id = old_crew AND user_id = caller_id;
		SELECT count(*) INTO remaining FROM public.crew_members WHERE crew_id = old_crew;
		IF remaining = 0 THEN
			DELETE FROM public.crews WHERE id = old_crew;
		ELSIF am_leader THEN
			SELECT user_id INTO next_leader FROM public.crew_members
				WHERE crew_id = old_crew ORDER BY joined_at ASC LIMIT 1;
			UPDATE public.crews SET leader_id = next_leader WHERE id = old_crew;
			UPDATE public.crew_members SET role = 'leader'
				WHERE crew_id = old_crew AND user_id = next_leader;
		END IF;
		BEGIN
			IF remaining > 0 THEN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				SELECT c.leader_id, 'crew_left', 'A snout answered another banner',
					'A rider left ' || old_name || ' to join another Sounder.',
					jsonb_build_object('crew_id', old_crew)
				FROM public.crews c WHERE c.id = old_crew;
			END IF;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (inv.crew_id, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending' AND id <> p_invite;
	RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
END;
$function$;

-- Knock-on-the-door flow (latest definitions: 20260742000000).
CREATE OR REPLACE FUNCTION public.request_to_join(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	seat_count   int;
	my_asks      int;
	new_id       uuid;
	asker_name   text;
	m            record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	seat_count := member_count
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = p_crew AND status = 'pending');
	IF seat_count >= 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_join_requests
	           WHERE crew_id = p_crew AND requester_id = caller_id AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_asked');
	END IF;
	SELECT count(*) INTO my_asks FROM public.crew_join_requests
		WHERE requester_id = caller_id AND status = 'pending';
	IF my_asks >= 3 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_asks'); END IF;

	INSERT INTO public.crew_join_requests (crew_id, requester_id)
		VALUES (p_crew, caller_id) RETURNING id INTO new_id;
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = caller_id;
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = p_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'crew_knock', 'A knock at the banner',
				COALESCE(asker_name, 'A pig') || ' wants to dig with ' || target.name || '.',
				jsonb_build_object('crew_id', p_crew, 'request_id', new_id));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_join_request(p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	req          record;
	crew_name    text;
	crew_leader  uuid;
	seat_count   int;
	asker_name   text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO req FROM public.crew_join_requests WHERE id = p_request FOR UPDATE;
	IF req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF NOT public.is_crew_member(req.crew_id, caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_your_crew');
	END IF;
	IF req.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = req.requester_id) THEN
		UPDATE public.crew_join_requests SET status = 'cancelled' WHERE id = p_request;
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT (SELECT count(*) FROM public.crew_members WHERE crew_id = req.crew_id)
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = req.crew_id AND status = 'pending')
		INTO seat_count;
	IF seat_count >= 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;

	SELECT name, leader_id INTO crew_name, crew_leader FROM public.crews WHERE id = req.crew_id;
	INSERT INTO public.crew_members (crew_id, user_id, role)
		VALUES (req.crew_id, req.requester_id, 'member');
	UPDATE public.crew_join_requests SET status = 'accepted' WHERE id = p_request;
	UPDATE public.crew_join_requests SET status = 'declined'
		WHERE requester_id = req.requester_id AND status = 'pending' AND id <> p_request;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = req.requester_id AND status = 'pending';
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = req.requester_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (req.requester_id, 'crew_join', 'A new snout',
			'the banner opened — you''re in ' || crew_name || '.',
			jsonb_build_object('crew_id', req.crew_id));
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (crew_leader, 'crew_join', 'A new snout',
			COALESCE(asker_name, 'A pig') || ' joined ' || crew_name || '.',
			jsonb_build_object('crew_id', req.crew_id));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'crew_id', req.crew_id);
END;
$function$;

-- Transitional old-client shim: joining still creates a knock.
CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	seat_count   int;
	new_id       uuid;
	asker_name   text;
	m            record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	seat_count := member_count
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = p_crew AND status = 'pending');
	IF seat_count >= 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_join_requests
	           WHERE crew_id = p_crew AND requester_id = caller_id AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', true, 'requested', true);
	END IF;

	INSERT INTO public.crew_join_requests (crew_id, requester_id)
		VALUES (p_crew, caller_id) RETURNING id INTO new_id;
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = caller_id;
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = p_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'crew_knock', 'A knock at the banner',
				COALESCE(asker_name, 'A pig') || ' wants to dig with ' || target.name || '.',
				jsonb_build_object('crew_id', p_crew, 'request_id', new_id));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'requested', true);
END;
$function$;

-- Discovery shows nonempty Sounders with at least one real seat left.
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
	) j
	WHERE j.member_count BETWEEN 1 AND 7;
$function$;

REVOKE ALL ON FUNCTION public.invite_to_crew(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_crew_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_to_join(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_join_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_crew(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_joinable_crews() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.invite_to_crew(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_crew_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_to_join(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_crew(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_joinable_crews() TO authenticated;
