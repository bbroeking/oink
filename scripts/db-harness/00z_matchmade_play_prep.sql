-- Minimal stub for validating 20261004230000_matchmade_play.sql on a plain
-- Postgres (see scripts/db-harness/run.sh and memory: local db reset dies at
-- the pg_cron migration). Only what the migration references, with the real
-- column names and types.
--   cat scripts/db-harness/00z_matchmade_play_prep.sql \
--       supabase/migrations/20261004230000_matchmade_play.sql \
--       scripts/db-harness/96_matchmade_play_smoke.sql \
--     | docker exec -i pgval psql -U postgres -v ON_ERROR_STOP=1
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
	id uuid PRIMARY KEY,
	username text,
	active_pig_id text NOT NULL DEFAULT 'rosie',
	active_hat_id text,
	active_bow_id text,
	wallow_count int NOT NULL DEFAULT 0,
	hide_from_leaderboard boolean NOT NULL DEFAULT false,
	is_test boolean NOT NULL DEFAULT false,
	feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.crews (id uuid PRIMARY KEY);

CREATE TABLE IF NOT EXISTS public.app_config (
	key text PRIMARY KEY,
	enabled boolean NOT NULL DEFAULT false,
	description text,
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
	key text PRIMARY KEY,
	value jsonb NOT NULL,
	description text,
	updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.profiles (id, username, is_test, hide_from_leaderboard) VALUES
	('00000000-0000-0000-0000-00000000000a', 'clover', true,  false),
	('00000000-0000-0000-0000-00000000000b', 'bandit', false, false),
	('00000000-0000-0000-0000-00000000000c', 'pepper', false, true),
	('00000000-0000-0000-0000-00000000000d', 'biscuit', false, false);
