-- Snout Season — battle pass system
-- Seasons run for a fixed duration. Each season has 30 tiers x 2 tracks (free/premium).
-- Each tickle = 1 XP toward the active season. 100 XP per tier.

-- Seasons catalog
CREATE TABLE public.seasons (
  id text PRIMARY KEY,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  total_tiers int NOT NULL DEFAULT 30,
  xp_per_tier int NOT NULL DEFAULT 100,
  premium_price_cents int NOT NULL DEFAULT 299,
  premium_plus_price_cents int NOT NULL DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tier reward catalog. One row per (season, tier, track).
CREATE TABLE public.season_tiers (
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  tier int NOT NULL CHECK (tier >= 1),
  track text NOT NULL CHECK (track IN ('free', 'premium')),
  reward_type text NOT NULL,
    -- 'tickles' | 'hat' | 'title' | 'background' | 'pig_skin' | 'boost' | 'mystery_box' | 'cap_increase'
  reward_value jsonb NOT NULL,
    -- e.g. {"amount": 100} or {"hat_id": "wizard"} or {"title": "Pork Lord"}
  display_label text NOT NULL,
  PRIMARY KEY (season_id, tier, track)
);

-- Per-user season progress
CREATE TABLE public.user_season_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  premium_unlocked boolean NOT NULL DEFAULT false,
  premium_plus_unlocked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, season_id)
);

-- Per-user claimed tier rewards
CREATE TABLE public.user_tier_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  tier int NOT NULL,
  track text NOT NULL CHECK (track IN ('free', 'premium')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, tier, track)
);

-- RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_season_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tier_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons public" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "Tiers public" ON public.season_tiers FOR SELECT USING (true);
CREATE POLICY "View own progress" ON public.user_season_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "View own claims" ON public.user_tier_claims
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.seasons TO authenticated, anon;
GRANT SELECT ON public.season_tiers TO authenticated, anon;
GRANT SELECT ON public.user_season_progress TO authenticated;
GRANT SELECT ON public.user_tier_claims TO authenticated;

-- ========== Functions ==========

set check_function_bodies = off;

-- Returns the currently active season (one row, latest started before now and not yet ended)
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.seasons
  WHERE starts_at <= now() AND ends_at >= now()
  ORDER BY starts_at DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.active_season() TO authenticated, anon;

-- Returns full state for the caller in the active season:
-- {season, tiers, xp, current_tier, premium_unlocked, premium_plus_unlocked, claims[]}
CREATE OR REPLACE FUNCTION public.season_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  season public.seasons;
  progress public.user_season_progress;
  current_tier int;
BEGIN
  SELECT * INTO season FROM public.active_season();
  IF season.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF caller_id IS NOT NULL THEN
    SELECT * INTO progress
    FROM public.user_season_progress
    WHERE user_id = caller_id AND season_id = season.id;
  END IF;

  current_tier := LEAST(season.total_tiers, GREATEST(1, COALESCE(progress.xp, 0) / season.xp_per_tier + 1));
  -- if xp >= total_tiers * xp_per_tier, current_tier = total_tiers (capped)
  IF COALESCE(progress.xp, 0) >= season.total_tiers * season.xp_per_tier THEN
    current_tier := season.total_tiers;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'season', to_jsonb(season),
    'tiers', (
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.tier, t.track)
      FROM public.season_tiers t
      WHERE t.season_id = season.id
    ),
    'xp', COALESCE(progress.xp, 0),
    'current_tier', current_tier,
    'premium_unlocked', COALESCE(progress.premium_unlocked, false),
    'premium_plus_unlocked', COALESCE(progress.premium_plus_unlocked, false),
    'claims', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tier', tier, 'track', track))
      FROM public.user_tier_claims
      WHERE user_id = caller_id AND season_id = season.id
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.season_state() TO authenticated, anon;

-- Claim a tier reward. Validates ownership/eligibility, grants the reward, records the claim.
CREATE OR REPLACE FUNCTION public.claim_tier_reward(target_tier int, target_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  season public.seasons;
  progress public.user_season_progress;
  reward record;
  current_tier int;
  reward_type_lc text;
  reward_payload jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO season FROM public.active_season();
  IF season.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
  END IF;

  SELECT * INTO progress
  FROM public.user_season_progress
  WHERE user_id = caller_id AND season_id = season.id
  FOR UPDATE;

  IF progress.user_id IS NULL THEN
    INSERT INTO public.user_season_progress (user_id, season_id) VALUES (caller_id, season.id);
    SELECT * INTO progress
    FROM public.user_season_progress
    WHERE user_id = caller_id AND season_id = season.id
    FOR UPDATE;
  END IF;

  current_tier := LEAST(season.total_tiers, GREATEST(1, progress.xp / season.xp_per_tier + 1));
  IF progress.xp >= season.total_tiers * season.xp_per_tier THEN
    current_tier := season.total_tiers;
  END IF;

  IF target_tier > current_tier THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'tier_locked', 'current_tier', current_tier);
  END IF;

  IF target_track = 'premium' AND NOT progress.premium_unlocked THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'premium_locked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_tier_claims
    WHERE user_id = caller_id AND season_id = season.id
      AND tier = target_tier AND track = target_track
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  SELECT * INTO reward
  FROM public.season_tiers
  WHERE season_id = season.id AND tier = target_tier AND track = target_track;

  IF reward.season_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
  END IF;

  reward_type_lc := reward.reward_type;
  reward_payload := reward.reward_value;

  -- Grant the reward by type
  IF reward_type_lc = 'tickles' THEN
    UPDATE public.profiles
    SET counter = counter + (reward_payload->>'amount')::bigint
    WHERE id = caller_id;
  ELSIF reward_type_lc = 'hat' THEN
    INSERT INTO public.user_hats (user_id, hat_id)
    VALUES (caller_id, reward_payload->>'hat_id')
    ON CONFLICT (user_id, hat_id) DO NOTHING;
  ELSE
    -- Other reward types (title, background, pig_skin, boost, mystery_box, cap_increase)
    -- are recorded as claimed but their effects are stubbed for now.
    NULL;
  END IF;

  INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
  VALUES (caller_id, season.id, target_tier, target_track);

  RETURN jsonb_build_object('ok', true, 'reward_type', reward_type_lc);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

-- Stub for unlocking premium (will be replaced by IAP receipt verification).
-- For testing: anyone can call to unlock.
CREATE OR REPLACE FUNCTION public.dev_unlock_premium(plus boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  season public.seasons;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO season FROM public.active_season();
  IF season.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
  END IF;

  INSERT INTO public.user_season_progress (user_id, season_id, premium_unlocked, premium_plus_unlocked)
  VALUES (caller_id, season.id, true, plus)
  ON CONFLICT (user_id, season_id) DO UPDATE
    SET premium_unlocked = true,
        premium_plus_unlocked = excluded.premium_plus_unlocked OR public.user_season_progress.premium_plus_unlocked;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_unlock_premium(boolean) TO authenticated;

-- Hook tickle into XP: replace update_profile_and_item_count to also bump XP.
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
