-- Season 2 premium-track fairness pass.
--
-- Slop Club includes the premium season track, but paid rewards must never
-- improve leaderboard or progression performance. Replace the six premium
-- tickle bundles and three gameplay boosts with authored cosmetic collectibles.
-- The free track keeps its earned tickles unchanged.

UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"ganache_truffle_crown"}'::jsonb, display_label='Ganache Truffle Crown' WHERE season_id='snout_season_2' AND track='premium' AND tier=2;
UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"slop_pail_topper"}'::jsonb,      display_label='Slop Pail Topper'      WHERE season_id='snout_season_2' AND track='premium' AND tier=5;
UPDATE public.season_tiers SET reward_type='held',       reward_value='{"hat_id":"truffle_medal_held"}'::jsonb,    display_label='Grand Trough Medal'    WHERE season_id='snout_season_2' AND track='premium' AND tier=8;
UPDATE public.season_tiers SET reward_type='aura',       reward_value='{"hat_id":"drip_glaze_aura"}'::jsonb,       display_label='Drip Glaze Aura'       WHERE season_id='snout_season_2' AND track='premium' AND tier=12;
UPDATE public.season_tiers SET reward_type='background', reward_value='{"hat_id":"spa_wallow_bg"}'::jsonb,         display_label='Truffle Spa Wallow'    WHERE season_id='snout_season_2' AND track='premium' AND tier=14;
UPDATE public.season_tiers SET reward_type='glasses',    reward_value='{"hat_id":"cocoa_sheen_specs"}'::jsonb,     display_label='Cocoa Sheen Specs'     WHERE season_id='snout_season_2' AND track='premium' AND tier=16;
UPDATE public.season_tiers SET reward_type='bow',        reward_value='{"hat_id":"caramel_drip_bow"}'::jsonb,      display_label='Caramel Drip Bow'      WHERE season_id='snout_season_2' AND track='premium' AND tier=21;
UPDATE public.season_tiers SET reward_type='held',       reward_value='{"hat_id":"corn_on_the_cob"}'::jsonb,       display_label='Corn on the Cob'       WHERE season_id='snout_season_2' AND track='premium' AND tier=27;
UPDATE public.season_tiers SET reward_type='hat',        reward_value='{"hat_id":"slop_club_signet_crown"}'::jsonb, display_label='Slop Club Signet Crown' WHERE season_id='snout_season_2' AND track='premium' AND tier=29;
