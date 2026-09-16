-- Fence the season-2 premium-track cosmetics off the shop.
--
-- 20260792000000_season2_premium_cosmetics_only.sql named nine members-only
-- cosmetics as snout_season_2 premium rewards — but it ran before any
-- snout_season_2 tier rows existed, so its UPDATEs matched nothing, and it
-- never flagged the items themselves. On prod (checked 2026-09-16) all nine
-- still read members_only=true, pass_exclusive=false, cost>0: plain for-sale
-- members' pieces, which the storefront's members' shelf now rotates in and
-- sells to Slop Club members for snouts.
--
-- A pass reward is the pass's (SKILL.md 2026-09-16). Flag them pass_exclusive
-- the way the season-1 premium nine already are (sovereign_jewel_crown …):
-- buy_hat() refuses them, daily_shop() / sounder_counter_buys() / the members'
-- shelf skip them, open_item_drive() can't open a Trough on them, and the
-- Closet still shows one you already own. Prices stay for the catalog card.
--
-- Still to do when season 2 is seeded: re-run 20260792's nine tier UPDATEs
-- (they are idempotent) so the track actually hands these out.

UPDATE public.hats
SET pass_exclusive = true
WHERE id IN (
	'ganache_truffle_crown',
	'slop_pail_topper',
	'truffle_medal_held',
	'drip_glaze_aura',
	'spa_wallow_bg',
	'cocoa_sheen_specs',
	'caramel_drip_bow',
	'corn_on_the_cob',
	'slop_club_signet_crown'
)
AND NOT pass_exclusive;
