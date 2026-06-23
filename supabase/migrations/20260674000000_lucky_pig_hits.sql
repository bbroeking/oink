-- FIX: the "Lucky Pig" quests never counted. Users SEE a Lucky Pig from the ~5%
-- CLIENT roll (hooks/useLuckyPig.ts -> components/Barn.tsx), but the quests that
-- count "lucky pigs" (the lucky_hog weekly bounty "Hit a Lucky Pig this week" and
-- the lucky_lover achievement "Hit 5 Lucky Pigs") read public.daily_lucky_claims —
-- the UNRELATED, rare daily lucky-NUMBER mechanic. The two are disjoint, so getting
-- a Lucky Pig never advanced the quests.
--
-- FIX: record each client lucky-pig trigger in a NEW table public.lucky_pig_hits
-- (via record_lucky_pig_hit, called from Barn.tsx), leave daily_lucky_claims (and
-- its feed + the ~8 EXISTS gates that read it) UNTOUCHED, and make the quest COUNT
-- functions count BOTH sources. The two existing AFTER-INSERT trigger functions
-- (daily_lucky_achievement_check, daily_lucky_claims_bounty_check) use only
-- NEW.user_id, so we reuse them on lucky_pig_hits to fire the same checks.
--
-- CARRY-LATEST: try_claim_achievements / my_achievements carried verbatim from
-- 20260559; my_weekly_bounties from 20260558. Only the lucky-count subquery changes
-- in each (count daily_lucky_claims + lucky_pig_hits). notify_ready_bounties is left
-- as-is (push-readiness still keys off lucky-number claims; the bounty PROGRESS +
-- CLAIM come from my_weekly_bounties, which is fixed here).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. lucky_pig_hits — one row per client-rolled Lucky Pig
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.lucky_pig_hits (
	id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lucky_pig_hits_user_idx
	ON public.lucky_pig_hits (user_id, claimed_at DESC);
ALTER TABLE public.lucky_pig_hits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view own lucky pig hits" ON public.lucky_pig_hits;
CREATE POLICY "view own lucky pig hits" ON public.lucky_pig_hits
	FOR SELECT USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. record_lucky_pig_hit — Barn.tsx calls this when the 5% roll fires
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.record_lucky_pig_hit()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	INSERT INTO public.lucky_pig_hits (user_id) VALUES (caller_id);
	RETURN jsonb_build_object('ok', true);
END; $function$;
GRANT EXECUTE ON FUNCTION public.record_lucky_pig_hit() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. try_claim_achievements — carried from 20260559 + lucky_count counts pig hits
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.try_claim_achievements(
	target_user_id uuid,
	cat text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	current_progress int;
	a                record;
	claims_made      int := 0;
	new_level        int;
	level_diff       int;
	bonus_snouts     int;
BEGIN
	-- Each category resolves to a non-negative integer.
	-- alignment_negative reads abs(alignment_max_neg) so the
	-- threshold compares on magnitude (100 means "reached -100").
	current_progress := CASE cat
		WHEN 'trade_giver'        THEN public.trade_given_total(target_user_id)
		WHEN 'trade_receiver'     THEN public.trade_received_total(target_user_id)
		WHEN 'bless_distinct'     THEN (
			SELECT COUNT(DISTINCT receiver_id)::int
			FROM public.blessings WHERE sender_id = target_user_id)
		WHEN 'curse_distinct'     THEN (
			SELECT COUNT(DISTINCT receiver_id)::int
			FROM public.curses    WHERE sender_id = target_user_id)
		WHEN 'alignment_positive' THEN
			GREATEST(0, COALESCE(
				(SELECT alignment_max_pos FROM public.profiles WHERE id = target_user_id),
				0))
		WHEN 'alignment_negative' THEN
			GREATEST(0, -COALESCE(
				(SELECT alignment_max_neg FROM public.profiles WHERE id = target_user_id),
				0))
		WHEN 'blessings_received' THEN (
			SELECT COUNT(*)::int FROM public.blessings WHERE receiver_id = target_user_id)
		WHEN 'friend_count'       THEN (
			SELECT COUNT(*)::int FROM public.friendships
			WHERE status = 'accepted'
			  AND (requester_id = target_user_id OR receiver_id = target_user_id))
		WHEN 'lucky_count'        THEN (
			(SELECT COUNT(*)::int FROM public.daily_lucky_claims WHERE user_id = target_user_id)
			+ (SELECT COUNT(*)::int FROM public.lucky_pig_hits WHERE user_id = target_user_id))
		ELSE 0
	END;

	FOR a IN
		SELECT * FROM public.achievements
		WHERE category = cat
		ORDER BY tier ASC
	LOOP
		IF current_progress < a.threshold THEN EXIT; END IF;

		-- Top-tier infinite leveling
		IF a.is_top_tier THEN
			new_level := GREATEST(0, FLOOR(LOG(2, GREATEST(1, current_progress::numeric / a.threshold)))::int);
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, new_level)
				ON CONFLICT (user_id, achievement_id) DO NOTHING;
			SELECT level INTO level_diff FROM public.user_achievements
				WHERE user_id = target_user_id AND achievement_id = a.id;
			IF level_diff IS NULL THEN level_diff := 0; END IF;
			IF new_level > level_diff THEN
				bonus_snouts := (new_level - level_diff) * 500;
				UPDATE public.user_achievements
					SET level = new_level, progress = current_progress
					WHERE user_id = target_user_id AND achievement_id = a.id;
				UPDATE public.profiles SET counter = counter + bonus_snouts
					WHERE id = target_user_id;
				claims_made := claims_made + (new_level - level_diff);
			END IF;
		END IF;

		-- Brand-new claim → grant rewards once.
		IF NOT EXISTS (
			SELECT 1 FROM public.user_achievements
			WHERE user_id = target_user_id AND achievement_id = a.id
		) THEN
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, 0);
			IF a.reward_title_id IS NOT NULL THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (target_user_id, a.reward_title_id)
					ON CONFLICT DO NOTHING;
			END IF;
			IF a.reward_item_id IS NOT NULL THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (target_user_id, a.reward_item_id)
					ON CONFLICT DO NOTHING;
			END IF;
			IF a.reward_snouts > 0 THEN
				UPDATE public.profiles
					SET counter = counter + a.reward_snouts
					WHERE id = target_user_id;
			END IF;
			claims_made := claims_made + 1;
		END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'claims_made', claims_made, 'progress', current_progress);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.try_claim_achievements(uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. my_achievements — carried from 20260559 + lucky_count counts pig hits
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE (
	id               text,
	category         text,
	display_category text,
	tier             int,
	name             text,
	description      text,
	threshold        int,
	reward_title_id  text,
	reward_item_id   text,
	reward_snouts    int,
	icon             text,
	display_order    int,
	is_top_tier      boolean,
	progress         int,
	claimed          boolean,
	level            int,
	viewed_at        timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH me AS (SELECT auth.uid() AS uid),
	p AS (
		SELECT alignment_max_pos AS amp, alignment_max_neg AS amn
		FROM public.profiles, me
		WHERE public.profiles.id = me.uid
	)
	SELECT
		a.id, a.category, a.display_category, a.tier, a.name, a.description, a.threshold,
		a.reward_title_id, a.reward_item_id, a.reward_snouts, a.icon, a.display_order,
		a.is_top_tier,
		COALESCE(
			ua.progress,
			CASE a.category
				WHEN 'trade_giver'        THEN public.trade_given_total((SELECT uid FROM me))
				WHEN 'trade_receiver'     THEN public.trade_received_total((SELECT uid FROM me))
				WHEN 'bless_distinct'     THEN (SELECT COUNT(DISTINCT b.receiver_id)::int FROM public.blessings b, me WHERE b.sender_id = me.uid)
				WHEN 'curse_distinct'     THEN (SELECT COUNT(DISTINCT c.receiver_id)::int FROM public.curses c, me WHERE c.sender_id = me.uid)
				WHEN 'alignment_positive' THEN GREATEST(0, COALESCE((SELECT amp FROM p), 0))
				WHEN 'alignment_negative' THEN GREATEST(0, -COALESCE((SELECT amn FROM p), 0))
				WHEN 'blessings_received' THEN (SELECT COUNT(*)::int FROM public.blessings b, me WHERE b.receiver_id = me.uid)
				WHEN 'friend_count'       THEN (SELECT COUNT(*)::int FROM public.friendships f, me WHERE f.status='accepted' AND (f.requester_id = me.uid OR f.receiver_id = me.uid))
				WHEN 'lucky_count'        THEN ((SELECT COUNT(*)::int FROM public.daily_lucky_claims dlc, me WHERE dlc.user_id = me.uid) + (SELECT COUNT(*)::int FROM public.lucky_pig_hits lph, me WHERE lph.user_id = me.uid))
				ELSE 0
			END
		)::int AS progress,
		(ua.user_id IS NOT NULL) AS claimed,
		COALESCE(ua.level, 0) AS level,
		ua.viewed_at
	FROM public.achievements a
	LEFT JOIN public.user_achievements ua
		ON ua.achievement_id = a.id AND ua.user_id = (SELECT uid FROM me)
	ORDER BY a.display_order;
$function$;

GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. my_weekly_bounties — carried from 20260558 + n_lucky counts pig hits
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_weekly_bounties()
RETURNS TABLE (
	code          text,
	slot_code     text,
	rerolled      boolean,
	name          text,
	description   text,
	goal          int,
	progress      int,
	reward_snouts int,
	claimed       boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	wk_start   date := public.current_week_start();
	wk_ts      timestamptz := wk_start::timestamptz;
	week_num   int := EXTRACT(WEEK FROM (now() AT TIME ZONE 'UTC'))::int;
	rot        int;
	pool_size  int := 11;
	-- live counters
	n_fulfilled         int := 0;  -- trades I gave (fulfilled others)
	n_received          int := 0;  -- my requests that got fulfilled
	n_blessings_sent    int := 0;  -- blessings I sent
	n_curses_sent       int := 0;  -- curses I sent
	n_blessings_recv    int := 0;  -- blessings I received
	n_distinct_partners int := 0;  -- distinct trade partners
	n_distinct_blessed  int := 0;  -- distinct friends I blessed
	n_distinct_cursed   int := 0;  -- distinct friends I cursed
	n_lucky             int := 0;  -- Lucky Pig claims this week
	n_cleansed          int := 0;  -- curses I cleansed (paid for) this week
BEGIN
	IF caller_id IS NULL THEN RETURN; END IF;

	SELECT COUNT(*) INTO n_fulfilled FROM public.tickle_trades
		WHERE target_id = caller_id AND status = 'fulfilled' AND fulfilled_at >= wk_ts;
	SELECT COUNT(*) INTO n_received FROM public.tickle_trades
		WHERE requester_id = caller_id AND status = 'fulfilled' AND fulfilled_at >= wk_ts;
	SELECT COUNT(*) INTO n_blessings_sent FROM public.blessings
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(*) INTO n_curses_sent FROM public.curses
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(*) INTO n_blessings_recv FROM public.blessings
		WHERE receiver_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(DISTINCT partner) INTO n_distinct_partners FROM (
		SELECT CASE WHEN requester_id = caller_id THEN target_id
		            ELSE requester_id END AS partner
			FROM public.tickle_trades
			WHERE (requester_id = caller_id OR target_id = caller_id)
			  AND status = 'fulfilled' AND created_at >= wk_ts
	) p;
	SELECT COUNT(DISTINCT receiver_id) INTO n_distinct_blessed FROM public.blessings
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(DISTINCT receiver_id) INTO n_distinct_cursed FROM public.curses
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT (SELECT COUNT(*) FROM public.daily_lucky_claims WHERE user_id = caller_id AND claimed_at >= wk_ts)
	     + (SELECT COUNT(*) FROM public.lucky_pig_hits     WHERE user_id = caller_id AND claimed_at >= wk_ts)
	  INTO n_lucky;
	-- Cleanses I performed (where my own incoming curses got cleared
	-- this week — cleared_at is set by cleanse_curses RPC).
	SELECT COUNT(*) INTO n_cleansed FROM public.curses
		WHERE receiver_id = caller_id
		  AND cleared_at IS NOT NULL
		  AND cleared_at >= wk_ts;

	rot := week_num % pool_size;

	RETURN QUERY
	WITH pool(idx, code, name, description, goal, progress, reward_snouts) AS (
		VALUES
		(0,  'generous_hoof',   'Generous Hoof',   'Fulfill 3 trade requests this week.',          3, n_fulfilled,         150),
		(1,  'well_asked',      'Asked & Answered','Have 3 of your requests fulfilled this week.', 3, n_received,          200),
		(2,  'daily_light',     'Daily Light',     'Send 5 blessings this week.',                  5, n_blessings_sent,    100),
		(3,  'mischief_maker',  'Mischief Maker',  'Send 5 curses this week.',                     5, n_curses_sent,       100),
		(4,  'even_hand',       'Even Hand',       'Give 2 trades and receive 2 this week.',       4, LEAST(n_fulfilled,2) + LEAST(n_received,2), 150),
		(5,  'social_butterfly','Social Butterfly','Trade with 3 different friends this week.',    3, n_distinct_partners, 200),
		(6,  'lucky_hog',       'Lucky Hog',       'Hit a Lucky Pig this week.',                   1, n_lucky,             100),
		(7,  'got_blessed',     'Well-Wished',     'Receive 2 blessings this week.',               2, n_blessings_recv,    100),
		(8,  'cleanser',        'Cleanser',        'Cleanse a curse this week.',                   1, n_cleansed,           75),
		(9,  'bless_distinct',  'Patron',          'Bless 3 different friends this week.',         3, n_distinct_blessed,  150),
		(10, 'curse_distinct',  'Hexsmith',        'Curse 3 different friends this week.',         3, n_distinct_cursed,   150)
	),
	rotation AS (
		SELECT pl.code AS slot_code, pl.idx
		FROM pool pl
		WHERE pl.idx IN (rot, (rot + 1) % pool_size, (rot + 2) % pool_size)
	),
	resolved AS (
		SELECT
			r.slot_code,
			COALESCE(rr.new_code, r.slot_code) AS visible_code,
			(rr.new_code IS NOT NULL) AS rerolled
		FROM rotation r
		LEFT JOIN public.user_bounty_rerolls rr
			ON rr.user_id = caller_id
		   AND rr.week_start = wk_start
		   AND rr.slot_code = r.slot_code
	)
	SELECT
		pl.code, res.slot_code, res.rerolled,
		pl.name, pl.description, pl.goal,
		LEAST(pl.progress, pl.goal),
		pl.reward_snouts,
		EXISTS (
			SELECT 1 FROM public.user_bounty_claims ubc
			WHERE ubc.user_id = caller_id
			  AND ubc.bounty_code = pl.code
			  AND ubc.week_start = wk_start
		)
	FROM resolved res
	JOIN pool pl ON pl.code = res.visible_code
	ORDER BY pl.idx;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_weekly_bounties() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Fire the same achievement + bounty checks on a lucky-pig hit (reuse the
--    existing trigger fns — both use only NEW.user_id).
-- ════════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS lucky_pig_hits_achievements ON public.lucky_pig_hits;
CREATE TRIGGER lucky_pig_hits_achievements
	AFTER INSERT ON public.lucky_pig_hits
	FOR EACH ROW EXECUTE FUNCTION public.daily_lucky_achievement_check();

DROP TRIGGER IF EXISTS lucky_pig_hits_bounty ON public.lucky_pig_hits;
CREATE TRIGGER lucky_pig_hits_bounty
	AFTER INSERT ON public.lucky_pig_hits
	FOR EACH ROW EXECUTE FUNCTION public.daily_lucky_claims_bounty_check();
