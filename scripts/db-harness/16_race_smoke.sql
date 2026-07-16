-- Functional smoke for the global dig race (20260719 + the 20260720 weekly/
-- season-board delta): Monday-weekly cycle math, race_digs attribution +
-- instant drain on submit, standings shape (ranked/unranked quorum split,
-- dense tie ranks, bot excluded, mine/last, season/mine_season cumulative
-- board), payout idempotence, the RACE_TRUFFLE_TABLE amounts, podium queue
-- pop → random-unowned fallback → owns-everything fallback, race_start/
-- race_end pushes (push_outbox stub), and the retired 1-v-1 surface being gone.
-- Runs after 15 (auth.uid() reads the smoke.uid GUC; NOTE: rosie/denny's crew
-- c001 has 2 real submitted digs this cycle, so it appears RANKED in the
-- current standings — current-cycle asserts are written to tolerate it).
\set ON_ERROR_STOP on

-- ── Fixtures (disjoint de/dd namespace; e3 = the ranked-crew non-digger) ─────
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000de01', 'la'),  ('00000000-0000-0000-0000-00000000de02', 'ma'),
	('00000000-0000-0000-0000-00000000de03', 'lb'),  ('00000000-0000-0000-0000-00000000de04', 'lc'),
	('00000000-0000-0000-0000-00000000de05', 'mc'),
	('00000000-0000-0000-0000-00000000de10', 'e1'),  ('00000000-0000-0000-0000-00000000de11', 'e2'),
	('00000000-0000-0000-0000-00000000de12', 'f1'),  ('00000000-0000-0000-0000-00000000de13', 'f2'),
	('00000000-0000-0000-0000-00000000de14', 'g1'),  ('00000000-0000-0000-0000-00000000de15', 'g2'),
	('00000000-0000-0000-0000-00000000de16', 'h1'),  ('00000000-0000-0000-0000-00000000de17', 'h2'),
	('00000000-0000-0000-0000-00000000de18', 'i1'),  ('00000000-0000-0000-0000-00000000de19', 'i2'),
	('00000000-0000-0000-0000-00000000de20', 'j1'),  ('00000000-0000-0000-0000-00000000de30', 'jx'),
	('00000000-0000-0000-0000-00000000de32', 'e3');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000de%';

INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000dd01', 'CrewA', '00000000-0000-0000-0000-00000000de01'),
	('00000000-0000-0000-0000-00000000dd02', 'CrewB', '00000000-0000-0000-0000-00000000de03'),
	('00000000-0000-0000-0000-00000000dd03', 'CrewC', '00000000-0000-0000-0000-00000000de04'),
	('00000000-0000-0000-0000-00000000dd05', 'CrewE', '00000000-0000-0000-0000-00000000de10'),
	('00000000-0000-0000-0000-00000000dd06', 'CrewF', '00000000-0000-0000-0000-00000000de12'),
	('00000000-0000-0000-0000-00000000dd07', 'CrewG', '00000000-0000-0000-0000-00000000de14'),
	('00000000-0000-0000-0000-00000000dd08', 'CrewH', '00000000-0000-0000-0000-00000000de16'),
	('00000000-0000-0000-0000-00000000dd09', 'CrewI', '00000000-0000-0000-0000-00000000de18'),
	('00000000-0000-0000-0000-00000000dd10', 'CrewJ', '00000000-0000-0000-0000-00000000de20');

INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000de01', 'leader'),
	('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000de02', 'member'),
	('00000000-0000-0000-0000-00000000dd02', '00000000-0000-0000-0000-00000000de03', 'leader'),
	('00000000-0000-0000-0000-00000000dd03', '00000000-0000-0000-0000-00000000de04', 'leader'),
	('00000000-0000-0000-0000-00000000dd03', '00000000-0000-0000-0000-00000000de05', 'member'),
	('00000000-0000-0000-0000-00000000dd05', '00000000-0000-0000-0000-00000000de10', 'leader'),
	('00000000-0000-0000-0000-00000000dd05', '00000000-0000-0000-0000-00000000de11', 'member'),
	('00000000-0000-0000-0000-00000000dd05', '00000000-0000-0000-0000-00000000de32', 'member'),
	('00000000-0000-0000-0000-00000000dd06', '00000000-0000-0000-0000-00000000de12', 'leader'),
	('00000000-0000-0000-0000-00000000dd06', '00000000-0000-0000-0000-00000000de13', 'member'),
	('00000000-0000-0000-0000-00000000dd07', '00000000-0000-0000-0000-00000000de14', 'leader'),
	('00000000-0000-0000-0000-00000000dd07', '00000000-0000-0000-0000-00000000de15', 'member'),
	('00000000-0000-0000-0000-00000000dd08', '00000000-0000-0000-0000-00000000de16', 'leader'),
	('00000000-0000-0000-0000-00000000dd08', '00000000-0000-0000-0000-00000000de17', 'member'),
	('00000000-0000-0000-0000-00000000dd09', '00000000-0000-0000-0000-00000000de18', 'leader'),
	('00000000-0000-0000-0000-00000000dd09', '00000000-0000-0000-0000-00000000de19', 'member'),
	('00000000-0000-0000-0000-00000000dd10', '00000000-0000-0000-0000-00000000de20', 'leader');

DO $smoke3$
DECLARE
	la  uuid := '00000000-0000-0000-0000-00000000de01'; ma uuid := '00000000-0000-0000-0000-00000000de02';
	lc  uuid := '00000000-0000-0000-0000-00000000de04'; mc uuid := '00000000-0000-0000-0000-00000000de05';
	e1  uuid := '00000000-0000-0000-0000-00000000de10'; e2 uuid := '00000000-0000-0000-0000-00000000de11';
	e3  uuid := '00000000-0000-0000-0000-00000000de32'; j1 uuid := '00000000-0000-0000-0000-00000000de20';
	jx  uuid := '00000000-0000-0000-0000-00000000de30';
	aa  uuid := '00000000-0000-0000-0000-00000000dd01';
	ee  uuid := '00000000-0000-0000-0000-00000000dd05'; ff uuid := '00000000-0000-0000-0000-00000000dd06';
	gg  uuid := '00000000-0000-0000-0000-00000000dd07'; hh uuid := '00000000-0000-0000-0000-00000000dd08';
	bot uuid := '00000000-0000-0000-0000-0000000000b0';
	cyc record; prev record; prev2 record; cm record;
	res jsonb; st jsonb; seed int;
	before_drain bigint; after_drain bigint;
	n1 int; n2 int; p1 int; p2 int;
BEGIN
	-- Pin the clock (20260721 patch phase) to 1h into the CURRENT real 8h
	-- block so la's open/submit in §3 always lands in the OPEN phase and in
	-- the same window/cycle as the unpinned reads (race_current_cycle → now()).
	PERFORM set_config('ttp.fake_now',
		(to_timestamp(floor((extract(epoch FROM now()) - 7200) / 28800) * 28800 + 7200)
		 + interval '1 hour')::text, true);

	-- ── 1. Cycle math: weekly, Monday 00:00 UTC anchored, always 7 days ──────
	-- (20260720 — the Mon/Thu alternation is gone.) 2026-07-06 is a Monday.
	SELECT * INTO cyc FROM public.race_cycle_at('2026-07-07 12:00+00');
	IF cyc.cycle_key <> '20260706' OR cyc.starts_at <> '2026-07-06 00:00+00'::timestamptz
	   OR cyc.ends_at <> '2026-07-13 00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'Tue noon should sit in the Mon 7-day cycle: %', to_jsonb(cyc); END IF;
	SELECT * INTO cyc FROM public.race_cycle_at('2026-07-09 00:00+00');
	IF cyc.cycle_key <> '20260706' THEN
		RAISE EXCEPTION 'Thursday is no longer a boundary — Mon cycle expected: %', to_jsonb(cyc); END IF;
	SELECT * INTO cyc FROM public.race_cycle_at('2026-07-12 23:59+00');
	IF cyc.cycle_key <> '20260706' THEN
		RAISE EXCEPTION 'late Sunday should still be in the Monday cycle: %', to_jsonb(cyc); END IF;
	SELECT * INTO cyc FROM public.race_cycle_at('2026-07-05 10:00+00');
	IF cyc.cycle_key <> '20260629' OR cyc.ends_at <> '2026-07-06 00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'Sunday should sit in the PRECEDING Monday cycle: %', to_jsonb(cyc); END IF;
	SELECT * INTO cyc FROM public.race_cycle_at('2026-07-06 00:00+00');
	IF cyc.cycle_key <> '20260706' OR cyc.ends_at - cyc.starts_at <> interval '7 days' THEN
		RAISE EXCEPTION 'Mon 00:00 boundary starts a fresh 7-day cycle: %', to_jsonb(cyc); END IF;

	-- ── 2. The retired 1-v-1 surface is gone; history tables stay dormant ────
	IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
	           WHERE n.nspname = 'public' AND p.proname IN
	             ('find_rival','cancel_rival_search','challenge_crew_digoff','accept_digoff',
	              'digoff_state','sweep_digoffs','_digoff_resolve_one','_digoff_resolve_due',
	              '_digoff_queue_bot_fill','_digoff_push_active','_digoff_crew_busy',
	              '_digoff_side_stats')) THEN
		RAISE EXCEPTION '1-v-1 dig-off functions should be dropped'; END IF;
	IF to_regclass('public.digoff_queue') IS NOT NULL THEN
		RAISE EXCEPTION 'digoff_queue should be dropped'; END IF;
	IF to_regclass('public.dig_offs') IS NULL OR to_regclass('public.dig_off_digs') IS NULL THEN
		RAISE EXCEPTION 'dig_offs history tables must stay (dormant)'; END IF;

	-- ── 3. Attribution + instant drain: a real dig writes race_digs AND moves
	--     hunger_drain immediately (no banking branch, no banked key) ─────────
	SELECT * INTO cyc FROM public.race_current_cycle();
	SELECT total INTO before_drain FROM public.hunger_drain WHERE id = true;
	PERFORM set_config('smoke.uid', la::text, true);
	PERFORM public.open_rooting();
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = la AND wr.submitted_at IS NULL;
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	SELECT total INTO after_drain FROM public.hunger_drain WHERE id = true;
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'la submit failed: %', res; END IF;
	IF res ? 'banked' OR res ? 'digoff_id' THEN
		RAISE EXCEPTION 'banking fields should be gone from the payload: %', res; END IF;
	IF after_drain - before_drain <> jsonb_array_length(res->'credited') THEN
		RAISE EXCEPTION 'drain should move instantly by credited finds: % -> %', before_drain, after_drain; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.race_digs
	               WHERE cycle_key = cyc.cycle_key AND user_id = la AND crew_id = aa
	                 AND finds = jsonb_array_length(res->'credited')) THEN
		RAISE EXCEPTION 'race_digs attribution row missing for la'; END IF;

	-- ── 4. Standings: quorum split, dense ties, bot exclusion, mine ──────────
	-- Current-cycle seeds: E avg 10.0 (rank 1), F & H tie at 6.0 (both rank 2,
	-- dense), G 1 digger (unranked). A row attributed to the bot crew must
	-- vanish. (c001 from smoke 15 is also ranked at ~3-4 avg — tolerated.)
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds) VALUES
		(cyc.cycle_key, e1, 900, ee, 12), (cyc.cycle_key, e2, 900, ee, 8),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000de12', 900, ff, 8),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000de13', 900, ff, 4),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000de16', 900, hh, 6),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000de17', 900, hh, 6),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000de14', 900, gg, 5),
		(cyc.cycle_key, jx, 900, bot, 9);
	PERFORM set_config('smoke.uid', e1::text, true);
	st := public.race_standings();
	IF (st->'cycle'->>'key') <> cyc.cycle_key THEN
		RAISE EXCEPTION 'standings cycle key wrong: %', st->'cycle'; END IF;
	IF (st->'ranked'->0->>'name') <> 'CrewE' OR (st->'ranked'->0->>'rank')::int <> 1
	   OR (st->'ranked'->0->>'avg')::numeric <> 10.0 THEN
		RAISE EXCEPTION 'CrewE should lead ranked at avg 10.0: %', st->'ranked'->0; END IF;
	IF (SELECT count(*) FROM jsonb_array_elements(st->'ranked') r
	    WHERE (r->>'rank')::int = 2 AND r->>'name' IN ('CrewF','CrewH')) <> 2 THEN
		RAISE EXCEPTION 'CrewF+CrewH should share dense rank 2: %', st->'ranked'; END IF;
	IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(st->'unranked') u
	               WHERE u->>'name' = 'CrewG' AND (u->>'diggers')::int = 1) THEN
		RAISE EXCEPTION 'CrewG (1 digger) should be listed unranked: %', st->'unranked'; END IF;
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(st->'ranked' || st->'unranked') x
	           WHERE (x->>'crew_id')::uuid = bot) THEN
		RAISE EXCEPTION 'bot crew must be excluded from standings'; END IF;
	IF (st->'mine'->>'rank')::int <> 1 OR (st->'mine'->>'diggers')::int <> 2 THEN
		RAISE EXCEPTION 'mine (e1, CrewE) should be rank 1 with 2 diggers: %', st->'mine'; END IF;
	IF st->'last' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'last should be null before any payout: %', st->'last'; END IF;

	-- ── 5. Payout: seed the PREVIOUS cycle with 7 ranked crews + 1 sub-quorum ─
	-- Avgs: A 10.0 > C 8.0 = E 8.0 > F 6.0 > G 5.0 > H 4.0 > I 3.0; J 1 digger.
	-- Dense ranks: A1 C2 E2 F3 G4 H5 I6; ranked_n = 7, ceil(7/2) = 4.
	-- RACE_TRUFFLE_TABLE: A→6, C/E→5, F→4, G→3 (rank 4), H/I→2.
	-- Podium (rank ≤ 3) = A, C, E, F. Queue holds TWO founder hats → la, ma pop
	-- them (crew order rank/name, member order user_id); lc/mc/e1/f1/f2 fall to
	-- random-unowned catalog; e2 pre-owns the whole catalog → +2 truffles.
	-- Two ended weeks: prev (the full 7-crew table) and prev2 (J's lone digger,
	-- +11 finds) so the SEASON board accumulates across weeks and the sweep
	-- pays BOTH in one pass (prev2 has zero ranked crews — payout row only).
	SELECT * INTO prev  FROM public.race_cycle_at(cyc.starts_at  - interval '1 second');
	SELECT * INTO prev2 FROM public.race_cycle_at(prev.starts_at - interval '1 second');
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds) VALUES
		(prev2.cycle_key, j1, 700, '00000000-0000-0000-0000-00000000dd10', 11),
		(prev.cycle_key, la, 800, aa, 12), (prev.cycle_key, ma, 800, aa, 8),
		(prev.cycle_key, lc, 800, '00000000-0000-0000-0000-00000000dd03', 8),
		(prev.cycle_key, mc, 800, '00000000-0000-0000-0000-00000000dd03', 8),
		(prev.cycle_key, e1, 800, ee, 10), (prev.cycle_key, e2, 800, ee, 6),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de12', 800, ff, 6),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de13', 800, ff, 6),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de14', 800, gg, 5),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de15', 800, gg, 5),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de16', 800, hh, 4),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de17', 800, hh, 4),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de18', 800, '00000000-0000-0000-0000-00000000dd09', 3),
		(prev.cycle_key, '00000000-0000-0000-0000-00000000de19', 800, '00000000-0000-0000-0000-00000000dd09', 3),
		(prev.cycle_key, j1, 800, '00000000-0000-0000-0000-00000000dd10', 9);
	INSERT INTO public.race_podium_queue (hat_id, note) VALUES
		('founder_hat_1', 'first pop'), ('founder_hat_2', 'second pop');
	INSERT INTO public.user_hats (user_id, hat_id)
		SELECT e2, h.id FROM public.hats h WHERE h.war_exclusive = true;   -- owns everything

	res := public.sweep_race();
	IF NOT (res->>'ok')::boolean OR (res->>'paid')::int <> 2 THEN
		RAISE EXCEPTION 'first sweep should pay BOTH ended cycles: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.cycle_payouts WHERE cycle_key = prev.cycle_key
	               AND (detail->>'ranked_count')::int = 7) THEN
		RAISE EXCEPTION 'cycle_payouts detail should record ranked_count 7'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.cycle_payouts WHERE cycle_key = prev2.cycle_key
	               AND (detail->>'ranked_count')::int = 0) THEN
		RAISE EXCEPTION 'prev2 (sub-quorum only) should be marked paid with 0 ranked'; END IF;

	-- 5a. Truffle table amounts (reason race_rank), diggers only.
	FOR cm IN SELECT * FROM (VALUES
		(la, 6), (ma, 6), (lc, 5), (mc, 5), (e1, 5), (e2, 7),
		('00000000-0000-0000-0000-00000000de12'::uuid, 4),
		('00000000-0000-0000-0000-00000000de13'::uuid, 4),
		('00000000-0000-0000-0000-00000000de14'::uuid, 3),
		('00000000-0000-0000-0000-00000000de15'::uuid, 3),
		('00000000-0000-0000-0000-00000000de16'::uuid, 2),
		('00000000-0000-0000-0000-00000000de17'::uuid, 2),
		('00000000-0000-0000-0000-00000000de18'::uuid, 2),
		('00000000-0000-0000-0000-00000000de19'::uuid, 2),
		(e3, 0), (j1, 0)) AS v(uid, want)
	LOOP
		IF (SELECT COALESCE(sum(amount), 0) FROM public.war_truffles
		    WHERE user_id = cm.uid AND reason = 'race_rank') <> cm.want THEN
			RAISE EXCEPTION 'race_rank truffles for % want % got %', cm.uid, cm.want,
				(SELECT COALESCE(sum(amount), 0) FROM public.war_truffles
				 WHERE user_id = cm.uid AND reason = 'race_rank');
		END IF;
	END LOOP;

	-- 5b. Podium cosmetics: queue popped by la+ma; the rest pull unowned
	-- catalog items; e2 (owns everything) gets nothing new.
	IF (SELECT count(*) FROM public.race_podium_queue) <> 0 THEN
		RAISE EXCEPTION 'podium queue should be fully consumed'; END IF;
	IF (SELECT count(*) FROM public.user_hats
	    WHERE user_id IN (la, ma) AND hat_id IN ('founder_hat_1', 'founder_hat_2')) <> 2 THEN
		RAISE EXCEPTION 'la+ma should hold the two founder queue hats'; END IF;
	FOR cm IN SELECT unnest(ARRAY[lc, mc, e1,
		'00000000-0000-0000-0000-00000000de12'::uuid,
		'00000000-0000-0000-0000-00000000de13'::uuid]) AS uid
	LOOP
		IF NOT EXISTS (SELECT 1 FROM public.user_hats uh JOIN public.hats h ON h.id = uh.hat_id
		               WHERE uh.user_id = cm.uid AND h.war_exclusive = true) THEN
			RAISE EXCEPTION 'podium member % should have pulled a catalog hat', cm.uid; END IF;
	END LOOP;
	IF (SELECT count(*) FROM public.user_hats WHERE user_id = e2) <> 3 THEN
		RAISE EXCEPTION 'e2 owns the whole catalog — no new hat, +2 truffles instead'; END IF;

	-- 5c. Pushes: race_start once to every crewed pig; race_end to ranked-crew
	-- members only (e3 included, j1 excluded — no shame for sub-quorum).
	IF (SELECT count(*) FROM public.push_outbox WHERE data->>'kind' = 'race_start'
	    AND user_id = la AND body = 'Every Sounder digs — spoils on Monday.') <> 1 THEN
		RAISE EXCEPTION 'la should get exactly one weekly race_start push'; END IF;
	IF EXISTS (SELECT 1 FROM public.push_outbox WHERE data->>'kind' = 'race_start' AND user_id = jx) THEN
		RAISE EXCEPTION 'crewless jx should get no race_start push'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE data->>'kind' = 'race_end'
	               AND user_id = la AND body = 'CrewA placed 1 of 7 — your spoils are in.') THEN
		RAISE EXCEPTION 'la should get the rank-1 race_end push'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE data->>'kind' = 'race_end' AND user_id = e3) THEN
		RAISE EXCEPTION 'e3 (ranked crew, no digs) still gets the end push'; END IF;
	IF EXISTS (SELECT 1 FROM public.push_outbox WHERE data->>'kind' = 'race_end' AND user_id = j1) THEN
		RAISE EXCEPTION 'sub-quorum j1 must get no end push'; END IF;
	IF EXISTS (SELECT 1 FROM public.push_outbox
	           WHERE data->>'kind' IN ('race_start','race_end') AND data->>'screen' <> 'season') THEN
		RAISE EXCEPTION 'race pushes must deep-link to season'; END IF;

	-- 5d. Idempotence: a second sweep pays nothing and re-pushes nothing.
	SELECT count(*) INTO n1 FROM public.war_truffles WHERE reason = 'race_rank';
	SELECT count(*) INTO p1 FROM public.push_outbox
		WHERE data->>'kind' IN ('race_start','race_end');
	res := public.sweep_race();
	IF (res->>'paid')::int <> 0 OR (res->>'started')::boolean THEN
		RAISE EXCEPTION 'second sweep should be a no-op: %', res; END IF;
	SELECT count(*) INTO n2 FROM public.war_truffles WHERE reason = 'race_rank';
	SELECT count(*) INTO p2 FROM public.push_outbox
		WHERE data->>'kind' IN ('race_start','race_end');
	IF n1 <> n2 OR p1 <> p2 THEN
		RAISE EXCEPTION 'double sweep double-paid (truffles % -> %, pushes % -> %)', n1, n2, p1, p2; END IF;
	IF (SELECT count(*) FROM public.cycle_payouts) <> 2 THEN
		RAISE EXCEPTION 'exactly two cycle_payouts rows expected'; END IF;

	-- 5e. standings.last now carries the caller's previous-cycle payout.
	PERFORM set_config('smoke.uid', la::text, true);
	st := public.race_standings();
	IF (st->'last'->>'cycle_key') <> prev.cycle_key
	   OR (st->'last'->>'rank')::int <> 1 OR (st->'last'->>'of')::int <> 7
	   OR (st->'last'->>'truffles_paid')::int <> 6
	   OR (st->'last'->>'cosmetic_hat_id') <> 'founder_hat_1' THEN
		RAISE EXCEPTION 'la''s last payload wrong: %', st->'last'; END IF;

	-- ── 6. Season-cumulative board (20260720): totals SUM across weeks, dense
	--     rank by total, NO quorum, bot excluded, mine_season ─────────────────
	-- CrewE = 16 (prev) + 20 (current) = 36, the season leader. CrewJ = 9
	-- (prev) + 11 (prev2) = 20 with a single digger — unranked weekly, but
	-- RANKED on the season board.
	IF (st->'season'->0->>'name') <> 'CrewE' OR (st->'season'->0->>'rank')::int <> 1
	   OR (st->'season'->0->>'total_finds')::int <> 36 THEN
		RAISE EXCEPTION 'CrewE should lead the season board at 36: %', st->'season'->0; END IF;
	IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(st->'season') s
	               WHERE s->>'name' = 'CrewJ' AND (s->>'total_finds')::int = 20
	                 AND (s->>'diggers')::int = 1 AND (s->>'rank') IS NOT NULL) THEN
		RAISE EXCEPTION 'CrewJ (1 digger, two weeks) should rank on the season board: %', st->'season'; END IF;
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(st->'season') s
	           WHERE (s->>'crew_id')::uuid = bot) THEN
		RAISE EXCEPTION 'bot crew must be excluded from the season board'; END IF;
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(st->'season') s, jsonb_array_elements(st->'season') s2
	           WHERE (s->>'rank')::int < (s2->>'rank')::int
	             AND (s->>'total_finds')::int < (s2->>'total_finds')::int) THEN
		RAISE EXCEPTION 'season ranks must be ordered by total_finds DESC'; END IF;
	-- mine_season as e1 (CrewE): rank 1, total 36; weekly keys are unchanged.
	PERFORM set_config('smoke.uid', e1::text, true);
	st := public.race_standings();
	IF (st->'mine_season'->>'rank')::int <> 1 OR (st->'mine_season'->>'total_finds')::int <> 36 THEN
		RAISE EXCEPTION 'e1 mine_season should be rank 1 / 36: %', st->'mine_season'; END IF;
	IF NOT (st ? 'cycle' AND st ? 'ranked' AND st ? 'unranked' AND st ? 'mine' AND st ? 'last') THEN
		RAISE EXCEPTION 'weekly standings keys must be untouched: %', st; END IF;
	IF (st->'mine'->>'rank')::int <> 1 THEN
		RAISE EXCEPTION 'weekly mine (e1) should still be rank 1: %', st->'mine'; END IF;

	RAISE NOTICE 'race smoke: all assertions passed';
END
$smoke3$;

SELECT 'race current standings (ranked crews)' AS chk,
	jsonb_array_length(public.race_standings()->'ranked') AS ranked;
SELECT 'race payouts' AS chk, cycle_key, detail->>'ranked_count' AS ranked_count
	FROM public.cycle_payouts ORDER BY cycle_key;
