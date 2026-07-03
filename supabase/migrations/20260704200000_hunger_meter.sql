-- ─────────────────────────────────────────────────────────────────────────────
-- UNAPPLIED — HELD FOR REVIEW. Push only on Brian's explicit "go".
--
-- The Great Hungerer's season energy meter (Season 2 world-boss layer).
-- READ-ONLY: one RPC, hunger_meter(), that derives the server-wide drain from
-- war contribution already written by the Mud Wars stack — the same
-- derived-view trick as Mud Fort. No new write paths, no triggers, no cron.
--
-- Fiction: every sling/throw/run/rooting either clan banks "pries tickles off
-- him" — the SUM across ALL wars this season is how weakened he is. Stages:
--   0 gorged → 1 stuffed → 2 full → 3 peckish → 4 hungry → 5 famished
-- The client renders the stage as a vignette (never a number).
--
-- Also seeds the `world_boss` feature-flag key (app_config) that
-- hooks/useFeatureFlags.tsx already declares client-side (global=false; flip
-- per-user via profiles.feature_overrides like mud_wars in 20260692).
-- ─────────────────────────────────────────────────────────────────────────────

-- Flag seed (client key exists since the GreatHungerIntroModal work; this is
-- the missing server row). Global OFF; Brian's override happens like 20260692.
INSERT INTO public.app_config (key, enabled, description)
VALUES ('world_boss', false, 'Season 2: The Great Hungerer world-boss layer (intro, meter, drain surfaces)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hunger_meter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	-- Season-2 window start. Wars created before this don't drain him.
	-- Retune at flip if the season formally starts on a different date.
	season_start CONSTANT timestamptz := timestamptz '2026-07-01 00:00:00+00';

	-- Stage boundaries (cumulative server-wide mud). PLACEHOLDERS sized for the
	-- ~27-player beta: retune at the mud_wars flip from war_population_ready()
	-- instrumentation (the arc memo's rule of thumb: full season ≈ 5 stages ≈
	-- expected total war output at ~40% participation). Re-tune by carrying THIS
	-- function (latest def lives here) — never by editing applied files.
	thresholds CONSTANT int[] := ARRAY[40, 100, 200, 340, 520];

	stage_names CONSTANT text[] :=
		ARRAY['gorged', 'stuffed', 'full', 'peckish', 'hungry', 'famished'];

	total_mud   int := 0;
	stage_idx   int := 0;   -- 0-based: 0=gorged … 5=famished
	next_thresh int := NULL;
	i           int;
BEGIN
	-- All human war contribution this season. The house bot never writes
	-- mud_slings rows (its pace is synthetic in the fold), but exclude bot-crew
	-- rows defensively anyway. Human effort in bot wars DOES drain him —
	-- "all war effort accumulates" (arc memo §3).
	SELECT COALESCE(SUM(ms.slings), 0)
	INTO total_mud
	FROM public.mud_slings ms
	JOIN public.mud_wars w ON w.id = ms.war_id
	WHERE w.created_at >= season_start
	  AND ms.crew_id NOT IN (SELECT id FROM public.crews WHERE is_bot);

	FOR i IN 1 .. array_length(thresholds, 1) LOOP
		IF total_mud >= thresholds[i] THEN
			stage_idx := i;
		END IF;
	END LOOP;

	IF stage_idx < array_length(thresholds, 1) THEN
		next_thresh := thresholds[stage_idx + 1];
	END IF;

	RETURN jsonb_build_object(
		'total',          total_mud,
		'stage',          stage_names[stage_idx + 1],
		'stage_index',    stage_idx,
		'next_threshold', next_thresh
	);
END;
$$;

-- Grant hygiene (20260672 rule): SECURITY DEFINER functions must not leak to
-- PUBLIC/anon. Signed-in players read the meter; nothing here writes.
REVOKE ALL ON FUNCTION public.hunger_meter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hunger_meter() TO authenticated;
