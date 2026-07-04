-- Season 2 — "The Great Hunger" battle pass (task-11).
--
-- Repopulates the S2 pass: 30 tiers x free/premium, seeded the same way as
-- Snout Season 1 (20260502010100 + 20260514020000). Rewards are drawn from the
-- Mud Wars "War Spoils" cosmetic pool (all 25 of constants/mudFights.ts
-- WAR_SPOILS_IDS, war_exclusive + cost = 0 since 20260650/20260660), a set of
-- new S2 titles, tickle bundles, and the same stubbed boosts S1 used.
--
-- Dark-launched: starts_at is the Jul-12 Season-1 finale / flip date, so
-- active_season() keeps returning nothing until then and the pass appears the
-- moment S2 goes live. (The world_boss flag gates the surrounding fiction; the
-- pass itself is date-gated like every season.)
--
-- Exclusivity: cosmetic rewards here pin a hat_id, so the broadened
-- sync_pass_exclusive trigger (20260706000000) flags every one pass_exclusive
-- on insert — earned via claim_tier_reward, never sold in the shop. The war
-- pool is already war_exclusive + cost = 0, so this is belt-and-suspenders for
-- them and the real guard for any future non-war cosmetic seeded into a tier.
-- (War items stay obtainable in the Truffle Exchange, which gates on
-- war_exclusive, not pass_exclusive — the "exclusive" rule is scoped to the
-- shop, per the task's audit.)

-- ── Season row ──────────────────────────────────────────────────────────────
INSERT INTO public.seasons
	(id, name, starts_at, ends_at, total_tiers, xp_per_tier, premium_price_cents, premium_plus_price_cents)
VALUES (
	'snout_season_2',
	'The Great Hunger',
	'2026-07-12 00:00:00+00',
	'2026-08-09 00:00:00+00',
	30, 100, 299, 999
)
ON CONFLICT (id) DO NOTHING;

-- ── New S2 titles (earn-only pass rewards; never in the shop). ──────────────
-- for_sale=false + source='season' mirrors the beta/referral title convention
-- (20260647 titles_source_check allows 'season'). ids MUST equal
-- title_id_from_name(name) = lower, spaces/hyphens -> '_'  (20260511).
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('rooter',                'Rooter',                'pre',  'Started digging in the lean season.',            'season', false, 500),
	('truffle_hound',         'Truffle Hound',         'pre',  'Sniffed out the buried prizes.',                  'season', false, 501),
	('bog_warden',            'Bog Warden',            'pre',  'Held the line through the Great Hunger.',          'season', false, 502),
	('the_well_fed',          'The Well-Fed',          'post', 'Ate well while the Hungerer starved.',             'season', false, 503),
	('hunger_ender',          'Hunger-Ender',          'post', 'Pried the last tickle off the Great Hungerer.',    'season', false, 504),
	('of_the_famished_table', 'Of the Famished Table', 'post', 'Sat at the table when the season turned.',         'season', false, 505)
ON CONFLICT (id) DO NOTHING;

-- ── Tier catalog (30 x free/premium). Cosmetic reward_value pins hat_id so the
--    grant path (claim_tier_reward COALESCE, latest 20260686) and the
--    pass_exclusive trigger both resolve the item. ──────────────────────────
INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
-- 1
('snout_season_2',  1, 'free',    'tickles',    '{"amount": 25}',                        '25 tickles'),
('snout_season_2',  1, 'premium', 'hat',        '{"hat_id": "muddy_cap"}',               'Muddy Cap'),
-- 2
('snout_season_2',  2, 'premium', 'tickles',    '{"amount": 50}',                        '50 tickles'),
-- 3
('snout_season_2',  3, 'free',    'title',      '{"title": "Rooter"}',                   'Title: Rooter'),
('snout_season_2',  3, 'premium', 'aura',       '{"hat_id": "mud_splatter_aura"}',       'Mud Splatter aura'),
-- 4
('snout_season_2',  4, 'premium', 'background', '{"hat_id": "mud_pit_bg"}',              'Mud Pit background'),
-- 5
('snout_season_2',  5, 'free',    'tickles',    '{"amount": 50}',                        '50 tickles'),
('snout_season_2',  5, 'premium', 'boost',      '{"boost_id": "fast_regen", "duration_min": 1440}', 'Faster Regen (24h)'),
-- 6
('snout_season_2',  6, 'premium', 'held',       '{"hat_id": "slop_bucket"}',             'Slop Bucket'),
-- 7
('snout_season_2',  7, 'free',    'hat',        '{"hat_id": "slop_bucket_hat"}',         'Slop-Bucket Hat'),
('snout_season_2',  7, 'premium', 'hat',        '{"hat_id": "reed_hat"}',                'Reed Hat'),
-- 8
('snout_season_2',  8, 'premium', 'tickles',    '{"amount": 100}',                       '100 tickles'),
-- 9
('snout_season_2',  9, 'free',    'title',      '{"title": "Truffle Hound"}',            'Title: Truffle Hound'),
('snout_season_2',  9, 'premium', 'held',       '{"hat_id": "mud_pie"}',                 'Mud Pie'),
-- 10
('snout_season_2', 10, 'premium', 'aura',       '{"hat_id": "swamp_bubble_aura"}',       'Swamp Bubbles aura'),
-- 11
('snout_season_2', 11, 'free',    'tickles',    '{"amount": 75}',                        '75 tickles'),
('snout_season_2', 11, 'premium', 'background', '{"hat_id": "reed_marsh_bg"}',           'Reed Marsh background'),
-- 12
('snout_season_2', 12, 'premium', 'tickles',    '{"amount": 150}',                       '150 tickles'),
-- 13
('snout_season_2', 13, 'free',    'held',       '{"hat_id": "mud_shovel"}',              'Mud Shovel'),
('snout_season_2', 13, 'premium', 'hat',        '{"hat_id": "bog_helmet"}',              'Bog Helmet'),
-- 14
('snout_season_2', 14, 'premium', 'boost',      '{"boost_id": "auto_tickler", "duration_min": 60}', 'Auto-Tickler (1h)'),
-- 15
('snout_season_2', 15, 'free',    'title',      '{"title": "Bog Warden"}',               'Title: Bog Warden'),
('snout_season_2', 15, 'premium', 'aura',       '{"hat_id": "firefly_aura"}',            'Fireflies aura'),
-- 16
('snout_season_2', 16, 'premium', 'tickles',    '{"amount": 250}',                       '250 tickles'),
-- 17
('snout_season_2', 17, 'free',    'held',       '{"hat_id": "golden_truffle"}',          'Golden Truffle charm'),
('snout_season_2', 17, 'premium', 'held',       '{"hat_id": "crew_pennant"}',            'Crew Pennant'),
-- 18
('snout_season_2', 18, 'premium', 'background', '{"hat_id": "mud_derby_bg"}',            'Mud Derby Grounds background'),
-- 19
('snout_season_2', 19, 'free',    'tickles',    '{"amount": 100}',                       '100 tickles'),
('snout_season_2', 19, 'premium', 'hat',        '{"hat_id": "rosette_cap"}',             'Rosette Cap'),
-- 20
('snout_season_2', 20, 'premium', 'necklace',   '{"hat_id": "prize_sash"}',              'Prize Sash'),
-- 21
('snout_season_2', 21, 'free',    'title',      '{"title": "The Well-Fed"}',             'Title: The Well-Fed'),
('snout_season_2', 21, 'premium', 'tickles',    '{"amount": 300}',                       '300 tickles'),
-- 22
('snout_season_2', 22, 'free',    'background', '{"hat_id": "bog_dusk_bg"}',             'Bog at Dusk background'),
('snout_season_2', 22, 'premium', 'hat',        '{"hat_id": "swamp_crown"}',             'Swamp Crown'),
-- 23
('snout_season_2', 23, 'premium', 'aura',       '{"hat_id": "golden_bog_aura"}',         'Golden Bog aura'),
-- 24
('snout_season_2', 24, 'free',    'title',      '{"title": "Hunger-Ender"}',             'Title: Hunger-Ender'),
('snout_season_2', 24, 'premium', 'held',       '{"hat_id": "festival_pennant"}',        'Festival Pennant'),
-- 25
('snout_season_2', 25, 'premium', 'aura',       '{"hat_id": "confetti_aura"}',           'Confetti Aura'),
-- 26
('snout_season_2', 26, 'free',    'tickles',    '{"amount": 200}',                       '200 tickles'),
('snout_season_2', 26, 'premium', 'background', '{"hat_id": "golden_mire_bg"}',          'Golden Mire background'),
-- 27
('snout_season_2', 27, 'premium', 'boost',      '{"boost_id": "tickle_3x", "duration_min": 15}', '3x Tickle (15min)'),
-- 28
('snout_season_2', 28, 'free',    'tickles',    '{"amount": 250}',                       '250 tickles'),
('snout_season_2', 28, 'premium', 'aura',       '{"hat_id": "heirloom_mire_aura"}',      'Heirloom Mire aura'),
-- 29
('snout_season_2', 29, 'premium', 'tickles',    '{"amount": 600}',                       '600 tickles'),
-- 30 (finale) — title carries a bundled 500-tickle bonus via the reward_value
-- 'tickles' key (the generic bonus path added in 20260659).
('snout_season_2', 30, 'free',    'title',      '{"title": "Of the Famished Table", "tickles": 500}', 'Title: Of the Famished Table + 500 tickles'),
('snout_season_2', 30, 'premium', 'background', '{"hat_id": "festival_night_bg"}',       'Festival Night background')
ON CONFLICT (season_id, tier, track) DO NOTHING;
