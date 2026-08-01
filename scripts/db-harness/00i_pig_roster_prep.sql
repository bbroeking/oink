-- The production profiles table already has Slop Club membership state.
-- The deliberately-small harness stub predates it, so add only the dependency
-- required to compile and exercise 20260781000000_member_pig_roster.sql.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
