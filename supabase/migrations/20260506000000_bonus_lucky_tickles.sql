-- Bonus mechanic: lifetime tickle score + daily lucky-tickle bonus.
-- Per docs/BONUS_SPEC.md.
--
-- Adds:
--   profiles.tickles_earned   bigint   — never decreases. Leaderboard uses this.
--   daily_lucky_state          row per UTC date with global counter + 3 lucky #s
--   daily_lucky_claims         one row per (date, number) when someone wins
--   roll_lucky_numbers()       picks 3 random distinct integers
--   lucky_today()              UI feed
--
-- Rewrites update_profile_and_item_count to:
--   - also +1 tickles_earned
--   - also +1 global lucky counter, atomic claim if it lands on a lucky #
--   - if won: +5 to both counter + tickles_earned

-- ───────────────────────── Lifetime tickles ─────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tickles_earned bigint NOT NULL DEFAULT 0;

-- Backfill: existing players get tickles_earned = counter as a floor (most
-- accurate proxy without historical spend logs).
UPDATE public.profiles
   SET tickles_earned = counter
 WHERE tickles_earned = 0;

CREATE INDEX IF NOT EXISTS profiles_tickles_earned_idx
  ON public.profiles (tickles_earned DESC);

-- ───────────────────────── Lucky-tickle tables ─────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_lucky_state (
  d              date PRIMARY KEY,
  global_counter bigint NOT NULL DEFAULT 0,
  numbers        integer[] NOT NULL,
  rolled_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_lucky_claims (
  d          date NOT NULL,
  number     integer NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (d, number)
);

CREATE INDEX IF NOT EXISTS daily_lucky_claims_user_idx
  ON public.daily_lucky_claims (user_id, claimed_at DESC);

ALTER TABLE public.daily_lucky_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_lucky_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lucky state public"   ON public.daily_lucky_state;
DROP POLICY IF EXISTS "lucky claims public"  ON public.daily_lucky_claims;
CREATE POLICY "lucky state public"  ON public.daily_lucky_state  FOR SELECT USING (true);
CREATE POLICY "lucky claims public" ON public.daily_lucky_claims FOR SELECT USING (true);

GRANT SELECT ON public.daily_lucky_state, public.daily_lucky_claims TO authenticated, anon;

-- ───────────────────────── Helper: roll lucky numbers ─────────────────────────

CREATE OR REPLACE FUNCTION public.roll_lucky_numbers()
RETURNS integer[]
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  avg_recent numeric;
  upper_bound int;
  picks integer[];
BEGIN
  -- Average global tickle volume over last 3 days, default 100 if no data.
  SELECT COALESCE(AVG(global_counter), 100)
    INTO avg_recent
    FROM public.daily_lucky_state
   WHERE d > CURRENT_DATE - INTERVAL '3 days';

  upper_bound := GREATEST(50, FLOOR(avg_recent)::int);

  -- 3 distinct random integers in [5, upper_bound]
  SELECT ARRAY(
    SELECT DISTINCT n
      FROM (
        SELECT (5 + FLOOR(random() * (upper_bound - 5 + 1)))::int AS n
          FROM generate_series(1, 30)
      ) candidates
     LIMIT 3
  ) INTO picks;

  RETURN picks;
END;
$function$;

-- ───────────────────────── Tickle RPC ─────────────────────────
-- Replaces the prior version (most recently from 20260504010000_vip.sql).
-- Adds: tickles_earned bump, global lucky counter increment, atomic claim.

-- DROP first because the return type changes (was bigint, now jsonb).
-- Postgres rejects CREATE OR REPLACE when the return shape differs.
DROP FUNCTION IF EXISTS public.update_profile_and_item_count(uuid);

CREATE FUNCTION public.update_profile_and_item_count(uid uuid)
RETURNS jsonb
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
  bumped_counter bigint;
  lucky_numbers integer[];
  lucky_won int := NULL;
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
    RETURN jsonb_build_object('balance', current_balance, 'lucky_won', null);
  END IF;

  new_balance := current_balance - 1;

  UPDATE public.user_items
  SET item_count = new_balance,
      last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
  WHERE user_id = uid;

  -- Personal: balance counter + lifetime tickles
  UPDATE public.profiles
  SET counter = counter + 1,
      tickles_earned = tickles_earned + 1
  WHERE id = uid;

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

  -- Global daily lucky counter — atomic insert-or-bump.
  INSERT INTO public.daily_lucky_state (d, global_counter, numbers)
       VALUES (CURRENT_DATE, 1, public.roll_lucky_numbers())
  ON CONFLICT (d) DO UPDATE
       SET global_counter = daily_lucky_state.global_counter + 1
    RETURNING global_counter, numbers
       INTO bumped_counter, lucky_numbers;

  -- Did this tickle land on a lucky number?
  IF bumped_counter = ANY(lucky_numbers) THEN
    -- Try to claim. If another tickle in the same instant beat us to it,
    -- ON CONFLICT bails and we don't double-pay.
    INSERT INTO public.daily_lucky_claims (d, number, user_id)
    VALUES (CURRENT_DATE, bumped_counter::int, uid)
    ON CONFLICT (d, number) DO NOTHING;

    -- Was the claim ours? RETURNING tells us.
    IF EXISTS (
      SELECT 1 FROM public.daily_lucky_claims
        WHERE d = CURRENT_DATE
          AND number = bumped_counter::int
          AND user_id = uid
    ) THEN
      lucky_won := bumped_counter::int;
      -- Award +5 to balance and lifetime
      UPDATE public.profiles
      SET counter = counter + 5,
          tickles_earned = tickles_earned + 5
      WHERE id = uid;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'balance', new_balance,
    'lucky_won', lucky_won,
    'global_counter', bumped_counter
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roll_lucky_numbers() TO authenticated;

-- ───────────────────────── lucky_today() — feed for Barn UI ─────────────────────────

CREATE OR REPLACE FUNCTION public.lucky_today()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object(
    'numbers', COALESCE(s.numbers, ARRAY[]::integer[]),
    'global_counter', COALESCE(s.global_counter, 0),
    'claims', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'number', c.number,
                'username', p.username
              ) ORDER BY c.number)
         FROM public.daily_lucky_claims c
         LEFT JOIN public.profiles p ON p.id = c.user_id
        WHERE c.d = CURRENT_DATE),
      '[]'::jsonb
    )
  )
  FROM (SELECT * FROM public.daily_lucky_state WHERE d = CURRENT_DATE) s
  RIGHT JOIN (SELECT 1) one ON true;
$function$;

GRANT EXECUTE ON FUNCTION public.lucky_today() TO authenticated, anon;
