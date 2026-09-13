-- Preset-only Sounder messages.
--
-- Coordination is server-authoritative and deliberately in-app only: these
-- RPCs never call send_push_to_user. A send creates one durable message plus a
-- recipient ledger row for each eligible crewmate. The ledger's shown_at is
-- set only when the next-activation digest is dismissed; the message itself is
-- retained for the notification board.

CREATE TABLE IF NOT EXISTS public.sounder_messages (
	id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	crew_id         uuid        REFERENCES public.crews(id) ON DELETE SET NULL,
	crew_name       text        NOT NULL,
	sender_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	preset          text        NOT NULL,
	body            text        NOT NULL,
	feeding_number  bigint,
	invite_id       uuid        REFERENCES public.crew_invites(id) ON DELETE SET NULL,
	created_at      timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT sounder_messages_preset_known CHECK (
		preset IN (
			'recruiting',
			'patch_open',
			'feeding_waiting',
			'one_more_bonus',
			'fine_digging'
		)
	),
	CONSTRAINT sounder_messages_exact_copy CHECK (
		body = CASE preset
			WHEN 'recruiting' THEN 'We saved you a place in our Sounder.'
			WHEN 'patch_open' THEN 'The Truffle Patch is open—come dig!'
			WHEN 'feeding_waiting' THEN 'Dig when you can; the Feeding is waiting.'
			WHEN 'one_more_bonus' THEN 'One more pig can unlock our Sounder Bonus.'
			WHEN 'fine_digging' THEN 'Fine digging, Sounder!'
		END
	),
	CONSTRAINT sounder_messages_scope_shape CHECK (
		(preset = 'recruiting' AND feeding_number IS NULL)
		OR
		(preset <> 'recruiting' AND feeding_number IS NOT NULL AND invite_id IS NULL)
	)
);

-- A real pending invitation may emit its recruiting note at most once.
CREATE UNIQUE INDEX IF NOT EXISTS sounder_messages_one_recruit_per_invite_idx
	ON public.sounder_messages (invite_id)
	WHERE preset = 'recruiting' AND invite_id IS NOT NULL;

-- A Sounder gets one use of each coordination preset per Feeding, regardless
-- of which member sent it. This is the concurrency-safe rate-limit backstop.
CREATE UNIQUE INDEX IF NOT EXISTS sounder_messages_one_preset_per_feeding_idx
	ON public.sounder_messages (crew_id, feeding_number, preset)
	WHERE preset <> 'recruiting';

CREATE INDEX IF NOT EXISTS sounder_messages_created_idx
	ON public.sounder_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS public.sounder_message_recipients (
	message_id  uuid        NOT NULL REFERENCES public.sounder_messages(id) ON DELETE CASCADE,
	recipient_id uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	delivered_at timestamptz NOT NULL DEFAULT now(),
	shown_at     timestamptz,
	PRIMARY KEY (message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS sounder_message_recipients_unshown_idx
	ON public.sounder_message_recipients (recipient_id, delivered_at DESC)
	WHERE shown_at IS NULL;

ALTER TABLE public.sounder_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sounder_message_recipients ENABLE ROW LEVEL SECURITY;

-- Zero direct-table policies or grants. Reads and writes are RPC-only so the
-- two-table recipient check cannot become mutually-recursive RLS, and clients
-- cannot bypass the RPCs' membership/block filters.
REVOKE ALL ON TABLE public.sounder_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sounder_message_recipients FROM PUBLIC, anon, authenticated;

-- State for the sender sheet. The client uses this to explain disabled options;
-- send_sounder_coordination repeats every check under the same server clock.
CREATE OR REPLACE FUNCTION public.sounder_message_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew uuid;
	clock record;
	member_count int := 0;
	dug_count int := 0;
	sent text[] := ARRAY[]::text[];
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT cm.crew_id INTO my_crew
	FROM public.crew_members cm
	JOIN public.crews c ON c.id = cm.crew_id AND c.is_bot = false
	WHERE cm.user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');
	END IF;

	SELECT * INTO clock FROM public._patch_clock(now());
	SELECT count(*)::int INTO member_count
	FROM public.crew_members WHERE crew_id = my_crew;
	SELECT count(*)::int INTO dug_count
	FROM public.war_rootings r
	JOIN public.crew_members cm
		ON cm.user_id = r.user_id AND cm.crew_id = my_crew
	WHERE r.window_index = clock.window_index
		AND r.submitted_at IS NOT NULL;
	SELECT COALESCE(array_agg(m.preset ORDER BY m.created_at), ARRAY[]::text[])
	INTO sent
	FROM public.sounder_messages m
	WHERE m.crew_id = my_crew
		AND m.feeding_number = clock.window_index
		AND m.preset <> 'recruiting';

	RETURN jsonb_build_object(
		'ok', true,
		'feeding_number', clock.window_index,
		'phase_open', clock.phase_open,
		'dug_count', dug_count,
		'member_count', member_count,
		'sent_presets', to_jsonb(sent),
		'available', jsonb_build_object(
			'patch_open', clock.phase_open,
			'feeding_waiting', clock.phase_open,
			'one_more_bonus', clock.phase_open AND dug_count = 1 AND member_count > 1,
			'fine_digging', dug_count > 0
		)
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_sounder_coordination(p_preset text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew uuid;
	my_crew_name text;
	clock record;
	member_count int := 0;
	dug_count int := 0;
	recipient_count int := 0;
	message_id uuid;
	message_body text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_preset IS NULL
		OR p_preset NOT IN ('patch_open', 'feeding_waiting', 'one_more_bonus', 'fine_digging')
	THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_preset');
	END IF;

	SELECT cm.crew_id, c.name INTO my_crew, my_crew_name
	FROM public.crew_members cm
	JOIN public.crews c ON c.id = cm.crew_id AND c.is_bot = false
	WHERE cm.user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');
	END IF;

	SELECT * INTO clock FROM public._patch_clock(now());
	SELECT count(*)::int INTO member_count
	FROM public.crew_members WHERE crew_id = my_crew;
	SELECT count(*)::int INTO dug_count
	FROM public.war_rootings r
	JOIN public.crew_members cm
		ON cm.user_id = r.user_id AND cm.crew_id = my_crew
	WHERE r.window_index = clock.window_index
		AND r.submitted_at IS NOT NULL;

	IF p_preset IN ('patch_open', 'feeding_waiting') AND NOT clock.phase_open THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'patch_closed');
	END IF;
	IF p_preset = 'one_more_bonus'
		AND NOT (clock.phase_open AND dug_count = 1 AND member_count > 1)
	THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bonus_condition_not_met');
	END IF;
	IF p_preset = 'fine_digging' AND dug_count = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_digs_yet');
	END IF;

	SELECT count(*)::int INTO recipient_count
	FROM public.crew_members cm
	WHERE cm.crew_id = my_crew
		AND cm.user_id <> caller_id
		AND NOT public.are_blocked(caller_id, cm.user_id);
	IF recipient_count = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_recipients');
	END IF;

	message_body := CASE p_preset
		WHEN 'patch_open' THEN 'The Truffle Patch is open—come dig!'
		WHEN 'feeding_waiting' THEN 'Dig when you can; the Feeding is waiting.'
		WHEN 'one_more_bonus' THEN 'One more pig can unlock our Sounder Bonus.'
		WHEN 'fine_digging' THEN 'Fine digging, Sounder!'
	END;

	INSERT INTO public.sounder_messages (
		crew_id, crew_name, sender_id, preset, body, feeding_number
	)
	VALUES (
		my_crew, my_crew_name, caller_id, p_preset, message_body, clock.window_index
	)
	ON CONFLICT DO NOTHING
	RETURNING id INTO message_id;
	IF message_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_sent');
	END IF;

	INSERT INTO public.sounder_message_recipients (message_id, recipient_id)
	SELECT message_id, cm.user_id
	FROM public.crew_members cm
	WHERE cm.crew_id = my_crew
		AND cm.user_id <> caller_id
		AND NOT public.are_blocked(caller_id, cm.user_id)
	ON CONFLICT DO NOTHING;

	RETURN jsonb_build_object(
		'ok', true,
		'id', message_id,
		'recipients', recipient_count,
		'feeding_number', clock.window_index
	);
END;
$function$;

-- Leader-only recruiting wrapper. The real invitation and its message are one
-- transaction. invite_to_crew remains the source of truth for capacity,
-- cooldown, self, and block checks; a failed invite can never emit a message.
CREATE OR REPLACE FUNCTION public.invite_to_crew_with_recruiting(p_invitee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew uuid;
	my_crew_name text;
	invite_result jsonb;
	pending_invite uuid;
	message_id uuid;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT c.id, c.name INTO my_crew, my_crew_name
	FROM public.crews c
	WHERE c.leader_id = caller_id AND c.is_bot = false;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'leader_only');
	END IF;

	invite_result := public.invite_to_crew(p_invitee);
	IF COALESCE((invite_result->>'ok')::boolean, false) IS NOT TRUE THEN
		RETURN invite_result;
	END IF;

	SELECT ci.id INTO pending_invite
	FROM public.crew_invites ci
	WHERE ci.crew_id = my_crew
		AND ci.inviter_id = caller_id
		AND ci.invitee_id = p_invitee
		AND ci.status = 'pending'
	ORDER BY ci.created_at DESC
	LIMIT 1;
	IF pending_invite IS NULL THEN
		RAISE EXCEPTION 'invite_created_without_pending_row';
	END IF;

	-- invite_to_crew's legacy generic in-app announcement would duplicate this
	-- purpose-built digest entry. Remove only the row the nested call just made.
	DELETE FROM public.system_announcements
	WHERE id = (
		SELECT a.id
		FROM public.system_announcements a
		WHERE a.user_id = p_invitee
			AND a.kind = 'crew_invite'
			AND a.data->>'crew_id' = my_crew::text
			-- Only the nested invite_to_crew call's row belongs to this
			-- transaction, regardless of whether an older schema used uuid or
			-- bigint announcement ids.
			AND a.xmin = pg_current_xact_id()::text::xid
		ORDER BY a.id DESC
		LIMIT 1
	);

	INSERT INTO public.sounder_messages (
		crew_id, crew_name, sender_id, preset, body, invite_id
	)
	VALUES (
		my_crew,
		my_crew_name,
		caller_id,
		'recruiting',
		'We saved you a place in our Sounder.',
		pending_invite
	)
	ON CONFLICT DO NOTHING
	RETURNING id INTO message_id;
	IF message_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_sent');
	END IF;

	INSERT INTO public.sounder_message_recipients (message_id, recipient_id)
	VALUES (message_id, p_invitee)
	ON CONFLICT DO NOTHING;

	RETURN jsonb_build_object(
		'ok', true,
		'invite_id', pending_invite,
		'message_id', message_id
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_sounder_messages(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
	FROM (
		SELECT
			m.id,
			m.preset,
			m.body,
			m.crew_name,
			m.sender_id,
			p.username AS sender_username,
			m.feeding_number,
			m.invite_id,
			m.created_at,
			r.shown_at
		FROM public.sounder_message_recipients r
		JOIN public.sounder_messages m ON m.id = r.message_id
		LEFT JOIN public.profiles p ON p.id = m.sender_id
		WHERE r.recipient_id = auth.uid()
			AND NOT public.are_blocked(m.sender_id, r.recipient_id)
		ORDER BY m.created_at DESC
		LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100)
	) q;
$function$;

CREATE OR REPLACE FUNCTION public.my_unshown_sounder_messages(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
	FROM (
		SELECT
			m.id,
			m.preset,
			m.body,
			m.crew_name,
			m.sender_id,
			p.username AS sender_username,
			m.created_at
		FROM public.sounder_message_recipients r
		JOIN public.sounder_messages m ON m.id = r.message_id
		LEFT JOIN public.profiles p ON p.id = m.sender_id
		WHERE r.recipient_id = auth.uid()
			AND r.shown_at IS NULL
			AND NOT public.are_blocked(m.sender_id, r.recipient_id)
		ORDER BY m.created_at DESC
		LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20)
	) q;
$function$;

CREATE OR REPLACE FUNCTION public.mark_sounder_messages_shown(p_message_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	changed int;
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	UPDATE public.sounder_message_recipients
	SET shown_at = COALESCE(shown_at, now())
	WHERE recipient_id = auth.uid()
		AND message_id = ANY(COALESCE(p_message_ids, ARRAY[]::uuid[]))
		AND shown_at IS NULL;
	GET DIAGNOSTICS changed = ROW_COUNT;
	RETURN jsonb_build_object('ok', true, 'shown', changed);
END;
$function$;

REVOKE ALL ON FUNCTION public.sounder_message_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_sounder_coordination(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_to_crew_with_recruiting(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_sounder_messages(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_unshown_sounder_messages(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_sounder_messages_shown(uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sounder_message_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_sounder_coordination(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_to_crew_with_recruiting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_sounder_messages(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_unshown_sounder_messages(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_sounder_messages_shown(uuid[]) TO authenticated;
