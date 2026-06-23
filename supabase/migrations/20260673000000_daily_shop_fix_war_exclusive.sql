-- FIX: the Shop's "Today" tab was empty. daily_shop() is declared RETURNS SETOF
-- public.hats but its body projected a HAND-LISTED 10 columns
-- (id, name, emoji, image_path, cost, display_order, created_at, category, rarity,
-- description). A LATER migration — 20260660000000_war_spoils_grant.sql — added an
-- 11th column to public.hats (war_exclusive). A function returning SETOF <table>
-- must produce rows matching the table's CURRENT composite type, so the 10-column
-- projection stopped matching and every call to daily_shop() raised a return-type
-- mismatch at runtime. The client (utils/rpc.ts) swallows the error -> null -> the
-- default "Today" view rendered the empty state. (The Browse tab uses a direct
-- table select and was unaffected.) This is the ALTER-after-def footgun.
--
-- The robust fix: project h.* so the row type ALWAYS tracks public.hats and a future
-- ADD COLUMN can never desync it again. Exclusions (cape/flag), cost>0 and the 8-item
-- daily limit are carried verbatim from 20260632.
--
-- Also DROPPED the World-Cup `soccer_ball` daily pin: that item still has no art
-- (assets/images/hats/soccer_ball.png was never added — it renders the generic "held"
-- placeholder), so featuring it at the top of every daily drop looked broken. The
-- pin can be restored once the art ships.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT h.*
	FROM public.hats h
	WHERE h.category NOT IN ('cape', 'flag')
		AND h.cost > 0
	-- Deterministic-per-UTC-day RNG order.
	ORDER BY abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
