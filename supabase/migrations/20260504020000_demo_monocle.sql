-- Demo: give the test account the monocle and equip it.
-- One-time. Safe to re-run (ON CONFLICT DO NOTHING + idempotent UPDATE).

INSERT INTO public.user_hats (user_id, hat_id)
SELECT u.id, 'monocle'
FROM auth.users u
WHERE u.email = 'iamactuallyinthearena@gmail.com'
ON CONFLICT (user_id, hat_id) DO NOTHING;

UPDATE public.profiles
SET active_hat_id = 'monocle'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'iamactuallyinthearena@gmail.com'
);
