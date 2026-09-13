-- Preset Sounder messages: permissions, exact copy, moderation, state gates,
-- per-Feeding dedupe, invite binding, digest shown state, and durable history.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid
$$;

DO $smoke_sounder_messages$
DECLARE
	leader_id uuid := '00000000-0000-0000-0000-000000068001';
	member_id uuid := '00000000-0000-0000-0000-000000068002';
	blocked_member_id uuid := '00000000-0000-0000-0000-000000068003';
	v_invitee_id uuid := '00000000-0000-0000-0000-000000068004';
	v_blocked_invitee_id uuid := '00000000-0000-0000-0000-000000068005';
	crew_id uuid := '00000000-0000-0000-0000-000000068010';
	res jsonb;
	v_message_id uuid;
	v_invite_id uuid;
	row_count int;
BEGIN
	INSERT INTO auth.users (id) VALUES
		(leader_id), (member_id), (blocked_member_id), (v_invitee_id), (v_blocked_invitee_id)
	ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		(leader_id, 'sounder-leader'),
		(member_id, 'sounder-member'),
		(blocked_member_id, 'sounder-blocked-member'),
		(v_invitee_id, 'sounder-invitee'),
		(v_blocked_invitee_id, 'sounder-blocked-invitee')
	ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
	INSERT INTO public.crews (id, name, leader_id, is_bot)
	VALUES (crew_id, 'Smoke Snouts', leader_id, false)
	ON CONFLICT (id) DO UPDATE SET leader_id = EXCLUDED.leader_id;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
		(crew_id, leader_id, 'leader'),
		(crew_id, member_id, 'member'),
		(crew_id, blocked_member_id, 'member')
	ON CONFLICT DO NOTHING;
	INSERT INTO public.user_blocks (blocker_id, blocked_id)
	VALUES (leader_id, blocked_member_id)
	ON CONFLICT DO NOTHING;

	-- Any member may coordinate, but a sender's block relationships prune the
	-- recipient set. The exact preset body is server-owned.
	PERFORM set_config('smoke.uid', leader_id::text, true);
	res := public.send_sounder_coordination('patch_open');
	IF NOT (res->>'ok')::boolean OR (res->>'recipients')::int <> 1 THEN
		RAISE EXCEPTION 'sounder messages: coordination send failed: %', res;
	END IF;
	v_message_id := (res->>'id')::uuid;
	IF NOT EXISTS (
		SELECT 1 FROM public.sounder_messages
		WHERE id = v_message_id
			AND body = 'The Truffle Patch is open—come dig!'
			AND feeding_number = 680001
	) THEN
		RAISE EXCEPTION 'sounder messages: exact patch-open copy/window missing';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.sounder_message_recipients
		WHERE sounder_message_recipients.message_id = v_message_id AND recipient_id = member_id
	) OR EXISTS (
		SELECT 1 FROM public.sounder_message_recipients
		WHERE sounder_message_recipients.message_id = v_message_id AND recipient_id = blocked_member_id
	) THEN
		RAISE EXCEPTION 'sounder messages: recipient scope/block filtering failed';
	END IF;

	res := public.send_sounder_coordination('patch_open');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_sent' THEN
		RAISE EXCEPTION 'sounder messages: duplicate Feeding preset accepted: %', res;
	END IF;

	-- The bonus wording is available only when exactly one current member has
	-- submitted in this Feeding.
	PERFORM set_config('smoke.uid', member_id::text, true);
	res := public.send_sounder_coordination('one_more_bonus');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bonus_condition_not_met' THEN
		RAISE EXCEPTION 'sounder messages: bonus state gate failed closed: %', res;
	END IF;
	INSERT INTO public.war_rootings (
		user_id, crew_id, window_index, seed, dig_day, opened_at, submitted_at
	) VALUES (
		leader_id, crew_id, 680001, 68001, date '2026-08-26', now(), now()
	)
	ON CONFLICT (user_id, window_index) DO UPDATE SET submitted_at = EXCLUDED.submitted_at;
	res := public.send_sounder_coordination('one_more_bonus');
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'sounder messages: true bonus state rejected: %', res;
	END IF;

	-- Dismissing the digest marks only the recipient ledger. The notification
	-- board history query still returns the durable message afterward.
	PERFORM set_config('smoke.uid', member_id::text, true);
	res := public.my_unshown_sounder_messages(20);
	IF jsonb_array_length(res) <> 1 OR res->0->>'id' <> v_message_id::text THEN
		RAISE EXCEPTION 'sounder messages: unshown digest read wrong: %', res;
	END IF;
	res := public.mark_sounder_messages_shown(ARRAY[v_message_id]);
	IF NOT (res->>'ok')::boolean OR (res->>'shown')::int <> 1 THEN
		RAISE EXCEPTION 'sounder messages: mark shown failed: %', res;
	END IF;
	IF jsonb_array_length(public.my_unshown_sounder_messages(20)) <> 0 THEN
		RAISE EXCEPTION 'sounder messages: dismissed row stayed in digest';
	END IF;
	res := public.my_sounder_messages(100);
	IF jsonb_array_length(res) < 1 OR res->0->>'id' <> v_message_id::text
		OR res->0->>'shown_at' IS NULL THEN
		RAISE EXCEPTION 'sounder messages: board history was not retained: %', res;
	END IF;

	-- Recruiting is leader-only and can happen only as part of a real invite.
	PERFORM set_config('smoke.uid', leader_id::text, true);
	res := public.invite_to_crew_with_recruiting(v_invitee_id);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'sounder messages: leader recruiting failed: %', res;
	END IF;
	v_invite_id := (res->>'invite_id')::uuid;
	IF NOT EXISTS (
		SELECT 1 FROM public.crew_invites
		WHERE id = v_invite_id AND crew_invites.invitee_id = v_invitee_id AND status = 'pending'
	) OR NOT EXISTS (
		SELECT 1 FROM public.sounder_messages
		WHERE sounder_messages.invite_id = v_invite_id
			AND preset = 'recruiting'
			AND body = 'We saved you a place in our Sounder.'
	) THEN
		RAISE EXCEPTION 'sounder messages: recruiting message not bound to invite';
	END IF;
	SELECT count(*)::int INTO row_count
	FROM public.sounder_messages WHERE sounder_messages.invite_id = v_invite_id;
	res := public.invite_to_crew_with_recruiting(v_invitee_id);
	IF (res->>'ok')::boolean OR res->>'reason' NOT IN ('already_invited', 'crew_full') THEN
		RAISE EXCEPTION 'sounder messages: duplicate pending invite accepted: %', res;
	END IF;
	IF (SELECT count(*) FROM public.sounder_messages WHERE sounder_messages.invite_id = v_invite_id) <> row_count THEN
		RAISE EXCEPTION 'sounder messages: pending invite emitted twice';
	END IF;

	PERFORM set_config('smoke.uid', member_id::text, true);
	res := public.invite_to_crew_with_recruiting(v_blocked_invitee_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'leader_only' THEN
		RAISE EXCEPTION 'sounder messages: nonleader recruiting accepted: %', res;
	END IF;
	PERFORM set_config('smoke.uid', leader_id::text, true);
	INSERT INTO public.user_blocks (blocker_id, blocked_id)
	VALUES (leader_id, v_blocked_invitee_id) ON CONFLICT DO NOTHING;
	res := public.invite_to_crew_with_recruiting(v_blocked_invitee_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'blocked' THEN
		RAISE EXCEPTION 'sounder messages: recruiting crossed a block: %', res;
	END IF;

	IF has_function_privilege('anon', 'public.send_sounder_coordination(text)', 'EXECUTE')
		OR has_function_privilege('anon', 'public.invite_to_crew_with_recruiting(uuid)', 'EXECUTE')
		OR has_function_privilege('anon', 'public.mark_sounder_messages_shown(uuid[])', 'EXECUTE') THEN
		RAISE EXCEPTION 'sounder messages: anon can execute a protected RPC';
	END IF;
	IF has_table_privilege('authenticated', 'public.sounder_messages', 'SELECT')
		OR has_table_privilege('authenticated', 'public.sounder_message_recipients', 'SELECT')
		OR has_table_privilege('authenticated', 'public.sounder_messages', 'INSERT')
		OR has_table_privilege('authenticated', 'public.sounder_message_recipients', 'UPDATE') THEN
		RAISE EXCEPTION 'sounder messages: client has direct table access';
	END IF;

	RAISE NOTICE 'chk sounder_messages: presets + scope + state + digest + history OK';
END;
$smoke_sounder_messages$;
