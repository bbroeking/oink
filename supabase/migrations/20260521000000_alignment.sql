-- Phase 0 of Season 1 (Goblins vs Angels): the alignment continuum.
--
-- alignment_score is a -100..+100 integer derived purely from a user's
-- trade behavior. There are NO explicit factions to join — your score
-- is your reputation, and your reputation is everything you've done.
-- See docs/season-1-goblins-vs-angels.md for the design.
--
-- This migration adds:
--   1. profiles.alignment_score + profiles.alignment_updated_at
--   2. alignment_label(score) → 'goblin' | 'neutral' | 'angel'
--   3. shift_alignment(target_user_id, delta) SECURITY DEFINER RPC
--   4. trigger on tickle_trades to shift alignment when a trade is
--      fulfilled (there is no repay step — see tickle_trades.sql)
--
-- Phase 0 does NOT include: blessings/curses (separate migration),
-- 7-day debt-decay (needs a cron job, deferred), inactivity decay
-- (deferred).

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS alignment_score      int         NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS alignment_updated_at timestamptz NOT NULL DEFAULT now();

-- Sanity clamp. We always go through shift_alignment, but a CHECK
-- catches any direct UPDATE that slips through.
ALTER TABLE public.profiles
	DROP CONSTRAINT IF EXISTS profiles_alignment_score_range;
ALTER TABLE public.profiles
	ADD CONSTRAINT profiles_alignment_score_range
		CHECK (alignment_score BETWEEN -100 AND 100);

-- ── alignment_label: SQL function so the label is derivable in
-- queries + matches the client-side helper exactly.
-- Hysteresis: ±34 thresholds. A score of exactly +34 lands in
-- 'angel'; +33 lands in 'neutral'. Mirror for negative.
CREATE OR REPLACE FUNCTION public.alignment_label(score int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT CASE
		WHEN score >=  34 THEN 'angel'
		WHEN score <= -34 THEN 'goblin'
		ELSE 'neutral'
	END;
$$;

-- ── shift_alignment: the one chokepoint for adjusting score.
-- Clamps to [-100, +100] and bumps alignment_updated_at so the
-- (future) inactivity decay job has a baseline.
CREATE OR REPLACE FUNCTION public.shift_alignment(
	target_user_id uuid,
	delta int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	new_score int;
BEGIN
	UPDATE public.profiles
		SET alignment_score      = GREATEST(-100, LEAST(100, alignment_score + delta)),
		    alignment_updated_at = now()
		WHERE id = target_user_id
		RETURNING alignment_score INTO new_score;
	RETURN new_score;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.shift_alignment(uuid, int) TO authenticated;

-- ── trigger: tickle_trades fulfill → alignment shift.
-- On pending → fulfilled:
--   giver (target_id)    gave N from their own bank for a bare
--                        social promise → +2 (generous).
--   asker (requester_id) pocketed 2N for free → -2 (greedy).
-- There is no repay step — asking-and-never-giving-back is exactly
-- how a player drifts Goblin. Cancelled shifts neither side.
CREATE OR REPLACE FUNCTION public.tickle_trades_alignment_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.status = 'fulfilled' AND OLD.status = 'pending' THEN
		PERFORM public.shift_alignment(NEW.target_id, 2);      -- giver: generous
		PERFORM public.shift_alignment(NEW.requester_id, -2);  -- asker: greedy
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickle_trades_alignment_shift_trig ON public.tickle_trades;
CREATE TRIGGER tickle_trades_alignment_shift_trig
	AFTER UPDATE ON public.tickle_trades
	FOR EACH ROW EXECUTE FUNCTION public.tickle_trades_alignment_shift();
