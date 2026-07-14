-- Smoke: 20260739300000_friend_favorites — owner-only RLS on the pin table.
--
-- Self-contained: shims auth.uid() off a GUC, then exercises the table under
-- the (non-superuser) `authenticated` role so RLS actually applies. The suite
-- otherwise runs as the container superuser, which BYPASSES RLS — so this smoke
-- SET ROLE authenticated around every check, and RESETs at the end.
--
-- Asserts:
--   • owner can insert / select / delete their OWN favorites
--   • pk dedupe: re-pinning the same (user_id, friend_id) is a no-op via
--     ON CONFLICT DO NOTHING (the client's insert path)
--   • a second user cannot SEE the first user's favorites (owner-only select)
--   • a user cannot INSERT a favorite owned by someone else (WITH CHECK)
--
-- The migration is applied by run.sh's CHAIN (the suite is piped into psql, so
-- relative \i paths don't resolve on the container).
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000fa000'), -- user A (pinner)
	('00000000-0000-0000-0000-0000000fa001'), -- friend 1
	('00000000-0000-0000-0000-0000000fa002'), -- friend 2
	('00000000-0000-0000-0000-0000000fa0b0')  -- user B (nosy)
ON CONFLICT (id) DO NOTHING;

-- ── A pins two friends, under RLS as `authenticated` ──────────────────────────
SET smoke.uid = '00000000-0000-0000-0000-0000000fa000';
SET ROLE authenticated;

INSERT INTO public.friend_favorites (user_id, friend_id) VALUES
	('00000000-0000-0000-0000-0000000fa000', '00000000-0000-0000-0000-0000000fa001'),
	('00000000-0000-0000-0000-0000000fa000', '00000000-0000-0000-0000-0000000fa002');

-- 1. owner sees exactly their own two pins
DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM public.friend_favorites;
	IF n <> 2 THEN
		RAISE EXCEPTION 'owner should see 2 favorites, saw %', n;
	END IF;
END $$;

-- 2. pk dedupe: re-pinning the same pair (the client's ON CONFLICT path) is a
-- no-op, not a duplicate row.
INSERT INTO public.friend_favorites (user_id, friend_id)
VALUES ('00000000-0000-0000-0000-0000000fa000', '00000000-0000-0000-0000-0000000fa001')
ON CONFLICT (user_id, friend_id) DO NOTHING;
DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM public.friend_favorites;
	IF n <> 2 THEN
		RAISE EXCEPTION 'dedupe failed — expected 2 rows after re-pin, saw %', n;
	END IF;
END $$;

-- 3. owner can unpin (delete) their own favorite
DELETE FROM public.friend_favorites
WHERE user_id = '00000000-0000-0000-0000-0000000fa000'
  AND friend_id = '00000000-0000-0000-0000-0000000fa002';
DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM public.friend_favorites;
	IF n <> 1 THEN
		RAISE EXCEPTION 'unpin failed — expected 1 row, saw %', n;
	END IF;
END $$;

-- ── B cannot see A's favorites (owner-only select) ────────────────────────────
RESET ROLE;
SET smoke.uid = '00000000-0000-0000-0000-0000000fa0b0';
SET ROLE authenticated;

DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM public.friend_favorites;
	IF n <> 0 THEN
		RAISE EXCEPTION 'B leaked A''s favorites — saw % rows, expected 0', n;
	END IF;
END $$;

-- ── B cannot insert a favorite owned by A (WITH CHECK owner-only) ─────────────
DO $$
DECLARE blocked boolean := false;
BEGIN
	BEGIN
		INSERT INTO public.friend_favorites (user_id, friend_id)
		VALUES ('00000000-0000-0000-0000-0000000fa000', '00000000-0000-0000-0000-0000000fa0b0');
	EXCEPTION WHEN insufficient_privilege THEN
		blocked := true;
	END;
	IF NOT blocked THEN
		RAISE EXCEPTION 'B was able to insert a favorite owned by A (RLS WITH CHECK failed)';
	END IF;
END $$;

RESET ROLE;
SET smoke.uid = '';

DO $$ BEGIN RAISE NOTICE 'chk friend favorites: owner insert/select/delete + pk dedupe + cross-user select/insert denied OK'; END $$;
ROLLBACK;
