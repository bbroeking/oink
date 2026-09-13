-- Optional historical-chain bridge for running all late smokes together.
-- Production gained this column in 20260504; the minimal harness stub omits it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
