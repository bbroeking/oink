-- Fixtures that must exist BEFORE 20261004201000_account_deletion_referral_cleanup
-- applies. Prod got profiles.referred_by from 20260520020000_sounder.sql as an
-- inline `REFERENCES auth.users(id)` (default name profiles_referred_by_fkey,
-- NO ACTION), which is not in this chain; recreate exactly that here so the
-- migration's DROP + re-ADD acts on the real shape. A referrer and a referee
-- are seeded for A2_account_deletion_referral_cleanup_smoke.sql.
-- Never edit 00_stub.sql for these.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000120001'::uuid),
  ('00000000-0000-0000-0000-000000120002'::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, referred_by) VALUES
  ('00000000-0000-0000-0000-000000120001'::uuid, 'smoke_referrer', NULL),
  ('00000000-0000-0000-0000-000000120002'::uuid, 'smoke_referee',
   '00000000-0000-0000-0000-000000120001'::uuid)
ON CONFLICT (id) DO NOTHING;
