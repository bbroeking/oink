-- Restore the 10-tickle starting balance for new users + backfill
-- anyone who fell through the gap.
--
-- Regression: migration 20260515010000_homestead_barn_default_bg.sql
-- rewrote handle_new_user() to add a user_hats insert (the default
-- homestead_barn backdrop) but dropped the original
--   INSERT INTO public.user_items (user_id, item_count, last_increment)
--   VALUES (new.id, 10, now());
-- that came from 20260501160000_tickles_regen.sql. Every account
-- created since then has no user_items row at all → tickle_info()'s
-- LEFT-JOIN-of-nothing returns null → the UI reads balance = 0.
--
-- Three things this migration does:
--   1. Rewrites handle_new_user() to put BOTH inserts back (profile
--      + homestead_barn + user_items seeded at 10).
--   2. Inserts a user_items row at item_count=10 for anyone who's
--      missing one entirely (broader safety net than the 48h ask).
--   3. For anyone created in the last 48h with a row but item_count
--      below 10, bumps them to 10 and resets last_increment to now()
--      so regen counts forward from a clean baseline.

set check_function_bodies = off;

-- ── 1. handle_new_user — put the user_items insert back ─────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
	INSERT INTO public.profiles (id, full_name, avatar_url)
	VALUES (
		new.id,
		new.raw_user_meta_data->>'full_name',
		new.raw_user_meta_data->>'avatar_url'
	);

	-- Seed the default backdrop (from 20260515010000).
	INSERT INTO public.user_hats (user_id, hat_id)
	VALUES (new.id, 'homestead_barn')
	ON CONFLICT (user_id, hat_id) DO NOTHING;

	-- Seed the starting tickle balance (RESTORED — was dropped by
	-- the 20260515010000 rewrite, leaving every new account at 0
	-- balance with no regen anchor).
	INSERT INTO public.user_items (user_id, item_count, last_increment)
	VALUES (new.id, 10, now())
	ON CONFLICT (user_id) DO NOTHING;

	RETURN new;
END;
$function$;

-- ── 2. Backfill: every existing user with no user_items row ──────
-- Broader than the user's 48h ask but cheaper and safer. Accounts
-- missing a row are stuck at 0; the only way to "do harm" here is
-- to grant 10 tickles to a pre-existing user who somehow has no
-- row but had used them before. There's no such state today — if
-- you have a user_items row you keep it; if you don't, you've been
-- stuck at 0 and this unsticks you.
INSERT INTO public.user_items (user_id, item_count, last_increment)
SELECT u.id, 10, now()
FROM auth.users u
LEFT JOIN public.user_items ui ON ui.user_id = u.id
WHERE ui.user_id IS NULL;

-- ── 3. Backfill: 48h window — bump anyone created recently who's
-- below 10 up to 10, reset their regen clock. Excludes anyone
-- who's already above 10 (they may have legitimately purchased /
-- earned more). Excludes test accounts so Brian's existing
-- balance isn't perturbed.
UPDATE public.user_items ui
	SET item_count = 10,
	    last_increment = now()
	FROM auth.users u
	LEFT JOIN public.profiles p ON p.id = u.id
	WHERE ui.user_id = u.id
	  AND u.created_at >= now() - interval '48 hours'
	  AND ui.item_count < 10
	  AND COALESCE(p.is_test, false) = false;
