-- ═══════════════════════════════════════════════════════════════════════════
-- RELEASE PARTY CROWN — a legendary launch-party keepsake.
-- HELD FOR REVIEW: push only on Brian's explicit "go" (CLAUDE.md — DB pushes
-- are never autonomous). Applied head at authoring time: 20260732.
--
-- Grant-only, never purchasable: this crown is GIFTED via a Golden Ticket
-- redemption (redeem_code, migration 20260732) at the launch party — it is
-- never in the shop. Modeled exactly on the seeded Exchange-exclusive idiom
-- (beta_founder_ribbon, 20260704400000): cost = 0, so it is
--   • hidden from Browse   — shop.tsx keeps cost<=0 items out unless owned;
--   • never in daily_shop() — the cost>0 filter drops it;
--   • unbuyable            — buy_hat rejects cost<=0.
--
-- ⚠️ ART GATE (same as beta_founder_ribbon): HAT_IMAGES + a placement pass
-- (tools/placement_studio) must land BEFORE grant-time, or owners see the
-- orphan-cosmetic fallback bug (20260685). The require() is wired in
-- constants/hats.ts; the anchor pass is the one remaining founder action.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING — reruns are safe no-ops. Brand-new
-- INSERT only, no CREATE OR REPLACE (carry-latest-def footgun avoided by
-- construction).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('release_party_crown', 'Release Party Crown', NULL, 0, 470, 'hat', 'legendary',
	 'A gilded crown handed out at the launch party — gifted, never sold.')
ON CONFLICT (id) DO NOTHING;
