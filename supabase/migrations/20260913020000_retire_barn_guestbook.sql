-- Retire the Barn guestbook (founder call, 2026-09-12).
--
-- The guestbook was two readouts (home placard + interior dock), a signing flow
-- inside friend visits, and the kindness-card blessing that rode on a stamped
-- visit. The client no longer renders or calls any of it, so the server side
-- goes too: the stamps table, its four RPCs, and the trigger that awarded the
-- Guestbook Keepsake on a host's first stamp.
--
-- What stays:
--   · `habitat_items.guestbook_keepsake` — flipped to active=false, which is the
--     catalog's existing "retired" semantics: hidden unless owned, never granted
--     or sold again. Owners keep it and their rooms keep rendering it.
--   · `habitat_milestones` / `habitat_grant_receipts` rows already written — they
--     are the receipts for those grants and reference nothing dropped here.
--   · The interaction-analytics allowlist rows for visit_stamp_left /
--     guestbook_opened / kindness_card_* — inline VALUES inside the validator
--     and funnel functions. The client emits none of them any more; they are
--     dead entries, not a hazard, and rewriting those functions from a stale
--     base is the carry-latest-def footgun. Prune them the next time those
--     functions are touched for a real reason.
--
-- Authored for review; do not push without Brian's explicit go.

DROP TRIGGER IF EXISTS grant_habitat_guestbook_keepsake ON public.barn_guestbook_stamps;
DROP FUNCTION IF EXISTS public._grant_habitat_guestbook_keepsake();

DROP FUNCTION IF EXISTS public.leave_barn_kindness_card(uuid);
DROP FUNCTION IF EXISTS public.barn_kindness_card_status(uuid);
DROP FUNCTION IF EXISTS public.my_barn_guestbook(int);
DROP FUNCTION IF EXISTS public.leave_barn_guestbook_stamp(uuid, text);

DROP TABLE IF EXISTS public.barn_guestbook_stamps;

UPDATE public.habitat_items SET active = false WHERE id = 'guestbook_keepsake';
