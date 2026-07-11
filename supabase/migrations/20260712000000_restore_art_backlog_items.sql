-- Restore daily-shop costs for the art-backlog cosmetics whose art landed in the
-- 2026-07-06 ChatGPT pass (docs/openai-missing-items-icons.md). Reverses the
-- blanket hide from 20260685000000_hide_orphan_cosmetics.sql for these ids only:
-- each now has a real PNG in HAT_IMAGES + (for worn items) a RelSpec, so it
-- renders correctly and re-enters daily_shop() rotation (which draws cost > 0).
--
-- Original costs are the 20260632000000_daily_shop_expand.sql seed values.
-- Gated per item on art actually shipping — one UPDATE per landed item.
--
-- ⚠️ DO NOT PUSH until the build ships / user says "push it now". Applying this
-- makes the items buyable; keep it un-pushed while the art is still in review.
--
-- All 11 items landed (library_nook succeeded on retry after its first render
-- stalled), so this restores the complete 20260632 hidden set.

UPDATE public.hats SET cost = 240  WHERE id = 'mushroom_cap';     -- hat, uncommon
UPDATE public.hats SET cost = 120  WHERE id = 'paper_boat';       -- hat, common
UPDATE public.hats SET cost = 260  WHERE id = 'jam_jar_lenses';   -- glasses, uncommon
UPDATE public.hats SET cost = 130  WHERE id = 'acorn_bow';        -- bow, common
UPDATE public.hats SET cost = 280  WHERE id = 'bumblebee_bow';    -- bow, uncommon
UPDATE public.hats SET cost = 600  WHERE id = 'firefly_lantern';  -- held, rare
UPDATE public.hats SET cost = 150  WHERE id = 'tiny_umbrella';    -- held, common
UPDATE public.hats SET cost = 750  WHERE id = 'moth_waltz';       -- aura, rare
UPDATE public.hats SET cost = 650  WHERE id = 'pumpkin_patch';    -- background, rare
UPDATE public.hats SET cost = 300  WHERE id = 'particle_bubble';  -- tickle_particle, uncommon
UPDATE public.hats SET cost = 1200 WHERE id = 'library_nook';     -- background, epic
