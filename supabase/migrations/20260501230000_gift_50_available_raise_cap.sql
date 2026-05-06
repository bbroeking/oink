-- Raise tickle balance cap from 25 -> 100 and gift everyone +50 unused tickles.

set check_function_bodies = off;

-- Replace tickle_balance with new cap of 100
CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT LEAST(
    100,
    item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)
  )
  FROM public.user_items
  WHERE user_id = uid;
$function$;

-- Replace update_profile_and_item_count with new cap of 100
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

  current_balance := LEAST(100, current_balance + hours_elapsed);

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

  RETURN new_balance;
END;
$function$;

-- Gift everyone +50 unused tickles (capped at new max)
UPDATE public.user_items
SET item_count = LEAST(100, item_count + 50),
    last_increment = now();
