-- Mark certain profiles as test accounts so the client can filter
-- them out of the leaderboard (and any other public-facing roster).
--
-- The flag is intentionally NOT auto-applied to anything — it's a
-- manually-toggled "this is an admin / dev / smoke-test account,
-- don't surface them on the global Board." Friend lists + UserSheet
-- still show test accounts (you can intentionally friend Brian; if
-- you do, you want to see him). The filter only fires on the
-- global-scope leaderboard query.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Brian is the project owner's primary account; flagging it so it
-- stops appearing as the all-time leader. If/when there are other
-- test/dev accounts they get toggled with a one-line UPDATE.
UPDATE public.profiles
	SET is_test = true
	WHERE username = 'Brian';
