-- Prep for 20261029260000_great_hunger_ends_nov9.sql + A7_great_hunger_ends_smoke.
--
-- 1. A RECORDING pg_cron stub. 00_stub's cron.schedule / cron.unschedule
--    record nothing; the migration reads cron.job back (unschedule-if-exists,
--    then a scheduled-exactly-once check), so this stub behaves like prod:
--    schedule upserts by name, unschedule raises on an unknown name. Nothing
--    later in run.sh's chain calls cron.*.
-- 2. The harness clock. The migration's guards read _patch_now(), which is
--    now() on production (no ttp.fake_now there). Pinning it to 2026-10-29
--    keeps the "not in the past" guard and the send window green after the
--    real 2026-11-09; the smoke clears it at the end.
ALTER TABLE cron.job
	ADD COLUMN IF NOT EXISTS schedule text,
	ADD COLUMN IF NOT EXISTS command text;
CREATE SEQUENCE IF NOT EXISTS cron.jobid_seq;

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
	jid bigint;
BEGIN
	UPDATE cron.job j SET schedule = $2, command = $3
		WHERE j.jobname = $1 RETURNING j.jobid INTO jid;
	IF jid IS NULL THEN
		INSERT INTO cron.job (jobid, jobname, schedule, command)
			VALUES (nextval('cron.jobid_seq'), $1, $2, $3) RETURNING jobid INTO jid;
	END IF;
	RETURN jid;
END $$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
	DELETE FROM cron.job j WHERE j.jobname = $1;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'could not find valid entry for job ''%''', $1;
	END IF;
	RETURN true;
END $$;

SELECT set_config('ttp.fake_now', '2026-10-29 12:00:00+00', false);
