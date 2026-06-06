-- Fix: tickle_at_barn + dig_truffle called send_system_announcement(), which is
-- admin-gated (raises 'admin_only' unless caller.is_test). So for normal users
-- the notification call aborted the whole RPC — the visit/dig would fail. (It
-- only "worked" in testing because the test user was an admin/owner.)
--
-- Fix: these are SECURITY DEFINER, so insert the announcement row DIRECTLY into
-- system_announcements (seen_at NULL → surfaces in the while-away modal),
-- bypassing the admin wrapper. Best-effort push is dropped (push isn't wired
-- yet anyway — missing aps-environment entitlement).

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	cooldown     constant interval := '1 hour';
	reward       constant int := 3;
	daily_budget constant int := 5;
	todays_visits int;
	last_at      timestamptz;
	visitor_name text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_target');
	END IF;

	SELECT count(*) INTO todays_visits
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());
	IF todays_visits >= daily_budget THEN
		RETURN jsonb_build_object('ok', false, 'error', 'budget', 'budget', daily_budget);
	END IF;

	SELECT max(created_at) INTO last_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;
	IF last_at IS NOT NULL AND last_at > now() - cooldown THEN
		RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'next_at', last_at + cooldown);
	END IF;

	PERFORM public.grant_tickles(p_target, reward);
	PERFORM public.shift_alignment(caller_id, 1);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, reward);

	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_target, 'barn_visit', 'Someone visited your Barn!',
		COALESCE(visitor_name, 'A friend') || ' tickled your pig — +'
			|| reward || ' tickles for you.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object(
		'ok', true, 'tickles', reward,
		'visits_left', daily_budget - todays_visits - 1
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dig_truffle(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	won_reward int;
	digger_name text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	UPDATE public.truffles
		SET dug_by = caller_id, dug_at = now()
		WHERE host_id = p_host AND dug_at IS NULL
		RETURNING reward INTO won_reward;
	IF won_reward IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	UPDATE public.profiles SET counter = counter + won_reward WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	SELECT username INTO digger_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'truffle_dug', 'Your truffle was found! 🐽',
		COALESCE(digger_name, 'A visitor') || ' dug up the truffle you buried.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object('ok', true, 'reward', won_reward);
END;
$function$;
