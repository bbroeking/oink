-- Smoke: 20260749000000_dig_share_count — the wedge-5b share-rate counter.
--
-- Applied by run.sh (pass the migration as an extra arg). Auto-globbed by the
-- [1234]*_smoke.sql pattern. The migration is standalone (new table + new
-- function only), so no prep is needed beyond the stub.
--
-- Covers:
--   • first bump INSERTs today's row at taps = 1
--   • a second bump UPSERTs the SAME day to taps = 2 (no duplicate row)
--   • the tally is a single global counter (no user scoping)
BEGIN;

-- ═══ 1. First tap inserts today's row ════════════════════════════════════════
DO $$ DECLARE n bigint; rows int;
BEGIN
	PERFORM public.bump_dig_share_count();
	SELECT count(*) INTO rows FROM public.dig_share_taps;
	IF rows <> 1 THEN RAISE EXCEPTION 'expected 1 tally row after first bump, saw %', rows; END IF;
	SELECT taps INTO n FROM public.dig_share_taps
		WHERE day = (now() AT TIME ZONE 'utc')::date;
	IF n <> 1 THEN RAISE EXCEPTION 'expected taps = 1 after first bump, saw %', n; END IF;
END $$;

-- ═══ 2. Second tap upserts the same day (taps = 2, still one row) ═════════════
DO $$ DECLARE n bigint; rows int;
BEGIN
	PERFORM public.bump_dig_share_count();
	SELECT count(*) INTO rows FROM public.dig_share_taps;
	IF rows <> 1 THEN RAISE EXCEPTION 'a second bump must not add a row, saw %', rows; END IF;
	SELECT taps INTO n FROM public.dig_share_taps
		WHERE day = (now() AT TIME ZONE 'utc')::date;
	IF n <> 2 THEN RAISE EXCEPTION 'expected taps = 2 after second bump, saw %', n; END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk dig_share_count smoke OK'; END $$;

ROLLBACK;
