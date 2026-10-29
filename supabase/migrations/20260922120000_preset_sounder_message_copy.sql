-- Preset Sounder message copy: the em dash leaves the copy (2026-09-22 slop
-- tells audit, docs/design/audit-2026-09-22-slop-tells.md). The patch_open
-- preset body lives in three places on the server — the exact-copy CHECK on
-- sounder_messages, the rows already sent, and send_sounder_coordination(),
-- which derives it — so all three move together. The function is carried
-- forward IN FULL from 20260826040000_preset_sounder_messages.sql (its latest
-- definition; nothing redefined it since) with only the one string changed.
-- The client mirror is utils/sounderMessages.ts; __tests__/sounderMessages.test.ts
-- pins the two to this file.

ALTER TABLE public.sounder_messages
	DROP CONSTRAINT IF EXISTS sounder_messages_exact_copy;

UPDATE public.sounder_messages
	SET body = 'The Truffle Patch is open. Come dig!'
	WHERE preset = 'patch_open'
	  AND body <> 'The Truffle Patch is open. Come dig!';

ALTER TABLE public.sounder_messages
	ADD CONSTRAINT sounder_messages_exact_copy CHECK (
		body = CASE preset
			WHEN 'recruiting' THEN 'We saved you a place in our Sounder.'
			WHEN 'patch_open' THEN 'The Truffle Patch is open. Come dig!'
			WHEN 'feeding_waiting' THEN 'Dig when you can; the Feeding is waiting.'
			WHEN 'one_more_bonus' THEN 'One more pig can unlock our Sounder Bonus.'
			WHEN 'fine_digging' THEN 'Fine digging, Sounder!'
		END
	);

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
		WHEN 'patch_open' THEN 'The Truffle Patch is open. Come dig!'
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

REVOKE ALL ON FUNCTION public.send_sounder_coordination(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_sounder_coordination(text) TO authenticated;
