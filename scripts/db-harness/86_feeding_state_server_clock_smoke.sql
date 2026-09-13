-- feeding_state exposes the same server instant, schedule, and per-user phase
-- geometry used by the privileged open/submit gates.
\set ON_ERROR_STOP on

DO $feeding_state_server_clock$
DECLARE
	pig uuid := '00000000-0000-0000-0000-000000085001';
	state jsonb; expected record;
BEGIN
	INSERT INTO auth.users(id) VALUES(pig) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone)
	VALUES(pig,'server-clock-pig','America/Los_Angeles')
	ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone;
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb
	WHERE key='feeding_schedule';
	PERFORM set_config('smoke.uid',pig::text,true);

	state:=public.feeding_state();
	SELECT * INTO expected
	FROM public._patch_clock_for_user((state->>'server_now')::timestamptz,pig);

	IF abs(extract(epoch FROM (statement_timestamp()-(state->>'server_now')::timestamptz))) > 1 THEN
		RAISE EXCEPTION 'feeding_state server_now is not current: %',state;
	END IF;
	IF state->'feeding_schedule' IS DISTINCT FROM '{"mode":"commuter_local"}'::jsonb THEN
		RAISE EXCEPTION 'feeding_state omitted the active raw schedule: %',state;
	END IF;
	IF (state->>'window_index')::bigint IS DISTINCT FROM expected.window_index
		OR (state->>'phase_open')::boolean IS DISTINCT FROM expected.phase_open
		OR (state->>'phase_ends_at')::timestamptz IS DISTINCT FROM expected.phase_ends_at
		OR (state->>'opens_at')::timestamptz IS DISTINCT FROM expected.opens_at
		OR state->>'feeding_time_zone' IS DISTINCT FROM 'America/Los_Angeles' THEN
		RAISE EXCEPTION 'feeding_state did not match caller-local server clock: %, expected %',state,row_to_json(expected);
	END IF;
	RAISE NOTICE 'chk feeding_state server clock + schedule + caller-local phase OK';
END;
$feeding_state_server_clock$;
