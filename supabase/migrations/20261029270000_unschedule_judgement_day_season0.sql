-- Retire the stale Season 0 Judgement Day cron job (founder ask, 2026-10-29).
--
-- `judgement-day-season-0` ('0 0 12 7 *', SELECT public.run_judgement_day_season0())
-- was scheduled for Season 0's finale in July 2026 (20260709000000, re-timed by
-- 20260726000000) and never unscheduled. cron.job_run_details shows it never ran,
-- and as a yearly schedule it would fire on 2027-07-12 and re-run a finished
-- season's Judgement Day. Season 0 is over (Season 1 since 2026-07-12; Season 2
-- flips 2026-11-09). Idempotent: a no-op when the job is already gone.
-- run_judgement_day_season0() itself is left in place (history; no caller).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'judgement-day-season-0';
