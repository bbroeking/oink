-- Curses: raise the daily cap 1 -> 3, mirroring 20260614's blessing raise.
-- send_curse body carried verbatim from 20260613 (latest) apart from the cap;
-- ritual_status's advertised curse_cap follows, so the RitualPicker counter
-- ("N of M left") updates with zero client changes.

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

	cast_cap := 3;  -- curse up to 3 different targets/day (was 1; mirrors send_blessing)
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
	PERFORM public.grant_season_xp(caller_id, 2);

	RETURN jsonb_build_object(
		'ok', true, 'kind', kind_today, 'curse_id', new_id,
		'snouts_taken', this_take
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_curse(uuid) TO authenticated;

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
	-- caps mirror the cast fns: send_blessing cast_cap=3, send_curse cast_cap=3.
	RETURN jsonb_build_object('ok', true,
		'bless_used', b_used, 'bless_cap', 3,
		'curse_used', c_used, 'curse_cap', 3);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ritual_status() TO authenticated;
