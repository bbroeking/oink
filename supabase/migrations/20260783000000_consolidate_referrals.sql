-- Make the code-based referral lifecycle the only active referral writer.
--
-- The original username-attribution system and its 50-tickle trigger survived
-- the code-based revival. Because both systems share profiles.referred_by, a
-- code redemption could still cross the legacy trigger and mint the old
-- "engaged" rewards before the canonical 100-tickle completion paid again.
--
-- Keep referral_milestones as historical data, but retire every callable or
-- automatic entry point that can create new legacy rows. The recruiter views
-- now read the canonical profiles.referrals_completed lifecycle instead.

DROP TRIGGER IF EXISTS profiles_referral_milestone_check ON public.profiles;
DROP FUNCTION IF EXISTS public.attribute_referral(text, text);
DROP FUNCTION IF EXISTS public.check_referral_milestones(uuid);
DROP FUNCTION IF EXISTS public.trigger_referral_milestone_check();

CREATE OR REPLACE FUNCTION public.sounder_leaderboard(limit_n int DEFAULT 20)
RETURNS TABLE (
	rank            bigint,
	user_id         uuid,
	username        text,
	discriminator   text,
	engaged_count   int,
	active_title_id text,
	is_self         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT
		ROW_NUMBER() OVER (
			ORDER BY COALESCE(p.referrals_completed, 0) DESC, p.username, p.id
		) AS rank,
		p.id,
		p.username,
		p.discriminator,
		COALESCE(p.referrals_completed, 0)::int AS engaged_count,
		p.active_title_id,
		p.id = auth.uid() AS is_self
	FROM public.profiles p
	WHERE COALESCE(p.referrals_completed, 0) > 0
	ORDER BY COALESCE(p.referrals_completed, 0) DESC, p.username, p.id
	LIMIT GREATEST(1, LEAST(COALESCE(limit_n, 20), 100));
$function$;

REVOKE ALL ON FUNCTION public.sounder_leaderboard(int)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sounder_leaderboard(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_sounder()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	engaged_count   int;
	signup_count    int;
	my_rank         bigint;
	next_threshold  int;
	next_title      text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT
		COALESCE(referrals_completed, 0),
		(
			SELECT COUNT(*)::int
			FROM public.profiles referred
			WHERE referred.referred_by = caller_id
		)
	INTO engaged_count, signup_count
	FROM public.profiles
	WHERE id = caller_id;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
	END IF;

	SELECT 1 + COUNT(*) INTO my_rank
	FROM public.profiles other
	WHERE COALESCE(other.referrals_completed, 0) > engaged_count;

	IF engaged_count = 0 THEN
		my_rank := NULL;
	END IF;

	next_threshold := CASE
		WHEN engaged_count < 3    THEN 3
		WHEN engaged_count < 5    THEN 5
		WHEN engaged_count < 10   THEN 10
		WHEN engaged_count < 25   THEN 25
		WHEN engaged_count < 100  THEN 100
		WHEN engaged_count < 500  THEN 500
		WHEN engaged_count < 1000 THEN 1000
		ELSE NULL
	END;

	next_title := CASE next_threshold
		WHEN 3    THEN 'Messenger Hat'
		WHEN 5    THEN 'a free month of Slop Club'
		WHEN 10   THEN 'Sounder Caller'
		WHEN 25   THEN 'Pen Marshal'
		WHEN 100  THEN 'Pied Piper'
		WHEN 500  THEN 'Patron of the Pen'
		WHEN 1000 THEN 'Worldbringer'
		ELSE NULL
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'engaged_count', engaged_count,
		'signup_count', signup_count,
		'rank', my_rank,
		'next_threshold', next_threshold,
		'next_title', next_title
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.my_sounder()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sounder() TO authenticated;
