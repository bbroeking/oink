-- 20261004201000_account_deletion_referral_cleanup: deleting a referrer's auth
-- user must succeed and clear only the referee's referred_by; the referee's
-- profile survives. Fixtures from 00zb_account_deletion_referral_prep.sql.
\set ON_ERROR_STOP on

DO $smoke$
BEGIN
  IF (SELECT confdeltype FROM pg_constraint
      WHERE conname = 'profiles_referred_by_fkey'
        AND conrelid = 'public.profiles'::regclass) IS DISTINCT FROM 'n' THEN
    RAISE EXCEPTION 'profiles_referred_by_fkey is not ON DELETE SET NULL';
  END IF;

  -- The referrer's profile row goes first (delete_my_account's order), then the
  -- auth user; under the old NO ACTION FK the second DELETE raised 23503.
  DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000120001'::uuid;
  DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000120001'::uuid;

  IF NOT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = '00000000-0000-0000-0000-000000120002'::uuid) THEN
    RAISE EXCEPTION 'the referee lost their profile';
  END IF;
  IF (SELECT referred_by FROM public.profiles
      WHERE id = '00000000-0000-0000-0000-000000120002'::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'the referee still points at the deleted referrer';
  END IF;
  RAISE NOTICE 'chk account_deletion_referral_cleanup: referee kept, referred_by cleared';
END
$smoke$;
