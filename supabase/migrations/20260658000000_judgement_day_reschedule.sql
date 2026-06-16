-- ⚠️ REVIEW BEFORE PUSHING — reschedules the DESTRUCTIVE Judgement Day job.
--
-- Moves Judgement Day from noon UTC Jul 15 (20260579) to 9:00 PM ET on Jul 11,
-- 2026 = 01:00 UTC Jul 12 → cron '0 1 12 7 *'. cron.schedule() upserts by job
-- name, so this updates the existing 'judgement-day-season-1' entry in place (no
-- unschedule needed). finalize_season('season_1') is unchanged + idempotent per
-- season_key. The client countdown (utils/season.ts SEASON_1_END) is moved to
-- match.
-- Verify after push:  SELECT jobname, schedule FROM cron.job WHERE jobname = 'judgement-day-season-1';

SELECT cron.schedule(
	'judgement-day-season-1',
	'0 1 12 7 *', -- 01:00 UTC Jul 12 == 9:00 PM ET Jul 11, 2026
	$$SELECT public.finalize_season('season_1')$$
);
