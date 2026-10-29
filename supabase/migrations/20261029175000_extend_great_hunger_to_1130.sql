-- The bridge to Season 2 (founder ruling 2026-10-29, SKILL.md log "The next
-- season is The Feast"). The Great Hunger would lapse at 2026-11-12 00:20 UTC;
-- The Feast ships dark in build 198 and flips by flip_season_2() once enough
-- players have updated (target Monday 2026-11-16, fallback 11-23). Extend the
-- cutoff to Monday 2026-11-30 00:00 UTC, on the drum's week boundary, so a late
-- flip never meets an empty active_season(). flip_season_2() sets both rows to
-- the same instant, so this ceiling is only ever a safety net.
-- Updating only the cutoff preserves XP, premium access, claims, and Wallow
-- progress. Never shorten a newer out-of-band extension; fail if the season is
-- absent. (Pattern carried from 20261013000000_extend_great_hunger_season.sql.)

UPDATE public.seasons
SET ends_at = '2026-11-30 00:00:00+00'::timestamptz
WHERE id = 'snout_season_1'
	AND ends_at < '2026-11-30 00:00:00+00'::timestamptz;

DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.seasons
		WHERE id = 'snout_season_1'
			AND ends_at >= '2026-11-30 00:00:00+00'::timestamptz
	) THEN
		RAISE EXCEPTION 'snout_season_1 was not extended to the required cutoff';
	END IF;
END
$migration$;
