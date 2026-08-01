-- The Trough — rewards are immediate, so receipts auto-claim.
--
-- Since 20260757, donate_to_drive credits the small 1:100 tickle thank-you
-- inline, but donation rows still inherited the old nullable
-- reward_claimed_at field. my_drives therefore surfaced already-paid rewards
-- as claimable receipts even though claim_drive_reward is deliberately retired.
--
-- Stamp every existing pending row and default future rows to claimed at insert
-- time. This pays nobody twice: the profile credit already happened inside
-- donate_to_drive, and historical pre-revival rows were zeroed by 20260751.
-- The old claim RPC remains retired for shipped clients.

ALTER TABLE public.item_drive_donations
	ALTER COLUMN reward_claimed_at SET DEFAULT now();

UPDATE public.item_drive_donations
	SET reward_claimed_at = COALESCE(created_at, now())
	WHERE reward_claimed_at IS NULL;
