-- Prep for 20260751000000_retire_trough_tickle_reward.sql (spec 15).
--
-- The migration re-defines donate_to_drive + claim_drive_reward (validated at
-- CREATE by check_function_bodies) and then runs a one-shot data claw-back. The
-- plain-Postgres stub + chain don't carry the full Trough shape, so this prep —
-- chained AHEAD of the migration ($@) — builds what the bodies + claw-back touch
-- and SEEDS the claw-back fixture the migration consumes. 49_trough_retire_smoke
-- asserts the outcome afterwards.
--
-- item_drives already exists (00f, minimal shape). Add the columns donate_to_drive
-- reads/writes: target_snouts / raised_snouts / granted_at. Nullable so 00f's own
-- inserts (which omit target_snouts) keep working.
ALTER TABLE public.item_drives ADD COLUMN IF NOT EXISTS target_snouts int;
ALTER TABLE public.item_drives ADD COLUMN IF NOT EXISTS raised_snouts int NOT NULL DEFAULT 0;
ALTER TABLE public.item_drives ADD COLUMN IF NOT EXISTS granted_at    timestamptz;

-- item_drive_donations — the per-donor ledger. Real shape (20260582); FKs dropped
-- for the harness so fixture rows needn't seed a matching drive.
CREATE TABLE IF NOT EXISTS public.item_drive_donations (
	id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	drive_id          uuid        NOT NULL,
	donor_user_id     uuid        NOT NULL,
	snouts            int         NOT NULL,
	tickle_reward     int         NOT NULL,
	reward_claimed_at timestamptz,
	created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Claw-back fixture ─────────────────────────────────────────────────────────
-- Boundary = 2026-07-12 00:10:39+00 (season-1 start). Two donors:
--   D1 (normal): counter/tickles_earned 100. Two CLAIMED post-boundary rewards
--       (5 + 3 = 8) → clawed. One CLAIMED pre-boundary reward (50) → untouched.
--       One PENDING reward (7) → zeroed by the migration, never clawed.
--   D2 (floor):  counter 2 / tickles_earned 1, one CLAIMED post-boundary reward
--       (10) → GREATEST floors both to 0.
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-000000049001'),
	('00000000-0000-0000-0000-000000049002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, counter, tickles_earned) VALUES
	('00000000-0000-0000-0000-000000049001', 'clawnormal', 100, 100),
	('00000000-0000-0000-0000-000000049002', 'clawfloor',    2,   1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.item_drive_donations
	(drive_id, donor_user_id, snouts, tickle_reward, reward_claimed_at) VALUES
	-- D1 post-boundary claimed → clawed (5 + 3)
	(gen_random_uuid(), '00000000-0000-0000-0000-000000049001', 50, 5,
		TIMESTAMPTZ '2026-07-12 00:10:39+00' + interval '1 day'),
	(gen_random_uuid(), '00000000-0000-0000-0000-000000049001', 30, 3,
		TIMESTAMPTZ '2026-07-12 00:10:39+00' + interval '2 days'),
	-- D1 pre-boundary claimed → untouched (settled season 0)
	(gen_random_uuid(), '00000000-0000-0000-0000-000000049001', 500, 50,
		TIMESTAMPTZ '2026-07-12 00:10:39+00' - interval '1 day'),
	-- D1 pending (unclaimed) → zeroed by step 3, never clawed
	(gen_random_uuid(), '00000000-0000-0000-0000-000000049001', 70, 7, NULL),
	-- D2 post-boundary claimed → floors D2 to 0
	(gen_random_uuid(), '00000000-0000-0000-0000-000000049002', 100, 10,
		TIMESTAMPTZ '2026-07-12 00:10:39+00' + interval '1 day');
