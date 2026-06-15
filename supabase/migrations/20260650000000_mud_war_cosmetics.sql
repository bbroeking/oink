-- Mud War (Season 2) cosmetic catalog rows.
--
-- Art generated 2026-06-14 via docs/openai-mud-war-items.md and sliced by
-- scripts/slice_mudwar.py into assets/images/hats/<id>.png (items) +
-- assets/images/backgrounds/<id>.png (backgrounds); HAT_IMAGES (constants/hats.ts)
-- keys them by id.
--
-- cost = 0 => NOT buyable (buy_hat rejects cost <= 0 with 'not_for_sale',
-- 20260544). These are war-exclusive: granted by the future War Spoils system
-- (docs/wiki/outputs/memos/mudwar-war-spoils-items.md), never sold in the daily
-- shop. No war_exclusive/war_season/set_id columns yet — those land with the War
-- Spoils build; for now they're plain catalog rows so the art is equippable once
-- granted. Idempotent (ON CONFLICT DO NOTHING).
--
-- The festival accessories were re-keyed from Strip 5's baked transparency
-- checkerboard (a luminance+saturation key in slice_mudwar.py): rosette_cap /
-- prize_sash / festival_pennant / confetti_aura all ship here. confetti_aura
-- also had the abutting night-bg scene cut by slice_mudwar.night_cut (a dynamic
-- dark-column boundary) rather than a fixed-fraction trim.

INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('muddy_cap',          'Muddy Cap',         '🧢', 0, 400, 'hat',        'common',    'A flat cap caked in fresh mud.'),
	('slop_bucket_hat',    'Slop-Bucket Hat',   '🪣', 0, 401, 'hat',        'uncommon',  'An overturned slop bucket, worn with pride.'),
	('reed_hat',           'Reed Hat',          '👒', 0, 402, 'hat',        'uncommon',  'A woven swamp-reed cone hat.'),
	('bog_helmet',         'Bog Helmet',        '⛑️', 0, 403, 'hat',        'rare',      'A dented derby helmet, mud-caked and mossy.'),
	('swamp_crown',        'Swamp Crown',       '👑', 0, 404, 'hat',        'epic',      'The muddy gold crown of the Swamp King.'),
	('slop_bucket',        'Slop Bucket',       '🪣', 0, 410, 'held',       'common',    'A pail brimming with good honest slop.'),
	('mud_shovel',         'Mud Shovel',        '⛏️', 0, 411, 'held',       'common',    'For digging up truffles.'),
	('mud_pie',            'Mud Pie',           '🥧', 0, 412, 'held',       'uncommon',  'Topped with a cherry. Please do not eat.'),
	('golden_truffle',     'Golden Truffle',    '🍄', 0, 413, 'held',       'rare',      'A prize truffle, freshly unearthed.'),
	('crew_pennant',       'Crew Pennant',      '🚩', 0, 414, 'held',       'rare',      'Fly your Sounder''s colors.'),
	('mud_splatter_aura',  'Mud Splatter',      '💥', 0, 420, 'aura',       'common',    'Flecks of flung mud orbit you.'),
	('swamp_bubble_aura',  'Swamp Bubbles',     '🫧', 0, 421, 'aura',       'uncommon',  'Swamp bubbles rise and pop around you.'),
	('firefly_aura',       'Fireflies',         '✨', 0, 422, 'aura',       'rare',      'A warm ring of drifting fireflies.'),
	('golden_bog_aura',    'Golden Bog',        '🌟', 0, 423, 'aura',       'epic',      'A radiant gold-flecked mud glow.'),
	('heirloom_mire_aura', 'Heirloom Mire',     '🌈', 0, 424, 'aura',       'legendary', 'Iridescent swamp mist with drifting petals.'),
	('mud_pit_bg',         'Mud Pit',           '🟫', 0, 430, 'background', 'common',    'A churned wallow under an open sky.'),
	('reed_marsh_bg',      'Reed Marsh',        '🌾', 0, 431, 'background', 'uncommon',  'Tall green reeds over still water.'),
	('mud_derby_bg',       'Mud Derby Grounds', '🎪', 0, 432, 'background', 'rare',      'The festive derby arena — bunting and all.'),
	('bog_dusk_bg',        'Bog at Dusk',       '🌅', 0, 433, 'background', 'epic',      'A misty swamp at golden sunset.'),
	('golden_mire_bg',     'Golden Mire',       '🌟', 0, 434, 'background', 'legendary', 'A glowing, prize-winning swamp.'),
	('festival_night_bg',  'Festival Night',    '🏮', 0, 435, 'background', 'legendary', 'The lantern-lit derby grounds after dark.'),
	('rosette_cap',        'Rosette Cap',       '🎗️', 0, 440, 'hat',  'rare', 'A flat cap pinned with a prize rosette.'),
	('prize_sash',         'Prize Sash',        '🎖️', 0, 441, 'neck', 'rare', 'A winner''s sash, rosette and all.'),
	('festival_pennant',   'Festival Pennant',  '🎏', 0, 442, 'held', 'epic', 'A pole strung with festive bunting.'),
	('confetti_aura',      'Confetti Aura',     '🎊', 0, 443, 'aura', 'epic', 'A swirl of confetti and mud flecks.')
ON CONFLICT (id) DO NOTHING;
