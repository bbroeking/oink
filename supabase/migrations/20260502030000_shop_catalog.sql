-- Extend hats table → general shop catalog with category + rarity.
-- Add 96 items across 9 categories (existing 4 hats stay).
-- Add daily_shop() RPC that returns 4 deterministic-per-day items.

ALTER TABLE public.hats
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'hat',
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  ADD COLUMN IF NOT EXISTS description text;

-- Backfill: existing 4 hats stay as 'hat' / 'common'
UPDATE public.hats SET category = 'hat', rarity = 'common'
  WHERE category IS NULL OR category = '';

-- Seed 96 new items.
-- Cost ranges by rarity:
--   common 25-100, uncommon 100-400, rare 400-1500, epic 1500-5000, legendary 5000-25000
INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description) VALUES
-- Hats (6 more, on top of existing 4)
('beanie',          'Beanie',           '🧢', 60,    11, 'hat', 'common',   'A cozy knitted cap.'),
('crown',           'Royal Crown',      '👑', 8000,  12, 'hat', 'epic',      'Fit for a pig of pure pedigree.'),
('halo',            'Halo',             '😇', 1200,  13, 'hat', 'rare',      'Glowing ring of holy light.'),
('pirate_tricorn',  'Pirate Tricorn',   '🏴‍☠️', 350, 14, 'hat', 'uncommon',  'Aye, matey.'),
('chef_toque',      'Chef Toque',       '👨‍🍳', 180,  15, 'hat', 'uncommon',  'For the culinary swine.'),
('viking_helmet',   'Viking Helmet',    '⚔️', 600,  16, 'hat', 'rare',      'With genuine non-historical horns.'),

-- Glasses (10)
('round_glasses',     'Round Glasses',     '👓', 80,    20, 'glasses', 'common',    'Owlish.'),
('aviator_sunglasses','Aviator Shades',    '🕶️', 200,   21, 'glasses', 'uncommon',  'Top gun pig.'),
('monocle',           'Monocle',           '🧐', 1200,  22, 'glasses', 'rare',      'Indeed, my dear sir.'),
('swim_goggles',      'Swim Goggles',      '🏊', 90,    23, 'glasses', 'common',    'Splash-proof.'),
('nerd_glasses',      'Nerd Glasses',      '🤓', 75,    24, 'glasses', 'common',    'Ackshually...'),
('three_d_glasses',   '3D Glasses',        '🎬', 120,   25, 'glasses', 'common',    'Whoa, depth!'),
('heart_sunglasses',  'Heart Sunglasses',  '😎', 220,   26, 'glasses', 'uncommon',  'Looking adorable.'),
('pixel_glasses',     'Pixel Shades',      '🕶️', 350,   27, 'glasses', 'uncommon',  '8-bit cool.'),
('safety_goggles',    'Safety Goggles',    '🥽', 60,    28, 'glasses', 'common',    'Science!'),
('vr_headset',        'VR Headset',        '🥽', 1800,  29, 'glasses', 'epic',      'In the meta-pen.'),

-- Bows (10)
('pink_bow',         'Pink Bow',          '🎀', 40,    30, 'bow', 'common',     'Classic pink ribbon.'),
('black_bow_tie',    'Black Bow Tie',     '🎩', 250,   31, 'bow', 'uncommon',   'Dapper.'),
('ribbon_bow',       'Ribbon Bow',        '🎀', 90,    32, 'bow', 'common',     'Tied just right.'),
('hair_bow',         'Hair Bow',          '🎀', 65,    33, 'bow', 'common',     'Cute.'),
('gift_bow',         'Gift Bow',          '🎁', 110,   34, 'bow', 'common',     'You ARE the gift.'),
('archery_bow',      'Archery Bow',       '🏹', 1400,  35, 'bow', 'rare',       'Robin Hog.'),
('silk_bow',         'Silk Bow',          '🎀', 320,   36, 'bow', 'uncommon',   'Smooth.'),
('polka_bow',        'Polka Dot Bow',     '🎀', 95,    37, 'bow', 'common',     'Spotted.'),
('velvet_bow',       'Velvet Bow',        '🎀', 280,   38, 'bow', 'uncommon',   'Soft.'),
('rainbow_bow',      'Rainbow Bow',       '🌈', 1100,  39, 'bow', 'rare',       'Lucky charm.'),

-- Scarves (10)
('knit_scarf',       'Knit Scarf',        '🧣', 70,    40, 'scarf', 'common',    'Toasty.'),
('silk_scarf',       'Silk Scarf',        '🧣', 350,   41, 'scarf', 'uncommon',  'Fancy.'),
('bandana_red',      'Red Bandana',       '🦊', 55,    42, 'scarf', 'common',    'Yeehaw.'),
('cape_scarf',       'Cape Scarf',        '🧣', 220,   43, 'scarf', 'uncommon',  'Half scarf, half cape.'),
('striped_scarf',    'Striped Scarf',     '🧣', 95,    44, 'scarf', 'common',    'Hogwarts vibes.'),
('winter_scarf',     'Winter Scarf',      '☃️', 120,   45, 'scarf', 'common',    'For cold farms.'),
('summer_kerchief',  'Summer Kerchief',   '🌻', 60,    46, 'scarf', 'common',    'Light & breezy.'),
('ascot',            'Ascot',             '🎩', 480,   47, 'scarf', 'uncommon',  'Nobility.'),
('neckwarmer',       'Neckwarmer',        '🧣', 85,    48, 'scarf', 'common',    'Snug.'),
('rainbow_scarf',    'Rainbow Scarf',     '🌈', 1200,  49, 'scarf', 'rare',      'Stretches over your snout.'),

-- Auras (10)
('pink_glow',        'Pink Aura',         '✨', 500,   50, 'aura', 'rare',       'Soft pink halo around you.'),
('gold_aura',        'Gold Aura',         '✨', 1500,  51, 'aura', 'epic',       'Worth your weight in.'),
('rainbow_aura',     'Rainbow Aura',      '🌈', 5000,  52, 'aura', 'legendary',  'Pride pig.'),
('fire_aura',        'Fire Aura',         '🔥', 1300,  53, 'aura', 'rare',       'You are on fire.'),
('ice_aura',         'Ice Aura',          '❄️', 1300,  54, 'aura', 'rare',       'Cool customer.'),
('electric_aura',    'Electric Aura',     '⚡', 1400,  55, 'aura', 'rare',       'Shocking.'),
('shadow_aura',      'Shadow Aura',       '🌑', 2200,  56, 'aura', 'epic',       'Spooky.'),
('holy_aura',        'Holy Aura',         '🙏', 2400,  57, 'aura', 'epic',       'Sanctified swine.'),
('sparkle_aura',     'Sparkle Aura',      '✨', 700,   58, 'aura', 'rare',       'Glittery.'),
('petal_aura',       'Petal Swirl',       '🌸', 900,   59, 'aura', 'rare',       'Cherry blossom drift.'),

-- Masks (10)
('masquerade',       'Masquerade Mask',   '🎭', 380,   60, 'mask', 'uncommon',   'Mysterious.'),
('domino',           'Domino Mask',       '🦝', 120,   61, 'mask', 'common',     'Sneaky.'),
('robber_mask',      'Robber Mask',       '🥷', 200,   62, 'mask', 'uncommon',   'Bag of tickles.'),
('sleep_mask',       'Sleep Mask',        '😴', 50,    63, 'mask', 'common',     'Ten more minutes.'),
('gas_mask',         'Gas Mask',          '🥽', 1100,  64, 'mask', 'rare',       'Fallout pig.'),
('carnival_mask',    'Carnival Mask',     '🎭', 320,   65, 'mask', 'uncommon',   'Festive.'),
('venice_mask',      'Venetian Mask',     '🎭', 1800,  66, 'mask', 'epic',       'Carnevale.'),
('cat_mask',         'Cat Mask',          '🐱', 240,   67, 'mask', 'uncommon',   'Cat-pig hybrid.'),
('skull_mask',       'Skull Mask',        '💀', 1600,  68, 'mask', 'epic',       'Spoooky.'),
('hero_mask',        'Hero Mask',         '🦸', 360,   69, 'mask', 'uncommon',   'Pig of justice.'),

-- Capes (10)
('royal_cape',       'Royal Cape',        '🦹', 2200,  70, 'cape', 'epic',       'For pig royalty.'),
('vampire_cape',     'Vampire Cape',      '🧛', 1100,  71, 'cape', 'rare',       'Bleh!'),
('hero_cape',        'Hero Cape',         '🦸', 1500,  72, 'cape', 'epic',       'Capes are cool.'),
('magician_cape',    'Magician Cape',     '🎩', 700,   73, 'cape', 'rare',       'Now you see me.'),
('fur_cape',         'Fur Cape',          '🐻', 480,   74, 'cape', 'uncommon',   'Toasty toasty.'),
('silk_cape',        'Silk Cape',         '🧣', 380,   75, 'cape', 'uncommon',   'Slick.'),
('leather_cape',     'Leather Cape',      '🧥', 320,   76, 'cape', 'uncommon',   'Tough.'),
('short_cape',       'Short Cape',        '🦸', 220,   77, 'cape', 'uncommon',   'Lil cape.'),
('ermine_cape',      'Ermine Cape',       '🦊', 4500,  78, 'cape', 'epic',       'Royal tier.'),
('star_cape',        'Star-Spangled Cape','🌟', 6500,  79, 'cape', 'legendary',  'Patriotic pig.'),

-- Necklaces (10)
('pearl_necklace',   'Pearl Necklace',    '📿', 280,   80, 'necklace', 'uncommon', 'Classic.'),
('gold_chain',       'Gold Chain',        '⛓️', 600,   81, 'necklace', 'rare',     'Bling bling.'),
('locket',           'Locket',            '💌', 320,   82, 'necklace', 'uncommon', 'A tiny secret inside.'),
('bone_necklace',    'Bone Necklace',     '🦴', 180,   83, 'necklace', 'common',   'Caveman pig.'),
('charm_necklace',   'Charm Necklace',    '🍀', 220,   84, 'necklace', 'uncommon', 'Lucky.'),
('diamond_pendant',  'Diamond Pendant',   '💎', 4000,  85, 'necklace', 'epic',     'Sparkles.'),
('emerald_pendant',  'Emerald Pendant',   '💚', 3500,  86, 'necklace', 'epic',     'Forest green.'),
('choker',           'Velvet Choker',     '🖤', 110,   87, 'necklace', 'common',   'Edgy.'),
('bell_collar',      'Bell Collar',       '🔔', 75,    88, 'necklace', 'common',   '*ding*'),
('ribbon_choker',    'Ribbon Choker',     '🎀', 60,    89, 'necklace', 'common',   'Cute and simple.'),

-- Held Items (10)
('magic_wand',       'Magic Wand',        '🪄', 800,   90, 'held', 'rare',       'Bibbidi-bobbidi-pig.'),
('toy_sword',        'Toy Sword',         '⚔️', 250,   91, 'held', 'uncommon',   'En garde!'),
('pencil',           'Pencil',            '✏️', 30,    92, 'held', 'common',     'Pig of letters.'),
('magnifier',        'Magnifying Glass',  '🔍', 130,   93, 'held', 'common',     'Detective pig.'),
('balloon',          'Balloon',           '🎈', 45,    94, 'held', 'common',     'Float away.'),
('flowers',          'Flower Bouquet',    '💐', 180,   95, 'held', 'common',     'For someone special.'),
('ice_cream',        'Ice Cream',         '🍦', 65,    96, 'held', 'common',     'Yum.'),
('pizza_slice',      'Pizza Slice',       '🍕', 80,    97, 'held', 'common',     'Cheesy.'),
('coffee_mug',       'Coffee Mug',        '☕', 50,    98, 'held', 'common',     'Daily fuel.'),
('controller',       'Game Controller',   '🎮', 350,   99, 'held', 'uncommon',   'Pro gamer.'),

-- Backgrounds (10)
('sunset_farm',      'Sunset Farm',       '🌅', 600,   100, 'background', 'rare',      'Golden hour.'),
('snowy_farm',       'Snowy Farm',        '❄️', 700,   101, 'background', 'rare',      'Winter wonderland.'),
('beach_island',     'Beach Island',      '🏝️', 900,   102, 'background', 'rare',      'Tropical pig.'),
('space_station',    'Space Station',     '🚀', 2500,  103, 'background', 'epic',      'Astronaut life.'),
('candyland',        'Candy Land',        '🍭', 1200,  104, 'background', 'rare',      'Sweet.'),
('forest_grove',     'Forest Grove',      '🌲', 500,   105, 'background', 'rare',      'Peaceful.'),
('jungle',           'Jungle',            '🌴', 750,   106, 'background', 'rare',      'Wild.'),
('underwater',       'Coral Reef',        '🐠', 1100,  107, 'background', 'rare',      'Glub glub.'),
('desert_dunes',     'Desert Dunes',      '🏜️', 650,   108, 'background', 'rare',      'Hot.'),
('mountain_top',     'Mountain Top',      '⛰️', 850,   109, 'background', 'rare',      'On top of the world.')
ON CONFLICT (id) DO NOTHING;

-- ========== Daily rotating shop ==========

set check_function_bodies = off;

-- Returns 4 items deterministic per UTC date, excluding what the caller owns.
-- Uses a date-seeded hash to pick consistently.
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
  LIMIT 4;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- Seconds until UTC midnight (for the countdown UI)
CREATE OR REPLACE FUNCTION public.shop_resets_in_seconds()
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT EXTRACT(EPOCH FROM (
    (current_date + INTERVAL '1 day')::timestamptz - now()
  ))::int;
$function$;

GRANT EXECUTE ON FUNCTION public.shop_resets_in_seconds() TO authenticated, anon;
