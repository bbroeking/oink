-- ════════════════════════════════════════════════════════════════════════
-- Season renumber — the greedy/generous era becomes SEASON 0; The Great
-- Hunger becomes SEASON 1. (Founder call, 2026-07-06; client + docs
-- renumbered in the same change set.)
--
-- Rename map (server side):
--   seasons.id        snout_season_1 → snout_season_0   (name → 'Snout Season 0')
--                     snout_season_2 → snout_season_1   (name 'The Great Hunger' unchanged)
--   league_seasons.key       season_2 → season_1
--   season_finales.season_key ('season_1' at the cron call) → 'season_0'
--   cron job  judgement-day-season-1 → judgement-day-season-0
--
-- DELIBERATELY UNCHANGED (shipped-client compatibility — build 103 reads
-- these exact keys):
--   feature flags: world_boss, mud_wars, season1_finale — `season1_finale`
--   is now a LEGACY NAME for the season-0 finale reveal; renaming the key
--   would silently disable the recap on live clients.
--   finalize_season(season_key DEFAULT 'season_1') keeps its legacy default
--   (only the cron calls it, and it passes the key explicitly).
--
-- seasons has no ON UPDATE CASCADE children (season_tiers /
-- user_season_progress / user_tier_claims all reference it ON DELETE
-- CASCADE), so each rename is copy → repoint children → delete old.
-- ORDER MATTERS: season_1 must vacate its id before season_2 claims it.
-- jsonb_populate_record copies every column (schema-drift-proof), only
-- overriding the id.
--
-- Carried latest defs: active_season ← 20260706400000 (the per-user
-- world_boss preview now targets snout_season_1);
-- run_judgement_day_season1 ← 20260704500000 (reborn as ..._season0,
-- finale key 'season_0'; still flips the legacy-named season1_finale flag).
-- pg_cron is ALREADY installed — do NOT CREATE EXTENSION.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Battle-pass seasons: snout_season_1 → snout_season_0 ─────────────
INSERT INTO public.seasons
	SELECT (jsonb_populate_record(s, '{"id": "snout_season_0"}'::jsonb)).*
	FROM public.seasons s WHERE s.id = 'snout_season_1'
	ON CONFLICT (id) DO NOTHING;
UPDATE public.seasons SET name = 'Snout Season 0' WHERE id = 'snout_season_0';
UPDATE public.season_tiers          SET season_id = 'snout_season_0' WHERE season_id = 'snout_season_1';
UPDATE public.user_season_progress  SET season_id = 'snout_season_0' WHERE season_id = 'snout_season_1';
UPDATE public.user_tier_claims      SET season_id = 'snout_season_0' WHERE season_id = 'snout_season_1';
DELETE FROM public.seasons WHERE id = 'snout_season_1';

-- ── 2. Battle-pass seasons: snout_season_2 → snout_season_1 ─────────────
INSERT INTO public.seasons
	SELECT (jsonb_populate_record(s, '{"id": "snout_season_1"}'::jsonb)).*
	FROM public.seasons s WHERE s.id = 'snout_season_2'
	ON CONFLICT (id) DO NOTHING;
UPDATE public.season_tiers          SET season_id = 'snout_season_1' WHERE season_id = 'snout_season_2';
UPDATE public.user_season_progress  SET season_id = 'snout_season_1' WHERE season_id = 'snout_season_2';
UPDATE public.user_tier_claims      SET season_id = 'snout_season_1' WHERE season_id = 'snout_season_2';
DELETE FROM public.seasons WHERE id = 'snout_season_2';

-- ── 3. League season key: season_2 → season_1 ───────────────────────────
INSERT INTO public.league_seasons (key, starts_at, ends_at)
	SELECT 'season_1', starts_at, ends_at FROM public.league_seasons WHERE key = 'season_2'
	ON CONFLICT (key) DO NOTHING;
UPDATE public.war_terms SET season_key = 'season_1' WHERE season_key = 'season_2';
DELETE FROM public.league_seasons WHERE key = 'season_2';

-- ── 4. active_season — carried VERBATIM from 20260706400000; ONE change:
--       the per-user world_boss preview targets the renamed id. ──────────
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.* FROM public.seasons s
  WHERE
    CASE WHEN auth.uid() IS NOT NULL AND COALESCE(
        ((SELECT feature_overrides ->> 'world_boss' FROM public.profiles
          WHERE id = auth.uid()))::boolean, false)
      THEN s.id = 'snout_season_1'
      ELSE s.starts_at <= now() AND s.ends_at >= now()
    END
  ORDER BY s.starts_at DESC
  LIMIT 1;
$function$;

-- ── 5. Judgement Day cron: the season-0 finale ──────────────────────────
-- Carried from 20260704500000; finale key → 'season_0'. The app_config
-- flag keeps its legacy key (season1_finale) — shipped clients read it.
CREATE OR REPLACE FUNCTION public.run_judgement_day_season0()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
	BEGIN
		PERFORM public.finalize_season('season_0');
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: finalize_season failed: %', SQLERRM;
	END;

	BEGIN
		PERFORM public.grant_beta_rewards();
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: grant_beta_rewards failed: %', SQLERRM;
	END;

	-- Legacy key on purpose: build ≤103 clients gate the recap on it.
	UPDATE public.app_config
	   SET enabled = TRUE, updated_at = now()
	 WHERE key = 'season1_finale';
END;
$$;
REVOKE ALL ON FUNCTION public.run_judgement_day_season0() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('judgement-day-season-1')
	WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'judgement-day-season-1');
SELECT cron.schedule(
	'judgement-day-season-0',
	'0 0 13 7 *', -- 00:00 UTC Jul 13 == 8:00 PM ET Jul 12, 2026 (unchanged)
	$$SELECT public.run_judgement_day_season0()$$
);
DROP FUNCTION IF EXISTS public.run_judgement_day_season1();
