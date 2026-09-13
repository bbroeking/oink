-- Player-local, server-authoritative Feeding clock.
--
-- Dormant until app_settings.feeding_schedule.mode = 'commuter_local'. The
-- database reads a persisted IANA zone; open/submit never accept clock input.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS feeding_time_zone text,
	ADD COLUMN IF NOT EXISTS pending_feeding_time_zone text,
	ADD COLUMN IF NOT EXISTS feeding_time_zone_effective_at timestamptz,
	ADD COLUMN IF NOT EXISTS feeding_time_zone_changed_at timestamptz;

-- A table-level UPDATE grant implies every column, so column REVOKE alone is
-- insufficient. Replace it with explicit grants for every pre-existing column.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
DO $profile_update_columns$
DECLARE safe_columns text;
BEGIN
	SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO safe_columns
	FROM pg_catalog.pg_attribute
	WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped
		AND attname NOT IN ('feeding_time_zone','pending_feeding_time_zone',
			'feeding_time_zone_effective_at','feeding_time_zone_changed_at');
	EXECUTE 'GRANT UPDATE ('||safe_columns||') ON public.profiles TO authenticated, anon';
END;
$profile_update_columns$;

CREATE TABLE IF NOT EXISTS public.user_feeding_cycle_zones (
	user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	cycle_key text NOT NULL,
	time_zone text NOT NULL,
	feeding_schedule jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, cycle_key)
);
ALTER TABLE public.user_feeding_cycle_zones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_feeding_cycle_zones FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._valid_feeding_time_zone(p_zone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
	SELECT p_zone IS NOT NULL AND length(p_zone) BETWEEN 1 AND 100
		AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_zone);
$function$;
REVOKE ALL ON FUNCTION public._valid_feeding_time_zone(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._feeding_zone_at(p_user uuid, p_at timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
	SELECT CASE
		WHEN p.feeding_time_zone_effective_at IS NOT NULL
			AND p.feeding_time_zone_effective_at <= p_at
			AND public._valid_feeding_time_zone(p.pending_feeding_time_zone)
			THEN p.pending_feeding_time_zone
		WHEN public._valid_feeding_time_zone(p.feeding_time_zone) THEN p.feeding_time_zone
		ELSE 'America/New_York'
	END
	FROM public.profiles p WHERE p.id = p_user;
$function$;
REVOKE ALL ON FUNCTION public._feeding_zone_at(uuid,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._patch_clock_at_zone(p_at timestamptz, p_zone text, p_schedule jsonb)
RETURNS TABLE(window_index bigint, dig_day date, phase_open boolean,
	phase_ends_at timestamptz, opens_at timestamptz, window_ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	setting jsonb;
	mode_name text;
	zone_name text;
	legacy_window int; legacy_open int; legacy_offset int; legacy_win bigint;
	legacy_start timestamptz;
	local_now timestamp; anchor_day date; anchor_time time; minute_from_anchor int; bucket int;
	base_local timestamp; close_local timestamp; next_local timestamp;
BEGIN
	setting := COALESCE(p_schedule,
		(SELECT value FROM public.app_settings WHERE key = 'feeding_schedule'));
	mode_name := COALESCE(setting->>'mode', 'uniform');
	IF mode_name NOT IN ('commuter_eastern','commuter_local') THEN
		legacy_window := COALESCE((setting->>'window_secs')::int, 28800);
		legacy_open := COALESCE((setting->>'open_secs')::int, 14400);
		legacy_offset := COALESCE((setting->>'offset_secs')::int, 7200);
		legacy_win := floor((extract(epoch FROM p_at) - legacy_offset) / legacy_window)::bigint;
		legacy_start := to_timestamp(legacy_win * legacy_window + legacy_offset);
		RETURN QUERY SELECT legacy_win, (p_at AT TIME ZONE 'UTC')::date,
			p_at < legacy_start + make_interval(secs => legacy_open),
			CASE WHEN p_at < legacy_start + make_interval(secs => legacy_open)
				THEN legacy_start + make_interval(secs => legacy_open)
				ELSE legacy_start + make_interval(secs => legacy_window) END,
			legacy_start + make_interval(secs => legacy_window),
			legacy_start + make_interval(secs => legacy_window);
		RETURN;
	END IF;

	zone_name := CASE WHEN mode_name = 'commuter_local'
		AND public._valid_feeding_time_zone(p_zone) THEN p_zone ELSE 'America/New_York' END;
	anchor_time := CASE WHEN mode_name = 'commuter_local' THEN time '08:00' ELSE time '06:00' END;
	local_now := p_at AT TIME ZONE zone_name;
	anchor_day := CASE WHEN local_now::time < anchor_time
		THEN local_now::date - 1 ELSE local_now::date END;
	minute_from_anchor := floor(extract(epoch FROM
		(local_now - (anchor_day + anchor_time))) / 60)::int;
	base_local := anchor_day + anchor_time;
	IF mode_name = 'commuter_local' THEN
		bucket := CASE WHEN minute_from_anchor >= 960 THEN 2
			WHEN minute_from_anchor >= 480 THEN 1 ELSE 0 END;
		close_local := base_local + make_interval(mins => CASE bucket
			WHEN 0 THEN 240 WHEN 1 THEN 720 ELSE 1200 END);
		next_local := base_local + make_interval(mins => CASE bucket
			WHEN 0 THEN 480 WHEN 1 THEN 960 ELSE 1440 END);
	ELSE
		bucket := CASE WHEN minute_from_anchor >= 900 THEN 3
			WHEN minute_from_anchor >= 660 THEN 2
			WHEN minute_from_anchor >= 360 THEN 1 ELSE 0 END;
		close_local := base_local + make_interval(mins => CASE bucket
			WHEN 0 THEN 240 WHEN 1 THEN 480 WHEN 2 THEN 840 ELSE 1020 END);
		next_local := base_local + make_interval(mins => CASE bucket
			WHEN 0 THEN 360 WHEN 1 THEN 660 WHEN 2 THEN 900 ELSE 1440 END);
	END IF;
	RETURN QUERY SELECT
		(CASE WHEN mode_name='commuter_local'
			THEN 1000000000::bigint+(anchor_day-date '1970-01-01')::bigint*3+bucket
			ELSE (anchor_day-date '1970-01-01')::bigint*4+bucket END)::bigint,
		anchor_day, p_at < (close_local AT TIME ZONE zone_name),
		(CASE WHEN p_at < (close_local AT TIME ZONE zone_name) THEN close_local ELSE next_local END) AT TIME ZONE zone_name,
		next_local AT TIME ZONE zone_name, next_local AT TIME ZONE zone_name;
END;
$function$;
REVOKE ALL ON FUNCTION public._patch_clock_at_zone(timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._patch_clock_at_zone(p_at timestamptz, p_zone text)
RETURNS TABLE(window_index bigint, dig_day date, phase_open boolean,
	phase_ends_at timestamptz, opens_at timestamptz, window_ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT * FROM public._patch_clock_at_zone(p_at,p_zone,NULL);
$function$;
REVOKE ALL ON FUNCTION public._patch_clock_at_zone(timestamptz,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._patch_clock_for_user(p_at timestamptz, p_user uuid)
RETURNS TABLE(window_index bigint, dig_day date, phase_open boolean,
	phase_ends_at timestamptz, opens_at timestamptz, window_ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT * FROM public._patch_clock_at_zone(p_at,
		COALESCE(public._feeding_zone_at(p_user, p_at), 'America/New_York'));
$function$;
REVOKE ALL ON FUNCTION public._patch_clock_for_user(timestamptz,uuid) FROM PUBLIC, anon, authenticated;

-- Keep the old signature so all existing player RPCs become local without
-- accepting a caller-provided timezone. Cron callers without auth fall back ET.
CREATE OR REPLACE FUNCTION public._patch_clock(p_at timestamptz)
RETURNS TABLE(window_index bigint, dig_day date, phase_open boolean,
	phase_ends_at timestamptz, opens_at timestamptz, window_ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT * FROM public._patch_clock_for_user(p_at, auth.uid());
$function$;
REVOKE ALL ON FUNCTION public._patch_clock(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._patch_clock(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_feeding_time_zone(p_time_zone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	caller_id uuid := auth.uid(); p public.profiles%ROWTYPE; setting_mode text;
	has_rootings boolean; boundary timestamptz; effective_zone text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unauthenticated'); END IF;
	IF NOT public._valid_feeding_time_zone(p_time_zone) THEN
		RETURN jsonb_build_object('ok',false,'reason','invalid_time_zone');
	END IF;
	SELECT * INTO p FROM public.profiles WHERE id=caller_id FOR UPDATE;
	-- Materialize an elapsed pending change before considering another request.
	IF p.feeding_time_zone_effective_at IS NOT NULL
		AND p.feeding_time_zone_effective_at <= now()
		AND public._valid_feeding_time_zone(p.pending_feeding_time_zone) THEN
		UPDATE public.profiles SET feeding_time_zone=p.pending_feeding_time_zone,
			pending_feeding_time_zone=NULL, feeding_time_zone_effective_at=NULL
		WHERE id=caller_id RETURNING * INTO p;
	END IF;
	SELECT COALESCE(value->>'mode','uniform') INTO setting_mode FROM public.app_settings WHERE key='feeding_schedule';
	IF p.feeding_time_zone_changed_at IS NOT NULL
		AND p.feeding_time_zone_changed_at > now() - interval '30 days'
		AND p_time_zone IS DISTINCT FROM COALESCE(p.pending_feeding_time_zone,p.feeding_time_zone) THEN
		RETURN jsonb_build_object('ok',false,'reason','time_zone_change_cooldown',
			'feeding_time_zone',COALESCE(public._feeding_zone_at(caller_id,now()),'America/New_York'),
			'pending_feeding_time_zone',p.pending_feeding_time_zone,
			'pending_effective_at',p.feeding_time_zone_effective_at,
			'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
	END IF;
	IF p.feeding_time_zone IS NOT NULL
		AND p_time_zone = COALESCE(public._feeding_zone_at(caller_id,now()),'America/New_York') THEN
		RETURN jsonb_build_object('ok',true,'feeding_time_zone',p_time_zone,
			'pending_feeding_time_zone',p.pending_feeding_time_zone,
			'pending_effective_at',p.feeding_time_zone_effective_at,
			'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
	END IF;
	SELECT EXISTS(SELECT 1 FROM public.war_rootings WHERE user_id=caller_id) INTO has_rootings;
	IF setting_mode <> 'commuter_local' OR NOT has_rootings THEN
		UPDATE public.profiles SET feeding_time_zone=p_time_zone,
			pending_feeding_time_zone=NULL, feeding_time_zone_effective_at=NULL,
			feeding_time_zone_changed_at=now() WHERE id=caller_id;
	ELSE
		boundary := date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '7 days';
		UPDATE public.profiles SET pending_feeding_time_zone=p_time_zone,
			feeding_time_zone_effective_at=boundary, feeding_time_zone_changed_at=now()
		WHERE id=caller_id;
	END IF;
	SELECT * INTO p FROM public.profiles WHERE id=caller_id;
	effective_zone := COALESCE(public._feeding_zone_at(caller_id,now()),'America/New_York');
	RETURN jsonb_build_object('ok',true,'feeding_time_zone',effective_zone,
		'pending_feeding_time_zone',p.pending_feeding_time_zone,
		'pending_effective_at',p.feeding_time_zone_effective_at,
		'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.set_feeding_time_zone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_feeding_time_zone(text) TO authenticated;

-- Add timezone state to the existing read model while retaining its shape.
CREATE OR REPLACE FUNCTION public.feeding_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid(); my_crew uuid; clock record; p public.profiles%ROWTYPE;
	dug boolean := false; crew_dug jsonb := '[]'::jsonb;
BEGIN
	SELECT * INTO clock FROM public._patch_clock_for_user(now(),caller_id);
	SELECT * INTO p FROM public.profiles WHERE id=caller_id;
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
	RETURN jsonb_build_object('window_index',clock.window_index,'window_ends_at',clock.window_ends_at,
		'phase_open',clock.phase_open,'phase_ends_at',clock.phase_ends_at,'opens_at',clock.opens_at,
		'dug',dug,'crew_dug',crew_dug,
		'feeding_time_zone',COALESCE(public._feeding_zone_at(caller_id,now()),'America/New_York'),
		'pending_feeding_time_zone',p.pending_feeding_time_zone,
		'pending_effective_at',p.feeding_time_zone_effective_at,
		'feeding_time_zone_changed_at',p.feeding_time_zone_changed_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.feeding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feeding_state() TO authenticated;

-- Capture the effective zone used by each user's race-cycle participation.
CREATE OR REPLACE FUNCTION public.capture_feeding_cycle_zone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
	INSERT INTO public.user_feeding_cycle_zones(user_id,cycle_key,time_zone,feeding_schedule)
	VALUES(NEW.user_id,NEW.cycle_key,COALESCE(public._feeding_zone_at(NEW.user_id,now()),'America/New_York'),
		COALESCE((SELECT value FROM public.app_settings WHERE key='feeding_schedule'),'{}'::jsonb))
	ON CONFLICT (user_id,cycle_key) DO NOTHING;
	RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.capture_feeding_cycle_zone() FROM PUBLIC, anon, authenticated;

-- Existing participation predates player zones. Snapshot the schedule it
-- actually used and the former canonical Eastern zone before activation.
INSERT INTO public.user_feeding_cycle_zones(user_id,cycle_key,time_zone,feeding_schedule)
SELECT DISTINCT d.user_id,d.cycle_key,'America/New_York',
	COALESCE((SELECT value FROM public.app_settings WHERE key='feeding_schedule'),'{}'::jsonb)
FROM public.race_digs d
ON CONFLICT(user_id,cycle_key) DO NOTHING;

DROP TRIGGER IF EXISTS capture_feeding_cycle_zone ON public.race_digs;
CREATE TRIGGER capture_feeding_cycle_zone AFTER INSERT ON public.race_digs
	FOR EACH ROW EXECUTE FUNCTION public.capture_feeding_cycle_zone();

CREATE OR REPLACE FUNCTION public.race_cycle_feeding_windows(p_cycle text,p_time_zone text,p_schedule jsonb)
RETURNS TABLE(window_index bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cycle_row record; mode_name text:=COALESCE(p_schedule->>'mode','uniform');
	zone_name text; anchor_hour int; local_day date; bucket_start int;
	opening timestamptz; legacy_window int; legacy_offset int; first_win bigint; last_win bigint; win bigint;
BEGIN
	IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{8}$' OR NOT public._valid_feeding_time_zone(p_time_zone) THEN RETURN; END IF;
	SELECT * INTO cycle_row FROM public.race_cycle_at(to_date(p_cycle,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
	IF cycle_row.cycle_key IS DISTINCT FROM p_cycle THEN RETURN; END IF;
	IF mode_name NOT IN ('commuter_eastern','commuter_local') THEN
		legacy_window:=COALESCE((p_schedule->>'window_secs')::int,28800);
		legacy_offset:=COALESCE((p_schedule->>'offset_secs')::int,7200);
		first_win:=floor((extract(epoch FROM cycle_row.starts_at)-legacy_offset)/legacy_window)::bigint-1;
		last_win:=floor((extract(epoch FROM cycle_row.ends_at)-legacy_offset)/legacy_window)::bigint+1;
		FOR win IN first_win..last_win LOOP
			opening:=to_timestamp(win*legacy_window+legacy_offset);
			IF opening>=cycle_row.starts_at AND opening<cycle_row.ends_at THEN window_index:=win; RETURN NEXT; END IF;
		END LOOP;
		RETURN;
	END IF;
	zone_name:=CASE WHEN mode_name='commuter_local' THEN p_time_zone ELSE 'America/New_York' END;
	anchor_hour:=CASE WHEN mode_name='commuter_local' THEN 8 ELSE 6 END;
	FOR local_day IN
		SELECT generate_series((cycle_row.starts_at AT TIME ZONE zone_name)::date-1,
			(cycle_row.ends_at AT TIME ZONE zone_name)::date+1,interval '1 day')::date
	LOOP
		FOREACH bucket_start IN ARRAY CASE WHEN mode_name='commuter_local'
			THEN ARRAY[0,480,960] ELSE ARRAY[0,360,660,900] END LOOP
			opening:=(local_day+make_interval(hours=>anchor_hour,mins=>bucket_start)) AT TIME ZONE zone_name;
			IF opening>=cycle_row.starts_at AND opening<cycle_row.ends_at THEN
				window_index:=(CASE WHEN mode_name='commuter_local' THEN
					1000000000::bigint+(local_day-date '1970-01-01')::bigint*3+
						CASE bucket_start WHEN 0 THEN 0 WHEN 480 THEN 1 ELSE 2 END
				ELSE (local_day-date '1970-01-01')::bigint*4+
					CASE bucket_start WHEN 0 THEN 0 WHEN 360 THEN 1 WHEN 660 THEN 2 ELSE 3 END END)::bigint;
				RETURN NEXT;
			END IF;
		END LOOP;
	END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.race_cycle_feeding_windows(text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- Existing award engine is retained for old rows; this per-user helper is the
-- canonical slate seam for player-local historical evaluation.
CREATE OR REPLACE FUNCTION public.user_race_cycle_feeding_windows(p_user uuid,p_cycle text)
RETURNS TABLE(window_index bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT w.window_index
	FROM public.user_feeding_cycle_zones z
	CROSS JOIN LATERAL public.race_cycle_feeding_windows(p_cycle,z.time_zone,z.feeding_schedule) w
	WHERE z.user_id=p_user AND z.cycle_key=p_cycle;
$function$;
REVOKE ALL ON FUNCTION public.user_race_cycle_feeding_windows(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_perfect_feeding_week(p_cycle text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cycle_row record; achievement_row record; candidate record;
	expected_windows int; expected_ids bigint[]; actual_windows int; inserted int; awarded int:=0;
BEGIN
	IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{8}$' THEN RETURN 0; END IF;
	SELECT * INTO cycle_row FROM public.race_cycle_at(
		to_date(p_cycle,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
	IF cycle_row.cycle_key IS DISTINCT FROM p_cycle OR cycle_row.ends_at>now() THEN RETURN 0; END IF;
	SELECT * INTO achievement_row FROM public.achievements WHERE id='every_last_feeding';
	IF achievement_row.id IS NULL THEN RETURN 0; END IF;

	FOR candidate IN
		SELECT DISTINCT d.user_id FROM public.race_digs d
		JOIN public.profiles p ON p.id=d.user_id AND p.is_test=false
		JOIN public.crews c ON c.id=d.crew_id AND c.is_bot=false
		WHERE d.cycle_key=p_cycle
	LOOP
		SELECT array_agg(window_index),count(*)::int INTO expected_ids,expected_windows
		FROM public.user_race_cycle_feeding_windows(candidate.user_id,p_cycle);
		IF expected_windows<=0 THEN CONTINUE; END IF;
		SELECT count(DISTINCT d.window_index)::int INTO actual_windows
		FROM public.race_digs d
		WHERE d.cycle_key=p_cycle AND d.user_id=candidate.user_id
			AND d.window_index=ANY(expected_ids);
		IF actual_windows<>expected_windows THEN CONTINUE; END IF;

		INSERT INTO public.user_achievements(user_id,achievement_id,claimed_at,progress,level)
		VALUES(candidate.user_id,achievement_row.id,now(),expected_windows,0)
		ON CONFLICT(user_id,achievement_id) DO NOTHING;
		GET DIAGNOSTICS inserted=ROW_COUNT;
		IF inserted=0 THEN CONTINUE; END IF;
		IF achievement_row.reward_title_id IS NOT NULL THEN
			INSERT INTO public.user_titles(user_id,title_id)
			VALUES(candidate.user_id,achievement_row.reward_title_id) ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_item_id IS NOT NULL THEN
			INSERT INTO public.user_hats(user_id,hat_id)
			VALUES(candidate.user_id,achievement_row.reward_item_id) ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_snouts>0 THEN
			UPDATE public.profiles SET counter=counter+achievement_row.reward_snouts
			WHERE id=candidate.user_id;
		END IF;
		awarded:=awarded+1;
	END LOOP;
	RETURN awarded;
END;
$function$;
REVOKE ALL ON FUNCTION public.award_perfect_feeding_week(text) FROM PUBLIC, anon, authenticated;

-- Dispatch per target because different local clocks can be open concurrently.
CREATE OR REPLACE FUNCTION public.dispatch_feeding_open_pushes(p_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE clock record; target record; delivery_window bigint; push_result jsonb; queued int:=0; suppressed int:=0;
BEGIN
	FOR target IN SELECT DISTINCT p.id FROM public.profiles p
		JOIN public.crew_members cm ON cm.user_id=p.id JOIN public.crews c ON c.id=cm.crew_id AND c.is_bot=false
		WHERE p.feeding_push_enabled=true AND p.push_permission_granted=true
			AND p.expo_push_token IS NOT NULL AND p.expo_push_token<>''
	LOOP
		SELECT * INTO clock FROM public._patch_clock_for_user(p_at,target.id);
		IF NOT clock.phase_open OR EXISTS(SELECT 1 FROM public.feeding_push_deliveries fd
			WHERE fd.user_id=target.id AND fd.window_index=clock.window_index)
			OR EXISTS(SELECT 1 FROM public.war_rootings wr WHERE wr.user_id=target.id
				AND wr.window_index=clock.window_index AND wr.submitted_at IS NOT NULL) THEN CONTINUE; END IF;
		delivery_window:=NULL;
		INSERT INTO public.feeding_push_deliveries(user_id,window_index,queued_at)
		VALUES(target.id,clock.window_index,p_at) ON CONFLICT DO NOTHING RETURNING window_index INTO delivery_window;
		IF delivery_window IS NULL THEN suppressed:=suppressed+1; CONTINUE; END IF;
		BEGIN
			push_result:=public.send_push_to_user(target.id,'The patch is open',
				'The Hungerer is gorging — come dig with your Sounder.',
				jsonb_build_object('kind','feeding_open','screen','season','window_index',clock.window_index));
			IF COALESCE((push_result->>'ok')::boolean,false) THEN
				UPDATE public.feeding_push_deliveries SET request_id=NULLIF(push_result->>'request_id','')::bigint
				WHERE user_id=target.id AND window_index=clock.window_index; queued:=queued+1;
			ELSE DELETE FROM public.feeding_push_deliveries WHERE user_id=target.id AND window_index=clock.window_index; suppressed:=suppressed+1; END IF;
		EXCEPTION WHEN OTHERS THEN
			DELETE FROM public.feeding_push_deliveries WHERE user_id=target.id AND window_index=clock.window_index; suppressed:=suppressed+1;
		END;
	END LOOP;
	RETURN jsonb_build_object('ok',true,'queued',queued,'suppressed',suppressed);
END;
$function$;
REVOKE ALL ON FUNCTION public.dispatch_feeding_open_pushes(timestamptz) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.set_feeding_time_zone(text) IS
	'Persists a validated IANA Feeding timezone; active established-account changes wait for the next UTC Monday and are limited to one per 30 days.';
