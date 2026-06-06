-- Barn visiting: make a tickle feel MUTUAL. A visit now tops off BOTH pigs —
-- the host gets +3 (the gift) and the visitor gets +1 (a little tickle back),
-- so it reads as a shared moment, not a one-way chore. Still bounded by the
-- 5/day visit budget + 1h per-target cooldown, and the visitor still earns +1
-- generous (giving stays the bigger half). Visitor reward is small + capped so
-- it's warmth, not a farm. (Tweak of docs/barn-visiting-design.md §3a.)

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	cooldown       constant interval := '1 hour';
	host_reward    constant int := 3;
	visitor_reward constant int := 1;
	daily_budget   constant int := 5;
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

	-- Mutual tickle: top off both pigs (over-cap allowed).
	PERFORM public.grant_tickles(p_target, host_reward);
	PERFORM public.grant_tickles(caller_id, visitor_reward);
	-- Giving stays the bigger half: the visitor's generosity rises.
	PERFORM public.shift_alignment(caller_id, 1);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_target, 'barn_visit', 'Someone visited your Barn!',
		COALESCE(visitor_name, 'A friend') || ' tickled your pig — +'
			|| host_reward || ' tickles for you.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'visits_left', daily_budget - todays_visits - 1
	);
END;
$function$;
