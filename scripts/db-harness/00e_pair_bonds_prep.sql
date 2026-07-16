-- Harness prep for the pair-bonds migration (20260743000000_pair_bonds.sql).
--
-- That migration attaches AFTER triggers to three tables — tickle_trades,
-- blessings, barn_visits — and its backfill SELECTs all three. The stub
-- (00_stub.sql) carries `blessings` already but NOT tickle_trades or
-- barn_visits, and check_function_bodies=on / CREATE TRIGGER both require the
-- target tables to exist at apply time. Prod carries both (20260520010000 /
-- 20260590000000-era); this file is harness-only and must be applied AHEAD of
-- 20260743000000.
--
-- Shapes match 42_pair_bonds_smoke.sql's own IF-NOT-EXISTS copies (and the
-- real columns the triggers/backfill read: requester_id/target_id/status for
-- trades, visitor_id/target_id for visits) so the self-contained smoke's
-- CREATE TABLE IF NOT EXISTS calls are clean no-ops.
CREATE TABLE IF NOT EXISTS public.tickle_trades (
	id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	requester_id uuid,
	target_id    uuid,
	amount       int DEFAULT 1,
	status       text DEFAULT 'pending',
	created_at   timestamptz DEFAULT now(),
	fulfilled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.barn_visits (
	id               bigserial PRIMARY KEY,
	visitor_id       uuid,
	target_id        uuid,
	tickles          int DEFAULT 1,
	visit_started_at timestamptz,
	visit_cap        int DEFAULT 1,
	created_at       timestamptz DEFAULT now()
);
