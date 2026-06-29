-- Hide the orphaned "Tiny Umbrella" held item. It was seeded into the shop
-- catalog (20260632) but never given art — it's absent from HAT_IMAGES and
-- both positioning files (hat_rel / hat_overlays), so it renders the wand
-- fallback. Pull it until the planned art pass produces a real umbrella PNG.
-- Fully reversible: re-add a cost + the art later.
--
--   • cost = 0  → daily_shop() skips it (its candidates are cost > 0) and
--                 buy_hat() rejects it ('not_for_sale') — no new acquisition.
--   • unequip   → take it off any pig currently wearing it so the wrong art
--                 stops showing immediately.
--
-- Owned copies are left in place (no data destroyed); the closet grid hides
-- art-less items client-side, so they won't surface either.

UPDATE public.hats
SET cost = 0
WHERE id = 'tiny_umbrella';

UPDATE public.profiles
SET active_held_id = NULL
WHERE active_held_id = 'tiny_umbrella';
