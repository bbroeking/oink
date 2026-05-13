-- Dev seed: grant every catalog item to the arena (test) account so
-- backgrounds, auras, capes, and everything else can be exercised
-- end-to-end without grinding tickles in dev.
--
-- Idempotent via ON CONFLICT — safe to re-run after new items are
-- added to the catalog (subsequent pushes pick them up too).
-- Targets only the iamactuallyinthearena@gmail.com account; other
-- users are untouched.

INSERT INTO public.user_hats (user_id, hat_id)
SELECT u.id, h.id
FROM auth.users u
CROSS JOIN public.hats h
WHERE u.email = 'iamactuallyinthearena@gmail.com'
ON CONFLICT (user_id, hat_id) DO NOTHING;
