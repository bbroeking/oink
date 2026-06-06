-- Re-open the battle-pass claims for the five zero-cost cosmetic hats that were
-- "missing hats" until 20260544. Those hats are tier rewards on snout_season_1
-- (tiers 7/18/22, alongside the title tiers), but before 20260544 they didn't
-- exist in public.hats — so claiming those tiers FK-failed and players who
-- passed the tier in that window never got the item (one even had the astronaut
-- granted by hand — see docs / task #3). The claim path grants the hat correctly
-- now (20260514 unified grant), so all that's left is to let the affected players
-- collect them.
--
-- This DELETEs the tier-claim row ONLY for these five slots and ONLY for users
-- who don't already own the corresponding hat — so the pass shows the reward as
-- unclaimed again and a tap re-runs claim_tier_reward, which grants the hat
-- (idempotent: ON CONFLICT DO NOTHING). Players who already own the hat are left
-- untouched (no nagging re-claim). Players who passed the tier but never claimed
-- already have it claimable, so they need no change.

DELETE FROM public.user_tier_claims utc
USING (VALUES
	(7,  'free',    'bunny_ears'),
	(7,  'premium', 'leaf_crown'),
	(18, 'premium', 'devil_horns'),
	(22, 'free',    'cat_ears'),
	(22, 'premium', 'astronaut')
) AS slot(tier, track, hat_id)
WHERE utc.season_id = 'snout_season_1'
  AND utc.tier  = slot.tier
  AND utc.track = slot.track
  AND NOT EXISTS (
	SELECT 1 FROM public.user_hats uh
	WHERE uh.user_id = utc.user_id
	  AND uh.hat_id  = slot.hat_id
  );
