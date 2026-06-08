-- Blessings: raise the daily cap 1 -> 3 (the in-app copy already promises "bless
-- up to 3 friends"; the 20260534 one-ritual-per-day migration had quietly capped
-- it at 1, so every blessing after the first returned daily_cap = "not going
-- through"). The per-pair-per-day unique index still prevents blessing the SAME
-- friend twice/day. Curses stay at 1. Adds ritual_status() so the UI can show
-- how many are left + the reset countdown.

-- == send_blessing: cap 1 -> 3 ==
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

	cast_cap := 3;  -- bless up to 3 different friends/day (was 1; matches the in-app copy)
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Generous blessers cast LONGER blessings; greedy ones shorter. Only the
	-- timed kinds use it; halo_kiss + bountiful_snouts are instant (NULL).
	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'  THEN interval '3 hours'
		WHEN 'sun_beam'  THEN interval '4 hours'
		ELSE NULL                          -- halo_kiss (+5 tickles) + bountiful_snouts (+5 snouts)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Instant payouts.
	IF kind_today = 'bountiful_snouts' THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	ELSIF kind_today = 'halo_kiss' THEN
		PERFORM public.grant_tickles(target_user_id, 5);
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

-- ritual_status(): how many blessings/curses the caller has used today + the
-- daily caps, so the UI can show "N of M left" + the reset countdown.
CREATE OR REPLACE FUNCTION public.ritual_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	today     date := (now() AT TIME ZONE 'UTC')::date;
	b_used    int;
	c_used    int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT count(*) INTO b_used FROM public.blessings WHERE sender_id = caller_id AND sent_on = today;
	SELECT count(*) INTO c_used FROM public.curses    WHERE sender_id = caller_id AND sent_on = today;
	-- caps mirror the cast fns: send_blessing cast_cap=3, send_curse cast_cap=1.
	RETURN jsonb_build_object('ok', true,
		'bless_used', b_used, 'bless_cap', 3,
		'curse_used', c_used, 'curse_cap', 1);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ritual_status() TO authenticated;
