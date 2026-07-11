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
