-- ═══════════════════════════════════════════════════════════════════════════
-- TICKET TAKER'S CAP — the general-giveaway Golden-Ticket hat.
--
-- Rare, cost 0 → grant-only via redeem_code (never in Browse / daily_shop /
-- buy_hat), same idiom as release_party_crown (20260733). For street QR
-- posters, creator drops, and ad-hoc giveaways — distinct from the one-event
-- party crown so the party exclusive stays exclusive.
--
-- Client mirror: constants/hats.ts HAT_IMAGES.ticket_takers_cap (art ships in
-- build 108 — a claim on an older binary grants fine and renders the rarity
-- fallback plate until the app updates; see the 20260685 orphan-cosmetic
-- lesson).
-- INSERT only, no CREATE OR REPLACE (carry-latest-def footgun avoided by
-- construction).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('ticket_takers_cap', 'Ticket Taker''s Cap', NULL, 0, 471, 'hat', 'rare',
	 'A smart red usher''s cap with a golden ticket in the band — gifted, never sold.')
ON CONFLICT (id) DO NOTHING;
