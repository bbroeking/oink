-- Renumber assertions.
\set ON_ERROR_STOP on
SELECT 'seasons ids' AS chk, id, name FROM public.seasons ORDER BY id;
SELECT 'old ids gone' AS chk, count(*) FROM public.seasons WHERE id IN ('snout_season_2') OR name = 'Snout Season 1';
SELECT 'tiers repointed' AS chk, season_id, count(*) FROM public.season_tiers GROUP BY season_id ORDER BY season_id;
SELECT 'progress repointed' AS chk, season_id FROM public.user_season_progress;
SELECT 'claims repointed' AS chk, season_id FROM public.user_tier_claims;
SELECT 'league key' AS chk, key FROM public.league_seasons;
SELECT 'cron fn swapped' AS chk,
	EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_judgement_day_season0') AS s0,
	EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_judgement_day_season1') AS s1_gone_if_false;
-- active_season preview path parses + runs (auth.uid() NULL → date-driven).
SELECT 'active_season runs' AS chk, (public.active_season()).id;
