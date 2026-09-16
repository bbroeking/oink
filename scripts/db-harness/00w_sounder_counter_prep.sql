-- Prep for 20260916130000_sounder_counter_buys.sql. Production has these
-- columns (user_hats.acquired_at from 20260501210000, profiles.active_pig_id
-- from the pig roster, hats.cost/category/pass_exclusive from the shop
-- migrations); the minimal stub does not.
ALTER TABLE public.user_hats ADD COLUMN IF NOT EXISTS acquired_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS active_pig_id text NOT NULL DEFAULT 'rosie';
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS cost           integer NOT NULL DEFAULT 0;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS category       text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS pass_exclusive boolean NOT NULL DEFAULT false;
-- auth.uid() reads the smoke.uid GUC so the smoke can act "as" a given pig
-- (same rewire 00o/15/24 apply; idempotent here).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid',true),'')::uuid $$;
