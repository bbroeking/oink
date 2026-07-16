-- Release-day flip rehearsal (runs FIRST among the smokes, right after the
-- chain applies). 20260744100000 deliberately seeds the LEGACY anchor
-- (offset 0) so pushing the migration changes nothing for shipped clients;
-- the founder's 6-10/2-6/10-2 ET shift is a one-row UPDATE timed to 1.3's
-- release day. This smoke (1) proves the pristine seed IS the legacy anchor,
-- then (2) performs that exact release-day UPDATE, so every window smoke
-- downstream (15/16/17/22, pinned to the 02/10/18 UTC anchor) runs against
-- the post-flip world — the chain rehearses the real cutover, not a fantasy.
\set ON_ERROR_STOP on

DO $smoke10$
BEGIN
	-- ── 1. Pristine seed = legacy anchor (offset 0) ───────────────────────────
	IF public._feeding_sched() <> ARRAY[28800, 14400, 0] THEN
		RAISE EXCEPTION 'pristine feeding_schedule seed wrong (want legacy offset 0): %',
			public._feeding_sched();
	END IF;

	-- ── 2. The release-day flip — the literal statement prod will run ─────────
	UPDATE public.app_settings
		SET value = jsonb_set(value, '{offset_secs}', to_jsonb(7200))
		WHERE key = 'feeding_schedule';

	IF public._feeding_sched() <> ARRAY[28800, 14400, 7200] THEN
		RAISE EXCEPTION 'release-day flip did not take: %', public._feeding_sched();
	END IF;

	RAISE NOTICE 'feeding flip smoke: legacy seed verified + release-day UPDATE applied OK';
END
$smoke10$;
