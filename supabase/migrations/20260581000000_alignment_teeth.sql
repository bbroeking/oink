-- Alignment teeth (Season 1): Generous/Greedy get gentle mechanical effects.
-- See docs/alignment-teeth-spec.md. Four functions touched, all reversible:
--   1. regen_secs_for     — economy tilt (generous regen faster, greedy slower)
--   2. send_blessing      — duration × blessing_factor (generous = better blesser)
--   3. send_curse         — duration × curse_factor    (greedy   = better curser)
--   4. tickle_trades_alignment_shift — redemption: greedy givers climb out faster
--
-- Specialist tradeoff (s = caller's alignment_score, -100..+100):
--   blessing_factor = 1 + (s/100)*0.5   (+50% at +100, -50% at -100)
--   curse_factor    = 1 - (s/100)*0.5   (+50% at -100, -50% at +100)

set check_function_bodies = off;

-- 1. Economy tilt — slots in alongside the warm_tea/sluggish ritual factors.
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		(CASE WHEN COALESCE(
			(SELECT is_vip FROM public.profiles WHERE id = uid), false)
		 THEN 1800 ELSE 3600 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'warm_tea'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		-- Alignment: generous regen ~10% faster, greedy ~10% slower.
		* (CASE
			WHEN COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) >= 25 THEN 0.9
			WHEN COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) <= -25 THEN 1.1
			ELSE 1 END)
	)::int);
$function$;

-- 2. send_blessing — duration scaled by the caller's blessing_factor.
CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	kind_today   text := public.daily_blessing_kind();
	casts_today  int;
	cast_cap     int;
	new_id       uuid;
	exp          timestamptz;
	bf           numeric;
	base         interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Generous blessers cast LONGER blessings; greedy ones shorter.
	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'  THEN interval '3 hours'
		WHEN 'sun_beam'  THEN interval '4 hours'
		WHEN 'halo_kiss' THEN interval '6 hours'
		ELSE NULL                                          -- bountiful_snouts (instant)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	IF kind_today = 'bountiful_snouts' THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

-- 3. send_curse — duration scaled by the caller's curse_factor.
CREATE OR REPLACE FUNCTION public.send_curse(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_curse_kind();
	casts_today   int;
	cast_cap      int;
	taken_today   int;
	this_take     int := 0;
	new_id        uuid;
	exp           timestamptz;
	cf            numeric;
	base          interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.curses
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Greedy cursers cast LONGER curses; generous ones shorter.
	cf := 1 - (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'sluggish_snout' THEN interval '3 hours'
		WHEN 'goblin_whisper' THEN interval '4 hours'
		WHEN 'phantom_itch'   THEN interval '6 hours'
		ELSE NULL                                               -- coin_pinch (instant)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * cf) END;

	IF kind_today = 'coin_pinch' THEN
		SELECT COALESCE(SUM(snouts_taken), 0) INTO taken_today
			FROM public.curses
			WHERE receiver_id = target_user_id
			  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
		this_take := LEAST(3, GREATEST(0, 10 - taken_today));
	END IF;

	BEGIN
		INSERT INTO public.curses
			(sender_id, receiver_id, kind, expires_at, snouts_taken)
			VALUES (caller_id, target_user_id, kind_today, exp, this_take)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_cursed_today');
	END;

	IF this_take > 0 THEN
		UPDATE public.profiles
			SET counter = GREATEST(0, counter - this_take)
			WHERE id = target_user_id;
	END IF;

	PERFORM public.shift_alignment(caller_id, -1);

	RETURN jsonb_build_object(
		'ok', true, 'kind', kind_today, 'curse_id', new_id,
		'snouts_taken', this_take
	);
END;
$function$;

-- 4. Redemption — a greedy giver climbs out faster (+3) than a neutral one (+2).
CREATE OR REPLACE FUNCTION public.tickle_trades_alignment_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	giver_score int;
BEGIN
	IF NEW.status = 'fulfilled' AND OLD.status = 'pending' THEN
		SELECT alignment_score INTO giver_score
			FROM public.profiles WHERE id = NEW.target_id;
		-- Giver drifts generous; if currently greedy, the climb-out is faster.
		PERFORM public.shift_alignment(NEW.target_id,
			CASE WHEN COALESCE(giver_score, 0) < 0 THEN 3 ELSE 2 END);
		PERFORM public.shift_alignment(NEW.requester_id, -2);  -- asker: greedy
	END IF;
	RETURN NEW;
END;
$function$;

-- NOTE: the launch announcement is intentionally NOT broadcast here — the
-- notification path is suspect (see notifications investigation). Send it via
-- a follow-up once notifications are confirmed working.
