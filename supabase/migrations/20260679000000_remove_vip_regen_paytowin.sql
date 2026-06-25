-- Remove the VIP pay-to-win tickle-regen advantage.
--
-- regen_secs_for() baked `CASE WHEN is_vip THEN 1800 ELSE 3600` — VIPs
-- regenerated tickles 2× faster (30 min vs 1 h) on the core MINTED resource.
-- That's "money buys advantage," which the SKILL.md charter refuses. Base regen
-- is now the SAME for everyone (3600s). The VIP perk is the larger tickle-bank
-- CAP only (50 vs 25), kept intact in barn_visit_status / tickle_info /
-- tickle_balance / update_profile_and_item_count — with equal regen, the cap is
-- a convenience (bigger reserve), not a power advantage.
--
-- Carried VERBATIM from 20260647 (the latest def) apart from the base value —
-- the warm_tea / sluggish_snout / alignment / happiness / war-winner multipliers
-- are unchanged (carry-latest-def discipline; a stale base would silently drop
-- the Mud-Fights war_winner buff added in 20260647).

CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		-- Base regen: SAME for everyone. VIP no longer gets 2× (was pay-to-win).
		3600
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
		-- Mud Fights: war-winner regen buff — ×0.85 (BUFF_MULT) for 72h after a win.
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;
