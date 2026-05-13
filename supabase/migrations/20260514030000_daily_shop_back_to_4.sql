-- Daily shop count: 8 → 4. The bento moved to a 4×4 tile layout
-- where every cell is at least 2×2 (≥4 grid units), making each
-- item visually substantial. Max 4 items fit cleanly under those
-- constraints; more would force tiny <4-unit cells.
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
			LEFT JOIN public.user_hats uh
				ON uh.hat_id = h.id AND uh.user_id = auth.uid()
			WHERE uh.hat_id IS NULL
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 4;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
