-- Prep for 20260753000000_tickle_breakdown.sql (spec 17).
--
-- tickle_breakdown()'s body reads public.truffle_digs and two timestamp columns
-- the minimal stub omits; check_function_bodies=on validates the body at CREATE,
-- so those must exist AHEAD of the migration ($@). barn_visits / tickle_trades
-- come from 00e (already chained above); seasons / season_tiers / user_tier_claims
-- / daily_lucky_claims come from 00_stub. 56_tickle_breakdown_smoke.sql seeds its
-- own fixtures + asserts afterward, so this file only shapes the schema.

-- Barn-forage dig ledger (real: 20260610). Neither the stub nor the chain carry it.
CREATE TABLE IF NOT EXISTS public.truffle_digs (
	truffle_id bigint,
	digger_id  uuid,
	amount     int,
	dug_at     timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (truffle_id, digger_id)
);

-- The real daily_lucky_claims carries claimed_at (20260506); the stub's minimal
-- copy keys on (user_id, claimed_on) with no timestamp. Add claimed_at so the
-- lucky-lane predicate (claimed_at > boundary) validates + runs.
ALTER TABLE public.daily_lucky_claims
	ADD COLUMN IF NOT EXISTS claimed_at timestamptz NOT NULL DEFAULT now();

-- The real user_tier_claims carries claimed_at (20260502); the stub omits it.
-- Add it for the pass-lane predicate (claimed_at > boundary).
ALTER TABLE public.user_tier_claims
	ADD COLUMN IF NOT EXISTS claimed_at timestamptz NOT NULL DEFAULT now();
