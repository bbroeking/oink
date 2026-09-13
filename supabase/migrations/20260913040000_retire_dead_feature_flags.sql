-- Retire the dead feature flags (2026-09-12 flag audit).
--
-- Three `app_config` rows are read by nothing:
--   habitat   — Personal Barn housing is the home now, not a dark-launched
--               surface. Seeded false by 20260906190000, never flipped; builds
--               ≥ 180 ignored it via a compiled HABITAT_VISIBLE=true. The client
--               dropped the key from its FeatureFlagKey union, so a consumer
--               can't be re-added by accident. A pre-180 binary reads a missing
--               key as false — exactly what it reads today.
--   coop_dig  — every "co-op dig" gate reads `world_boss` instead (the comments
--               in app/_layout.tsx and app/(tabs)/friends.tsx recorded why);
--               dropped from the client union too, so it can't become a second,
--               conflicting Season-1 gate.
--   mud_wars  — seeded by 20260692000000 and never read by any RPC or client.
--
-- The per-user overrides for those keys go with them (one tester profile held
-- all three from July's dark launch). `world_boss` overrides are untouched.
--
-- `season0_graduated` is NOT a feature flag: it is the once-only guard that
-- records the Season-0 graduation / lifetime-tickles backfill has run. It stays
-- in app_config because nine migrations read it there, but its description now
-- says so, for the admin surface and the next reader.
--
-- Authored for review; do not push without Brian's explicit go.

DELETE FROM public.app_config WHERE key IN ('habitat', 'coop_dig', 'mud_wars');

UPDATE public.profiles
   SET feature_overrides = feature_overrides - 'habitat' - 'coop_dig' - 'mud_wars'
 WHERE feature_overrides ?| ARRAY['habitat', 'coop_dig', 'mud_wars'];

UPDATE public.app_config
   SET description = 'MIGRATION STATE, not a feature flag: the once-only guard that the Season-0 graduation backfill (20260735–20260737) has run. Never toggle.'
 WHERE key = 'season0_graduated';
