-- Dev seed: bump test account's tickle counter and refill available balance.
-- Idempotency note: this adds 1000 tickles each time it runs.
-- Targets the user with the project owner's email.

UPDATE public.profiles
SET counter = counter + 1000
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'iamactuallyinthearena@gmail.com'
);

UPDATE public.user_items
SET item_count = 25, last_increment = now()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'iamactuallyinthearena@gmail.com'
);
