-- Barn visiting: one person every 3 hours. Replaces the old "5 distinct barns
-- per day" budget with a global cooldown — once you've tickled someone, you
-- can't tickle a DIFFERENT person for 3 hours (re-tapping the SAME barn within
-- your session is still fine, bounded by the 7/hour tired ceiling). So you pick
-- one pig to visit per 3-hour window. Both tickle_at_barn (enforce) and
-- barn_visit_status (report lock + next_at for the modal) get the new rule.
-- Builds on 20260601 (cost-a-tickle) / 20260602 (status). Error: 'cooldown'.

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;
	tired_cap      constant int := 7;
	visit_cooldown constant interval := '3 hours';
	taps_this_hour int;
	last_other_at  timestamptz;
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

	-- One person every 3 hours: if you've tickled a DIFFERENT barn inside the
	-- cooldown, you can't start on this one yet. Re-tapping the same barn is ok.
	SELECT max(created_at) INTO last_other_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id <> p_target;
	IF last_other_at IS NOT NULL AND last_other_at > now() - visit_cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown', 'next_at', last_other_at + visit_cooldown
		);
	END IF;

	-- Per-barn tired ceiling: at most tired_cap taps/hour on the same barn.
	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';
	IF taps_this_hour >= tired_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'tired');
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
		'resting', taps_this_hour >= tired_cap,
		'locked', is_locked,
		'next_at', CASE WHEN is_locked THEN last_other_at + visit_cooldown ELSE NULL END,
		'balance', v_bal
	);
END;
$function$;
