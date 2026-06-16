-- Test-account grant (same pattern as 20260636 brian_test_items §1):
-- unlock the legendary aura 'northern_lights' (20260632 batch) for the
-- callmemaybe test account so it's equippable / viewable in the Closet.
-- Idempotent + no-ops on any DB where that user doesn't exist (fresh/local).
-- Wrapped in a DO block so the push log confirms whether the user was found.
DO $$
DECLARE uid uuid;
BEGIN
	SELECT id INTO uid FROM public.profiles WHERE lower(username) = 'callmemaybe';
	IF uid IS NULL THEN
		RAISE NOTICE 'callmemaybe: no matching profile — nothing granted';
	ELSE
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (uid, 'northern_lights')
			ON CONFLICT (user_id, hat_id) DO NOTHING;
		RAISE NOTICE 'callmemaybe (%): northern_lights granted (or already owned)', uid;
	END IF;
END $$;
