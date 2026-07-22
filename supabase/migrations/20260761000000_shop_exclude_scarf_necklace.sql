-- Founder call (2026-07-20): scarf and necklace never appear in the daily
-- shop. They were already hidden from placement on the client
-- (HIDDEN_CATEGORIES in constants/hats.ts), but the server's daily_shop()
-- still ROLLED them into the LIMIT 8 set — the client then stripped them via
-- filterPlaceable(), dropping 8 → an odd count and leaving a lonely dangling
-- card in the 2-column grid. Excluding them at the source keeps the daily
-- drop a full, even 8 placeable items and removes them from the shop
-- generally (the intended behavior).
--
-- daily_shop() carried VERBATIM from 20260688000000_members_only_cosmetics.sql
-- (the alphabetically-latest def) — the ONLY change is the category NOT IN
-- list gains 'scarf' and 'necklace'. Signature unchanged → CREATE OR REPLACE,
-- no DROP.
--
-- Migration AUTHORED ONLY — never `db push` autonomously (CLAUDE.md).
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
	-- Deterministic-per-UTC-day RNG order.
	ORDER BY abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;
GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
