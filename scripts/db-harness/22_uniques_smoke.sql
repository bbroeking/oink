-- Functional smoke for the patch-uniques claim path (20260728000000):
-- open_rooting rolls + returns unique_id; submit_rooting accepts the 'unique'
-- token ONLY on a board that carries a relic (grants a user_uniques row,
-- new=true, found_count=1, and credits it toward the meter drain); a repeat
-- catch bumps found_count with new=false; the 'unique' token on a relic-less
-- board refuses bad_finds PRE-WRITE; and RLS keeps a pig's Burrow Book private.
--
-- Determinism note: the relic roll is random() < 0.4 (per-board), so instead of
-- fighting the PRNG we open boards for a POOL of fixture pigs (same window) and
-- pick the first that actually carries a relic — 24 pigs makes a miss astronomically
-- unlikely (0.6^24 ≈ 5e-6). The clock is pinned 1h into the current 8h block
-- (guaranteed OPEN phase), matching the coop-dig smoke's idiom.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke GUC (idempotent — 15_coop_dig installs the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Fixtures: one crew (Relichunters) of 24 diggers in a fresh de5x/dd30 namespace
-- so nothing collides with the a00x / b00x / de4x pigs earlier smokes assert on.
INSERT INTO public.profiles (id, username)
	SELECT ('00000000-0000-0000-0000-0000000' || to_char(3584 + g, 'FM00000'))::uuid,
	       'relic' || g
	FROM generate_series(0, 23) AS g;
INSERT INTO auth.users (id)
	SELECT ('00000000-0000-0000-0000-0000000' || to_char(3584 + g, 'FM00000'))::uuid
	FROM generate_series(0, 23) AS g;
INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000dd30', 'Relichunters',
	 '00000000-0000-0000-0000-000000003584');
INSERT INTO public.crew_members (crew_id, user_id, role)
	SELECT '00000000-0000-0000-0000-00000000dd30',
	       ('00000000-0000-0000-0000-0000000' || to_char(3584 + g, 'FM00000'))::uuid,
	       CASE WHEN g = 0 THEN 'leader' ELSE 'member' END
	FROM generate_series(0, 23) AS g;

DO $smoke5$
DECLARE
	relic_uid   uuid;    -- the pig whose board carries a relic
	plain_uid   uuid;    -- a pig whose board carries NO relic
	other_uid   uuid;    -- a third pig (RLS: must not see relic_uid's Book)
	the_relic   text;    -- the relic id on relic_uid's board
	g           int;
	pig         uuid;
	seed        int;
	res         jsonb;
	drain_before bigint;
	drain_after  bigint;
	book_count  int;
BEGIN
	-- Pin the clock 1h into the current 8h block → guaranteed OPEN phase.
	PERFORM set_config('ttp.fake_now',
		(to_timestamp(floor(extract(epoch FROM now()) / 28800) * 28800)
		 + interval '1 hour')::text, true);

	-- ── 1. open_rooting returns unique_id; find a relic board + a plain board ──
	FOR g IN 0..23 LOOP
		pig := ('00000000-0000-0000-0000-0000000' || to_char(3584 + g, 'FM00000'))::uuid;
		PERFORM set_config('smoke.uid', pig::text, true);
		res := public.open_rooting();
		IF NOT (res->>'ok')::boolean THEN
			RAISE EXCEPTION 'relic% open should succeed: %', g, res; END IF;
		-- The key MUST be present in the payload (null-valued on a plain board).
		IF NOT (res ? 'unique_id') THEN
			RAISE EXCEPTION 'open_rooting payload missing unique_id key: %', res; END IF;
		IF res->>'unique_id' IS NOT NULL THEN
			IF relic_uid IS NULL THEN
				relic_uid := pig; the_relic := res->>'unique_id';
			END IF;
		ELSIF plain_uid IS NULL THEN
			plain_uid := pig;
		ELSIF other_uid IS NULL THEN
			other_uid := pig;
		END IF;
	END LOOP;

	IF relic_uid IS NULL THEN
		RAISE EXCEPTION 'no board carried a relic across 24 opens (PRNG or roll broken)'; END IF;
	IF plain_uid IS NULL OR other_uid IS NULL THEN
		RAISE EXCEPTION 'need >=2 relic-less boards for the plain+RLS pigs (got plain=% other=%)',
			plain_uid, other_uid; END IF;
	-- The relic must be a real pool member (parity guard on roll_unique output).
	IF NOT EXISTS (SELECT 1 FROM public.unique_pool() WHERE unique_id = the_relic) THEN
		RAISE EXCEPTION 'rolled relic % is not in unique_pool()', the_relic; END IF;
	-- The row must actually store the relic (open_rooting persisted it).
	IF NOT EXISTS (SELECT 1 FROM public.war_rootings
		WHERE user_id = relic_uid AND unique_id = the_relic) THEN
		RAISE EXCEPTION 'war_rootings did not persist unique_id for the relic board'; END IF;

	-- ── 2. Claiming 'unique' on a relic-less board refuses bad_finds PRE-WRITE ─
	PERFORM set_config('smoke.uid', plain_uid::text, true);
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = plain_uid AND wr.submitted_at IS NULL;
	res := public.submit_rooting(public.rooting_finds(seed) || 'unique'::text, 4);
	IF (res->>'ok')::boolean OR (res->>'reason') <> 'bad_finds' THEN
		RAISE EXCEPTION 'unique on a relic-less board should refuse bad_finds: %', res; END IF;
	-- Pre-write guarantee: the refusal left the row unsubmitted (no side effects).
	IF EXISTS (SELECT 1 FROM public.war_rootings
		WHERE user_id = plain_uid AND submitted_at IS NOT NULL) THEN
		RAISE EXCEPTION 'bad_finds refusal must NOT stamp submitted_at (pre-write)'; END IF;
	IF EXISTS (SELECT 1 FROM public.user_uniques WHERE user_id = plain_uid) THEN
		RAISE EXCEPTION 'bad_finds refusal must NOT write a Book entry'; END IF;

	-- ── 3. Valid 'unique' claim on the relic board: grant + credit + new=true ──
	PERFORM set_config('smoke.uid', relic_uid::text, true);
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = relic_uid AND wr.submitted_at IS NULL;
	SELECT total INTO drain_before FROM public.hunger_drain WHERE id = true;
	-- Claim the two truffles + the relic (the seed-derived finds never include
	-- 'unique'; the relic is validated against the stored unique_id).
	res := public.submit_rooting(ARRAY['truffle_l', 'truffle_d', 'unique'], 4);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'valid unique claim should succeed: %', res; END IF;
	IF res->'unique_found' IS NULL OR res->'unique_found' = 'null'::jsonb THEN
		RAISE EXCEPTION 'unique_found payload missing on a valid claim: %', res; END IF;
	IF (res#>>'{unique_found,id}') <> the_relic THEN
		RAISE EXCEPTION 'unique_found.id mismatch: want % got %', the_relic, res; END IF;
	IF NOT (res#>>'{unique_found,new}')::boolean THEN
		RAISE EXCEPTION 'first catch should be new=true: %', res; END IF;
	IF (res#>>'{unique_found,found_count}')::int <> 1 THEN
		RAISE EXCEPTION 'first catch found_count should be 1: %', res; END IF;
	-- The relic counts as a credited find: 3 claimed (2 truffles + relic) → drain +3.
	SELECT total INTO drain_after FROM public.hunger_drain WHERE id = true;
	IF drain_after - drain_before <> 3 THEN
		RAISE EXCEPTION 'relic must count toward drain: want +3 got +%', drain_after - drain_before; END IF;
	IF (res->>'drain_total')::bigint <> drain_after THEN
		RAISE EXCEPTION 'returned drain_total disagrees with table: % vs %', res->>'drain_total', drain_after; END IF;
	-- The Book now holds exactly one row for this pig at found_count 1.
	SELECT found_count INTO book_count FROM public.user_uniques
		WHERE user_id = relic_uid AND unique_id = the_relic;
	IF book_count <> 1 THEN
		RAISE EXCEPTION 'Book found_count should be 1 after first catch, got %', book_count; END IF;

	-- ── 4. Dupe catch: a second board with the SAME relic bumps found_count ────
	-- Advance the clock to the NEXT 8h block (new window) so relic_uid can open a
	-- fresh board, and roll until that board carries the SAME relic again.
	<<dupe>>
	FOR g IN 1..500 LOOP
		PERFORM set_config('ttp.fake_now',
			(to_timestamp(floor(extract(epoch FROM now()) / 28800) * 28800)
			 + interval '1 hour' + (g * interval '8 hours'))::text, true);
		PERFORM set_config('smoke.uid', relic_uid::text, true);
		res := public.open_rooting();
		IF NOT (res->>'ok')::boolean THEN
			RAISE EXCEPTION 'dupe-window open should succeed: %', res; END IF;
		IF res->>'unique_id' = the_relic THEN
			SELECT wr.seed INTO seed FROM public.war_rootings wr
				WHERE wr.user_id = relic_uid AND wr.submitted_at IS NULL
				ORDER BY wr.window_index DESC LIMIT 1;
			res := public.submit_rooting(ARRAY['truffle_l', 'unique'], 4);
			IF NOT (res->>'ok')::boolean THEN
				RAISE EXCEPTION 'dupe unique claim should succeed: %', res; END IF;
			IF (res#>>'{unique_found,new}')::boolean THEN
				RAISE EXCEPTION 'dupe catch should be new=false: %', res; END IF;
			IF (res#>>'{unique_found,found_count}')::int <> 2 THEN
				RAISE EXCEPTION 'dupe catch found_count should be 2: %', res; END IF;
			EXIT dupe;
		END IF;
		IF g = 500 THEN
			RAISE EXCEPTION 'could not re-roll the same relic in 500 windows'; END IF;
	END LOOP;
	-- Still ONE Book row for this (pig, relic) — the dupe upserted, not duplicated.
	SELECT count(*) INTO book_count FROM public.user_uniques
		WHERE user_id = relic_uid AND unique_id = the_relic;
	IF book_count <> 1 THEN
		RAISE EXCEPTION 'dupe must upsert one row, found % rows', book_count; END IF;

	-- Stash the pigs for the RLS check (runs outside this superuser block).
	PERFORM set_config('smoke.relic_uid', relic_uid::text, false);
	PERFORM set_config('smoke.other_uid', other_uid::text, false);

	RAISE NOTICE 'uniques smoke: relic=% claimed by %, dupe bumped, plain refused', the_relic, relic_uid;
END
$smoke5$;

-- ── 5. RLS: a second pig cannot SELECT the first pig's Burrow Book ────────────
-- psql runs as the postgres superuser, which BYPASSES RLS — so switch into the
-- non-superuser `authenticated` role (the grant target) with row_security on.
SET row_security = on;
SET ROLE authenticated;
-- As the relic owner: sees exactly the one Book row.
SELECT set_config('smoke.uid', current_setting('smoke.relic_uid'), false);
SELECT 'chk uniques rls owner sees own' AS chk,
	(SELECT count(*) FROM public.user_uniques) = 1 AS pass;
-- As another pig: sees ZERO of the owner's rows.
SELECT set_config('smoke.uid', current_setting('smoke.other_uid'), false);
SELECT 'chk uniques rls other sees none' AS chk,
	(SELECT count(*) FROM public.user_uniques) = 0 AS pass;
RESET ROLE;
RESET row_security;

-- Hard-fail the harness if either RLS assertion is false (the SELECTs above are
-- for the run.sh chk grep; this DO makes a violation abort with ON_ERROR_STOP).
DO $rls$
DECLARE owner_seen int; other_seen int;
BEGIN
	SET LOCAL row_security = on;
	SET LOCAL ROLE authenticated;
	PERFORM set_config('smoke.uid', current_setting('smoke.relic_uid'), true);
	SELECT count(*) INTO owner_seen FROM public.user_uniques;
	PERFORM set_config('smoke.uid', current_setting('smoke.other_uid'), true);
	SELECT count(*) INTO other_seen FROM public.user_uniques;
	RESET ROLE;
	IF owner_seen <> 1 THEN RAISE EXCEPTION 'RLS: owner should see 1 Book row, saw %', owner_seen; END IF;
	IF other_seen <> 0 THEN RAISE EXCEPTION 'RLS: other pig leaked % Book rows', other_seen; END IF;
	RAISE NOTICE 'uniques RLS: owner sees 1, other sees 0';
END
$rls$;
