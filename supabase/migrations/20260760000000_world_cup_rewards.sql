-- Hog Cup / World Cup rewards.
--
-- This migration only mints the historical achievement and Spain's champions
-- reward. World Cup choices, flags, allegiance data, and choose_allegiance()
-- remain intact for future UI reuse; the current client owns their visibility.

-- ── 1. Spain champions' reward ─────────────────────────────────────────────
-- Grant-only held cosmetic: cost 0 keeps it out of the daily shop and buy_hat.
INSERT INTO public.hats
	(id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES
	('golden_hog_cup', 'Golden Hog Cup', NULL, NULL, 0, 473, 'held', 'legendary',
	 'A golden champions'' trophy for the pigs who backed Spain to the final whistle. Earned, never sold.')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Tournament participation achievement ────────────────────────────────
-- Directly backfilled below because this is a closed historical event, not a
-- live counter that belongs in try_claim_achievements(). Non-participants keep
-- the locked badge as a record of the 2026 event.
INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES
	('flew_the_colors', 'world_cup_2026', 1, 'Flew the Colors',
	 'Backed a team in the 2026 Hog Cup.', 1,
	 NULL, NULL, 0, 'trophy', 223, false, 'social')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
SELECT p.id, 'flew_the_colors', 1, 0
FROM public.profiles p
WHERE p.allegiance_country IS NOT NULL
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Reward the flag actually flying at closeout. This deliberately reads the
-- equipped slot rather than historical ownership or allegiance_country: flags
-- could also be changed from the Closet, and "currently repping Spain" means
-- active_flag_id = flag_spain at the closing snapshot.
INSERT INTO public.user_hats (user_id, hat_id)
SELECT p.id, 'golden_hog_cup'
FROM public.profiles p
WHERE p.active_flag_id = 'flag_spain'
ON CONFLICT (user_id, hat_id) DO NOTHING;

INSERT INTO public.system_announcements (user_id, kind, title, body, data)
SELECT p.id, 'world_cup',
	'Spain brought home the cup!',
	'You backed the champions to the final whistle. The Golden Hog Cup is waiting in your Closet under Held.',
	jsonb_build_object('screen', 'shop', 'view', 'wardrobe', 'hat', 'golden_hog_cup')
FROM public.profiles p
WHERE p.active_flag_id = 'flag_spain';
