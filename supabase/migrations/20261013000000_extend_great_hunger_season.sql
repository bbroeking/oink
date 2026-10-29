-- The Great Hunger expired at 2026-10-12 00:20:10.715+00, leaving
-- active_season() empty for ordinary players. Keep the same season running
-- for one more calendar month while the next season remains undecided.
-- Updating only the cutoff preserves XP, premium access, claims, and Wallow
-- progress. It does not backfill season XP missed during the expired gap.
-- Never shorten a newer out-of-band extension; fail if the season is absent.

UPDATE public.seasons
SET ends_at = '2026-11-12 00:20:10.715+00'::timestamptz
WHERE id = 'snout_season_1'
	AND ends_at < '2026-11-12 00:20:10.715+00'::timestamptz;

DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.seasons
		WHERE id = 'snout_season_1'
			AND ends_at >= '2026-11-12 00:20:10.715+00'::timestamptz
	) THEN
		RAISE EXCEPTION 'snout_season_1 was not extended to the required cutoff';
	END IF;
END
$migration$;
