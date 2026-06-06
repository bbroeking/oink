-- Barn visit now COSTS the visitor a tickle per tap (spent from their bank,
-- materializing regen first — no snout, it's a gift), and that tickle is
-- TRANSFERRED to the host. Both pigs still gain happiness (yours full, theirs
-- 25%) — so a visit counts for both. If you're out of tickles you can't visit-
-- tickle. Per-barn tired ceiling (7/hr) + daily budget (5 distinct barns) keep
-- it bounded. Was: minted +1 to each. See docs/happiness-spec.md / ADR 0004.

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;   -- the tickle you transfer to the host
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

	-- Per-barn tired ceiling: at most `tired_cap` taps/hour.
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

	-- Cost: spend one of the visitor's tickles (materialize regen, then deduct).
	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / v_regen)::int)
	INTO v_count, v_intervals
	FROM public.user_items WHERE user_id = caller_id FOR UPDATE;

	IF v_count IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_tickles');
	END IF;
	v_bal := GREATEST(v_count, LEAST(v_cap, v_count + v_intervals));
	IF v_bal < 1 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_tickles');
	END IF;

	UPDATE public.user_items
	SET item_count = v_bal - 1,
	    last_increment = last_increment + (v_intervals * (v_regen * INTERVAL '1 second'))
	WHERE user_id = caller_id;

	-- Transfer the tickle to the host; both pigs get happier.
	PERFORM public.grant_tickles(p_target, host_reward);
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	-- First tap of the session: generosity + notify (once).
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
		'visitor_balance', v_bal - 1,
		'taps_left', tired_cap - taps_this_hour - 1
	);
END;
$function$;
