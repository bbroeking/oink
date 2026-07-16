-- Feeding-schedule config smoke (20260744100000): runs AFTER 10_feeding_flip
-- rehearsed the release-day UPDATE, so the row here is the FLIPPED (7200)
-- schedule. Verifies it reads through app_setting(); _feeding_sched() folds it into
-- the int[3] every window function reads; and a plain row UPDATE moves
-- patch_phase_open with NO function change — the founder's "one UPDATE shifts
-- the schedule" contract. Runs LAST in the smoke order; restores the seeded
-- values before finishing.
\set ON_ERROR_STOP on

DO $smoke43$
DECLARE
	v jsonb;
	s int[];
BEGIN
	-- ── 1. The (flipped) row reads back through the RPC ──────────────────────
	v := public.app_setting('feeding_schedule');
	IF v IS NULL
	   OR (v->>'window_secs')::int <> 28800
	   OR (v->>'open_secs')::int <> 14400
	   OR (v->>'offset_secs')::int <> 7200 THEN
		RAISE EXCEPTION 'feeding_schedule config row wrong: %', v;
	END IF;
	-- An unknown key reads null (the client treats that as "keep defaults").
	IF public.app_setting('no_such_setting') IS NOT NULL THEN
		RAISE EXCEPTION 'app_setting should be null for an unknown key';
	END IF;

	-- ── 2. _feeding_sched folds the row into the window functions' int[3] ────
	s := public._feeding_sched();
	IF s <> ARRAY[28800, 14400, 7200] THEN
		RAISE EXCEPTION '_feeding_sched wrong: %', s;
	END IF;

	-- ── 3. One-UPDATE shift: move the offset +1h; the phase gate follows ──────
	-- With offset 10800 (03:00 anchor), 02:30 UTC falls in the PREVIOUS window's
	-- guarded tail and 03:00 UTC is minute zero of an open phase.
	UPDATE public.app_settings
		SET value = jsonb_set(value, '{offset_secs}', to_jsonb(10800))
		WHERE key = 'feeding_schedule';
	IF public.patch_phase_open('2026-07-08 02:30:00+00') IS NOT FALSE
	   OR public.patch_phase_open('2026-07-08 03:00:00+00') IS NOT TRUE THEN
		RAISE EXCEPTION 'patch_phase_open did not follow the config UPDATE';
	END IF;

	-- ── 4. Restore the seed so nothing downstream sees the probe values ──────
	UPDATE public.app_settings
		SET value = jsonb_set(value, '{offset_secs}', to_jsonb(7200))
		WHERE key = 'feeding_schedule';
	IF public._feeding_sched() <> ARRAY[28800, 14400, 7200] THEN
		RAISE EXCEPTION 'feeding_schedule restore failed';
	END IF;

	RAISE NOTICE 'feeding schedule config smoke: seeded row + one-UPDATE shift OK';
END
$smoke43$;
