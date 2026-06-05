-- Keep cost-0 items out of the random daily rotation.
--
-- Bug: the default barn backdrop ('homestead_barn', cost 0, auto-granted to
-- every user) and other earned/free items (referral 'messenger', season-pass
-- hats at cost 0) were eligible for daily_shop() and got surfaced as
-- "purchasable" tiles. The homestead_barn art is the cozy barn scene with the
-- pig in it, so it read as "Rosie is for sale" — nonsensical, since everyone
-- already owns it and it's the fallback background.
--
-- Fix: daily_shop() only ever sells things, so restrict candidates to cost > 0.
-- Free/earned/default items are obtained through the pass, referrals, or the
-- new-user grant — never the daily store. Body otherwise identical to
-- 20260571000000_world_cup_event.sql (still excludes 'cape' + 'flag').
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH
		today_seed AS (SELECT current_date::text AS d),
		candidates AS (
			SELECT h.*,
				abs(hashtext(h.id || (SELECT d FROM today_seed))) AS rnk
			FROM public.hats h
			WHERE h.category NOT IN ('cape', 'flag')
				AND h.cost > 0
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
