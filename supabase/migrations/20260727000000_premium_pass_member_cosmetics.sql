-- HELD FOR REVIEW — push with the finale stack on Brian's go.
--
-- Season-1 PREMIUM battle-pass cleanup: strip the pay-to-win / stub rewards and
-- replace them with members-only cosmetics from the Slop Club catalog.
--
-- The premium track had 6 `tickles` tiers (leaderboard pay-to-win — a paying
-- member should never buy their way up the Board) and 3 `boost` tiers (the
-- stubbed boosts that grant nothing). This swaps those 9 tiers (2, 5, 8, 12, 14,
-- 16, 21, 27, 29) for members-only cosmetics. The free track and the existing
-- premium cosmetic tiers are untouched. Format (reward_type = slot,
-- reward_value = {"hat_id": id}, display_label) matches the existing cosmetic
-- tiers exactly, so claim_tier_reward grants them identically. All 9 items are
-- members_only=true with art shipped (constants/membersImages.generated.ts).

UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"sovereign_jewel_crown"}'::jsonb, display_label='Sovereign Jewel Crown' WHERE season_id='snout_season_1' AND track='premium' AND tier=2;
UPDATE public.season_tiers SET reward_type='held',       reward_value='{"hat_id":"royal_scepter"}'::jsonb,        display_label='Royal Scepter'         WHERE season_id='snout_season_1' AND track='premium' AND tier=5;
UPDATE public.season_tiers SET reward_type='aura',       reward_value='{"hat_id":"majesty_gold_aura"}'::jsonb,    display_label='Majesty Aura'          WHERE season_id='snout_season_1' AND track='premium' AND tier=8;
UPDATE public.season_tiers SET reward_type='background', reward_value='{"hat_id":"throne_room_bg"}'::jsonb,       display_label='Royal Throne Room'     WHERE season_id='snout_season_1' AND track='premium' AND tier=12;
UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"ringed_planet_hat"}'::jsonb,    display_label='Ringed Planet Hat'     WHERE season_id='snout_season_1' AND track='premium' AND tier=14;
UPDATE public.season_tiers SET reward_type='held',       reward_value='{"hat_id":"comet_wand"}'::jsonb,           display_label='Comet Wand'            WHERE season_id='snout_season_1' AND track='premium' AND tier=16;
UPDATE public.season_tiers SET reward_type='aura',       reward_value='{"hat_id":"nebula_aura"}'::jsonb,          display_label='Nebula Aura'           WHERE season_id='snout_season_1' AND track='premium' AND tier=21;
UPDATE public.season_tiers SET reward_type='background', reward_value='{"hat_id":"cosmic_drift_bg"}'::jsonb,      display_label='Cosmic Drift'          WHERE season_id='snout_season_1' AND track='premium' AND tier=27;
UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"ermine_coronet"}'::jsonb,       display_label='Ermine Coronet'        WHERE season_id='snout_season_1' AND track='premium' AND tier=29;
