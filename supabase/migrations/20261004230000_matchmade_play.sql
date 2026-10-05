-- Matchmade play: the tables the Render play server keeps, the monthly wins
-- board the app reads, and the dark-launch switches.
--
-- Architecture (docs/multiplayer/README.md): an authoritative Node WebSocket
-- server on Render runs every match from the shared rules in multiplayer/.
-- It writes these tables with the service role; clients never write them.
-- Clients read exactly two things: their own results (RLS) and the wins board
-- (play_leaderboard, SECURITY DEFINER).
--
-- Charter (SKILL.md, 2026-10-04 entry): head-to-head is allowed inside
-- matchmade games only, and "losing still feels warm" holds by construction —
-- the public board counts WINS this month and nothing else: no loss column, no
-- public zero (a pig with no wins is simply absent), no rating on show, reset
-- monthly. The Elo-style rating in play_ratings is hidden and only shapes
-- who you are paired with.
--
-- AUTHORED, NOT PUSHED. Needs the founder's explicit "go" (CLAUDE.md).

-- ── Invites ──────────────────────────────────────────────────────────────────
-- One row per invite code. direct = named friends (pushed), link = anyone with
-- the URL, crew = the inviter's Sounder (pushed to each member).
CREATE TABLE IF NOT EXISTS public.play_invites (
	code        text PRIMARY KEY
		CHECK (code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$'),
	game        text NOT NULL CHECK (game ~ '^[a-z][a-z0-9_]{1,40}$'),
	pace        text NOT NULL CHECK (pace IN ('live', 'async')),
	kind        text NOT NULL CHECK (kind IN ('direct', 'link', 'crew')),
	from_user   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	to_users    uuid[] NOT NULL DEFAULT '{}',
	crew_id     uuid REFERENCES public.crews(id) ON DELETE SET NULL,
	room_id     uuid,
	status      text NOT NULL DEFAULT 'open'
		CHECK (status IN ('open', 'accepted', 'declined', 'cancelled', 'expired', 'full')),
	seats_max   int NOT NULL CHECK (seats_max BETWEEN 2 AND 4),
	accepted_by uuid[] NOT NULL DEFAULT '{}',
	created_at  timestamptz NOT NULL DEFAULT now(),
	updated_at  timestamptz NOT NULL DEFAULT now(),
	expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS play_invites_from_idx ON public.play_invites (from_user, created_at DESC);
CREATE INDEX IF NOT EXISTS play_invites_open_idx ON public.play_invites (expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS play_invites_to_idx ON public.play_invites USING gin (to_users);

-- ── Matches ──────────────────────────────────────────────────────────────────
-- One row per table (room). `state` is the full engine state INCLUDING the
-- secret seed, so play-by-push tables and live tables survive a server restart.
-- Service role only: no client policy, no client grant.
CREATE TABLE IF NOT EXISTS public.play_matches (
	id            uuid PRIMARY KEY,
	game          text NOT NULL CHECK (game ~ '^[a-z][a-z0-9_]{1,40}$'),
	rules_version int  NOT NULL,
	pace          text NOT NULL CHECK (pace IN ('live', 'async')),
	source        text NOT NULL CHECK (source IN ('queue', 'invite', 'rematch')),
	phase         text NOT NULL CHECK (phase IN ('lobby', 'starting', 'playing', 'ended')),
	seat_users    uuid[] NOT NULL DEFAULT '{}',
	state         jsonb NOT NULL,
	result        jsonb,
	created_at    timestamptz NOT NULL DEFAULT now(),
	updated_at    timestamptz NOT NULL DEFAULT now(),
	ended_at      timestamptz
);
CREATE INDEX IF NOT EXISTS play_matches_open_idx ON public.play_matches (pace, updated_at) WHERE phase <> 'ended';
CREATE INDEX IF NOT EXISTS play_matches_seat_users_idx ON public.play_matches USING gin (seat_users);

-- ── Results ──────────────────────────────────────────────────────────────────
-- One row per pig per finished table. `period` is the UTC month the table
-- ended in ('YYYY-MM') — the wins board's reset boundary.
CREATE TABLE IF NOT EXISTS public.play_results (
	match_id  uuid NOT NULL REFERENCES public.play_matches(id) ON DELETE CASCADE,
	user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	game      text NOT NULL,
	seat      int  NOT NULL CHECK (seat BETWEEN 0 AND 3),
	outcome   text NOT NULL
		CHECK (outcome IN ('win', 'draw', 'loss', 'coop_success', 'coop_short', 'shared', 'no_contest')),
	score     int,
	reason    text NOT NULL CHECK (reason IN ('complete', 'forfeit', 'ended_early', 'server')),
	opponents uuid[] NOT NULL DEFAULT '{}',
	period    text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
	ended_at  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS play_results_board_idx ON public.play_results (period, game, user_id) WHERE outcome = 'win';
CREATE INDEX IF NOT EXISTS play_results_user_idx ON public.play_results (user_id, ended_at DESC);

-- ── Hidden rating ────────────────────────────────────────────────────────────
-- Elo-style (start 1000, K 24), competitive games only, updated by the server
-- after each decided table. Never shown to any player; it only breaks ties in
-- the matchmaker's choice of partner.
CREATE TABLE IF NOT EXISTS public.play_ratings (
	user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	game       text NOT NULL,
	rating     int  NOT NULL DEFAULT 1000,
	games      int  NOT NULL DEFAULT 0 CHECK (games >= 0),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, game)
);

-- ── Access ───────────────────────────────────────────────────────────────────
ALTER TABLE public.play_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.play_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.play_matches FROM anon, authenticated;
REVOKE ALL ON TABLE public.play_ratings FROM anon, authenticated;
REVOKE ALL ON TABLE public.play_results FROM anon, authenticated;
GRANT SELECT ON TABLE public.play_results TO authenticated;

DROP POLICY IF EXISTS play_results_select_own ON public.play_results;
CREATE POLICY play_results_select_own ON public.play_results
	FOR SELECT TO authenticated
	USING (user_id = auth.uid());

-- ── The monthly wins board ───────────────────────────────────────────────────
-- Top p_limit pigs by wins in p_period (default: this UTC month), optionally
-- for one game. Ties share a rank (dense); within a rank, whoever reached the
-- count first is listed first. Pigs with hide_from_leaderboard never appear,
-- but `me` always carries the caller's own wins (rank null when hidden).
-- A pig with no wins is absent, never a zero row.
CREATE OR REPLACE FUNCTION public.play_leaderboard(
	p_game   text DEFAULT NULL,
	p_period text DEFAULT NULL,
	p_limit  int  DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH params AS (
		SELECT
			COALESCE(NULLIF(p_period, ''), to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM')) AS period,
			LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100) AS lim
	),
	wins AS (
		SELECT r.user_id, count(*)::int AS wins, max(r.ended_at) AS reached_at
		FROM public.play_results r, params
		WHERE r.period = params.period
			AND r.outcome = 'win'
			AND (p_game IS NULL OR r.game = p_game)
		GROUP BY r.user_id
	),
	visible AS (
		SELECT w.*, dense_rank() OVER (ORDER BY w.wins DESC) AS rank
		FROM wins w
		JOIN public.profiles p ON p.id = w.user_id
		WHERE NOT COALESCE(p.hide_from_leaderboard, false)
	),
	top AS (
		SELECT v.*
		FROM visible v
		ORDER BY v.rank, v.reached_at, v.user_id
		LIMIT (SELECT lim FROM params)
	)
	SELECT jsonb_build_object(
		'ok', true,
		'period', (SELECT period FROM params),
		'game', p_game,
		'rows', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'rank', t.rank,
				'user_id', t.user_id,
				'username', p.username,
				'pig_id', p.active_pig_id,
				'hat_id', p.active_hat_id,
				'bow_id', p.active_bow_id,
				'wallow', p.wallow_count,
				'wins', t.wins
			) ORDER BY t.rank, t.reached_at, t.user_id)
			FROM top t JOIN public.profiles p ON p.id = t.user_id
		), '[]'::jsonb),
		'me', jsonb_build_object(
			'wins', COALESCE((SELECT w.wins FROM wins w WHERE w.user_id = auth.uid()), 0),
			'rank', (SELECT v.rank FROM visible v WHERE v.user_id = auth.uid())
		)
	);
$function$;
REVOKE ALL ON FUNCTION public.play_leaderboard(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.play_leaderboard(text, text, int) TO authenticated;

-- ── Dark launch ──────────────────────────────────────────────────────────────
-- The door, the routes and the server all read one flag, resolved per user by
-- feature_flags(): off for everyone, on for is_test profiles. Flip it for all
-- with:  UPDATE public.app_config SET enabled = true WHERE key = 'multiplayer';
INSERT INTO public.app_config (key, enabled, description)
VALUES (
	'multiplayer',
	false,
	'Matchmade play (docs/multiplayer/README.md): the Play together door on Friends, invites, and the Render play server. Off globally; is_test profiles opted in via feature_overrides.'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.profiles
SET feature_overrides = COALESCE(feature_overrides, '{}'::jsonb) || jsonb_build_object('multiplayer', true)
WHERE is_test
	AND NOT (COALESCE(feature_overrides, '{}'::jsonb) ? 'multiplayer');

-- Where the app finds the play server, and which games it may offer. The
-- server is the authority on games (its welcome catalog); this row lets the
-- URL move (custom domain, new service) without a binary. Set `url` to the
-- Render service's wss URL after the first deploy.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'multiplayer',
	jsonb_build_object(
		'url', 'wss://ttp-play.onrender.com/ws',
		'practice', true,
		'async', true
	),
	'Matchmade play client config: url = the play server WebSocket endpoint (wss://<render service>/ws), practice/async = whether the app offers Practice and play-by-push. Games are switched on the server (welcome catalog), not here.'
)
ON CONFLICT (key) DO NOTHING;
