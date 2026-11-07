-- Minimal stand-alone prep for the Bullion's Market smoke
-- (C1_bullions_market_smoke.sql, C2_bullion_board_smoke.sql and
-- C3_market_launch_fixes_smoke.sql). It stubs only what the market migrations
-- read, so the market can be validated on a bare local Postgres without the
-- whole chain (one psql session: C2 uses C1's pg_temp helpers):
--
--   createdb market && psql -d market -v ON_ERROR_STOP=1 \
--     -f scripts/db-harness/00x_market_prep.sql \
--     -f supabase/migrations/20261031100000_bullions_market.sql \
--     -f supabase/migrations/20261031110000_market_followups.sql \
--     -f supabase/migrations/20261101150000_bullion_board.sql \
--     -f supabase/migrations/20261102200000_market_launch_fixes.sql \
--     -f scripts/db-harness/C1_bullions_market_smoke.sql \
--     -f scripts/db-harness/C2_bullion_board_smoke.sql \
--     -f scripts/db-harness/C3_market_launch_fixes_smoke.sql
--
-- No pg_cron here: 20261102200000 leaves the season2-flip job alone without it
-- (C3 tests the flip wrapper against a stub flip_season_2).
--
-- The tickle bank is stubbed WITHOUT regen (tickle_balance = item_count), so
-- every number in the smoke is exact. The real settle_tickles /
-- grant_tickles / tickle_balance keep the same contract: settle locks and
-- returns the spendable balance, grant adds past the cap.
\set ON_ERROR_STOP on

DO $roles$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb, description text, updated_at timestamptz DEFAULT now());
CREATE TABLE public.app_config (key text PRIMARY KEY, enabled boolean, updated_at timestamptz DEFAULT now());
INSERT INTO public.app_settings (key, value) VALUES
	('trader_tuning', '{"prices": {"common": 3, "uncommon": 8, "rare": 20}}');

CREATE TABLE public.profiles (
	id uuid PRIMARY KEY REFERENCES auth.users(id),
	username text,
	active_pig_id text DEFAULT 'rosie',
	is_vip boolean DEFAULT false
);
CREATE TABLE public.user_items (user_id uuid PRIMARY KEY, item_count int NOT NULL);

CREATE OR REPLACE FUNCTION public._patch_now() RETURNS timestamptz LANGUAGE sql STABLE AS $$
	SELECT COALESCE(NULLIF(current_setting('ttp.fake_now', true), '')::timestamptz, now()) $$;

CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid) RETURNS int LANGUAGE sql STABLE AS $$
	SELECT item_count FROM public.user_items WHERE user_id = uid $$;
CREATE OR REPLACE FUNCTION public.settle_tickles(uid uuid) RETURNS int LANGUAGE plpgsql AS $$
DECLARE b int;
BEGIN
	SELECT item_count INTO b FROM public.user_items WHERE user_id = uid FOR UPDATE;
	IF b IS NULL THEN RAISE EXCEPTION 'No user_items row for user %', uid; END IF;
	RETURN b;
END $$;
CREATE OR REPLACE FUNCTION public.grant_tickles(uid uuid, n int) RETURNS int LANGUAGE plpgsql AS $$
DECLARE b int;
BEGIN
	UPDATE public.user_items SET item_count = item_count + GREATEST(0, n) WHERE user_id = uid RETURNING item_count INTO b;
	IF b IS NULL THEN RAISE EXCEPTION 'No user_items row for user %', uid; END IF;
	RETURN b;
END $$;

CREATE TABLE public.friendships (requester_id uuid, receiver_id uuid, status text);
CREATE TABLE public.user_blocks (blocker_id uuid, blocked_id uuid);
CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
	SELECT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted'
		AND ((requester_id = user_a AND receiver_id = user_b) OR (requester_id = user_b AND receiver_id = user_a))) $$;
CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
	SELECT EXISTS (SELECT 1 FROM public.user_blocks
		WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)) $$;

CREATE TABLE public.satchel_finds (id text PRIMARY KEY, name text NOT NULL, rarity text NOT NULL, sort int NOT NULL);
INSERT INTO public.satchel_finds (id, name, rarity, sort) VALUES
	('river_pebble', 'river pebble', 'common', 10), ('blue_feather', 'blue feather', 'common', 20),
	('clover', 'four-leaf clover', 'common', 30), ('snail_shell', 'snail shell', 'common', 40),
	('brass_button', 'brass button', 'common', 50), ('wool_tuft', 'tuft of wool', 'common', 60),
	('red_berries', 'red berries', 'common', 70), ('pinecone', 'pinecone', 'common', 80),
	('old_key', 'old key', 'uncommon', 90), ('honeycomb', 'honeycomb chip', 'uncommon', 100),
	('marble', 'glass marble', 'uncommon', 110), ('tin_whistle', 'tin whistle', 'rare', 120);

CREATE TABLE public.satchel_items (
	id bigserial PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id),
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	source text NOT NULL DEFAULT 'dig',
	from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
-- The Season 2 fresh start's archive (20261029190000): the market reads when
-- the Satchels were last archived.
CREATE TABLE public.season_reset_archive (
	user_id uuid NOT NULL REFERENCES auth.users(id),
	season_id text NOT NULL,
	kind text NOT NULL,
	payload jsonb NOT NULL,
	archived_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, season_id, kind)
);
CREATE TABLE public.satchel_met (user_id uuid, find_id text, PRIMARY KEY (user_id, find_id));

-- Pushes (20261102200000): the real send_push_to_user posts to Expo through
-- pg_net. This one records what would have gone out; smoke.push_fail = 'on'
-- makes it raise (a failed push must never roll back a trade).
CREATE TABLE public._smoke_pushes (id bigserial PRIMARY KEY, user_id uuid, title text, body text, data jsonb);
CREATE OR REPLACE FUNCTION public.send_push_to_user(target_user_id uuid, push_title text, push_body text,
	push_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
	IF current_setting('smoke.push_fail', true) = 'on' THEN RAISE EXCEPTION 'push service down'; END IF;
	INSERT INTO public._smoke_pushes (user_id, title, body, data) VALUES (target_user_id, push_title, push_body, push_data);
	RETURN jsonb_build_object('ok', true, 'request_id', currval('public._smoke_pushes_id_seq'));
END $$;
