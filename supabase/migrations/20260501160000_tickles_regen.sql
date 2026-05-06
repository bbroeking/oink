-- Tickles regen: start at 10 on signup, +1/hr up to 25 cap.
-- Replaces the previous hourly-cron pattern with on-read lazy regen.

set check_function_bodies = off;

-- Trigger: also seed user_items on new auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  insert into public.user_items (user_id, item_count, last_increment)
  values (new.id, 10, now());

  return new;
end;
$function$;

-- Backfill existing auth.users that have no user_items row
INSERT INTO public.user_items (user_id, item_count, last_increment)
SELECT u.id, 10, now()
FROM auth.users u
LEFT JOIN public.user_items ui ON ui.user_id = u.id
WHERE ui.user_id IS NULL;

-- Read-only helper: returns regenerated balance (capped at 25)
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

-- Atomic tickle: lazy-regen, then decrement, then bump counter.
-- Returns the post-tickle balance.
DROP FUNCTION IF EXISTS public.update_profile_and_item_count(uuid);
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

  RETURN new_balance;
END;
$function$;

DROP FUNCTION IF EXISTS public.increment_user_items();

GRANT EXECUTE ON FUNCTION public.tickle_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;
