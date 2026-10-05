-- Smoke for 20261004230000_matchmade_play.sql (run after 00z_matchmade_play_prep.sql).
-- Pins: the dark-launch rows, the is_test opt-in, the wins board's shape
-- (wins only, dense ranks, hidden pigs absent but their own `me` intact, no
-- zero rows), and that clients can't read matches/invites/ratings.

-- Dark launch: global flag off, test profile opted in, client config row seeded.
DO $$ BEGIN
	ASSERT (SELECT enabled FROM public.app_config WHERE key = 'multiplayer') = false, 'flag must ship off';
	ASSERT (SELECT (feature_overrides ->> 'multiplayer')::boolean FROM public.profiles WHERE username = 'clover'), 'is_test opted in';
	ASSERT (SELECT feature_overrides ? 'multiplayer' FROM public.profiles WHERE username = 'bandit') = false, 'non-test untouched';
	ASSERT (SELECT value ->> 'url' FROM public.app_settings WHERE key = 'multiplayer') LIKE 'wss://%', 'url seeded';
END $$;

-- A month of tables: clover 3 wins, bandit 3 wins (reached later), pepper
-- (hidden) 4 wins, biscuit 0 wins (a loss and a draw only).
INSERT INTO public.play_matches (id, game, rules_version, pace, source, phase, seat_users, state, ended_at)
SELECT gen_random_uuid(), 'mud_volley', 1, 'live', 'queue', 'ended', '{}', '{}'::jsonb, now()
FROM generate_series(1, 12);

WITH m AS (SELECT id, row_number() OVER () AS n FROM public.play_matches)
INSERT INTO public.play_results (match_id, user_id, game, seat, outcome, reason, period, ended_at)
SELECT m.id, x.user_id::uuid, 'mud_volley', 0, x.outcome, 'complete', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM'), now() - (x.age || ' minutes')::interval
FROM m JOIN (VALUES
	(1,  '00000000-0000-0000-0000-00000000000a', 'win',  30),
	(2,  '00000000-0000-0000-0000-00000000000a', 'win',  29),
	(3,  '00000000-0000-0000-0000-00000000000a', 'win',  28),
	(4,  '00000000-0000-0000-0000-00000000000b', 'win',  10),
	(5,  '00000000-0000-0000-0000-00000000000b', 'win',   9),
	(6,  '00000000-0000-0000-0000-00000000000b', 'win',   8),
	(7,  '00000000-0000-0000-0000-00000000000c', 'win',   7),
	(8,  '00000000-0000-0000-0000-00000000000c', 'win',   6),
	(9,  '00000000-0000-0000-0000-00000000000c', 'win',   5),
	(10, '00000000-0000-0000-0000-00000000000c', 'win',   4),
	(11, '00000000-0000-0000-0000-00000000000d', 'loss',  3),
	(12, '00000000-0000-0000-0000-00000000000d', 'draw',  2)
) AS x(n, user_id, outcome, age) ON x.n = m.n;

-- As biscuit (no wins): rows are clover then bandit at rank 1, pepper absent.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
DO $$
DECLARE b jsonb := public.play_leaderboard('mud_volley', NULL, 50);
BEGIN
	ASSERT jsonb_array_length(b -> 'rows') = 2, format('expected 2 rows, got %s', b -> 'rows');
	ASSERT b -> 'rows' -> 0 ->> 'username' = 'clover', 'earliest to reach 3 lists first';
	ASSERT (b -> 'rows' -> 0 ->> 'rank')::int = 1 AND (b -> 'rows' -> 1 ->> 'rank')::int = 1, 'ties share a rank';
	ASSERT NOT (b -> 'rows')::text LIKE '%pepper%', 'hidden pig absent';
	ASSERT NOT (b -> 'rows')::text LIKE '%biscuit%', 'no zero rows';
	ASSERT (b -> 'me' ->> 'wins')::int = 0 AND (b -> 'me' -> 'rank') = 'null'::jsonb, 'me without wins';
END $$;

-- As pepper (hidden, 5 wins): own wins visible to self, no rank.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$
DECLARE b jsonb := public.play_leaderboard(NULL, NULL, NULL);
BEGIN
	ASSERT (b -> 'me' ->> 'wins')::int = 4, format('hidden pig keeps own wins, got %s', b -> 'me');
	ASSERT (b -> 'me' -> 'rank') = 'null'::jsonb, 'hidden pig has no rank';
	ASSERT b ->> 'period' = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM'), 'defaults to this month';
END $$;

-- Another month is empty.
DO $$ BEGIN
	ASSERT jsonb_array_length(public.play_leaderboard(NULL, '1999-01', 10) -> 'rows') = 0, 'other month empty';
END $$;

-- Clients cannot read matches, invites or ratings; they can read only their own results.
DO $$ BEGIN
	ASSERT NOT has_table_privilege('authenticated', 'public.play_matches', 'SELECT'), 'matches hidden';
	ASSERT NOT has_table_privilege('authenticated', 'public.play_invites', 'SELECT'), 'invites hidden';
	ASSERT NOT has_table_privilege('authenticated', 'public.play_ratings', 'SELECT'), 'ratings hidden';
	ASSERT has_table_privilege('authenticated', 'public.play_results', 'SELECT'), 'own results readable';
	ASSERT NOT has_table_privilege('authenticated', 'public.play_results', 'INSERT'), 'results not writable';
	ASSERT has_function_privilege('authenticated', 'public.play_leaderboard(text, text, integer)', 'EXECUTE'), 'board callable';
END $$;

SELECT 'matchmade play smoke: ok' AS result;
