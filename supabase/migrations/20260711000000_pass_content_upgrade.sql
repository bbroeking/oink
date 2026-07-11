-- ⛔️ DO-NOT-PUSH — DRAFT PROPOSAL, NOT APPLIED ⛔️
-- ════════════════════════════════════════════════════════════════════════
-- Season-1 "The Great Hunger" battle-pass content upgrade — FREE TRACK.
--
-- WHY: PAID_BATTLE_PASS_ENABLED = false (app/(tabs)/season.tsx), so the FREE
-- track is the ONLY track players see live. Of its 30 tiers, 17 pay nothing
-- but raw tickles — the founder's "bring back cool items and titles". All 25
-- War Spoils cosmetics (constants/mudFights.ts WAR_SPOILS_IDS) are already
-- spent by the seed (20260706100000), 20 of them on the *premium* track a
-- free player never sees. So this upgrade uses only ZERO-ART sources:
--   • new season TITLES  — text only, source='season' for_sale=false, so they
--                           are earn-only by construction (never hit the shop,
--                           no pass_exclusive concern).
--   • Mystery Hat Box    — reward_type 'mystery_box' pins NO hat_id, so the
--                           sync_pass_exclusive trigger (20260706000000) skips
--                           it; the box draws the EXISTING hat pool → no art.
-- Early tickle tiers + the finale bundle are kept for pacing dopamine.
--
-- Net free-track collectibles: 13 → 20 "cool" tiers; 17 → 10 tickle fillers.
-- No new art. No shop cosmetic is cannibalized. Premium track untouched.
--
-- DB-PUSH SAFETY (per project rules):
--   • Additive only — INSERT ... ON CONFLICT DO NOTHING for titles; idempotent
--     UPDATEs keyed on (season_id, tier, track) for the tier rows. Re-runnable.
--   • No CREATE OR REPLACE of any function from a stale base (footgun avoided).
--   • Title ids follow title_id_from_name (20260511): lower, space/hyphen → '_'.
--   • Targets season_id 'snout_season_1' — the id AFTER the 20260709 renumber.
--     If pushed before that renumber lands, retarget to 'snout_season_2'.
--   • Timestamp 20260711000000 sorts after the latest applied (20260710000000).
--   • The season_tiers AFTER UPDATE trigger re-runs sync_pass_exclusive; titles
--     pin no hat_id so nothing is flagged — safe.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. New earn-only S1 titles (no art; mirror the 20260706100000 convention).
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('slop_savorer', 'Slop Savorer', 'pre',  'Licked the trough clean in the lean weeks.',        'season', false, 506),
	('mire_walker',  'Mire-Walker',  'pre',  'Never lost the path through the bog.',              'season', false, 507),
	('the_unstarved','The Unstarved','post', 'Kept the herd fed while the Hungerer thinned.',     'season', false, 508),
	('truffle_rich', 'Truffle-Rich', 'pre',  'Buried more than the Hungerer could ever eat.',     'season', false, 509)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Upgrade FREE-track filler tiers. Each UPDATE is idempotent and only
--       touches free-track rows that currently pay raw tickles. ──────────────
UPDATE public.season_tiers SET reward_type = 'title', reward_value = '{"title": "Slop Savorer"}',  display_label = 'Title: Slop Savorer'
	WHERE season_id = 'snout_season_1' AND tier =  5 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'mystery_box', reward_value = '{"box_kind": "hat"}',   display_label = 'Mystery Hat Box'
	WHERE season_id = 'snout_season_1' AND tier = 10 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'title', reward_value = '{"title": "Mire-Walker"}',    display_label = 'Title: Mire-Walker'
	WHERE season_id = 'snout_season_1' AND tier = 11 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'title', reward_value = '{"title": "The Unstarved"}',  display_label = 'Title: The Unstarved'
	WHERE season_id = 'snout_season_1' AND tier = 19 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'mystery_box', reward_value = '{"box_kind": "hat"}',   display_label = 'Mystery Hat Box'
	WHERE season_id = 'snout_season_1' AND tier = 20 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'title', reward_value = '{"title": "Truffle-Rich"}',   display_label = 'Title: Truffle-Rich'
	WHERE season_id = 'snout_season_1' AND tier = 27 AND track = 'free';
UPDATE public.season_tiers SET reward_type = 'mystery_box', reward_value = '{"box_kind": "hat"}',   display_label = 'Mystery Hat Box'
	WHERE season_id = 'snout_season_1' AND tier = 28 AND track = 'free';

-- Kept as tickles for pacing: T1,2,6,8,12,16,18,23,26,29 + T30 finale bundle.
-- ⛔️ DO-NOT-PUSH — DRAFT PROPOSAL, NOT APPLIED ⛔️
