-- Prep for 20261029250000_shelf_preview_override.sql + A6_shelf_preview_smoke:
-- the founder row the migration's UPDATE targets, carrying the overrides prod
-- already has (world_boss, season_preview), and a namesake it must not touch.
-- Production has the columns (discriminator, is_test, feature_overrides);
-- earlier preps in run.sh's chain (00c/00o, 00e/00x) add them to the stub.
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000a6001'),
	('00000000-0000-0000-0000-0000000a6003')
ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, username, discriminator, is_test, counter, feature_overrides) VALUES
	('00000000-0000-0000-0000-0000000a6001', 'Brian', '4075', true,  100000,
	 '{"world_boss": true, "season_preview": "snout_season_2"}'),
	('00000000-0000-0000-0000-0000000a6003', 'Brian', '0001', false, 100000, '{}')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, discriminator = EXCLUDED.discriminator,
	is_test = EXCLUDED.is_test, counter = EXCLUDED.counter, feature_overrides = EXCLUDED.feature_overrides;
