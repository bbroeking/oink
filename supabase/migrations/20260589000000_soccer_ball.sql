-- World Cup soccer ball — a held cosmetic that stays purchasable for the whole
-- tournament.
--
-- 1. Seed the item. It renders the ⚽ emoji in the shop until real art is
--    dropped at assets/images/hats/soccer_ball.png + wired into HAT_IMAGES
--    (the shop tile falls back to the category emoji, so it's buyable now;
--    the on-pig render needs the art + a held anchor).
-- 2. Pin it into the daily drop so it's reliably featured all tournament. It's
--    also always buyable via Browse (the full catalog), so "available at all
--    times" holds regardless. The pin is a WC-only hardcode on the id — remove
--    the first ORDER BY key after the tournament. Keeps the cost > 0 filter
--    from 20260584 so free/default items still never appear.

INSERT INTO public.hats
	(id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES (
	'soccer_ball', 'Soccer Ball', '⚽', NULL, 250, 95, 'held', 'uncommon',
	'Give it a good kick — it''s World Cup season.'
)
ON CONFLICT (id) DO NOTHING;

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
	-- Pin the soccer ball to the daily drop for the World Cup; the rest stay
	-- RNG. Drop the first ORDER BY key once the tournament is over.
	ORDER BY (id = 'soccer_ball') DESC, rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
