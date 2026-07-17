-- Functional smoke for SEEDED CREW BOARDS (20260748000000, wedge 5a).
--
-- The change: open_rooting derives the board seed from f(window, crew_id)
-- instead of f(window, user_id), so every pig in the SAME Sounder digs the
-- IDENTICAL patch each feeding (the comparability unlock). This smoke opens
-- digs as members of two different crews in one pinned window and asserts:
--
--   1. Two crewmates (same window + same crew) get the IDENTICAL stored seed
--      → the IDENTICAL board (rooting_finds equal).
--   2. That seed EQUALS the crew-keyed hashtext expression the migration uses
--      — and does NOT equal the OLD per-user value (proves the key moved from
--      user_id to crew_id; under the old formula the two crewmates would have
--      had DIFFERENT boards).
--   3. A member of a DIFFERENT crew (same window) gets a DIFFERENT seed/board.
--   4. A crewless pig is still refused (no_crew) — the solo (window, user_id)
--      seed branch and the practice/random path are CLIENT-side (open_rooting
--      never issues a solo board); they're covered by __tests__/rooting.test.ts
--      (crewBoardSeed + practiceSeed). The migration's COALESCE(my_crew,
--      caller_id) documents that unreachable server fallback.
--
-- Reads _feeding_sched() live so it's robust to whichever offset the earlier
-- feeding-flip smoke left active. Self-contained fixtures (d-namespace ids) so
-- it can't collide with 15's a/b crews or their current-window rows.
\set ON_ERROR_STOP on

-- auth.uid() off a GUC (same shim as 15) — re-declared idempotently in case this
-- smoke runs standalone.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-0000000d0001', 'herd_a1'),
	('00000000-0000-0000-0000-0000000d0002', 'herd_a2'),
	('00000000-0000-0000-0000-0000000d0003', 'herd_b1'),
	('00000000-0000-0000-0000-0000000d0099', 'herd_stray')
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id) SELECT id FROM public.profiles ON CONFLICT (id) DO NOTHING;
INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-0000000dc001', 'HerdA', '00000000-0000-0000-0000-0000000d0001'),
	('00000000-0000-0000-0000-0000000dc002', 'HerdB', '00000000-0000-0000-0000-0000000d0003')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-0000000dc001', '00000000-0000-0000-0000-0000000d0001', 'leader'),
	('00000000-0000-0000-0000-0000000dc001', '00000000-0000-0000-0000-0000000d0002', 'member'),
	('00000000-0000-0000-0000-0000000dc002', '00000000-0000-0000-0000-0000000d0003', 'leader');

DO $smoke$
DECLARE
	a1   uuid := '00000000-0000-0000-0000-0000000d0001';
	a2   uuid := '00000000-0000-0000-0000-0000000d0002';
	b1   uuid := '00000000-0000-0000-0000-0000000d0003';
	stray uuid := '00000000-0000-0000-0000-0000000d0099';
	crew_a uuid := '00000000-0000-0000-0000-0000000dc001';
	crew_b uuid := '00000000-0000-0000-0000-0000000dc002';
	sched  int[] := public._feeding_sched();
	win    bigint;
	sa1 int; sa2 int; sb1 int;
	crew_expected int; old_a1 int; old_a2 int;
	res jsonb;
BEGIN
	-- Pin the clock to 1h into the CURRENT open block (offset-aware via sched).
	PERFORM set_config('ttp.fake_now',
		(to_timestamp(floor((extract(epoch FROM now()) - sched[3]) / sched[1]) * sched[1] + sched[3])
		 + interval '1 hour')::text, true);
	win := floor((extract(epoch FROM public._patch_now()) - sched[3]) / sched[1])::bigint;

	-- ── crew A, two members: same window + same crew → identical board ─────────
	PERFORM set_config('smoke.uid', a1::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'a1 open should be ok: %', res; END IF;
	SELECT wr.seed INTO sa1 FROM public.war_rootings wr WHERE wr.user_id = a1 AND wr.window_index = win;

	PERFORM set_config('smoke.uid', a2::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'a2 open should be ok: %', res; END IF;
	SELECT wr.seed INTO sa2 FROM public.war_rootings wr WHERE wr.user_id = a2 AND wr.window_index = win;

	IF sa1 <> sa2 THEN
		RAISE EXCEPTION 'crewmates should share ONE seeded board: a1=% a2=%', sa1, sa2;
	END IF;
	IF public.rooting_finds(sa1) <> public.rooting_finds(sa2) THEN
		RAISE EXCEPTION 'identical seed must yield identical board finds: % vs %',
			public.rooting_finds(sa1), public.rooting_finds(sa2);
	END IF;

	-- ── the seed is CREW-keyed (not user-keyed) ────────────────────────────────
	crew_expected := (abs(hashtext(win::text || ':' || crew_a::text)) % 2147483646) + 1;
	old_a1 := (abs(hashtext(win::text || ':' || a1::text)) % 2147483646) + 1;
	old_a2 := (abs(hashtext(win::text || ':' || a2::text)) % 2147483646) + 1;
	IF sa1 <> crew_expected THEN
		RAISE EXCEPTION 'seed not crew-keyed: got % want f(win,crew)=%', sa1, crew_expected;
	END IF;
	-- Sanity that the change is real: the OLD per-user formula gave the two
	-- crewmates DIFFERENT seeds, and the new crew seed differs from a1's old seed.
	IF old_a1 = old_a2 THEN
		RAISE EXCEPTION 'test premise broken: old per-user seeds collided (% = %)', old_a1, old_a2;
	END IF;
	IF sa1 = old_a1 THEN
		RAISE EXCEPTION 'seed still per-user (unchanged from old formula): %', sa1;
	END IF;

	-- ── crew B, same window → DIFFERENT board ──────────────────────────────────
	PERFORM set_config('smoke.uid', b1::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'b1 open should be ok: %', res; END IF;
	SELECT wr.seed INTO sb1 FROM public.war_rootings wr WHERE wr.user_id = b1 AND wr.window_index = win;
	IF sb1 = sa1 THEN
		RAISE EXCEPTION 'different crews must dig different boards: crewA=% crewB=%', sa1, sb1;
	END IF;
	IF sb1 <> (abs(hashtext(win::text || ':' || crew_b::text)) % 2147483646) + 1 THEN
		RAISE EXCEPTION 'crew B seed not keyed on crew B: %', sb1;
	END IF;

	-- ── crewless pig: still refused (solo/practice seeds are client-side) ──────
	PERFORM set_config('smoke.uid', stray::text, true);
	res := public.open_rooting();
	IF (res->>'ok')::boolean OR (res->>'reason') <> 'no_crew' THEN
		RAISE EXCEPTION 'crewless open should refuse no_crew: %', res;
	END IF;

	RAISE NOTICE 'seeded crew boards smoke: all assertions passed (win=%, crewA seed=%, crewB seed=%)',
		win, sa1, sb1;
END
$smoke$;

SELECT 'seeded boards: crew A shares one seed' AS chk,
	(SELECT count(DISTINCT seed) FROM public.war_rootings
	 WHERE crew_id = '00000000-0000-0000-0000-0000000dc001') AS distinct_seeds_in_crew_a;
