-- Demo account state seed for the App Store reviewer.
--
-- The auth.users + auth.identities rows are NOT created by this
-- migration — those need to come through Supabase's signup flow
-- (manual SQL inserts miss user_metadata + identity_data fields
-- that GoTrue queries during sign-in, causing a "Database error
-- querying schema" 500). Instead, create the auth user via:
--
--   curl -sX POST "$SUPABASE_URL/auth/v1/signup" \
--     -H "apikey: $SUPABASE_ANON" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"demo@ticklethepig.com","password":"TicklePig2026!"}'
--
-- Project settings have email confirmations OFF, so signup
-- auto-confirms and the account can sign in immediately.
--
-- After the signup returns a user_id, this migration seeds the
-- profile + friendships + achievements so the demo lands in a
-- populated account instead of an empty Barn.
--
-- Credentials (paste into App Store Connect → App Review Information):
--   Email:    demo@ticklethepig.com
--   Password: TicklePig2026!

set check_function_bodies = off;

DO $$
DECLARE
	demo_email   text := 'demo@ticklethepig.com';
	demo_id      uuid;
	friend_ids   uuid[];
	fid          uuid;
BEGIN
	SELECT id INTO demo_id FROM auth.users WHERE email = demo_email;
	IF demo_id IS NULL THEN
		-- Auth user doesn't exist yet — skip seed. Operator should
		-- run the signup curl call above, then re-apply this
		-- migration (or run the body manually) to populate state.
		RAISE NOTICE 'Demo auth user (%) not found; skipping state seed. Create via /auth/v1/signup first.', demo_email;
		RETURN;
	END IF;

	UPDATE public.profiles
		SET username = 'demo_rosie',
		    discriminator = '0001',
		    counter = 1500,
		    tickles_earned = 350,
		    alignment_score = 18,
		    alignment_max_pos = 18,
		    active_background_id = 'homestead_barn'
		WHERE id = demo_id;

	INSERT INTO public.user_items (user_id, item_count, last_increment)
		VALUES (demo_id, 25, now())
		ON CONFLICT (user_id) DO UPDATE SET item_count = 25, last_increment = now();

	-- Pick 5 existing players with usernames as friends so the
	-- sounder + leaderboard tabs show real activity. Exclude
	-- is_test = true accounts.
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

	INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
		VALUES (demo_id, 'first_friend', 5, 0), (demo_id, 'small_sounder', 5, 0)
		ON CONFLICT DO NOTHING;
END
$$;
