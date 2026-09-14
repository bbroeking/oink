-- Prep for 20260913060000_snout_deep.sql: production's app_config carries a
-- description column (20260692000000_feature_flags); the minimal stub does not.
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS description text;
