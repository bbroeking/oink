-- Harness prep for the QR-redemption migration validation.
-- The stub's `hats` table is minimal (id, war_exclusive, token_cost); prod hats
-- carries `name text NOT NULL`. redeem_code()'s body SELECTs hats.name, and
-- check_function_bodies=on validates that reference at CREATE — so backfill the
-- column onto the stub BEFORE the migration is applied. Prod already has it;
-- this file is harness-only (passed as the first extra arg, ahead of the
-- migration). See scripts/db-harness/40_redemption_smoke.sql for the assertions.
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common';
UPDATE public.hats SET name = initcap(replace(id, '_', ' ')) WHERE name IS NULL;

-- 20260733 (release_party_crown) seeds a grant-only hat with the prod catalog
-- shape: emoji / cost / display_order / category (the beta_founder_ribbon
-- idiom). The stub `hats` is minimal (id, war_exclusive, token_cost), so
-- backfill those columns too or the INSERT can't parse. Harness-only; prod
-- already carries them (20260501210000_hats_shop + later category/rarity adds).
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS emoji         text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS cost          integer NOT NULL DEFAULT 0;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS category      text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS description   text;
