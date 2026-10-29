-- Halloween 2026 ("Spooky Snouts") catalog: the sellable accessories and
-- backgrounds for the `halloween_2026` seasonal shelf.
--
-- DEPENDS ON 20261029220000_seasonal_shelves.sql (public.seasonal_shelves,
-- hats.shelf_key, hats.shelf_lane). That migration owns the selling rules:
-- daily_shop() leaves shelf_lane = 'new' rows out of the daily drop, and
-- buy_hat() only sells them inside the shelf window. Every row below has
-- cost > 0, so without that contract they would roll into the daily drop on
-- push, including on old binaries that do not carry the art.
--
-- The shelf ships DARK: opens_at and closes_at are NULL. The founder sets the
-- window once the build that carries the art (constants/hats.ts, assets under
-- assets/images/{hats,backgrounds}/halloween-2026/) is live.
--
-- Ids are the docs/design/halloween-2026/content.json ids, which are also the
-- art file stems, so the card set's `unlocks` ids (seasonal_card_catalog
-- .item_id, halloween_2026_v1) join to these rows with no translation table.
-- None collides with an existing hats id or a members id.
--
-- Prices sit inside the economy bands (uncommon 200-400, rare 400-800,
-- epic 800-2000, legendary 2000-5000): bows and small held pieces low in
-- their band, full hats and lanterns mid, backgrounds high.
--
-- EXCLUDED FROM SALE (art is registered in constants/hats.ts, no hats row):
--   high_collar_scarf           scarf, in HIDDEN_CATEGORIES (unwearable on the client)
--   moon_charm                  necklace, never sold (20260761000000 founder call)
--   halloween_2026_little_haunt aura that needs a hand-placed offset first
--   the 11 *_costume pieces     out of scope (they wait on a body slot)
--
-- FK order: hats.shelf_key references seasonal_shelves(key) and
-- seasonal_shelves.backdrop_hat_id references hats(id), so the shelf row goes
-- in first with no backdrop, then the hats rows, then the backdrop.
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).

-- 1. The shelf (dark).
INSERT INTO public.seasonal_shelves (key, title, kicker, opens_at, closes_at, backdrop_hat_id)
VALUES ('halloween_2026', 'Spooky Snouts', 'moonlit mischief', NULL, NULL, NULL)
ON CONFLICT (key) DO NOTHING;

-- 2. The new pieces. Column order (id, name, emoji, cost, display_order,
-- category, ...) matches tools/placement_studio.py's catalog-row parser.
INSERT INTO public.hats
	(id, name, emoji, cost, display_order, category, rarity, description, members_only, pass_exclusive, shelf_key, shelf_lane)
VALUES
	-- Hats
	('moonbrew_witch_hat', 'Moonbrew Witch Hat', NULL, 1600, 1601, 'hat', 'epic', 'A moon-curled hat for stirring up cozy trouble.', false, false, 'halloween_2026', 'new'),
	('patchwork_bolt_cap', 'Bolt Headband', NULL, 1000, 1602, 'hat', 'epic', 'Soft bolts, bright scraps, excellent ideas.', false, false, 'halloween_2026', 'new'),
	('linen_knot_headwrap', 'Linen Knot Headwrap', NULL, 300, 1603, 'hat', 'uncommon', 'Ancient linens, freshly fluffed.', false, false, 'halloween_2026', 'new'),
	('lantern_sprout_cap', 'Lantern Sprout Cap', NULL, 650, 1604, 'hat', 'rare', 'A pumpkin lid that picked you.', false, false, 'halloween_2026', 'new'),
	('silly_sheet_ghost_hood', 'Silly Sheet Ghost Hood', NULL, 3500, 1605, 'hat', 'legendary', 'A wobbly boo with two ears poking through.', false, false, 'halloween_2026', 'new'),
	('moonpuff_wolf_ears', 'Moonpuff Wolf Ears', NULL, 600, 1606, 'hat', 'rare', 'Extra ears for hearing the treat bag open.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_pirate_tricorn_hat', 'Moonwake Tricorn', NULL, 1400, 1607, 'hat', 'epic', 'A captain’s hat for charting the candy seas.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_patched_straw_hat', 'Patchwork Straw Hat', NULL, 550, 1608, 'hat', 'rare', 'A harvest hat with room for one more patch.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_bat_ear_cap', 'Twilight Bat-Ear Cap', NULL, 650, 1609, 'hat', 'rare', 'Extra ears for every tiny midnight flutter.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_star_headwrap', 'Starlight Headwrap', NULL, 1200, 1610, 'hat', 'epic', 'A little starlight for seeing tomorrow’s treats.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_cobweb_crown', 'Cobweb Crown', NULL, 1500, 1611, 'hat', 'epic', 'Moon-silk finery for the ruler of the rafters.', false, false, 'halloween_2026', 'new'),
	-- Bows
	('stitched_bow', 'Stitched Bow', NULL, 400, 1612, 'bow', 'rare', 'Every stitch holds a tiny happy thought.', false, false, 'halloween_2026', 'new'),
	('crossbones_bow', 'Crossbones Bow', NULL, 450, 1613, 'bow', 'rare', 'A bow with a cheerful little rattle.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_straw_bow', 'Straw Bow', NULL, 200, 1614, 'bow', 'uncommon', 'Tied from the friendliest wisps in the field.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_bat_wing_bow', 'Bat-Wing Bow', NULL, 900, 1615, 'bow', 'epic', 'A bow that flutters whenever treats are near.', false, false, 'halloween_2026', 'new'),
	-- Face
	('friendly_skull_facepaint', 'Bone Mask', NULL, 1200, 1616, 'mask', 'epic', 'A bony grin painted on with marshmallow chalk.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_spark_goggles', 'Spark Goggles', NULL, 1000, 1617, 'glasses', 'epic', 'For observing extremely fizzy ideas.', false, false, 'halloween_2026', 'new'),
	-- Held
	('hedge_broom', 'Hedge Broom', NULL, 600, 1618, 'held', 'rare', 'A twiggy whisk for sweeping moonbeams.', false, false, 'halloween_2026', 'new'),
	('pip_candle', 'Pip Candle', NULL, 450, 1619, 'held', 'rare', 'A brave little flame for the walk home.', false, false, 'halloween_2026', 'new'),
	('scarab_lantern', 'Scarab Lantern', NULL, 1200, 1620, 'held', 'epic', 'Old golden light, warm as toast.', false, false, 'halloween_2026', 'new'),
	('pumpkin_treat_pail', 'Pumpkin Treat Pail', NULL, 250, 1621, 'held', 'uncommon', 'Room for one more caramel truffle.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_toy_cutlass', 'Toy Cutlass', NULL, 500, 1622, 'held', 'rare', 'A brave little blade made for cardboard treasure.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_bubbling_flask', 'Bubbling Flask', NULL, 500, 1623, 'held', 'rare', 'One bubble means curious. Three mean snack time.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_crystal_ball', 'Pocket Crystal Ball', NULL, 3000, 1624, 'held', 'legendary', 'It predicts a very cozy evening.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_ghostlight_lantern', 'Ghostlight Lantern', NULL, 1300, 1625, 'held', 'epic', 'A shy little light that knows every shortcut home.', false, false, 'halloween_2026', 'new'),
	-- Aura
	('spirit_glow', 'Spirit Glow', NULL, 4500, 1626, 'aura', 'legendary', 'A soft boo-light that follows everywhere.', false, false, 'halloween_2026', 'new'),
	-- Backgrounds
	('lantern_porch_bg', 'Lantern Porch', NULL, 700, 1627, 'background', 'rare', 'Every porch light is a pumpkin smile.', false, false, 'halloween_2026', 'new'),
	('cobweb_barn_bg', 'Cobweb Barn', NULL, 700, 1628, 'background', 'rare', 'The barn dressed up too.', false, false, 'halloween_2026', 'new'),
	('candy_lantern_trail_bg', 'Candy Lantern Trail', NULL, 750, 1629, 'background', 'rare', 'Follow the sweets all the way home.', false, false, 'halloween_2026', 'new'),
	('haunted_orchard_bg', 'Haunted Orchard', NULL, 1800, 1630, 'background', 'epic', 'The apple trees whisper silly secrets.', false, false, 'halloween_2026', 'new'),
	('witches_wood_bg', 'Witch''s Wood', NULL, 1800, 1631, 'background', 'epic', 'A crooked path where fireflies brew moonlight.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_harvest_moon_cornfield_bg', 'Harvest Moon Cornfield', NULL, 1600, 1632, 'background', 'epic', 'The corn rows glow under a pumpkin-bright moon.', false, false, 'halloween_2026', 'new'),
	('moonlit_graveyard_bg', 'Moonlit Graveyard', NULL, 5000, 1633, 'background', 'legendary', 'Soft moonlight for brave little hooves.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_haunted_ship_deck_bg', 'Haunted Ship Deck', NULL, 4500, 1634, 'background', 'legendary', 'The moon keeps watch from the crow’s nest.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_whispering_crypt_bg', 'Whispering Crypt', NULL, 4500, 1635, 'background', 'legendary', 'The old stones only whisper friendly secrets.', false, false, 'halloween_2026', 'new')
ON CONFLICT (id) DO NOTHING;

-- 3. The backdrop: the cozy porch, central floor clear for the pig.
UPDATE public.seasonal_shelves
SET backdrop_hat_id = 'lantern_porch_bg'
WHERE key = 'halloween_2026' AND backdrop_hat_id IS NULL;

-- 4. The four weekend pieces come back on the shelf. They keep their daily
-- drop life ('returning' is not filtered out of daily_shop()).
UPDATE public.hats
SET shelf_key = 'halloween_2026', shelf_lane = 'returning'
WHERE id IN ('skull_mask', 'pumpkin_patch', 'firefly_lantern', 'candyland');
