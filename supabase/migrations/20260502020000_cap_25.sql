-- Drop tickle cap from 250 -> 25.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT LEAST(
    25,
    item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)
  )
  FROM public.user_items
  WHERE user_id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.tickle_info(uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'balance',
      LEAST(25, item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)),
    'cap', 25,
    'next_regen_seconds',
      CASE
        WHEN LEAST(25, item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)) >= 25
          THEN NULL
        ELSE 3600 - (EXTRACT(EPOCH FROM (now() - last_increment))::int % 3600)
      END
  )
  FROM public.user_items
  WHERE user_id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  hours_elapsed int;
  current_balance int;
  new_balance int;
  active_season_id text;
BEGIN
  SELECT
    GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int),
    item_count
  INTO hours_elapsed, current_balance
  FROM public.user_items
  WHERE user_id = uid
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No user_items row for user %', uid;
  END IF;

  current_balance := LEAST(25, current_balance + hours_elapsed);

  IF current_balance <= 0 THEN
    UPDATE public.user_items
    SET item_count = current_balance,
        last_increment = last_increment + (hours_elapsed * INTERVAL '1 hour')
    WHERE user_id = uid;
    RETURN current_balance;
  END IF;

  new_balance := current_balance - 1;

  UPDATE public.user_items
  SET item_count = new_balance,
      last_increment = last_increment + (hours_elapsed * INTERVAL '1 hour')
  WHERE user_id = uid;

  UPDATE public.profiles SET counter = counter + 1 WHERE id = uid;

  -- Battle pass XP
  SELECT id INTO active_season_id
  FROM public.seasons
  WHERE starts_at <= now() AND ends_at >= now()
  ORDER BY starts_at DESC
  LIMIT 1;

  IF active_season_id IS NOT NULL THEN
    INSERT INTO public.user_season_progress (user_id, season_id, xp)
    VALUES (uid, active_season_id, 1)
    ON CONFLICT (user_id, season_id) DO UPDATE
      SET xp = public.user_season_progress.xp + 1;
  END IF;

  RETURN new_balance;
END;
$function$;

-- Clip everyone's stockpile back down to the new cap.
UPDATE public.user_items SET item_count = LEAST(item_count, 25);
