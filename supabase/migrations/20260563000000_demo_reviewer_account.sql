-- Demo account for the App Store reviewer.
--
-- Apple Sign-In creates a fresh empty account per Apple ID, which
-- means a reviewer who taps "Sign in with Apple" lands in a stark
-- empty Barn with no friends / no progress / no equipped items.
-- They can't evaluate the social loop without seeing it in motion.
-- App Store Connect → App Review Information has a "Demo Account"
-- field for exactly this case.
--
-- Credentials (paste these into App Store Connect):
--   Email:    iamactuallyinthearena+reviewer@gmail.com
--   Password: TicklePig2026!
--
-- This migration:
--   1. Creates the auth.users + auth.identities rows so the account
--      can sign in via email/password
--   2. Sets email_confirmed_at = now() so no verification email is
--      required (Apple's reviewer won't have access to the inbox)
--   3. Seeds a profile + 5 friendships + some progress so the
--      reviewer immediately sees the social loop in action

set check_function_bodies = off;

DO $$
DECLARE
	demo_email   text := 'iamactuallyinthearena+reviewer@gmail.com';
	demo_pass    text := 'TicklePig2026!';
	demo_id      uuid;
	friend_ids   uuid[];
	fid          uuid;
BEGIN
	-- Idempotent: if the user already exists, just reuse the id.
	SELECT id INTO demo_id FROM auth.users WHERE email = demo_email;

	IF demo_id IS NULL THEN
		demo_id := gen_random_uuid();
		INSERT INTO auth.users (
			instance_id, id, aud, role, email, encrypted_password,
			email_confirmed_at, created_at, updated_at,
			raw_app_meta_data, raw_user_meta_data,
			is_super_admin, confirmation_token,
			email_change_token_new, recovery_token
		) VALUES (
			'00000000-0000-0000-0000-000000000000',
			demo_id,
			'authenticated',
			'authenticated',
			demo_email,
			extensions.crypt(demo_pass, extensions.gen_salt('bf')),
			now(), now(), now(),
			jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
			'{}'::jsonb,
			false, '', '', ''
		);

		-- The matching identities row that Supabase expects.
		INSERT INTO auth.identities (
			id, user_id, provider_id, identity_data, provider,
			last_sign_in_at, created_at, updated_at
		) VALUES (
			gen_random_uuid(),
			demo_id,
			demo_id::text,
			jsonb_build_object('sub', demo_id::text, 'email', demo_email),
			'email',
			now(), now(), now()
		);
	END IF;

	-- handle_new_user trigger seeded a basic profile + user_items + user_hats.
	-- Override the username for a friendly display name.
	UPDATE public.profiles
		SET username = 'demo_rosie',
		    discriminator = '0001',
		    counter = 1500,
		    tickles_earned = 350,
		    alignment_score = 18,
		    alignment_max_pos = 18
		WHERE id = demo_id;

	-- Make sure the items / hats rows exist (covers the case where
	-- handle_new_user didn't fire for some reason).
	INSERT INTO public.user_items (user_id, item_count, last_increment)
		VALUES (demo_id, 25, now())
		ON CONFLICT (user_id) DO UPDATE SET item_count = 25, last_increment = now();

	-- Pick 5 existing players with usernames as friends so the
	-- sounder + leaderboard tabs show real activity. Exclude
	-- is_test = true accounts so the leaderboard filter stays clean.
	SELECT array_agg(p.id) INTO friend_ids
		FROM (
			SELECT id FROM public.profiles
			WHERE username IS NOT NULL AND username <> ''
			  AND COALESCE(is_test, false) = false
			  AND id <> demo_id
			ORDER BY tickles_earned DESC NULLS LAST
			LIMIT 5
		) p;

	IF friend_ids IS NOT NULL THEN
		FOREACH fid IN ARRAY friend_ids LOOP
			INSERT INTO public.friendships (requester_id, receiver_id, status, created_at, updated_at)
				VALUES (demo_id, fid, 'accepted', now(), now())
				ON CONFLICT DO NOTHING;
		END LOOP;
	END IF;

	-- A few unviewed achievement claims so the Ready filter on the
	-- achievements page shows the gold Claim ✦ button treatment.
	INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
		VALUES
			(demo_id, 'first_friend',  5,  0),
			(demo_id, 'small_sounder', 5,  0)
		ON CONFLICT DO NOTHING;

	-- Equip the default backdrop so the Barn isn't blank.
	UPDATE public.profiles
		SET active_background_id = 'homestead_barn'
		WHERE id = demo_id;
END
$$;
