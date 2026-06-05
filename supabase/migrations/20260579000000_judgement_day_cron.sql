-- ⚠️ REVIEW BEFORE PUSHING — schedules a DESTRUCTIVE job.
--
-- Automates Judgement Day: runs finalize_season('season_1') at noon UTC on
-- 2026-07-15 (SEASON_1_END). finalize_season ranks everyone, grants the finale
-- titles + snouts, and WIPES every alignment_score to 0 for Season 2. It is
-- idempotent per season_key, so a re-fire (e.g. the same cron next year) is a
-- safe no-op.
--
-- pg_cron is ALREADY installed on this project (verified pg_extension), so we
-- do NOT re-run CREATE EXTENSION here: Supabase fires a custom after-create
-- hook on every `CREATE EXTENSION pg_cron` (even IF NOT EXISTS) that does a
-- `revoke ... from postgres`, which errors 2BP01 ("dependent privileges
-- exist") given the existing grant-option state. Scheduling alone is enough.
-- To cancel later:        SELECT cron.unschedule('judgement-day-season-1');
-- To verify scheduling:   SELECT * FROM cron.job;
-- To see run history:     SELECT * FROM cron.job_run_details ORDER BY start_time DESC;

-- '0 12 15 7 *' = 12:00 UTC, July 15, every year (idempotent → safe to repeat).
SELECT cron.schedule(
	'judgement-day-season-1',
	'0 12 15 7 *',
	$$SELECT public.finalize_season('season_1')$$
);
