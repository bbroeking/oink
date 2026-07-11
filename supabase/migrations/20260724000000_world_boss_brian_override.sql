-- Season-1 (The Great Hunger) preview on the founder's own PROD build: the
-- season tab gates on `world_boss || __DEV__`, so dev builds already live in
-- the new season — this flips the per-user override so Brian's TestFlight
-- device does too. The GLOBAL flip stays scheduled for later (app_config row
-- untouched); this writes exactly one profile (same targeting precedent as
-- 20260714's founder seed: lower(username) = 'brian').
UPDATE public.profiles
	SET feature_overrides = feature_overrides || '{"world_boss": true}'::jsonb
	WHERE lower(username) = 'brian';
