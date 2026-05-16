-- Capes are removed from the app: filter them out of daily_shop and
-- swap the 3 cape rewards in the season 1 free track for auras from
-- the leftover catalog. Catalog rows stay in the hats table (no FK
-- breakage) but every surface that picks them is gated.
--
-- Scarves are already in HIDDEN_CATEGORIES alongside capes but stay
-- in daily_shop for now — those have ongoing art work; once that
-- lands they can be flipped back on without a migration.

-- ── 1. daily_shop skips capes ──────────────────────────────────
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
			  AND h.category <> 'cape'
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- ── 2. Replace cape rewards in the free battle pass track ─────
-- Tier 10: silk_cape   → ice_aura
-- Tier 20: royal_cape  → electric_aura
-- Tier 27: hero_cape   → fire_aura
UPDATE public.season_tiers
SET reward_type = 'aura',
	reward_value = '{"hat_id": "ice_aura"}'::jsonb,
	display_label = 'Ice aura'
WHERE season_id = 'snout_season_1'
  AND tier = 10
  AND track = 'free';

UPDATE public.season_tiers
SET reward_type = 'aura',
	reward_value = '{"hat_id": "electric_aura"}'::jsonb,
	display_label = 'Electric aura'
WHERE season_id = 'snout_season_1'
  AND tier = 20
  AND track = 'free';

UPDATE public.season_tiers
SET reward_type = 'aura',
	reward_value = '{"hat_id": "fire_aura"}'::jsonb,
	display_label = 'Fire aura'
WHERE season_id = 'snout_season_1'
  AND tier = 27
  AND track = 'free';
