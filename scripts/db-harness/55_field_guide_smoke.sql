-- Smoke: 20260752000000_field_guide_pages — the Field Guide unlock state.
--
-- Shims auth.uid() off a GUC and exercises the write RPC, the read RPC, the
-- whitelist, and RLS own-rows-only. Applied by run.sh (pass the migration as an
-- extra arg; auth.users is stubbed by 00_stub).
--
-- Covers:
--   • unlock_field_guide_page inserts the caller's own row
--   • idempotent — a second unlock of the same page is a no-op (one row)
--   • unknown page id is rejected (whitelist) and inserts nothing
--   • get_field_guide_pages reads the caller's own ids, sorted
--   • no cross-user bleed — a second player sees only their own pages
--   • unauthenticated (auth.uid() NULL) — unlock is a silent no-op, get empty
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000f6001'),
	('00000000-0000-0000-0000-0000000f6002')
ON CONFLICT (id) DO NOTHING;

-- ═══ 1. unlock inserts the caller's row; idempotent on repeat ════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000f6001';
DO $$ DECLARE n int;
BEGIN
	PERFORM public.unlock_field_guide_page('truffle');
	PERFORM public.unlock_field_guide_page('truffle'); -- repeat: ON CONFLICT no-op
	SELECT count(*) INTO n FROM public.field_guide_pages
		WHERE user_id = '00000000-0000-0000-0000-0000000f6001' AND page_id = 'truffle';
	IF n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 truffle row, saw %', n; END IF;
END $$;

-- ═══ 2. unknown page id is rejected and seeds nothing ════════════════════════
DO $$ DECLARE n int; raised boolean := false;
BEGIN
	BEGIN
		PERFORM public.unlock_field_guide_page('echo'); -- deliberately cut from v1
	EXCEPTION WHEN check_violation THEN
		raised := true;
	END;
	IF NOT raised THEN RAISE EXCEPTION 'unknown page id should have raised'; END IF;
	SELECT count(*) INTO n FROM public.field_guide_pages
		WHERE user_id = '00000000-0000-0000-0000-0000000f6001' AND page_id = 'echo';
	IF n <> 0 THEN RAISE EXCEPTION 'rejected page id must not seed a row, saw %', n; END IF;
END $$;

-- ═══ 3. get_field_guide_pages reads own ids, sorted ══════════════════════════
DO $$ DECLARE ids text[];
BEGIN
	PERFORM public.unlock_field_guide_page('snouts');
	SELECT public.get_field_guide_pages() INTO ids;
	IF ids <> ARRAY['snouts', 'truffle']::text[] THEN
		RAISE EXCEPTION 'expected [snouts, truffle] sorted, saw %', ids;
	END IF;
END $$;

-- ═══ 4. No cross-user bleed — a second player sees only their own ════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000f6002';
DO $$ DECLARE ids text[];
BEGIN
	SELECT public.get_field_guide_pages() INTO ids;
	IF ids <> ARRAY[]::text[] THEN
		RAISE EXCEPTION 'second player should start empty, saw %', ids;
	END IF;
	PERFORM public.unlock_field_guide_page('exchange');
	SELECT public.get_field_guide_pages() INTO ids;
	IF ids <> ARRAY['exchange']::text[] THEN
		RAISE EXCEPTION 'second player should see only [exchange], saw %', ids;
	END IF;
END $$;

-- ═══ 5. Unauthenticated — unlock is a silent no-op, get is empty ═════════════
SET smoke.uid = '';
DO $$ DECLARE ids text[]; n int;
BEGIN
	PERFORM public.unlock_field_guide_page('trough'); -- matches no uid; must not error
	SELECT public.get_field_guide_pages() INTO ids;
	IF ids <> ARRAY[]::text[] THEN
		RAISE EXCEPTION 'unauth get should be empty, saw %', ids;
	END IF;
	SELECT count(*) INTO n FROM public.field_guide_pages WHERE page_id = 'trough';
	IF n <> 0 THEN RAISE EXCEPTION 'unauth unlock must seed nothing, saw %', n; END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk field_guide smoke OK'; END $$;

ROLLBACK;
