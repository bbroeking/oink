-- Reduce every shop-item price by a factor of 10.
--
-- Verified against the live catalog before writing: 81 items, costs
-- 0–8000, exactly one free item (cost 0 — stays free under ROUND)
-- and zero items priced 1–9, so the round-divide can't accidentally
-- turn a paid item free.
--
-- Runs after the seed (20260502030000_shop_catalog), so a fresh
-- `db reset` lands on the reduced prices too: seed inserts the old
-- values, then this migration divides them.

UPDATE public.hats SET cost = ROUND(cost / 10.0)::int;
