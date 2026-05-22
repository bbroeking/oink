-- Cap referral payouts to the referrer at 100 snouts, lifetime.
--
-- attribute_referral paid the referrer 100 on every referral, with no
-- ceiling. Decision (2026-05-22): a referrer earns 100 from referrals
-- TOTAL — their first referral pays 100, and after that referrals
-- still register (the referee is attributed, gets their own 100
-- signup bonus, the referrer's sounder count still grows) but pay the
-- referrer nothing. A player's snout balance can climb past 100 from
-- other sources; referral earnings just stop accumulating.
--
-- Body is the LIVE remote definition (verified via pg_get_functiondef)
-- with only the referrer-payout cap added.

CREATE OR REPLACE FUNCTION public.attribute_referral(
	referrer_username text,
	referrer_discriminator text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id        uuid := auth.uid();
	referrer_id      uuid;
	existing         uuid;
	earned           int;
	referrer_payout  int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT id INTO referrer_id
		FROM public.profiles
		WHERE username = referrer_username
		  AND discriminator = referrer_discriminator;
	IF referrer_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'referrer_not_found');
	END IF;
	IF referrer_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
	END IF;

	SELECT referred_by INTO existing
		FROM public.profiles WHERE id = caller_id;
	IF existing IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_attributed');
	END IF;

	-- How much this referrer has already earned from referrals. The
	-- table alias + function-qualified variable disambiguate the
	-- column `referrer_id` from the plpgsql variable of the same name.
	SELECT COALESCE(SUM(rm.snouts_referrer), 0) INTO earned
		FROM public.referral_milestones rm
		WHERE rm.referrer_id = attribute_referral.referrer_id;
	referrer_payout := GREATEST(0, 100 - earned);

	-- Attribute the referee + pay both sides (referrer capped at 100).
	UPDATE public.profiles SET referred_by = referrer_id WHERE id = caller_id;

	INSERT INTO public.referral_milestones
		(referrer_id, referee_id, milestone, snouts_referrer, snouts_referee)
		VALUES (referrer_id, caller_id, 'signup', referrer_payout, 100)
		ON CONFLICT (referee_id, milestone) DO NOTHING;

	IF referrer_payout > 0 THEN
		UPDATE public.profiles SET counter = counter + referrer_payout
			WHERE id = referrer_id;
	END IF;
	UPDATE public.profiles SET counter = counter + 100 WHERE id = caller_id;

	RETURN jsonb_build_object(
		'ok', true,
		'referrer_id', referrer_id,
		'referrer_payout', referrer_payout
	);
END;
$function$;
