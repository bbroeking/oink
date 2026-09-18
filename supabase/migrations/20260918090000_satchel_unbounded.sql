-- The Satchel is unbounded (2026-09-18).
--
-- Founder: "Make the satchel unbounded right now (no capacity limit). We can
-- keep items in the satchel as-is." The cap is a number in
-- app_settings.satchel_tuning that every bag write compares against
-- (`have < cap` in the dig receipt, `host_bag_full` in swap_with_host), so the
-- cheapest honest change is a sentinel the client also knows:
-- constants/satchel.ts SATCHEL_UNBOUNDED_CAP = 9999 — a bag at or above it
-- never says "full", never says "N of cap", and nothing stays in the mud.
-- Existing rows are untouched; nothing is deleted or trimmed.
--
-- Merge, never clobber: the row carries odds / weights / hours / tickles /
-- thresholds / swap caps that stay exactly as they are.
--
-- Authored for review; do not push without Brian's explicit "go".

UPDATE public.app_settings
SET value = COALESCE(value, '{}'::jsonb) || '{"cap": 9999}'::jsonb,
    description = 'The Satchel (docs/satchel-spec.md + the 2026-09-16 swap plan): bag cap (9999 = unbounded, 2026-09-18), finds-per-dig odds, wish rarity weights, wish timer, tickles per hand-off (flat — rarity never pays), keepsake thresholds, swap options per wish, paid-swap caps per pair and per pig per UTC day.'
WHERE key = 'satchel_tuning';
