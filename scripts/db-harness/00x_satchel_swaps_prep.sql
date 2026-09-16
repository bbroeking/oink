-- Prep for 20260917100000_satchel_swaps.sql (the barn swap).
--
-- Two gaps between the minimal chain and production:
--
--   1. tickle_breakdown is carried from its LATEST definition
--      (20260803010000_rewarded_ads_reporting.sql), which reads the `ads` lane
--      off public.rewarded_ad_consumptions. The chain applies the OLDER
--      20260753000000 def and never applies 20260803000000_rewarded_ads.sql,
--      so the table does not exist and check_function_bodies would reject the
--      carried body. Stub it with production's shape (20260803000000) so the
--      real call site validates and the lane reads 0.
--
--   2. are_friends / are_blocked are constants in the chain (true / false), so
--      no smoke can reach the `not_friends` or `blocked` refusals (audit F9).
--      Re-stub both to read a transaction-local GUC, keeping production's
--      signatures and the chain's default answers:
--        smoke.unfriend = <uuid>  → that pig is friends with nobody
--        smoke.blocked  = <uuid>  → that pig is blocked by everyone
--      Unset (the default) means everyone is friends and nobody is blocked,
--      exactly as before, so every earlier fixture keeps its behaviour.
--
-- profiles.discriminator (my_satchel_swaps joins it) already exists — added by
-- 00e_sounder_invite_any_player_prep.sql — but re-assert it so this file can be
-- read on its own.

CREATE TABLE IF NOT EXISTS public.rewarded_ad_consumptions (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id uuid NOT NULL,
	consumed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rewarded_ad_consumptions_user_time_idx
	ON public.rewarded_ad_consumptions(user_id, consumed_at DESC);

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS discriminator text;

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
	SELECT COALESCE(NULLIF(current_setting('smoke.unfriend', true), ''), '-')
		NOT IN (a::text, b::text)
$$;

CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
	SELECT COALESCE(NULLIF(current_setting('smoke.blocked', true), ''), '-')
		IN (a::text, b::text)
$$;
