-- Stub harness for 20260707000000_sounder_league.sql validation.
-- Minimal real tables + correctly-signed stubs for everything referenced.
SET check_function_bodies = on;

CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;

-- pg_cron stub (real prod has the extension; plain postgres does not).
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid bigint, jobname text);
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

CREATE TABLE public.profiles (
	id uuid PRIMARY KEY,
	username text,
	feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
	war_wins int NOT NULL DEFAULT 0,
	tickles_earned int NOT NULL DEFAULT 0,
	alignment_max_pos int NOT NULL DEFAULT 0,
	alignment_max_neg int NOT NULL DEFAULT 0,
	counter int NOT NULL DEFAULT 0,
	golden_truffles int NOT NULL DEFAULT 0,   -- 20260704100000 truffle pouch (for the coop-dig rebuild)
	active_title_id text
);

-- Legacy achievement counter sources (my_achievements is SQL-language, so
-- check_function_bodies validates every category branch at CREATE).
CREATE TABLE public.blessings (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	sender_id uuid, receiver_id uuid, kind text,
	sent_at timestamptz DEFAULT now(), cleared_at timestamptz, expires_at timestamptz
);
CREATE TABLE public.curses (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	sender_id uuid, receiver_id uuid, sent_at timestamptz DEFAULT now()
);
CREATE TABLE public.friendships (
	requester_id uuid, receiver_id uuid, status text,
	PRIMARY KEY (requester_id, receiver_id)
);
CREATE TABLE public.daily_lucky_claims (
	user_id uuid, claimed_on date DEFAULT current_date,
	PRIMARY KEY (user_id, claimed_on)
);
CREATE TABLE public.lucky_pig_hits (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid
);
CREATE TABLE public.user_titles (
	user_id uuid, title_id text, PRIMARY KEY (user_id, title_id)
);
CREATE FUNCTION public.trade_given_total(p_user uuid) RETURNS int
LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION public.trade_received_total(p_user uuid) RETURNS int
LANGUAGE sql AS $$ SELECT 0 $$;

-- Achievements engine (20260520060000 shape) + echo claims — for 20260710.
CREATE TABLE public.titles (
	id text PRIMARY KEY, name text, placement text, description text,
	source text, for_sale boolean DEFAULT false, display_order int
);
CREATE TABLE public.achievements (
	id text PRIMARY KEY, category text, tier int, name text, description text,
	threshold int, reward_title_id text, reward_item_id text,
	reward_snouts int DEFAULT 0, icon text, display_order int,
	is_top_tier boolean DEFAULT false, display_category text NOT NULL DEFAULT 'generous'
);
CREATE TABLE public.user_achievements (
	user_id uuid, achievement_id text, claimed_at timestamptz, progress int,
	level int DEFAULT 0, viewed_at timestamptz,
	PRIMARY KEY (user_id, achievement_id)
);
CREATE TABLE public.echo_claims (
	event_id uuid, user_id uuid, created_at timestamptz DEFAULT now(),
	PRIMARY KEY (event_id, user_id)
);

-- Battle-pass tables (20260502010000 shape) + finale/config deps.
CREATE TABLE public.seasons (
	id text PRIMARY KEY,
	name text NOT NULL,
	starts_at timestamptz NOT NULL,
	ends_at timestamptz NOT NULL,
	total_tiers int NOT NULL DEFAULT 30,
	xp_per_tier int NOT NULL DEFAULT 100,
	premium_price_cents int NOT NULL DEFAULT 499,
	premium_plus_price_cents int NOT NULL DEFAULT 999,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.season_tiers (
	season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
	tier int NOT NULL,
	track text NOT NULL,
	reward_type text NOT NULL,
	reward_value jsonb NOT NULL,
	display_label text NOT NULL,
	PRIMARY KEY (season_id, tier, track)
);
CREATE TABLE public.user_season_progress (
	user_id uuid NOT NULL,
	season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
	xp int NOT NULL DEFAULT 0,
	PRIMARY KEY (user_id, season_id)
);
CREATE TABLE public.user_tier_claims (
	user_id uuid NOT NULL,
	season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
	tier int NOT NULL,
	track text NOT NULL,
	PRIMARY KEY (user_id, season_id, tier, track)
);
CREATE TABLE public.app_config (
	key text PRIMARY KEY,
	enabled boolean NOT NULL DEFAULT false,
	updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.finalize_season(season_key text DEFAULT 'season_1')
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.grant_beta_rewards() RETURNS void
LANGUAGE sql AS $$ SELECT $$;
-- Seed the two pass seasons so the copy-rename dance is exercised.
INSERT INTO public.seasons (id, name, starts_at, ends_at) VALUES
	('snout_season_1', 'Snout Season 1', '2026-05-02', '2026-07-12'),
	('snout_season_2', 'The Great Hunger', '2026-07-12', '2027-01-01');
INSERT INTO public.season_tiers VALUES ('snout_season_1', 1, 'free', 'tickles', '{"amount":25}', '25 tickles'),
	('snout_season_2', 1, 'free', 'tickles', '{"amount":25}', '25 tickles');
INSERT INTO public.user_season_progress VALUES ('00000000-0000-0000-0000-00000000a001', 'snout_season_1', 500);
INSERT INTO public.user_tier_claims VALUES ('00000000-0000-0000-0000-00000000a001', 'snout_season_1', 1, 'free');

CREATE TABLE public.crews (
	id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	name        text NOT NULL,
	leader_id   uuid,
	is_bot      boolean NOT NULL DEFAULT false,
	next_war_at timestamptz,
	created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crew_members (
	crew_id   uuid NOT NULL,
	user_id   uuid NOT NULL,
	role      text NOT NULL DEFAULT 'member',
	joined_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (crew_id, user_id)
);

CREATE TABLE public.crew_invites (
	id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	crew_id    uuid NOT NULL,
	inviter_id uuid NOT NULL,
	invitee_id uuid NOT NULL,
	status     text NOT NULL DEFAULT 'pending',
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mud_wars (
	id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	challenger_crew uuid NOT NULL,
	defender_crew   uuid NOT NULL,
	status          text NOT NULL DEFAULT 'pending',
	started_at      timestamptz,
	ends_at         timestamptz,
	winner_crew     uuid,
	resolved_at     timestamptz,
	is_bot_war      boolean NOT NULL DEFAULT false,
	rope_pos        int NOT NULL DEFAULT 0,
	forfeited_by    uuid,
	fronts_enabled  boolean NOT NULL DEFAULT false,
	rhythm_enabled  boolean NOT NULL DEFAULT false,
	build_ends_at   timestamptz,
	weekly_modifier text,
	created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mud_slings (
	id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	war_id     uuid NOT NULL,
	crew_id    uuid NOT NULL,
	user_id    uuid NOT NULL,
	slings     int NOT NULL DEFAULT 0,
	war_day    date NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.war_rootings (
	war_id       uuid NOT NULL,
	user_id      uuid NOT NULL,
	crew_id      uuid NOT NULL,
	window_index bigint,
	opened_at    timestamptz,
	submitted_at timestamptz
);

CREATE TABLE public.crew_ratings (
	crew_id          uuid PRIMARY KEY,
	rating           int NOT NULL DEFAULT 1200,
	provisional_wars int NOT NULL DEFAULT 0,
	wars_played      int NOT NULL DEFAULT 0,
	season           int NOT NULL DEFAULT 1,
	updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_announcements (
	id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	kind    text,
	title   text,
	body    text,
	data    jsonb
);

-- Stubbed functions the migration's bodies call (correct signatures).
CREATE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.mud_rhythm_on() RETURNS boolean
LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.mud_fronts_on() RETURNS boolean
LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.pick_weekly_modifier(p_war uuid) RETURNS text
LANGUAGE sql AS $$ SELECT 'none'::text $$;
CREATE FUNCTION public.seed_war_board(p_war uuid, p_day date) RETURNS void
LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.resolve_war(p_war uuid) RETURNS jsonb
LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;

CREATE TABLE public.user_hats (
	user_id uuid, hat_id text, PRIMARY KEY (user_id, hat_id)
);

-- hats — minimal shape for the race podium fallback (20260719): one random
-- unowned war_exclusive item (the 20260660 spoils-catalog flag). Exactly three
-- catalog rows so the owns-everything fallback is reachable in a smoke.
CREATE TABLE public.hats (
	id            text PRIMARY KEY,
	war_exclusive boolean NOT NULL DEFAULT false,
	token_cost    int
);
INSERT INTO public.hats (id, war_exclusive) VALUES
	('muddy_cap', true), ('reed_hat', true), ('bog_helmet', true),
	('plain_cap', false);

-- ── Co-op dig rebuild deps (20260714000000) ─────────────────────────────────
-- These live in unchained migrations (truffle_patch / season XP) in prod; the
-- coop-dig rebuild carries the dig RPCs that call them, so stub them here so the
-- smoke can actually mint + drain.
CREATE TABLE public.war_truffles (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	user_id uuid, amount int, reason text, war_id uuid,
	created_at timestamptz DEFAULT now()
);

-- mint_truffles — cap-aware mint (verbatim behavior from 20260704100000).
CREATE FUNCTION public.mint_truffles(p_user uuid, p_amount int, p_reason text, p_war uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE bal int; actual int;
BEGIN
	IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
	SELECT golden_truffles INTO bal FROM public.profiles WHERE id = p_user FOR UPDATE;
	IF bal IS NULL THEN RETURN 0; END IF;
	actual := LEAST(p_amount, GREATEST(0, 999 - bal));
	IF actual = 0 THEN RETURN 0; END IF;
	UPDATE public.profiles SET golden_truffles = golden_truffles + actual WHERE id = p_user;
	INSERT INTO public.war_truffles (user_id, amount, reason, war_id) VALUES (p_user, actual, p_reason, p_war);
	RETURN actual;
END $$;

-- rooting_finds — VERBATIM from 20260704100000 (client parity contract).
CREATE FUNCTION public.rooting_finds(p_seed int)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	state bigint := p_seed; orient int; vert int; shimmer int; junk int;
	finds text[] := ARRAY['truffle_l', 'truffle_d'];
BEGIN
	state := (state * 16807) % 2147483647; orient  := (state % 4)::int;
	state := (state * 16807) % 2147483647; vert    := (state % 2)::int;
	state := (state * 16807) % 2147483647; shimmer := (state % 2)::int;
	state := (state * 16807) % 2147483647; junk    := (state % 2)::int;
	IF shimmer = 1 THEN finds := finds || 'shimmer'::text; END IF;
	finds := finds || (CASE junk WHEN 0 THEN 'junk_boot' ELSE 'junk_wrap' END)::text;
	RETURN finds;
END $$;

CREATE FUNCTION public.grant_season_xp(uid uuid, amount int) RETURNS void
LANGUAGE sql AS $$ SELECT $$;

-- is_crew_member — kept crew helper (20260647); the coop-dig RLS policies use it.
CREATE FUNCTION public.is_crew_member(p_crew uuid, p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
	SELECT EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = p_crew AND user_id = p_user) $$;

-- ── Push delivery RECORDING stub (real def: 20260520050000, pg_net → exp.host).
-- The dig-off push migration (20260718) calls send_push_to_user; the smokes
-- assert against push_outbox instead of a live pg_net queue.
CREATE TABLE public.push_outbox (
	id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id uuid, title text, body text, data jsonb,
	sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.send_push_to_user(
	target_user_id uuid, push_title text, push_body text,
	push_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO public.push_outbox (user_id, title, body, data)
		VALUES (target_user_id, push_title, push_body, push_data);
	RETURN jsonb_build_object('ok', true);
END $$;
