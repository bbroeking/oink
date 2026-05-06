-- Raise tickle cap from 100 -> 250 and add tickle_info RPC for client UI.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT LEAST(
    250,
    item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)
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

  current_balance := LEAST(250, current_balance + hours_elapsed);

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

-- Returns balance, cap, and seconds until next regen tick.
-- next_regen_seconds is null when at cap.
CREATE OR REPLACE FUNCTION public.tickle_info(uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'balance',
      LEAST(250, item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)),
    'cap', 250,
    'next_regen_seconds',
      CASE
        WHEN LEAST(250, item_count + GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / 3600)::int)) >= 250
          THEN NULL
        ELSE 3600 - (EXTRACT(EPOCH FROM (now() - last_increment))::int % 3600)
      END
  )
  FROM public.user_items
  WHERE user_id = uid;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_info(uuid) TO authenticated;
