-- Read-only companion to tickle_at_barn: tells the client, on opening a friend's
-- Barn, how much tickling is left THIS HOUR at THIS barn — so the visit doesn't
-- appear to "reset" when you hop A→B→A. The 7/hour-per-barn ceiling is shared
-- across visits within the hour (the barn_visits rows persist), so coming back
-- continues toward the same ceiling instead of granting a fresh session.
--
-- barn_visits has RLS on with NO client policies (definer-only writes), so the
-- client can't count its own rows directly — this definer RPC hands back exactly
-- what the modal needs: taps left, whether the pigs are still resting, whether
-- you're out of daily visits, and your current (regen-materialized) tickle bank
-- so we can pre-warn when you can't afford to tickle. Mirrors tickle_at_barn's
-- ceilings (tired_cap 7/hr, daily_barns 5). See 20260601 / docs/happiness-spec.md.

CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	tired_cap      constant int := 7;
	daily_barns    constant int := 5;
	taps_this_hour int;
	distinct_today int;
	tapped_today   boolean;
	v_vip          boolean;
	v_cap          int;
	v_regen        int;
	v_count        int;
	v_intervals    int;
	v_bal          int;
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

	SELECT count(DISTINCT target_id), bool_or(target_id = p_target)
	INTO distinct_today, tapped_today
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());

	-- Current tickle bank, with regen materialized (read-only — no write).
	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / v_regen)::int)
	INTO v_count, v_intervals
	FROM public.user_items WHERE user_id = caller_id;
	v_bal := COALESCE(GREATEST(v_count, LEAST(v_cap, v_count + v_intervals)), 0);

	RETURN jsonb_build_object(
		'ok', true,
		'taps_left', GREATEST(0, tired_cap - taps_this_hour),
		'taps_this_hour', taps_this_hour,
		'resting', taps_this_hour >= tired_cap,
		'out_of_visits', (distinct_today >= daily_barns AND NOT COALESCE(tapped_today, false)),
		'balance', v_bal
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
