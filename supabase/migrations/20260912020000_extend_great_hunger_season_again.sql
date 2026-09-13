-- The Great Hunger's one-month extension (20260812000000) ran out at
-- 2026-09-12 00:20:10.715+00, which left active_season() empty again while the
-- next season is still undecided — the Hungerer was only at Peckish. Extend by
-- one more calendar month, same idempotent shape: never shorten a newer
-- out-of-band extension, and refuse to apply if the row didn't move.
--
-- Founder call 2026-09-11 ("bring the current season back"). If the next
-- season lands before 2026-10-12, its migration supersedes this cutoff.

UPDATE public.seasons
SET ends_at = '2026-10-12 00:20:10.715+00'::timestamptz
WHERE id = 'snout_season_1'
	AND ends_at < '2026-10-12 00:20:10.715+00'::timestamptz;

DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.seasons
		WHERE id = 'snout_season_1'
			AND ends_at >= '2026-10-12 00:20:10.715+00'::timestamptz
	) THEN
		RAISE EXCEPTION 'snout_season_1 was not extended to the required cutoff';
	END IF;
END
$migration$;
