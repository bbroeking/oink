-- Founder test grant: Slop Club membership for the arena account.
--
-- Data-only. Uses the referral-grant lane (20260680): is_vip = true +
-- slop_club_grant_until set, vip_until left NULL — the nightly
-- slop-club-referral-grant-expiry cron only clears PURE-GRANT users whose
-- grant_until has lapsed, so a 1-year grant survives the sweep and the RC
-- webhook (which keys store subs on vip_until) never touches it.
--
-- Targeted by auth email prefix so an Apple private-relay address can't
-- silently miss; the NOTICE reports how many rows matched (expect 1).

DO $$
DECLARE
	granted int;
BEGIN
	UPDATE public.profiles
		SET is_vip = true,
		    slop_club_grant_until = GREATEST(
		    	now() + interval '1 year',
		    	COALESCE(slop_club_grant_until, now())
		    )
		WHERE id IN (
			SELECT id FROM auth.users
			WHERE email ILIKE 'iamactuallyinthearena@%'
		);
	GET DIAGNOSTICS granted = ROW_COUNT;
	RAISE NOTICE 'arena VIP grant: % profile(s) updated', granted;
END $$;
