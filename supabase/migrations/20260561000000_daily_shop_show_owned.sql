-- daily_shop() previously excluded any item the caller already
-- owned. As a player's collection grows, the daily rotation
-- shrinks toward "same 5 unowned items, every day" — and they
-- never see the items they DO own showcased in today's drop.
--
-- Change: drop the `uh.hat_id IS NULL` exclusion. Owned items
-- now appear in the rotation alongside un-owned. The client
-- already branches on ownership: owned items show Wear / Take
-- off buttons instead of Buy / Not enough, so the UI handles
-- the state cleanly. Net effect for a player with a full
-- closet: the daily drop becomes a richer rotation of
-- everything they have + everything they could buy.
--
-- The cape filter stays — capes are removed-from-game (per
-- 20260514060000_remove_capes.sql) and shouldn't surface
-- anywhere.

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
			WHERE h.category <> 'cape'
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
