-- Halloween weekend shelf (founder call 2026-10-29).
--
-- For the UTC days 2026-10-30 .. 2026-11-02 the daily shop leads with four
-- items that already ship in every binary (art in the 1.2 / build-143 line
-- since 491affaf / 4f4a5e06): Skull Mask, Pumpkin Patch, Firefly Lantern,
-- Candy Land. The other four slots roll from the usual per-day hash, so the
-- drop stays a full, even 8. Outside the window the CASE is 1 for every row
-- and the ordering is byte-for-byte the old one: the shelf expires on its own,
-- no follow-up migration needed. No client change; the live App Store build
-- renders it as an ordinary drop.
--
-- daily_shop() carried VERBATIM from 20260761000000_shop_exclude_scarf_necklace.sql
-- (the alphabetically-latest def). The ONLY change is the leading ORDER BY key.
-- Signature unchanged -> CREATE OR REPLACE, no DROP. The four ids already pass
-- every WHERE filter on prod (cost > 0, not pass_exclusive, not members_only,
-- categories mask / background / held).
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT h.*
	FROM public.hats h
	WHERE h.category NOT IN ('cape', 'flag', 'scarf', 'necklace')
		AND h.cost > 0
		AND NOT h.pass_exclusive   -- battle-pass rewards are earned, never sold
		AND NOT h.members_only      -- members items live in the Members section
	ORDER BY
		-- Halloween weekend shelf: these four lead the drop, 10-30 .. 11-02 UTC.
		CASE
			WHEN current_date BETWEEN DATE '2026-10-30' AND DATE '2026-11-02'
				AND h.id IN ('skull_mask', 'pumpkin_patch', 'firefly_lantern', 'candyland')
			THEN 0 ELSE 1
		END,
		-- Deterministic-per-UTC-day RNG order.
		abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;
GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
