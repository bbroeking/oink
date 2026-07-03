-- ⚠️ Reschedules the DESTRUCTIVE Judgement Day job AND couples the beta-reward
--    grant + the season1_finale reveal to it. Explicit go given 2026-07-03.
--
-- 1) Judgement Day moves from 01:00 UTC Jul 12 (= 9:00 PM ET Jul 11; 20260658)
--    to 8:00 PM ET Jul 12, 2026 = 00:00 UTC Jul 13 → cron '0 0 13 7 *'.
--    cron.schedule() upserts by job name, so 'judgement-day-season-1' is
--    updated in place (no unschedule needed). The client countdown
--    (utils/season.ts SEASON_1_END) moves to '2026-07-12' in the same commit.
-- 2) The job now runs run_judgement_day_season1(), which:
--      a. finalize_season('season_1')  — unchanged, idempotent per season_key
--      b. grant_beta_rewards()         — idempotent (20260704400000); writes the
--         per-user inline system_announcements = the "you earned this" inbox
--         notification for every qualifying beta player
--      c. flips app_config.'season1_finale' → TRUE — the single reveal switch
--         for the SeasonEndModal storybook recap on Season-2-era clients
--    Steps a/b are exception-guarded independently so one failure cannot
--    strand the other; c runs regardless (announcements degrade gracefully).
-- 3) Seeds Brian's world_boss per-user override = true (mud_wars is already
--    true via 20260692) so the local test account sees the full Season-2
--    surface against the live DB while every other user inherits the FALSE
--    globals.
--
-- ⚠️ ART DEPENDENCY (from 20260704400000's header): the Founder's Mud Ribbon
--    (beta_founder_ribbon) must have its art shipped in a client build BEFORE
--    this cron fires on Jul 12, or live owners see fallback art in the Closet.
--
-- Verify after push:
--   SELECT jobname, schedule, command FROM cron.job
--    WHERE jobname = 'judgement-day-season-1';

CREATE OR REPLACE FUNCTION public.run_judgement_day_season1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
	BEGIN
		PERFORM public.finalize_season('season_1');
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: finalize_season failed: %', SQLERRM;
	END;

	BEGIN
		PERFORM public.grant_beta_rewards();
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: grant_beta_rewards failed: %', SQLERRM;
	END;

	UPDATE public.app_config
	   SET enabled = TRUE, updated_at = now()
	 WHERE key = 'season1_finale';
END;
$$;

REVOKE ALL ON FUNCTION public.run_judgement_day_season1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_judgement_day_season1() FROM anon;
REVOKE ALL ON FUNCTION public.run_judgement_day_season1() FROM authenticated;

SELECT cron.schedule(
	'judgement-day-season-1',
	'0 0 13 7 *', -- 00:00 UTC Jul 13 == 8:00 PM ET Jul 12, 2026
	$$SELECT public.run_judgement_day_season1()$$
);

-- Brian's Season-2 test overrides (pattern from 20260692: lower(username)).
UPDATE public.profiles
   SET feature_overrides = feature_overrides || '{"world_boss": true}'::jsonb
 WHERE lower(username) = 'brian';
