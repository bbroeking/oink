-- Smoke: 20260747000000_storybook_seen — the reinstall-flow storybook mirror.
--
-- Shims auth.uid() off a GUC and exercises the two SECURITY DEFINER RPCs plus
-- the new profiles.storybook_seen column. Applied by run.sh (pass the migration
-- as an extra arg; profiles is stubbed by 00_stub).
--
-- Covers:
--   • column default false on an existing profile
--   • get_storybook_seen() reads the caller's own bit (false, then true)
--   • mark_storybook_seen() flips ONLY the caller's row (no cross-user bleed)
--   • unauthenticated (auth.uid() NULL) → get reads false, mark is a no-op
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-0000000fc001', 'sb_reinstaller'),
	('00000000-0000-0000-0000-0000000fc002', 'sb_bystander')
ON CONFLICT (id) DO NOTHING;

-- ═══ 1. Column defaults false; get_storybook_seen reflects it ════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000fc001';
DO $$ DECLARE seen boolean;
BEGIN
	SELECT storybook_seen INTO seen FROM public.profiles
		WHERE id = '00000000-0000-0000-0000-0000000fc001';
	IF seen IS NOT FALSE THEN RAISE EXCEPTION 'expected column default false, saw %', seen; END IF;
	IF public.get_storybook_seen() IS NOT FALSE THEN
		RAISE EXCEPTION 'expected get_storybook_seen false before mark';
	END IF;
END $$;

-- ═══ 2. mark_storybook_seen flips the caller's bit; get sees it ══════════════
DO $$
BEGIN
	PERFORM public.mark_storybook_seen();
	IF public.get_storybook_seen() IS NOT TRUE THEN
		RAISE EXCEPTION 'expected get_storybook_seen true after mark';
	END IF;
END $$;

-- ═══ 3. No cross-user bleed — the bystander is untouched ═════════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000fc002';
DO $$
BEGIN
	IF public.get_storybook_seen() IS NOT FALSE THEN
		RAISE EXCEPTION 'bystander bit should still be false';
	END IF;
END $$;

-- ═══ 4. Unauthenticated — get reads false, mark is a silent no-op ════════════
SET smoke.uid = '';
DO $$ DECLARE bystander boolean;
BEGIN
	IF public.get_storybook_seen() IS NOT FALSE THEN
		RAISE EXCEPTION 'unauth get should be false';
	END IF;
	PERFORM public.mark_storybook_seen(); -- matches no row; must not error
	SELECT storybook_seen INTO bystander FROM public.profiles
		WHERE id = '00000000-0000-0000-0000-0000000fc002';
	IF bystander IS NOT FALSE THEN
		RAISE EXCEPTION 'unauth mark must not flip anyone, bystander now %', bystander;
	END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk storybook_seen smoke OK'; END $$;

ROLLBACK;
