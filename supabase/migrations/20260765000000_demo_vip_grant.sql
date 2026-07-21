-- Test grant: Slop Club membership for the App-Review demo account
-- (demo@ticklethepig.com) so a second member client can exercise the
-- lounge (P2 two-pig verification). Same grant lane as 20260764.
-- Note: App Review will now see the member experience on this account.
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
			SELECT id FROM auth.users WHERE email = 'demo@ticklethepig.com'
		);
	GET DIAGNOSTICS granted = ROW_COUNT;
	RAISE NOTICE 'demo VIP grant: % profile(s) updated', granted;
END $$;
