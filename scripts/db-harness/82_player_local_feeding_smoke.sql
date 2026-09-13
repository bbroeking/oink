-- Player-local Feeding schedule: zone parity, DST, persistence and isolation.
\set ON_ERROR_STOP on

DO $player_local_feeding$
DECLARE
	ny record; la record; tokyo record; c record;
	ny_id uuid := '00000000-0000-0000-0000-000000082001';
	la_id uuid := '00000000-0000-0000-0000-000000082002';
	crew_id uuid := '00000000-0000-0000-0000-000000082010';
	res jsonb; opened_ny jsonb; opened_la jsonb; submitted jsonb;
	before_index bigint; monday timestamptz; pushed int; awarded int;
BEGIN
	IF has_column_privilege('authenticated','public.profiles','feeding_time_zone','UPDATE')
		OR has_column_privilege('anon','public.profiles','feeding_time_zone','UPDATE') THEN
		RAISE EXCEPTION 'timezone columns remain directly writable';
	END IF;
	-- Applying the dormant migration must preserve the prior Eastern mode.
	UPDATE public.app_settings SET value='{"mode":"commuter_eastern"}'::jsonb
	WHERE key='feeding_schedule';
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-16 10:00+00','Asia/Tokyo');
	IF NOT c.phase_open OR c.phase_ends_at<>'2026-07-16 14:00+00'::timestamptz THEN
		RAISE EXCEPTION 'commuter_eastern changed while player-local mode dormant: %',row_to_json(c);
	END IF;

	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb
	WHERE key='feeding_schedule';
	SELECT * INTO ny FROM public._patch_clock_at_zone('2026-07-16 12:00+00','America/New_York');
	SELECT * INTO la FROM public._patch_clock_at_zone('2026-07-16 15:00+00','America/Los_Angeles');
	SELECT * INTO tokyo FROM public._patch_clock_at_zone('2026-07-15 23:00+00','Asia/Tokyo');
	IF NOT ny.phase_open OR ny.phase_ends_at<>'2026-07-16 16:00+00'::timestamptz THEN
		RAISE EXCEPTION 'NY 08:00 boundary wrong: %',row_to_json(ny);
	END IF;
	IF NOT la.phase_open OR la.phase_ends_at<>'2026-07-16 19:00+00'::timestamptz THEN
		RAISE EXCEPTION 'LA 08:00 boundary wrong: %',row_to_json(la);
	END IF;
	IF NOT tokyo.phase_open OR tokyo.phase_ends_at<>'2026-07-16 03:00+00'::timestamptz THEN
		RAISE EXCEPTION 'Tokyo 08:00 boundary wrong: %',row_to_json(tokyo);
	END IF;
	IF ny.window_index<>la.window_index OR ny.window_index<>tokyo.window_index THEN
		RAISE EXCEPTION 'same local date/bucket must share logical board ids: %, %, %',ny.window_index,la.window_index,tokyo.window_index;
	END IF;
	IF ny.window_index<1000000000 THEN RAISE EXCEPTION 'local board id aliases legacy namespace: %',ny.window_index; END IF;

	-- Exact local boundaries: 08-12, 16-20 and 00-04.
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-16 11:59:59+00','America/New_York');
	IF c.phase_open THEN RAISE EXCEPTION '07:59:59 local should be guarded'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-16 12:00+00','America/New_York');
	IF NOT c.phase_open THEN RAISE EXCEPTION '08:00 local should open'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-16 16:00+00','America/New_York');
	IF c.phase_open THEN RAISE EXCEPTION '12:00 local should close'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-16 20:00+00','America/New_York');
	IF NOT c.phase_open THEN RAISE EXCEPTION '16:00 local should open'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-17 00:00+00','America/New_York');
	IF c.phase_open THEN RAISE EXCEPTION '20:00 local should close'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-17 04:00+00','America/New_York');
	IF NOT c.phase_open THEN RAISE EXCEPTION '00:00 local should open'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-17 08:00+00','America/New_York');
	IF c.phase_open THEN RAISE EXCEPTION '04:00 local should close'; END IF;

	-- The midnight opening remains bucket 2 of its prior 08:00-anchored day.
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-07-17 04:30+00','America/New_York');
	IF NOT c.phase_open OR c.dig_day<>date '2026-07-16'
		OR c.phase_ends_at<>'2026-07-17 08:00+00'::timestamptz THEN
		RAISE EXCEPTION 'midnight-crossing wind-down wrong: %',row_to_json(c);
	END IF;

	-- IANA conversion owns both spring-forward and fall-back offsets.
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-03-07 13:00+00','America/New_York');
	IF c.phase_ends_at<>'2026-03-07 17:00+00'::timestamptz THEN RAISE EXCEPTION 'pre-spring DST wrong'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-03-09 12:00+00','America/New_York');
	IF c.phase_ends_at<>'2026-03-09 16:00+00'::timestamptz THEN RAISE EXCEPTION 'post-spring DST wrong'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-10-31 12:00+00','America/New_York');
	IF c.phase_ends_at<>'2026-10-31 16:00+00'::timestamptz THEN RAISE EXCEPTION 'pre-fall DST wrong'; END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-11-02 13:00+00','America/New_York');
	IF c.phase_ends_at<>'2026-11-02 17:00+00'::timestamptz THEN RAISE EXCEPTION 'post-fall DST wrong'; END IF;
	-- Midnight-to-04:00 spans three elapsed hours in spring and five in fall.
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-03-08 05:00+00','America/New_York');
	IF NOT c.phase_open OR c.phase_ends_at<>'2026-03-08 08:00+00'::timestamptz THEN
		RAISE EXCEPTION 'spring midnight window should span 3 elapsed hours: %',row_to_json(c);
	END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-11-01 04:00+00','America/New_York');
	IF NOT c.phase_open OR c.phase_ends_at<>'2026-11-01 09:00+00'::timestamptz THEN
		RAISE EXCEPTION 'fall midnight window should span 5 elapsed hours: %',row_to_json(c);
	END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-11-01 05:30+00','America/New_York');
	IF NOT c.phase_open OR c.phase_ends_at<>'2026-11-01 09:00+00'::timestamptz THEN
		RAISE EXCEPTION 'first repeated 01:30 should remain open through 04:00: %',row_to_json(c);
	END IF;
	SELECT * INTO c FROM public._patch_clock_at_zone('2026-11-01 09:00+00','America/New_York');
	IF c.phase_open THEN RAISE EXCEPTION 'fall close must land at 09:00Z'; END IF;

	INSERT INTO auth.users(id) VALUES(ny_id),(la_id) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username) VALUES(ny_id,'local-clock-ny'),(la_id,'local-clock-la')
	ON CONFLICT(id) DO UPDATE SET feeding_time_zone=NULL,pending_feeding_time_zone=NULL,
		feeding_time_zone_effective_at=NULL,feeding_time_zone_changed_at=NULL;
	INSERT INTO public.crews(id,name,leader_id,is_bot)
	VALUES(crew_id,'Local Clock Crew',ny_id,false) ON CONFLICT(id) DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role)
	VALUES(crew_id,ny_id,'leader'),(crew_id,la_id,'member') ON CONFLICT DO NOTHING;
	PERFORM set_config('smoke.uid',ny_id::text,true);
	res:=public.set_feeding_time_zone('Not/A_Real_Zone');
	IF res->>'reason'<>'invalid_time_zone' THEN RAISE EXCEPTION 'invalid zone accepted: %',res; END IF;
	res:=public.set_feeding_time_zone('America/New_York');
	IF NOT (res->>'ok')::boolean OR res->>'feeding_time_zone'<>'America/New_York' THEN
		RAISE EXCEPTION 'first zone registration failed: %',res;
	END IF;
	res:=public.set_feeding_time_zone('America/Los_Angeles');
	IF res->>'reason'<>'time_zone_change_cooldown' THEN RAISE EXCEPTION 'cooldown missing: %',res; END IF;

	-- Established active accounts queue a change for next UTC Monday.
	UPDATE public.profiles SET feeding_time_zone_changed_at=now()-interval '31 days' WHERE id=ny_id;
	INSERT INTO public.war_rootings(user_id,crew_id,window_index,seed,dig_day,opened_at)
	VALUES(ny_id,crew_id,82001,1,current_date,now()) ON CONFLICT DO NOTHING;
	res:=public.set_feeding_time_zone('America/Los_Angeles');
	monday:=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'+interval '7 days';
	IF NOT (res->>'ok')::boolean OR res->>'pending_feeding_time_zone'<>'America/Los_Angeles'
		OR (res->>'pending_effective_at')::timestamptz<>monday THEN
		RAISE EXCEPTION 'pending boundary wrong: % expected %',res,monday;
	END IF;
	IF public._feeding_zone_at(ny_id,monday-interval '1 second')<>'America/New_York'
		OR public._feeding_zone_at(ny_id,monday)<>'America/Los_Angeles' THEN
		RAISE EXCEPTION 'pending zone did not switch exactly at boundary';
	END IF;

	-- Exercise the public no-timezone-argument dig contracts. Corresponding NY
	-- and LA morning Feedings share one board id/seed and asynchronous crew echo.
	UPDATE public.profiles SET feeding_time_zone='America/New_York',
		pending_feeding_time_zone=NULL,feeding_time_zone_effective_at=NULL WHERE id=ny_id;
	UPDATE public.profiles SET feeding_time_zone='America/Los_Angeles' WHERE id=la_id;
	PERFORM set_config('smoke.uid',ny_id::text,true);
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);
	opened_ny:=public.open_rooting();
	IF NOT (opened_ny->>'ok')::boolean OR (opened_ny->>'already')::boolean THEN
		RAISE EXCEPTION 'NY real open failed: %',opened_ny;
	END IF;
	submitted:=public.submit_rooting(ARRAY[]::text[],0,ARRAY[]::text[]);
	IF NOT (submitted->>'ok')::boolean THEN RAISE EXCEPTION 'NY real submit failed: %',submitted; END IF;
	IF (public.submit_rooting(ARRAY[]::text[],0,ARRAY[]::text[])->>'reason')<>'already_rooted' THEN
		RAISE EXCEPTION 'duplicate real submit was not rejected';
	END IF;
	PERFORM set_config('smoke.uid',la_id::text,true);
	PERFORM set_config('ttp.fake_now','2026-07-16 15:01+00',true);
	opened_la:=public.open_rooting();
	IF NOT (opened_la->>'ok')::boolean
		OR opened_la->>'window_index'<>opened_ny->>'window_index'
		OR opened_la->>'seed'<>opened_ny->>'seed'
		OR NOT (opened_la->>'coop')::boolean THEN
		RAISE EXCEPTION 'cross-zone shared board/echo failed: NY %, LA %',opened_ny,opened_la;
	END IF;
	submitted:=public.submit_rooting(ARRAY[]::text[],0,ARRAY[]::text[]);
	IF NOT (submitted->>'ok')::boolean THEN RAISE EXCEPTION 'LA real submit failed: %',submitted; END IF;
	PERFORM set_config('ttp.fake_now','',true);

	-- Dispatcher evaluates each recipient. At 08:01 NY, LA is still guarded.
	UPDATE public.profiles SET feeding_push_enabled=true,push_permission_granted=true,
		expo_push_token=CASE id WHEN ny_id THEN 'ExponentPushToken[local-ny]'
		ELSE 'ExponentPushToken[local-la]' END WHERE id IN(ny_id,la_id);
	DELETE FROM public.feeding_push_deliveries WHERE user_id IN(ny_id,la_id);
	DELETE FROM public.smoke_push_calls WHERE target_user_id IN(ny_id,la_id);
	res:=public.dispatch_feeding_open_pushes('2026-07-17 12:01+00');
	SELECT count(*)::int INTO pushed FROM public.smoke_push_calls WHERE target_user_id IN(ny_id,la_id);
	IF pushed<>1 OR NOT EXISTS(SELECT 1 FROM public.smoke_push_calls WHERE target_user_id=ny_id) THEN
		RAISE EXCEPTION 'per-user push clock queued wrong recipients: %, calls %',res,pushed;
	END IF;
	PERFORM public.dispatch_feeding_open_pushes('2026-07-17 12:02+00');
	IF (SELECT count(*) FROM public.smoke_push_calls WHERE target_user_id IN(ny_id,la_id))<>1 THEN
		RAISE EXCEPTION 'per-user push dedupe failed';
	END IF;

	-- Different zones have different UTC slates at race edges, and snapshots
	-- keep that historical expectation independent of later profile changes.
	INSERT INTO public.user_feeding_cycle_zones(user_id,cycle_key,time_zone,feeding_schedule)
	VALUES(ny_id,'20260105','America/New_York','{"mode":"commuter_local"}'::jsonb),
		(la_id,'20260105','Asia/Tokyo','{"mode":"commuter_local"}'::jsonb)
	ON CONFLICT(user_id,cycle_key) DO UPDATE SET time_zone=EXCLUDED.time_zone,
		feeding_schedule=EXCLUDED.feeding_schedule;
	SELECT count(*) INTO before_index FROM public.user_race_cycle_feeding_windows(ny_id,'20260105');
	IF before_index<>21 OR (SELECT count(*) FROM public.user_race_cycle_feeding_windows(la_id,'20260105'))<>21 THEN
		RAISE EXCEPTION 'per-user weekly slate must contain 21 Feedings';
	END IF;
	INSERT INTO public.race_digs(cycle_key,user_id,window_index,crew_id,finds)
	SELECT '20260105',la_id,w.window_index,crew_id,0
	FROM public.user_race_cycle_feeding_windows(la_id,'20260105') w ON CONFLICT DO NOTHING;
	SELECT public.award_perfect_feeding_week('20260105') INTO awarded;
	IF awarded<1 OR NOT EXISTS(SELECT 1 FROM public.user_achievements
		WHERE user_id=la_id AND achievement_id='every_last_feeding') THEN
		RAISE EXCEPTION 'per-user perfect Feeding award failed: %',awarded;
	END IF;

	RAISE NOTICE 'chk player-local feeding: dormant parity + zones + DST + midnight + validation + cooldown + weekly slate OK';
END;
$player_local_feeding$;
