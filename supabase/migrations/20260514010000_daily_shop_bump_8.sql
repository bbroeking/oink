-- Daily shop rotation: 5 → 8 items per day. The bento grid in the
-- daily view places one "hero" + 7 smaller tiles; with 5 items the
-- bottom rows of the layout were empty.
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
	LIMIT 8;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
