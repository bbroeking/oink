-- Extend Season 1's ends_at to Sunday July 5, 2026 (first Sunday of
-- July). The seed migration (20260502010100_seed_snout_season_1.sql)
-- had ends_at = '2026-05-27 00:00:00+00' which already elapsed —
-- active_season() now returns no rows, and the Season tab renders
-- "No active season." (the dark-theme styling on that empty state
-- reads as a blank tab against the cream background).
--
-- ends_at is treated as inclusive by active_season() (`ends_at >= now()`),
-- so setting to UTC midnight at the start of July 6 keeps the
-- season "active" through all of Sunday July 5 in every US timezone
-- and into early Monday morning UTC.

UPDATE public.seasons
   SET ends_at = '2026-07-06 00:00:00+00'
 WHERE id = 'snout_season_1';
