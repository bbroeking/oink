-- Add regen_seconds (the full regen PERIOD, not just time-to-next) to
-- barn_visit_status so the Visit screen's "YOUR TICKLES" refill countdown stays
-- exact for a happy/VIP player instead of falling back to a hardcoded display
-- cadence after the first tick. Everything else unchanged from 20260607.

CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	tired_cap      constant int := 7;
	visit_cooldown constant interval := '3 hours';
	taps_this_hour int;
	last_other_at  timestamptz;
	is_locked      boolean;
	v_vip          boolean;
	v_cap          int;
	v_regen        int;
	v_count        int;
	v_intervals    int;
	v_bal          int;
	v_secs_since   numeric;
	v_next_regen   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';

	SELECT max(created_at) INTO last_other_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id <> p_target;

	is_locked := (last_other_at IS NOT NULL AND last_other_at > now() - visit_cooldown);

	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       EXTRACT(EPOCH FROM (now() - last_increment))
	INTO v_count, v_secs_since
	FROM public.user_items WHERE user_id = caller_id;
	v_intervals := GREATEST(0, floor(COALESCE(v_secs_since, 0) / v_regen)::int);
	v_bal := COALESCE(GREATEST(v_count, LEAST(v_cap, v_count + v_intervals)), 0);
	v_next_regen := CASE
		WHEN v_bal >= v_cap THEN NULL
		ELSE GREATEST(1, v_regen - (COALESCE(v_secs_since, 0)::int % v_regen))
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'taps_left', GREATEST(0, tired_cap - taps_this_hour),
		'resting', taps_this_hour >= tired_cap,
		'locked', is_locked,
		'next_at', CASE WHEN is_locked THEN last_other_at + visit_cooldown ELSE NULL END,
		'balance', v_bal,
		'cap', v_cap,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;
