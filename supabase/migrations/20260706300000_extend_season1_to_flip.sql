-- HOTFIX: Season 1's pass lapsed at 2026-07-06 00:00 UTC (the 20260568
-- extension targeted "first Sunday of July"), but Season 2's pass
-- (20260706100000) doesn't start until 2026-07-12 — a six-day hole where
-- active_season() returns nothing and the Season tab renders the blank
-- "No active season" state for every player. Live incident: reported by
-- Brian ~01:00 UTC Jul 6, players already in the gap.
--
-- Extend Season 1 exactly to the flip: at 2026-07-12 00:00:00+00 both
-- seasons match the window for one instant and active_season()'s
-- ORDER BY starts_at DESC hands over to snout_season_2 cleanly.

UPDATE public.seasons
   SET ends_at = '2026-07-12 00:00:00+00'
 WHERE id = 'snout_season_1';
