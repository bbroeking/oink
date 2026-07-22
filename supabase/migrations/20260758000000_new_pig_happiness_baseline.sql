-- New-player happiness baseline: 60 -> 65 (just into the Happy band).
--
-- Bug (2026-07-20): a brand-new pig read as neutral/sad on first launch. The
-- mood sprite is driven entirely by utils/happiness.moodAnimation():
--   Sad 20-37, Content 38-62 (the neutral `idle` face), Happy 63-80.
-- A fresh account's happiness comes ONLY from the profiles.happiness column
-- DEFAULT — handle_new_user() (live def in 20260566000000_referrals.sql) never
-- sets happiness, so the column default IS the new-user init lever. That default
-- was 60, which lands mid-Content: the flat `idle` pose, not the smiling Happy
-- sprite. The founder wants a new pig to open smiling (2026-07-20 call: 65).
--
-- Fix: raise the column DEFAULT to 65 — just over the 63 Happy threshold, so a
-- new pig smiles without beaming (the founder chose 65 over 70 to keep it
-- pleased-but-not-manic). Headroom: 27 pts above the Sad threshold (~54h of
-- 0.5/hr neglect-decay) and 15 below the 80 ceiling. No function is rewritten
-- (the default is the whole lever), so there's no carry-latest-def surface here.
-- moodAnimation's thresholds are correct and untouched: 60 was never "sad", just
-- not "happy" — this is a baseline change, not a threshold fix. Genuinely-
-- neglected pigs still decay to Sad exactly as before.

ALTER TABLE public.profiles
	ALTER COLUMN happiness SET DEFAULT 65;

-- Lift existing brand-new pigs that are provably untouched to the new baseline.
-- Guard is conservative and only-up:
--   • happiness = 60           → the exact old default; any self-/friend-tickle
--                                routes through apply_happiness() which rewrites
--                                the value off 60, so 60 == zero happiness
--                                activity since signup.
--   • happiness_window_gain = 0 → no gain has ever been applied this window.
-- Together these isolate freshly-created, never-engaged pigs. No engaged pig is
-- at exactly 60 (598 backfilled existing pigs to 50; 621 floored live<50 to 50),
-- so this can only promote genuinely-new accounts and never demotes anyone. The
-- clocks are reset so live == stored == 65 renders immediately.
UPDATE public.profiles
	SET happiness              = 65,
	    happiness_updated_at   = now(),
	    happiness_window_start = now(),
	    happiness_window_gain  = 0
	WHERE happiness = 60
	  AND happiness_window_gain = 0;
