-- Harness prep for the lifetime-tickles migration chain
-- (20260726 graduate board → 20260736 safeupdate fix → 20260737 lifetime tickles).
--
-- The stub `profiles` (00_stub.sql) is the war/league minimal shape and lacks the
-- columns the graduation block reads/writes, and there's no `user_items` table at
-- all. Prod carries all of these; this file is harness-only, passed as the FIRST
-- extra arg AHEAD of the migrations. See 50_lifetime_tickles_smoke.sql.

-- Graduation block SELECTs these two in its RANK()/hidden expressions.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;

-- The fresh-season bank reset UPDATEs user_items (one row per user, no item_id).
CREATE TABLE IF NOT EXISTS public.user_items (
	user_id        uuid PRIMARY KEY,
	item_count     int NOT NULL DEFAULT 0,
	last_increment timestamptz NOT NULL DEFAULT now()
);

-- ── Seed: three named players with un-graduated Season-0 tickles + a bank row. ─
-- The smoke drives graduate_season0_probe() over these, then asserts the archive,
-- the add-to-base, the zero, and (post-graduation) the fresh backfill guard.
-- season0_tickle_standings.user_id FKs auth.users, so seed those rows first.
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000000c1'),
	('00000000-0000-0000-0000-0000000000c2'),
	('00000000-0000-0000-0000-0000000000c3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, tickles_earned) VALUES
	('00000000-0000-0000-0000-0000000000c1', 'alpha', 500),
	('00000000-0000-0000-0000-0000000000c2', 'bravo', 120),
	('00000000-0000-0000-0000-0000000000c3', 'charlie', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_items (user_id, item_count) VALUES
	('00000000-0000-0000-0000-0000000000c1', 3),
	('00000000-0000-0000-0000-0000000000c2', 7),
	('00000000-0000-0000-0000-0000000000c3', 25)
ON CONFLICT (user_id) DO NOTHING;
