-- Persistent Feeding pushes: preference sync, opt-out, repeat Feedings,
-- participation gates, routing payload, and per-window duplicate prevention.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid
$$;

DO $smoke_feeding_pushes$
DECLARE
	member_id uuid := '00000000-0000-0000-0000-000000065001';
	crewless_id uuid := '00000000-0000-0000-0000-000000065002';
	permissionless_id uuid := '00000000-0000-0000-0000-000000065003';
	crew_id uuid := '00000000-0000-0000-0000-000000065010';
	res jsonb;
	morning_window bigint;
	lunch_window bigint;
	evening_window bigint;
	call_count int;
BEGIN
	INSERT INTO auth.users (id) VALUES (member_id), (crewless_id), (permissionless_id)
	ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (
		id, username, expo_push_token, push_permission_granted
	) VALUES
		(member_id, 'feeding-member', 'ExponentPushToken[member]', true),
		(crewless_id, 'feeding-crewless', 'ExponentPushToken[crewless]', true),
		(permissionless_id, 'feeding-permissionless', NULL, false)
	ON CONFLICT (id) DO UPDATE SET
		expo_push_token = EXCLUDED.expo_push_token,
		push_permission_granted = EXCLUDED.push_permission_granted,
		feeding_push_enabled = false;
	INSERT INTO public.crews (id, name, leader_id, is_bot)
	VALUES (crew_id, 'Push Test Pigs', member_id, false)
	ON CONFLICT (id) DO NOTHING;
	INSERT INTO public.crew_members (crew_id, user_id, role)
	VALUES (crew_id, member_id, 'leader')
	ON CONFLICT DO NOTHING;

	-- Enabling is account-owned and readable on a later RPC call (the client on
	-- another device/remount sees this same truth).
	PERFORM set_config('smoke.uid', member_id::text, true);
	res := public.set_feeding_push_preference(true);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'enabled')::boolean THEN
		RAISE EXCEPTION 'feeding push: enable failed: %', res;
	END IF;
	res := public.feeding_push_preference();
	IF NOT (res->>'ok')::boolean OR NOT (res->>'enabled')::boolean THEN
		RAISE EXCEPTION 'feeding push: synchronized read failed: %', res;
	END IF;

	-- Permissionless accounts never enter a false enabled state.
	PERFORM set_config('smoke.uid', permissionless_id::text, true);
	res := public.set_feeding_push_preference(true);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'notifications_unavailable' THEN
		RAISE EXCEPTION 'feeding push: permissionless enable should fail: %', res;
	END IF;

	-- A crewless opted-in fixture proves the dispatcher re-checks actual
	-- participation instead of trusting preference alone.
	UPDATE public.profiles SET feeding_push_enabled = true WHERE id = crewless_id;

	SELECT window_index INTO morning_window
	FROM public._patch_clock('2026-07-16 10:01:00+00');
	res := public.dispatch_feeding_open_pushes('2026-07-16 10:01:00+00');
	IF (res->>'queued')::int <> 1 THEN
		RAISE EXCEPTION 'feeding push: morning should queue member only: %', res;
	END IF;
	SELECT count(*)::int INTO call_count FROM public.smoke_push_calls;
	IF call_count <> 1 THEN
		RAISE EXCEPTION 'feeding push: expected one push call, got %', call_count;
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.smoke_push_calls
		WHERE target_user_id = member_id
			AND push_data->>'kind' = 'feeding_open'
			AND push_data->>'screen' = 'season'
			AND (push_data->>'window_index')::bigint = morning_window
	) THEN
		RAISE EXCEPTION 'feeding push: routing payload is wrong';
	END IF;

	-- Same Feeding, including an overlapping invocation, stays exactly once.
	res := public.dispatch_feeding_open_pushes('2026-07-16 10:02:00+00');
	SELECT count(*)::int INTO call_count FROM public.smoke_push_calls;
	IF call_count <> 1 THEN
		RAISE EXCEPTION 'feeding push: duplicate dispatcher sent % calls', call_count;
	END IF;

	-- The still-enabled preference fires again at the next Feeding.
	SELECT window_index INTO lunch_window
	FROM public._patch_clock('2026-07-16 16:01:00+00');
	res := public.dispatch_feeding_open_pushes('2026-07-16 16:01:00+00');
	SELECT count(*)::int INTO call_count FROM public.smoke_push_calls;
	IF lunch_window = morning_window OR call_count <> 2 THEN
		RAISE EXCEPTION 'feeding push: next Feeding did not send once: % / %', res, call_count;
	END IF;

	-- Opt-out is accepted and stops every later Feeding.
	PERFORM set_config('smoke.uid', member_id::text, true);
	res := public.set_feeding_push_preference(false);
	IF NOT (res->>'ok')::boolean OR (res->>'enabled')::boolean THEN
		RAISE EXCEPTION 'feeding push: opt-out failed: %', res;
	END IF;
	PERFORM public.dispatch_feeding_open_pushes('2026-07-16 21:01:00+00');
	SELECT count(*)::int INTO call_count FROM public.smoke_push_calls;
	IF call_count <> 2 THEN
		RAISE EXCEPTION 'feeding push: opted-out member received another push';
	END IF;

	-- Even while opted in, a submitted dig suppresses a delayed dispatcher.
	UPDATE public.profiles SET feeding_push_enabled = true WHERE id = member_id;
	SELECT window_index INTO evening_window
	FROM public._patch_clock('2026-07-16 21:01:00+00');
	INSERT INTO public.war_rootings (
		user_id, crew_id, window_index, seed, dig_day, opened_at, submitted_at
	) VALUES (
		member_id, crew_id, evening_window, 65001, date '2026-07-16',
		'2026-07-16 21:00:10+00', '2026-07-16 21:00:30+00'
	)
	ON CONFLICT (user_id, window_index) DO UPDATE
	SET submitted_at = EXCLUDED.submitted_at;
	PERFORM public.dispatch_feeding_open_pushes('2026-07-16 21:02:00+00');
	SELECT count(*)::int INTO call_count FROM public.smoke_push_calls;
	IF call_count <> 2 THEN
		RAISE EXCEPTION 'feeding push: already-dug member received a push';
	END IF;

	IF has_function_privilege('anon', 'public.dispatch_feeding_open_pushes(timestamptz)', 'EXECUTE')
		OR has_function_privilege('authenticated', 'public.dispatch_feeding_open_pushes(timestamptz)', 'EXECUTE') THEN
		RAISE EXCEPTION 'feeding push: clients can execute cron dispatcher';
	END IF;

	RAISE NOTICE 'chk feeding_pushes: sync + opt-out + repeats + dedupe + participation OK';
END;
$smoke_feeding_pushes$;

