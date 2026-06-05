-- Unlock ALL World Cup cosmetics for the admin/test account (Brian) for
-- testing. Brian = profiles.is_test = true (the project owner's account).
--
-- ⚠ Requires the World Cup seed migration (20260569000000_world_cup_flags.sql)
--   to be applied first — the flag items + titles must exist. Run on explicit
--   "go" only (house rule: no autonomous DB writes). Idempotent.

-- 1. Grant every flag cosmetic (category 'flag') to Brian.
INSERT INTO public.user_hats (user_id, hat_id)
SELECT p.id, h.id
FROM public.profiles p
CROSS JOIN public.hats h
WHERE p.username = 'Brian'
  AND h.category = 'flag'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_hats uh
    WHERE uh.user_id = p.id AND uh.hat_id = h.id
  );

-- 2. Grant every World Cup country title to Brian.
INSERT INTO public.user_titles (user_id, title_id)
SELECT p.id, t.id
FROM public.profiles p
CROSS JOIN public.titles t
WHERE p.username = 'Brian'
  AND t.source = 'world_cup'
ON CONFLICT DO NOTHING;

-- 3. Verify (expect 47 flags + 47 titles).
SELECT 'flags' AS kind, count(*) FROM public.user_hats uh
  JOIN public.profiles p ON p.id = uh.user_id
  JOIN public.hats h ON h.id = uh.hat_id
  WHERE p.username = 'Brian' AND h.category = 'flag'
UNION ALL
SELECT 'titles', count(*) FROM public.user_titles ut
  JOIN public.profiles p ON p.id = ut.user_id
  JOIN public.titles t ON t.id = ut.title_id
  WHERE p.username = 'Brian' AND t.source = 'world_cup';
