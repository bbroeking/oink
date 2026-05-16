-- Dev seed: unlock everything for the user with username = 'Brian'.
-- Grants every catalog item, maxes XP so all season-pass tiers are
-- reachable, and flips premium_unlocked so the premium track is
-- claimable too — full test surface in one migration.
--
-- Targets only profiles.username = 'Brian'; if that user doesn't
-- exist or hasn't picked a username yet, the migration is a no-op.

-- ── 1. Grant every catalog hat (including backgrounds/auras) ──
INSERT INTO public.user_hats (user_id, hat_id)
SELECT p.id, h.id
FROM public.profiles p
CROSS JOIN public.hats h
WHERE p.username = 'Brian'
ON CONFLICT (user_id, hat_id) DO NOTHING;

-- ── 2. Max XP + premium for the active season ─────────────────
UPDATE public.user_season_progress usp
SET xp = s.total_tiers * s.xp_per_tier,
    premium_unlocked = true,
    premium_plus_unlocked = true
FROM public.profiles p,
     public.active_season() s
WHERE usp.user_id = p.id
  AND usp.season_id = s.id
  AND p.username = 'Brian';

-- Some users may not have a user_season_progress row yet if they
-- haven't earned any XP — seed one for them so the season state RPC
-- has something to bump.
INSERT INTO public.user_season_progress (user_id, season_id, xp, premium_unlocked, premium_plus_unlocked)
SELECT p.id, s.id,
       s.total_tiers * s.xp_per_tier,
       true,
       true
FROM public.profiles p
CROSS JOIN public.active_season() s
WHERE p.username = 'Brian'
ON CONFLICT (user_id, season_id) DO NOTHING;
