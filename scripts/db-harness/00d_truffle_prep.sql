-- Harness prep for the truffle-reclaim cooldown migration
-- (20260738400000_truffle_reclaim_cooldown.sql).
--
-- The stub (00_stub.sql) is the war/league minimal shape and has no
-- `public.truffles` table at all, but reclaim_truffle()/bury_truffle() (carried
-- verbatim from 20260656/20260637 by that migration) SELECT/UPDATE/INSERT it,
-- and check_function_bodies=on validates those references at CREATE. Prod
-- carries this table (20260632-era bury_truffle chain); this file is
-- harness-only and must be applied AHEAD of 20260738400000.
--
-- Shape matches 52_truffle_reclaim_cooldown_smoke.sql's own IF-NOT-EXISTS copy
-- (bigserial id, host_id, reward, remaining, dug_by, dug_at, created_at) so the
-- self-contained smoke's CREATE TABLE IF NOT EXISTS is a clean no-op. The
-- migration adds reclaimed_at via ALTER ... ADD COLUMN IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS public.truffles (
	id           bigserial PRIMARY KEY,
	host_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reward       int  NOT NULL,
	remaining    int  NOT NULL,
	dug_by       uuid,
	dug_at       timestamptz,
	created_at   timestamptz NOT NULL DEFAULT now()
);
