-- One blessing + one curse per player per day.
--
-- Was: 3 casts/day each (5 for VIP). Now a flat 1 — every player gets
-- exactly one blessing and one curse to spend daily, no VIP bump.
--
-- send_blessing / send_curse are rebuilt from their live definitions
-- (verified via pg_get_functiondef); the ONLY change is the cap — the
-- VIP-aware `cast_cap` CASE becomes a constant 1.

set check_function_bodies = off;

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

	-- Cap: one blessing per sender per UTC day.
	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Effect duration per kind. Instant kinds get NULL expires_at.
	exp := CASE kind_today
		WHEN 'warm_tea'  THEN now() + interval '1 hour'
		WHEN 'halo_kiss' THEN now() + interval '6 hours'
		WHEN 'sun_beam'  THEN now() + interval '24 hours'  -- "next lucky pig"
		ELSE NULL                                          -- bountiful_snouts
	END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Instant payout.
	IF kind_today = 'bountiful_snouts' THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	END IF;

	-- Casting a blessing is active kindness → +1 alignment to sender.
	PERFORM public.shift_alignment(caller_id, 1);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

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

	-- Cap: one curse per sender per UTC day.
	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.curses
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	exp := CASE kind_today
		WHEN 'sluggish_snout' THEN now() + interval '1 hour'
		WHEN 'goblin_whisper' THEN now() + interval '4 hours'
		WHEN 'phantom_itch'   THEN now() + interval '24 hours'  -- next 3 taps
		ELSE NULL                                               -- coin_pinch
	END;

	-- coin_pinch: cap total snout loss at 10/day per RECEIVER.
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

	-- Casting a curse is active mischief → -1 alignment to sender.
	PERFORM public.shift_alignment(caller_id, -1);

	RETURN jsonb_build_object(
		'ok', true, 'kind', kind_today, 'curse_id', new_id,
		'snouts_taken', this_take
	);
END;
$function$;
