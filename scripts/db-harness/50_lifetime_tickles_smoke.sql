-- Lifetime-tickles smoke (20260737000000_lifetime_tickles.sql).
--
-- Asserts:
--   1. profiles.tickles_lifetime_base exists (bigint, NOT NULL, default 0).
--   2. Pre-graduation the base is 0 for the seeded players (archive is empty in
--      the harness, so the migration's one-time backfill is a clean no-op).
--   3. graduate_season0_probe() folds tickles_earned INTO the base BEFORE zeroing:
--      after it runs, base == the pre-zero tickles and tickles_earned == 0
--      (the add-to-base-then-zero pattern this migration establishes).
--   4. Displayed lifetime (base + live) is stable across the reset: it equals the
--      pre-graduation season total.
\set ON_ERROR_STOP on

-- 1. Column shape.
SELECT 'lifetime_base column' AS chk, count(*) AS n
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'tickles_lifetime_base'
  AND data_type = 'bigint' AND is_nullable = 'NO';

-- 2. Backfill is inert here (empty archive): everyone still at base 0 pre-grad.
SELECT 'base zero pre-grad' AS chk, count(*) AS n
FROM public.profiles
WHERE id IN ('00000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-0000000000c2',
             '00000000-0000-0000-0000-0000000000c3')
  AND tickles_lifetime_base = 0;

-- Capture pre-graduation season totals for the invariant check below.
CREATE TEMP TABLE _pre AS
	SELECT id, tickles_earned AS pre_season, tickles_lifetime_base AS pre_base
	FROM public.profiles
	WHERE id IN ('00000000-0000-0000-0000-0000000000c1',
	             '00000000-0000-0000-0000-0000000000c2',
	             '00000000-0000-0000-0000-0000000000c3');

-- 3. Run the graduation (add-to-base, then zero). Must return 'ok'.
SELECT 'probe ok' AS chk, public.graduate_season0_probe() AS result;

DO $$
DECLARE bad int;
BEGIN
	-- base now == the season total that was there before the zero.
	SELECT count(*) INTO bad
	FROM public.profiles p JOIN _pre x ON x.id = p.id
	WHERE p.tickles_lifetime_base <> x.pre_base + x.pre_season;
	IF bad <> 0 THEN
		RAISE EXCEPTION 'add-to-base failed for % player(s)', bad;
	END IF;

	-- live column zeroed.
	SELECT count(*) INTO bad FROM public.profiles p JOIN _pre x ON x.id = p.id
	WHERE p.tickles_earned <> 0;
	IF bad <> 0 THEN
		RAISE EXCEPTION 'zero failed for % player(s)', bad;
	END IF;

	-- displayed lifetime (base + live) unchanged by the reset.
	SELECT count(*) INTO bad
	FROM public.profiles p JOIN _pre x ON x.id = p.id
	WHERE (p.tickles_lifetime_base + p.tickles_earned) <> (x.pre_base + x.pre_season);
	IF bad <> 0 THEN
		RAISE EXCEPTION 'displayed lifetime drifted for % player(s)', bad;
	END IF;

	RAISE NOTICE 'lifetime: add-to-base + zero + invariant all hold';
END $$;

-- 4. Idempotency: the guard is now flipped, so a second probe run is a no-op and
--    must NOT double-count the base.
SELECT 'probe reruns inert' AS chk, public.graduate_season0_probe() AS result;

DO $$
DECLARE base_alpha bigint;
BEGIN
	SELECT tickles_lifetime_base INTO base_alpha FROM public.profiles
	WHERE id = '00000000-0000-0000-0000-0000000000c1';
	IF base_alpha <> 500 THEN
		RAISE EXCEPTION 'double-count: alpha base = % (expected 500)', base_alpha;
	END IF;
	RAISE NOTICE 'lifetime: guard blocks double-count (alpha base still 500)';
END $$;

-- Cleanup: later smokes (e.g. 15_coop_dig) do `INSERT INTO auth.users SELECT id
-- FROM profiles` with no ON CONFLICT — they assume every profile lacks an
-- auth.users row. Remove this smoke's seeded players so it doesn't collide.
DELETE FROM public.season0_tickle_standings
	WHERE user_id IN ('00000000-0000-0000-0000-0000000000c1',
	                  '00000000-0000-0000-0000-0000000000c2',
	                  '00000000-0000-0000-0000-0000000000c3');
DELETE FROM public.user_items
	WHERE user_id IN ('00000000-0000-0000-0000-0000000000c1',
	                  '00000000-0000-0000-0000-0000000000c2',
	                  '00000000-0000-0000-0000-0000000000c3');
DELETE FROM public.profiles
	WHERE id IN ('00000000-0000-0000-0000-0000000000c1',
	             '00000000-0000-0000-0000-0000000000c2',
	             '00000000-0000-0000-0000-0000000000c3');
DELETE FROM auth.users
	WHERE id IN ('00000000-0000-0000-0000-0000000000c1',
	             '00000000-0000-0000-0000-0000000000c2',
	             '00000000-0000-0000-0000-0000000000c3');
