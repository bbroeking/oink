-- Snout Season 1 — full tier list (30 tiers x 2 tracks)
-- Hat reward_value uses hat_id from public.hats (or future hat ids stubbed).

INSERT INTO public.seasons (id, name, starts_at, ends_at, total_tiers, xp_per_tier, premium_price_cents, premium_plus_price_cents)
VALUES (
  'snout_season_1',
  'Snout Season 1',
  '2026-05-02 00:00:00+00',
  '2026-05-27 00:00:00+00',
  30, 100, 299, 999
);

INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
-- Tier 1
('snout_season_1', 1, 'free', 'tickles', '{"amount": 25}', '25 tickles'),
('snout_season_1', 1, 'premium', 'hat', '{"hat_id": "beanie"}', 'Beanie hat'),
-- Tier 2
('snout_season_1', 2, 'premium', 'tickles', '{"amount": 50}', '50 tickles'),
-- Tier 3
('snout_season_1', 3, 'free', 'title', '{"title": "Piglet"}', 'Title: Piglet'),
('snout_season_1', 3, 'premium', 'title', '{"title": "Trotter"}', 'Title: Trotter'),
-- Tier 4
('snout_season_1', 4, 'premium', 'background', '{"bg_id": "sunset_farm"}', 'Sunset farm background'),
-- Tier 5
('snout_season_1', 5, 'free', 'tickles', '{"amount": 50}', '50 tickles'),
('snout_season_1', 5, 'premium', 'boost', '{"boost_id": "tickle_2x", "duration_min": 60}', '2x Tickle (1h)'),
-- Tier 6
('snout_season_1', 6, 'premium', 'tickles', '{"amount": 100}', '100 tickles'),
-- Tier 7
('snout_season_1', 7, 'free', 'hat', '{"hat_id": "bunny_ears"}', 'Bunny ears'),
('snout_season_1', 7, 'premium', 'hat', '{"hat_id": "leaf_crown"}', 'Crown of leaves'),
-- Tier 8
('snout_season_1', 8, 'premium', 'tickles', '{"amount": 150}', '150 tickles'),
-- Tier 9
('snout_season_1', 9, 'free', 'title', '{"title": "Boar Apprentice"}', 'Title: Boar Apprentice'),
('snout_season_1', 9, 'premium', 'title', '{"title": "Mud-Caked Mage"}', 'Title: Mud-Caked Mage'),
-- Tier 10
('snout_season_1', 10, 'premium', 'hat', '{"hat_id": "pirate_tricorn"}', 'Pirate tricorn'),
-- Tier 11
('snout_season_1', 11, 'free', 'tickles', '{"amount": 75}', '75 tickles'),
('snout_season_1', 11, 'premium', 'boost', '{"boost_id": "fast_regen", "duration_min": 1440}', 'Faster Regen (24h)'),
-- Tier 12
('snout_season_1', 12, 'premium', 'tickles', '{"amount": 200}', '200 tickles'),
-- Tier 13
('snout_season_1', 13, 'free', 'background', '{"bg_id": "snowy_farm"}', 'Snowy farm bg'),
('snout_season_1', 13, 'premium', 'hat', '{"hat_id": "halo"}', 'Halo'),
-- Tier 14
('snout_season_1', 14, 'premium', 'boost', '{"boost_id": "auto_tickler", "duration_min": 60}', 'Auto-Tickler (1h)'),
-- Tier 15
('snout_season_1', 15, 'free', 'mystery_box', '{"box_kind": "hat"}', 'Mystery Hat Box'),
('snout_season_1', 15, 'premium', 'mystery_box', '{"box_kind": "hat"}', 'Mystery Hat Box'),
-- Tier 16
('snout_season_1', 16, 'premium', 'tickles', '{"amount": 300}', '300 tickles'),
-- Tier 17
('snout_season_1', 17, 'free', 'title', '{"title": "Hamfister"}', 'Title: Hamfister'),
('snout_season_1', 17, 'premium', 'title', '{"title": "Bacon Baron"}', 'Title: Bacon Baron'),
-- Tier 18
('snout_season_1', 18, 'premium', 'hat', '{"hat_id": "devil_horns"}', 'Devil horns'),
-- Tier 19
('snout_season_1', 19, 'free', 'tickles', '{"amount": 100}', '100 tickles'),
('snout_season_1', 19, 'premium', 'cap_increase', '{"amount": 50}', 'Cap +50 (permanent)'),
-- Tier 20
('snout_season_1', 20, 'premium', 'pig_skin', '{"skin_id": "robot"}', 'Robot pig skin'),
-- Tier 21
('snout_season_1', 21, 'premium', 'tickles', '{"amount": 400}', '400 tickles'),
-- Tier 22
('snout_season_1', 22, 'free', 'hat', '{"hat_id": "cat_ears"}', 'Cat ears'),
('snout_season_1', 22, 'premium', 'hat', '{"hat_id": "astronaut"}', 'Astronaut helmet'),
-- Tier 23
('snout_season_1', 23, 'premium', 'boost', '{"boost_id": "streak_shield"}', 'Streak Shield'),
-- Tier 24
('snout_season_1', 24, 'free', 'title', '{"title": "Snout Sage"}', 'Title: Snout Sage'),
('snout_season_1', 24, 'premium', 'title', '{"title": "Pork Lord"}', 'Title: Pork Lord'),
-- Tier 25
('snout_season_1', 25, 'premium', 'pig_skin', '{"skin_id": "cosmic"}', 'Cosmic pig skin'),
-- Tier 26
('snout_season_1', 26, 'free', 'tickles', '{"amount": 200}', '200 tickles'),
('snout_season_1', 26, 'premium', 'boost', '{"boost_id": "tickle_3x", "duration_min": 15}', '3x Tickle (15min)'),
-- Tier 27
('snout_season_1', 27, 'premium', 'background', '{"bg_id": "beach_island"}', 'Beach island bg'),
-- Tier 28
('snout_season_1', 28, 'free', 'hat', '{"hat_id": "chef_toque"}', 'Chef toque'),
('snout_season_1', 28, 'premium', 'hat', '{"hat_id": "viking_helmet"}', 'Viking helmet'),
-- Tier 29
('snout_season_1', 29, 'premium', 'tickles', '{"amount": 600}', '600 tickles'),
-- Tier 30 (finale)
('snout_season_1', 30, 'free', 'title', '{"title": "Season 1 Veteran"}', 'Title: Season 1 Veteran + 500 tickles'),
('snout_season_1', 30, 'premium', 'title', '{"title": "Season 1 Champion"}', 'Crown + Champion title + Golden pig');
