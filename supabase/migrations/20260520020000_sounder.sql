-- The Sounder — referral program.
--
-- A "sounder" is the canonical collective noun for pigs. Each user has
-- ONE sounder: the set of users who joined the app via their invite
-- link and engaged enough to count.
--
-- Lifecycle (per referee):
--   signup   — referee joined via a referrer's invite link. Both get
--              +100 snouts. Recorded once via attribute_referral().
--   engaged  — referee reached tickles_earned >= 50 (genuine play).
--              Both get +500 snouts. Referrer also crosses any title
--              threshold this brings them past (Sounder Initiate at 1
--              engaged, Sounder Scout at 3, Ambassador at 5, Drove
--              Captain at 10, Sounder Sovereign at 25, Crown Hog at 50).
--
-- Anti-abuse: signup milestone is idempotent (UNIQUE on (referee_id,
-- milestone)); engaged requires honest tickles_earned which is the
-- same value the leaderboard uses, so faking it is faking the
-- leaderboard.

-- ── 1. Attribution column ─────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx
	ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

-- ── 2. Milestone payouts table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_milestones (
	id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	referrer_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	referee_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	milestone       text        NOT NULL CHECK (milestone IN ('signup', 'engaged')),
	granted_at      timestamptz NOT NULL DEFAULT now(),
	snouts_referrer int         NOT NULL DEFAULT 0,
	snouts_referee  int         NOT NULL DEFAULT 0,
	UNIQUE (referee_id, milestone)
);

CREATE INDEX IF NOT EXISTS referral_milestones_referrer_idx
	ON public.referral_milestones (referrer_id, milestone);

ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own referral payouts" ON public.referral_milestones;
CREATE POLICY "View own referral payouts"
	ON public.referral_milestones FOR SELECT
	USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- ── 3. Extend titles.source CHECK to include 'sounder' + seed ─────
ALTER TABLE public.titles DROP CONSTRAINT IF EXISTS titles_source_check;
ALTER TABLE public.titles
	ADD CONSTRAINT titles_source_check
	CHECK (source IS NULL OR source IN ('battle_pass', 'shop', 'lucky', 'sounder'));

INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('sounder_initiate', 'Sounder Initiate', 'pre',  'First one in the pen.',                       'sounder', false, 200),
	('sounder_scout',    'Sounder Scout',    'pre',  'A small drove follows you.',                  'sounder', false, 201),
	('ambassador',       'Ambassador',       'pre',  'Welcomes new pigs to the pen.',               'sounder', false, 202),
	('drove_captain',    'Drove Captain',    'pre',  'Leads a proper drove.',                       'sounder', false, 203),
	('sounder_sovereign','Sounder Sovereign','pre',  'A whole sounder calls you theirs.',           'sounder', false, 204),
	('crown_hog',        'Crown Hog',        'pre',  'The big boar — fifty in your sounder.',       'sounder', false, 205)
ON CONFLICT (id) DO NOTHING;

-- ── 4. attribute_referral: caller picks a referrer at signup ──────
-- Called by app/invite.tsx the first time a brand-new account opens
-- a referral link. Idempotent (re-calling no-ops once referred_by
-- is set). Returns the referrer's id on success.
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
	caller_id   uuid := auth.uid();
	referrer_id uuid;
	existing    uuid;
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

	-- Attribute + pay both sides the signup bonus.
	UPDATE public.profiles SET referred_by = referrer_id WHERE id = caller_id;

	INSERT INTO public.referral_milestones
		(referrer_id, referee_id, milestone, snouts_referrer, snouts_referee)
		VALUES (referrer_id, caller_id, 'signup', 100, 100)
		ON CONFLICT (referee_id, milestone) DO NOTHING;

	UPDATE public.profiles SET counter = counter + 100 WHERE id = referrer_id;
	UPDATE public.profiles SET counter = counter + 100 WHERE id = caller_id;

	RETURN jsonb_build_object('ok', true, 'referrer_id', referrer_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.attribute_referral(text, text) TO authenticated;

-- ── 5. check_referral_milestones: fires after a tickles_earned bump
-- Idempotent. Pays the 'engaged' milestone the FIRST time the referee
-- crosses 50 tickles, and grants the referrer any sounder title their
-- new total crossed.
CREATE OR REPLACE FUNCTION public.check_referral_milestones(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	rec               record;
	referrer_engaged  int;
	threshold_title   text;
BEGIN
	SELECT id, tickles_earned, referred_by INTO rec
		FROM public.profiles WHERE id = target_user_id;
	IF NOT FOUND OR rec.referred_by IS NULL THEN
		RETURN jsonb_build_object('ok', true, 'paid', 0);
	END IF;

	IF rec.tickles_earned < 50 THEN
		RETURN jsonb_build_object('ok', true, 'paid', 0);
	END IF;

	-- Engaged milestone. Idempotent via the UNIQUE on (referee_id, milestone).
	IF EXISTS (
		SELECT 1 FROM public.referral_milestones
		WHERE referee_id = target_user_id AND milestone = 'engaged'
	) THEN
		RETURN jsonb_build_object('ok', true, 'paid', 0);
	END IF;

	INSERT INTO public.referral_milestones
		(referrer_id, referee_id, milestone, snouts_referrer, snouts_referee)
		VALUES (rec.referred_by, target_user_id, 'engaged', 500, 500);

	UPDATE public.profiles SET counter = counter + 500 WHERE id = rec.referred_by;
	UPDATE public.profiles SET counter = counter + 500 WHERE id = target_user_id;

	-- Title ladder: grant whatever the referrer's NEW total just crossed.
	SELECT count(*) INTO referrer_engaged
		FROM public.referral_milestones
		WHERE referrer_id = rec.referred_by AND milestone = 'engaged';

	threshold_title := CASE
		WHEN referrer_engaged >= 50 THEN 'crown_hog'
		WHEN referrer_engaged >= 25 THEN 'sounder_sovereign'
		WHEN referrer_engaged >= 10 THEN 'drove_captain'
		WHEN referrer_engaged >= 5  THEN 'ambassador'
		WHEN referrer_engaged >= 3  THEN 'sounder_scout'
		WHEN referrer_engaged >= 1  THEN 'sounder_initiate'
		ELSE NULL
	END;

	IF threshold_title IS NOT NULL THEN
		INSERT INTO public.user_titles (user_id, title_id)
			VALUES (rec.referred_by, threshold_title)
			ON CONFLICT (user_id, title_id) DO NOTHING;
	END IF;

	RETURN jsonb_build_object(
		'ok', true, 'paid', 1,
		'referrer_engaged', referrer_engaged,
		'title', threshold_title
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_referral_milestones(uuid) TO authenticated;

-- ── 6. Trigger: fire the milestone check the first time tickles_earned
--      crosses 50. Saves the client from polling.
CREATE OR REPLACE FUNCTION public.trigger_referral_milestone_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.tickles_earned >= 50
	   AND (OLD.tickles_earned IS NULL OR OLD.tickles_earned < 50)
	   AND NEW.referred_by IS NOT NULL THEN
		PERFORM public.check_referral_milestones(NEW.id);
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_referral_milestone_check ON public.profiles;
CREATE TRIGGER profiles_referral_milestone_check
	AFTER UPDATE OF tickles_earned ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.trigger_referral_milestone_check();

-- ── 7. sounder_leaderboard ────────────────────────────────────────
-- Top recruiters by engaged-referee count. UI calls with limit_n.
CREATE OR REPLACE FUNCTION public.sounder_leaderboard(limit_n int DEFAULT 20)
RETURNS TABLE (
	rank           bigint,
	user_id        uuid,
	username       text,
	discriminator  text,
	engaged_count  int,
	active_title_id text,
	is_self        boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH counts AS (
		SELECT referrer_id, COUNT(*)::int AS engaged_count
		FROM public.referral_milestones
		WHERE milestone = 'engaged'
		GROUP BY referrer_id
	)
	SELECT
		ROW_NUMBER() OVER (ORDER BY counts.engaged_count DESC, p.username) AS rank,
		p.id,
		p.username,
		p.discriminator,
		counts.engaged_count,
		p.active_title_id,
		p.id = auth.uid() AS is_self
	FROM counts
	JOIN public.profiles p ON p.id = counts.referrer_id
	ORDER BY counts.engaged_count DESC, p.username
	LIMIT GREATEST(1, LEAST(limit_n, 100));
$function$;

GRANT EXECUTE ON FUNCTION public.sounder_leaderboard(int) TO authenticated;

-- ── 8. my_sounder: caller's own stats + next-title progress ───────
CREATE OR REPLACE FUNCTION public.my_sounder()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	engaged_count  int;
	signup_count   int;
	my_rank        bigint;
	next_threshold int;
	next_title     text;
	thresholds     int[] := ARRAY[1, 3, 5, 10, 25, 50];
	t              int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT COUNT(*) FILTER (WHERE milestone = 'engaged')::int,
	       COUNT(*) FILTER (WHERE milestone = 'signup')::int
		INTO engaged_count, signup_count
		FROM public.referral_milestones
		WHERE referrer_id = caller_id;

	-- Rank: 1 + number of users with strictly more engaged referees
	SELECT 1 + COUNT(*) INTO my_rank FROM (
		SELECT referrer_id
		FROM public.referral_milestones
		WHERE milestone = 'engaged'
		GROUP BY referrer_id
		HAVING COUNT(*) > engaged_count
	) higher;

	-- If caller has zero engaged, rank is technically "unranked"
	IF engaged_count = 0 THEN my_rank := NULL; END IF;

	next_threshold := NULL;
	FOREACH t IN ARRAY thresholds LOOP
		IF engaged_count < t THEN
			next_threshold := t;
			EXIT;
		END IF;
	END LOOP;

	next_title := CASE next_threshold
		WHEN 1 THEN 'Sounder Initiate'
		WHEN 3 THEN 'Sounder Scout'
		WHEN 5 THEN 'Ambassador'
		WHEN 10 THEN 'Drove Captain'
		WHEN 25 THEN 'Sounder Sovereign'
		WHEN 50 THEN 'Crown Hog'
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

GRANT EXECUTE ON FUNCTION public.my_sounder() TO authenticated;
