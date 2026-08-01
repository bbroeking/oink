-- PRODUCTION RELEASE STEP — run only after the pig-friends build is live.
--
-- Idempotent by campaign id. A seen announcement row acts only as the delivery
-- ledger (it will not create a duplicate While Away card); the app's one-time
-- launch ceremony is the durable in-app surface. The push tap opens Home,
-- where PigFriendsLaunchModal converts the player or opens recruitment.
--
-- Do not run as part of a migration: App Store availability is the release
-- gate, and the push must not outrun the binary.

DO $$
DECLARE
	target record;
	campaign constant text := 'pig_friends_v1';
	announcement_id bigint;
BEGIN
	FOR target IN SELECT id FROM public.profiles LOOP
		IF EXISTS (
			SELECT 1
			FROM public.system_announcements sa
			WHERE sa.user_id = target.id
				AND sa.kind = 'pig_friends_launch'
				AND sa.data->>'campaign' = campaign
		) THEN
			CONTINUE;
		END IF;

		INSERT INTO public.system_announcements (
			user_id,
			kind,
			title,
			body,
			data,
			seen_at
		)
		VALUES (
			target.id,
			'pig_friends_launch',
			'Rosie’s friends have arrived!',
			'Meet Copper, Pepper, Bandit, Pickles, and Biscuit. Join the Slop Club to get Rosie a friend.',
			jsonb_build_object('campaign', campaign, 'screen', 'home'),
			now()
		)
		RETURNING id INTO announcement_id;

		BEGIN
			PERFORM public.send_push_to_user(
				target.id,
				'Rosie’s friends have arrived!',
				'Meet the five new pigs waiting to join your Barn.',
				jsonb_build_object(
					'kind', 'pig_friends_launch',
					'campaign', campaign,
					'screen', 'home',
					'announcement_id', announcement_id::text
				)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	END LOOP;
END;
$$;
