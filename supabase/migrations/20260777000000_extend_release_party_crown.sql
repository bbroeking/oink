-- Extend the Release Party Crown campaign through the END of September 1,
-- 2026 in the project's America/New_York timezone.
-- AUTHORED ONLY: do not push without Brian's explicit "go".
--
-- Stored code is normalized (no dashes). Exact-code targeting avoids changing
-- the expiry of any future Crown campaign that may intentionally use a
-- different window.
UPDATE public.redemption_codes
SET expires_at = '2026-09-02 00:00:00-04'::timestamptz
WHERE code = 'PIGGXF8ST7N'
	AND "grant" = '{"kind":"hat","id":"release_party_crown"}'::jsonb;

