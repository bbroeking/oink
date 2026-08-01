-- The compact harness profile stub predates cosmetic equipment slots. The
-- production schema already has both columns; add them here so the pending
-- data repair migration can be exercised in the release-grade harness.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_hat_id text,
	ADD COLUMN IF NOT EXISTS active_held_id text;
