-- The current homepage backdrop ("homepage-bg.jpg") becomes its own
-- equippable item: 'homestead_barn'. Everyone already on the platform
-- gets it added to their wardrobe; new signups receive it via the
-- handle_new_user trigger update at the bottom of this migration.
--
-- It's the fallback background when nothing else is equipped, so even
-- a user who never equips anything sees the same view as before.

-- ── 1. Catalog row ─────────────────────────────────────────────
INSERT INTO public.hats
	(id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES (
	'homestead_barn',
	'Homestead Barn',
	'🏚',
	NULL,
	0,
	100,          -- before forest_grove (105)
	'background',
	'common',
	'The cozy barn where every tickle starts.'
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Backfill: grant homestead_barn to every existing user ───
INSERT INTO public.user_hats (user_id, hat_id)
SELECT p.id, 'homestead_barn'
FROM public.profiles p
ON CONFLICT (user_id, hat_id) DO NOTHING;

-- ── 3. Update handle_new_user so future signups get it too ─────
-- Keep the existing profile-create behavior and append a user_hats
-- insert. Safe-default to NULL coalesces in case raw_user_meta_data
-- isn't populated by every provider.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
	INSERT INTO public.profiles (id, full_name, avatar_url)
	VALUES (
		new.id,
		new.raw_user_meta_data->>'full_name',
		new.raw_user_meta_data->>'avatar_url'
	);

	-- Seed the default backdrop. ON CONFLICT in case some other
	-- migration also grants it.
	INSERT INTO public.user_hats (user_id, hat_id)
	VALUES (new.id, 'homestead_barn')
	ON CONFLICT (user_id, hat_id) DO NOTHING;

	RETURN new;
END;
$function$;
