-- Alignment regen: linear, not stepped (player feedback).
--
-- The alignment factor in regen_secs_for was a step function — ±10% only past
-- ±25 (Angel/Goblin), flat 1.0 in between. Next to the SMOOTHLY-scaling
-- blessing/curse effects (±0.5%/point) the Me page's "Regen 0%" at e.g. -19
-- read as a bug. Now linear: pct = clamp(score * 0.4, -10, +10) — identical
-- ±10% at/beyond ±25 (Angels/Goblins keep exactly their current bonus), smooth
-- ramp through the middle. factor = 1 - pct/100 (generous → faster → smaller
-- interval). Body otherwise verbatim from 20260598_happiness.sql (the latest
-- def); floor GREATEST(60, …) unchanged. Client mirror: utils/alignment.ts
-- alignmentEffects().

CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		(CASE WHEN COALESCE(
			(SELECT is_vip FROM public.profiles WHERE id = uid), false)
		 THEN 1800 ELSE 3600 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'warm_tea'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		-- Alignment: LINEAR ±10% cap, full strength at ±25 (was a ±25 step).
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		-- Happiness: 1.15× (sad) → 0.85× (happy), linear.
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
	)::int);
$function$;
