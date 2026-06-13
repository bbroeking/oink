-- Shop expansion: bigger daily drop + a dozen new catalog items.
--
-- 1. daily_shop() goes 5 → 8 featured items per day. Carried verbatim
--    from 20260589 (soccer-ball pin + cape/flag exclusions + cost > 0
--    filter all kept) — only the LIMIT changes.
-- 2. Seed 12 new items across the live wearable categories (hat,
--    glasses, bow, held, aura, background, tickle_particle — nothing
--    in HIDDEN_CATEGORIES). Costs sit inside the post-rescale bands
--    from 20260547:
--      common 100-200 · uncommon 200-400 · rare 400-800
--      epic 800-2000 · legendary 2000-5000
--    image_path stays NULL — the shop tile falls back to each item's
--    emoji (same precedent as the 20260585/20260589 World Cup items).
--    On-pig render needs art dropped into assets/images/... + wired
--    into HAT_IMAGES per item; until then they're buyable + collectible.
--    particle_bubble additionally needs its PNG before the tap effect
--    swaps off the default ♥/✦ glyphs.

INSERT INTO public.hats
	(id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES
	-- Hats
	('mushroom_cap',    'Mushroom Cap',    '🍄', NULL, 240,  120,  'hat',             'uncommon',  'Sprouted overnight. Smells like rain.'),
	('paper_boat',      'Paper Boat',      '⛵', NULL, 120,  121,  'hat',             'common',    'Folded from yesterday''s news. Seaworthy-ish.'),
	-- Glasses
	('jam_jar_lenses',  'Jam-Jar Lenses',  '🫙', NULL, 260,  122,  'glasses',         'uncommon',  'Bottle-bottom glass. Everything looks like jam.'),
	-- Bows
	('acorn_bow',       'Acorn Bow',       '🌰', NULL, 130,  123,  'bow',             'common',    'Tied with a twig. A squirrel wants it back.'),
	('bumblebee_bow',   'Bumblebee Bow',   '🐝', NULL, 280,  124,  'bow',             'uncommon',  'Black and yellow, with a gentle hum.'),
	-- Held
	('firefly_lantern', 'Firefly Lantern', '🏮', NULL, 600,  125,  'held',            'rare',      'Three fireflies inside, working in shifts.'),
	('tiny_umbrella',   'Tiny Umbrella',   '☂️', NULL, 150,  126,  'held',            'common',    'For drizzle, sun, or dramatic exits.'),
	-- Auras
	('moth_waltz',      'Moth Waltz',      '🦋', NULL, 750,  127,  'aura',            'rare',      'Soft wings circle you like a porch light.'),
	('northern_lights', 'Northern Lights', '🌌', NULL, 3500, 128,  'aura',            'legendary', 'The sky drapes itself over one lucky pig.'),
	-- Backgrounds
	('pumpkin_patch',   'Pumpkin Patch',   '🎃', NULL, 650,  129,  'background',      'rare',      'Big ones, lumpy ones, one suspiciously pig-shaped.'),
	('library_nook',    'Library Nook',    '📚', NULL, 1200, 130,  'background',      'epic',      'Rainy-day light and a chair that knows you.'),
	-- Tickle particles (display_order follows the 91xx particle block)
	('particle_bubble', 'Bubble Particle', '🫧', NULL, 300,  9108, 'tickle_particle', 'uncommon',  'Wobbly soap bubbles pop with every tickle.')
ON CONFLICT (id) DO NOTHING;

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
				AND h.cost > 0
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	-- Pin the soccer ball to the daily drop for the World Cup; the rest stay
	-- RNG. Drop the first ORDER BY key once the tournament is over.
	ORDER BY (id = 'soccer_ball') DESC, rnk
	LIMIT 8;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;
