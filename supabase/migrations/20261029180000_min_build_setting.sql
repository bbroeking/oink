-- ── The soft-update nudge's switch: app_settings.min_build ───────────────────
--
-- Today's binary carries a never-blocking "a new version is ready" card on Home
-- (components/UpdateNudge.tsx, hooks/useMinBuild.ts). It reads this row through
-- the generic app_setting(p_key) RPC (20260744100000: SECURITY DEFINER,
-- EXECUTE granted to anon + authenticated, no key allowlist), so seeding the
-- row is the whole server side. No new function, no new grant.
--
-- SHAPE: {"build": int, "title": text, "body": text}. A binary whose native
-- build number (CFBundleVersion) is BELOW `build` shows the card; an empty
-- title/body falls back to the compiled copy ("A new version is ready" /
-- "Update to get the latest."). Seeded INERT (build 0): nothing is below 0, so
-- this push changes nothing on any client.
--
-- TO RAISE IT (the Season 2 flip, docs/explorations/2026-10-29-season-2):
--   UPDATE public.app_settings
--     SET value = jsonb_build_object('build', <build>, 'title', '...', 'body', '...'),
--         updated_at = now()
--     WHERE key = 'min_build';
-- Open apps pick it up on their next foreground (the client debounces the
-- fetch to once a minute); binaries older than this one never read the row.
-- TO LOWER IT: set build back to 0. Copy is player-facing: no em dashes.
--
-- ON CONFLICT DO NOTHING: a row a later migration (or an operator) already
-- wrote is never reset by a re-run.

INSERT INTO public.app_settings (key, value, description)
VALUES (
	'min_build',
	'{"build": 0, "title": "", "body": ""}'::jsonb,
	'Soft-update nudge: native builds below "build" see a dismissable "a new version is ready" card on Home linking to the App Store. 0 = inert. Empty title/body use the compiled copy.'
)
ON CONFLICT (key) DO NOTHING;
