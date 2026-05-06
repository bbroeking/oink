-- VIP subscription support.
-- VIP users get: 2x regen rate, +25 cap (50 total), auto-claim premium pass, leaderboard star.
--
-- The `is_vip` flag is the source of truth. It's set by:
--   - Manual seed/test (this migration)
--   - A future RevenueCat webhook → Edge Function that updates this row
-- Until the webhook is wired, the client also calls dev_set_vip() for testing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_until timestamptz;

CREATE INDEX IF NOT EXISTS profiles_is_vip_idx ON public.profiles (is_vip) WHERE is_vip;

set check_function_bodies = off;

-- Updated tickle_balance with VIP-aware cap (50 vs 25) and 2x regen rate.
CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH p AS (
    SELECT COALESCE(pr.is_vip, false) AS is_vip
    FROM public.profiles pr WHERE pr.id = uid
  )
  SELECT LEAST(
    CASE WHEN (SELECT is_vip FROM p) THEN 50 ELSE 25 END,
    item_count + GREATEST(0, floor(
      EXTRACT(EPOCH FROM (now() - last_increment))
      / CASE WHEN (SELECT is_vip FROM p) THEN 1800 ELSE 3600 END
    )::int)
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
  WITH
    p AS (
      SELECT COALESCE(pr.is_vip, false) AS is_vip
      FROM public.profiles pr WHERE pr.id = uid
    ),
    cfg AS (
      SELECT
        CASE WHEN (SELECT is_vip FROM p) THEN 50 ELSE 25 END AS cap,
        CASE WHEN (SELECT is_vip FROM p) THEN 1800 ELSE 3600 END AS regen_secs
    ),
    bal AS (
      SELECT
        LEAST(
          (SELECT cap FROM cfg),
          item_count + GREATEST(0, floor(
            EXTRACT(EPOCH FROM (now() - last_increment)) / (SELECT regen_secs FROM cfg)
          )::int)
        ) AS balance,
        last_increment
      FROM public.user_items
      WHERE user_id = uid
    )
  SELECT jsonb_build_object(
    'balance', (SELECT balance FROM bal),
    'cap', (SELECT cap FROM cfg),
    'is_vip', (SELECT is_vip FROM p),
    'next_regen_seconds',
      CASE
        WHEN (SELECT balance FROM bal) >= (SELECT cap FROM cfg) THEN NULL
        ELSE (SELECT regen_secs FROM cfg)
             - (EXTRACT(EPOCH FROM (now() - (SELECT last_increment FROM bal)))::int
                % (SELECT regen_secs FROM cfg))
      END
  );
$function$;

-- Updated tickle RPC with VIP-aware cap + regen.
CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_vip boolean;
  cap_val int;
  regen_secs int;
  intervals_elapsed int;
  current_balance int;
  new_balance int;
  active_season_id text;
BEGIN
  SELECT COALESCE(profiles.is_vip, false) INTO is_vip
  FROM public.profiles WHERE id = uid;

  cap_val := CASE WHEN is_vip THEN 50 ELSE 25 END;
  regen_secs := CASE WHEN is_vip THEN 1800 ELSE 3600 END;

  SELECT
    GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / regen_secs)::int),
    item_count
  INTO intervals_elapsed, current_balance
  FROM public.user_items
  WHERE user_id = uid
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No user_items row for user %', uid;
  END IF;

  current_balance := LEAST(cap_val, current_balance + intervals_elapsed);

  IF current_balance <= 0 THEN
    UPDATE public.user_items
    SET item_count = current_balance,
        last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
    WHERE user_id = uid;
    RETURN current_balance;
  END IF;

  new_balance := current_balance - 1;

  UPDATE public.user_items
  SET item_count = new_balance,
      last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
  WHERE user_id = uid;

  UPDATE public.profiles SET counter = counter + 1 WHERE id = uid;

  -- Battle pass XP
  SELECT id INTO active_season_id
  FROM public.seasons
  WHERE starts_at <= now() AND ends_at >= now()
  ORDER BY starts_at DESC LIMIT 1;

  IF active_season_id IS NOT NULL THEN
    INSERT INTO public.user_season_progress (user_id, season_id, xp)
    VALUES (uid, active_season_id, 1)
    ON CONFLICT (user_id, season_id) DO UPDATE
      SET xp = public.user_season_progress.xp + 1;
  END IF;

  RETURN new_balance;
END;
$function$;

-- Dev RPC to flip VIP on/off (replaced by RevenueCat webhook later)
CREATE OR REPLACE FUNCTION public.dev_set_vip(target boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
  SET is_vip = target,
      vip_until = CASE WHEN target THEN now() + INTERVAL '30 days' ELSE NULL END
  WHERE id = caller_id;
  RETURN jsonb_build_object('ok', true, 'is_vip', target);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_set_vip(boolean) TO authenticated;
