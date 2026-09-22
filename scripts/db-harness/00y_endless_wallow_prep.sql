-- Fixtures that must exist BEFORE 20260922100000_endless_wallow applies, so the
-- migration's one-shot work has something to act on:
--   * two pigs wearing the old Marsh Crown in the head slot (one with an empty
--     Neck slot, one already wearing a necklace) — the re-slot branch,
--   * a W11 pig — the ranks 7..N back-pay loop.
-- Asserted by A1_endless_wallow_smoke.sql. Never edit 00_stub.sql for these.

INSERT INTO public.hats (id, name, cost, display_order, category, rarity)
VALUES ('smoke_spare_necklace', 'Spare Necklace', 0, 9901, 'necklace', 'common')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000111001'::uuid),
  ('00000000-0000-0000-0000-000000111002'::uuid),
  ('00000000-0000-0000-0000-000000111011'::uuid);

INSERT INTO public.profiles(id, username, wallow_count, mote_balance, counter, golden_truffles,
                            active_hat_id, active_neck_id)
VALUES
  ('00000000-0000-0000-0000-000000111001'::uuid, 'wreath-bare-neck', 3, 0, 0, 0,
   'wallow_marsh_crown', NULL),
  ('00000000-0000-0000-0000-000000111002'::uuid, 'wreath-busy-neck', 3, 0, 0, 0,
   'wallow_marsh_crown', 'smoke_spare_necklace'),
  ('00000000-0000-0000-0000-000000111011'::uuid, 'backpay-eleven', 11, 0, 0, 0,
   NULL, NULL);
