-- Give clients the authoritative instant and schedule that produced this
-- caller's Feeding state. Eligibility remains entirely server-owned; these
-- fields let display clocks measure the returned absolute boundaries against
-- the same database clock instead of the phone's wall clock.

CREATE OR REPLACE FUNCTION public.feeding_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid(); my_crew uuid; clock record; p public.profiles%ROWTYPE;
	v_now timestamptz := now(); schedule jsonb;
	dug boolean := false; crew_dug jsonb := '[]'::jsonb;
BEGIN
	SELECT * INTO clock FROM public._patch_clock_for_user(v_now,caller_id);
	SELECT * INTO p FROM public.profiles WHERE id=caller_id;
	SELECT value INTO schedule FROM public.app_settings WHERE key='feeding_schedule';
	IF caller_id IS NOT NULL THEN
		SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id=caller_id;
		dug := EXISTS(SELECT 1 FROM public.war_rootings WHERE user_id=caller_id
			AND window_index=clock.window_index AND submitted_at IS NOT NULL);
		IF my_crew IS NOT NULL THEN
			SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',r.user_id,'display_name',pr.username)),'[]'::jsonb)
			INTO crew_dug FROM public.war_rootings r JOIN public.profiles pr ON pr.id=r.user_id
			WHERE r.crew_id=my_crew AND r.window_index=clock.window_index
				AND r.submitted_at IS NOT NULL AND r.user_id<>caller_id;
		END IF;
	END IF;
	RETURN jsonb_build_object('server_now',v_now,'feeding_schedule',schedule,
		'window_index',clock.window_index,'window_ends_at',clock.window_ends_at,
		'phase_open',clock.phase_open,'phase_ends_at',clock.phase_ends_at,'opens_at',clock.opens_at,
		'dug',dug,'crew_dug',crew_dug,
		'feeding_time_zone',COALESCE(public._feeding_zone_at(caller_id,v_now),'America/New_York'),
		'pending_feeding_time_zone',p.pending_feeding_time_zone,
		'pending_effective_at',p.feeding_time_zone_effective_at,
		'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.feeding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feeding_state() TO authenticated;

