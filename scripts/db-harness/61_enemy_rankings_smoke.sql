-- Functional smoke for enemy rankings (20260795000000): curse inserts roll up
-- into one canonical unordered pair, leave friendship bond unchanged, and feed
-- the ranked board + pinned caller row.
\set ON_ERROR_STOP on

DO $smoke_enemy_rankings$
DECLARE
	pa uuid := '00000000-0000-0000-0000-000000061001';
	pb uuid := '00000000-0000-0000-0000-000000061002';
	pc uuid := '00000000-0000-0000-0000-000000061003';
	pd uuid := '00000000-0000-0000-0000-000000061004';
	res jsonb;
	enemies jsonb;
	you jsonb;
BEGIN
	INSERT INTO auth.users (id) VALUES (pa), (pb), (pc), (pd) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		(pa, 'eada'), (pb, 'ebo'), (pc, 'ecass'), (pd, 'edex')
		ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

	-- Three curses in both directions must share one canonical rivalry row.
	INSERT INTO public.curses (sender_id, receiver_id) VALUES
		(pa, pb), (pb, pa), (pa, pb);
	IF (SELECT count(*) FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 1 THEN
		RAISE EXCEPTION 'enemy_rankings: reversed curses must share one row'; END IF;
	IF (SELECT curses FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 3 THEN
		RAISE EXCEPTION 'enemy_rankings: expected 3 rolled-up curses'; END IF;
	IF (SELECT bond FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 0 THEN
		RAISE EXCEPTION 'enemy_rankings: curses must not increase friendship bond'; END IF;

	-- A stronger rivalry establishes deterministic rank order.
	INSERT INTO public.curses (sender_id, receiver_id) VALUES
		(pc, pd), (pd, pc), (pc, pd), (pd, pc), (pc, pd);

	PERFORM set_config('smoke.uid', pd::text, true);
	res := public.enemy_leaderboard(25);
	enemies := res->'enemies';
	IF NOT (res->>'ok')::boolean OR jsonb_array_length(enemies) <> 2 THEN
		RAISE EXCEPTION 'enemy_leaderboard: expected two rows, got %', res; END IF;
	IF (enemies->0->>'curses')::int <> 5 OR (enemies->0->>'rank')::int <> 1 THEN
		RAISE EXCEPTION 'enemy_leaderboard: five-curse rivalry must rank first'; END IF;
	IF (enemies->0->>'curses_a_to_b')::int <> 3
		OR (enemies->0->>'curses_b_to_a')::int <> 2 THEN
		RAISE EXCEPTION 'enemy_leaderboard: expected directional split 3/2, got %', enemies->0;
	END IF;
	IF NOT (enemies->0->>'is_self')::boolean OR res->'you' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'enemy_leaderboard: visible caller rivalry must not be pinned'; END IF;

	PERFORM set_config('smoke.uid', pa::text, true);
	res := public.enemy_leaderboard(1);
	you := res->'you';
	IF (you->>'curses')::int <> 3 OR (you->>'curses_a_to_b')::int <> 2
		OR (you->>'curses_b_to_a')::int <> 1 OR (you->>'rank')::int <> 2
		OR NOT (you->>'is_self')::boolean THEN
		RAISE EXCEPTION 'enemy_leaderboard: caller outside top must get rank-2 pin, got %', you;
	END IF;

	RAISE NOTICE 'chk enemy_rankings: canonical rollup + direction + bond isolation + order/is_self/you-row OK';
END $smoke_enemy_rankings$;

DELETE FROM public.curses WHERE sender_id IN
	('00000000-0000-0000-0000-000000061001','00000000-0000-0000-0000-000000061002',
	 '00000000-0000-0000-0000-000000061003','00000000-0000-0000-0000-000000061004');
DELETE FROM public.pair_bonds WHERE user_a IN
	('00000000-0000-0000-0000-000000061001','00000000-0000-0000-0000-000000061002',
	 '00000000-0000-0000-0000-000000061003','00000000-0000-0000-0000-000000061004');
DELETE FROM public.profiles WHERE id IN
	('00000000-0000-0000-0000-000000061001','00000000-0000-0000-0000-000000061002',
	 '00000000-0000-0000-0000-000000061003','00000000-0000-0000-0000-000000061004');
