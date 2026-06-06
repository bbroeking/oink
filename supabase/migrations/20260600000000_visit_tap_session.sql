-- Barn visit becomes a tap-session: you tap a friend's pig repeatedly. Each tap
-- tops off both pigs (tickles + happiness — yours full, theirs 25%). The barn
-- "tires out" after at most 7 taps/hour (the client ends a visit on a random
-- 3–7); the daily budget is now distinct barns visited (5/day). Generosity +
-- the "someone visited" notification fire once per session (the first tap), not
-- per tap. See docs/happiness-spec.md + ADR 0004.

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;   -- tickles per tap to the host
	visitor_reward constant int := 1;   -- a little tickle back to you
	tired_cap      constant int := 7;   -- max taps per barn per hour (the tired ceiling)
	daily_barns    constant int := 5;   -- distinct barns you can visit per day
	taps_this_hour int;
	distinct_today int;
	tapped_today   boolean;
	visitor_name   text;
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

	-- This barn's tired ceiling: at most `tired_cap` taps in the last hour.
	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';
	IF taps_this_hour >= tired_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'tired');
	END IF;

	-- Daily budget = distinct barns visited today.
	SELECT count(DISTINCT target_id), bool_or(target_id = p_target)
	INTO distinct_today, tapped_today
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());
	IF distinct_today >= daily_barns AND NOT COALESCE(tapped_today, false) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'budget', 'budget', daily_barns);
	END IF;

	-- Mutual tickle + happiness (yours full, theirs 25%, both window-capped).
	PERFORM public.grant_tickles(p_target, host_reward);
	PERFORM public.grant_tickles(caller_id, visitor_reward);
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	-- First tap of the session: generosity + notify (once, not per tap).
	IF taps_this_hour = 0 THEN
		PERFORM public.shift_alignment(caller_id, 1);
		SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			p_target, 'barn_visit', 'Someone visited your Barn!',
			COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!',
			'{}'::jsonb
		);
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'taps_left', tired_cap - taps_this_hour - 1
	);
END;
$function$;
