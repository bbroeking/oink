-- Allow account deletion for referrers while preserving referred players.
-- The old NO ACTION constraint rejected delete_my_account() when a surviving
-- profile still referenced the departing auth user. Clear only that reference.

ALTER TABLE public.profiles
	DROP CONSTRAINT IF EXISTS profiles_referred_by_fkey;

ALTER TABLE public.profiles
	ADD CONSTRAINT profiles_referred_by_fkey
	FOREIGN KEY (referred_by)
	REFERENCES auth.users(id)
	ON DELETE SET NULL;
