-- World Cup event go-live: an equippable flag slot, keep flags out of the
-- random daily rotation, and broadcast the launch announcement to everyone.

-- 1. New equip slot for the country flag cosmetic (category 'flag').
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_flag_id text
		REFERENCES public.hats(id) ON DELETE SET NULL;

-- 2. daily_shop(): also exclude category 'flag' — flags live only in the
--    World Cup shop section, never the random daily drop. (Body otherwise
--    identical to 20260561000000_daily_shop_show_owned.sql.)
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
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- 3. Broadcast the launch announcement to every real player (persists in the
--    while-you-were-away modal even without push permission).
INSERT INTO public.system_announcements (user_id, kind, title, body, data)
SELECT p.id, 'world_cup',
	'The Hog Cup has kicked off!',
	'The World Cup is here — fly your country''s colors! 47 national flags are now in the Shop. Rep your team all tournament long.',
	'{}'::jsonb
FROM public.profiles p
WHERE p.username IS NOT NULL AND p.username <> '';
