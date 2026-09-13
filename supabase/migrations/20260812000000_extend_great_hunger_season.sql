-- Keep the currently shipped season active while the next season remains
-- undecided. Production had The Great Hunger ending at
-- 2026-08-12 00:20:10.715+00, which left active_season() empty immediately
-- afterward. Extend it by one calendar month without ever shortening a newer
-- out-of-band extension.

UPDATE public.seasons
SET ends_at = '2026-09-12 00:20:10.715+00'::timestamptz
WHERE id = 'snout_season_1'
	AND ends_at < '2026-09-12 00:20:10.715+00'::timestamptz;

DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.seasons
		WHERE id = 'snout_season_1'
			AND ends_at >= '2026-09-12 00:20:10.715+00'::timestamptz
	) THEN
		RAISE EXCEPTION 'snout_season_1 was not extended to the required cutoff';
	END IF;
END
$migration$;
