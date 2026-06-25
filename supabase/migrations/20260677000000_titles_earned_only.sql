-- Titles are EARNED, never bought.
--
-- 1. The 10 ex-shop titles become achievement rewards (no refund — prior buyers
--    keep theirs; the backfill auto-grants any newly-qualifying title).
-- 2. A new `tickle_volume` category (lifetime profiles.tickles_earned) so the
--    "tickle a lot" titles can be earned, with a trigger on tickles_earned.
-- 3. A small basic-achievement layer (snout rewards, no title).
-- 4. titles.for_sale=false for the 10 + buy_title() becomes a hard no-op, so a
--    stale client that still calls it gets a clean refusal instead of a spend.
-- 5. my_unclaimed_achievement_count() backs the "N ready to claim" entry badge.
--
-- Engine ladders claim in tier order and EXIT at the first unmet threshold, so
-- new rows either open a fresh category (tickle_volume) or extend an existing
-- ladder at the bottom (tier 0) / top (tier 5+) — never wedged in the middle.
--
-- Carry-latest-def: try_claim_achievements + my_achievements are carried
-- VERBATIM from 20260674 with ONLY the `tickle_volume` branch added to each
-- (see project memory: stale-base CREATE OR REPLACE silently drops features).

-- ── 1. Achievement rows (10 title rewards + basics) ─────────────────────────
-- display_category 'devotion' is new (the achievements screen adds a matching
-- filter chip). icon is keyed by achievement id in the client (trophy fallback)
-- so the column value here is incidental — kept as a short non-emoji label.
INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES
	-- Devotion — lifetime tickles (the new tickle_volume ladder, easy → prestige)
	('warming_up',   'tickle_volume', 1, 'Warming Up',      'Tickle your pig 100 times.',     100,     NULL,              NULL, 25,   'pig',   200, false, 'devotion'),
	('curly_tail_a', 'tickle_volume', 2, 'Curly Tail',      'Tickle 2,000 times.',            2000,    'curly_tail',      NULL, 100,  'pig',   201, false, 'devotion'),
	('mud_conn_a',   'tickle_volume', 3, 'Mud Connoisseur', 'Tickle 8,000 times.',            8000,    'mud_connoisseur', NULL, 150,  'pig',   202, false, 'devotion'),
	('squeal_a',     'tickle_volume', 4, 'Squeal Master',   'Tickle 40,000 times.',           40000,   'squeal_master',   NULL, 400,  'pig',   203, false, 'devotion'),
	('pork_royal_a', 'tickle_volume', 5, 'Pork Royalty',    'Tickle 300,000 times.',          300000,  'pork_royalty',    NULL, 2500, 'crown', 204, false, 'devotion'),
	('sty_sov_a',    'tickle_volume', 6, 'Sty Sovereign',   'Tickle 1,200,000 times.',        1200000, 'sty_sovereign',   NULL, 5000, 'crown', 205, true,  'devotion'),
	-- Generous — trades given + blessings cast
	('first_gift',   'trade_giver',    0, 'First Gift',     'Give your first trade.',          1,      NULL,              NULL, 50,   'gift',  206, false, 'generous'),
	('sow_supreme_a','trade_giver',    5, 'Sow Supreme',    'Give 2,500 tickles via trades.',  2500,   'sow_supreme',     NULL, 1500, 'crown', 207, false, 'generous'),
	('hog_honor_a',  'trade_giver',    6, 'Hog of Honor',   'Give 5,000 tickles via trades.',  5000,   'hog_of_honor',    NULL, 3000, 'crown', 208, false, 'generous'),
	('soft_start',   'bless_distinct', 0, 'Soft Start',     'Bless your first friend.',        1,      NULL,              NULL, 25,   'heart', 209, false, 'generous'),
	('ham_whisper_a','bless_distinct', 2, 'Ham Whisperer',  'Bless 75 different friends.',     75,     'ham_whisperer',   NULL, 600,  'heart', 210, false, 'generous'),
	-- Greedy — lucky pigs + curses cast
	('first_lucky',  'lucky_count',    0, 'First Lucky Pig','Hit your first Lucky Pig.',       1,      NULL,              NULL, 25,   'star',  211, false, 'greedy'),
	('truffle_a',    'lucky_count',    2, 'Truffle Hunter', 'Hit 30 Lucky Pigs.',              30,     'truffle_hunter',  NULL, 400,  'star',  212, false, 'greedy'),
	('notorious_a',  'curse_distinct', 2, 'Notorious P.I.G.','Curse 75 different friends.',    75,     'notorious_pig',   NULL, 600,  'cloud', 213, false, 'greedy'),
	-- Social — blessings received
	('well_blessed', 'blessings_received', 2, 'Well-Blessed','Receive 50 blessings.',          50,     NULL,              NULL, 200,  'star',  214, false, 'social')
ON CONFLICT (id) DO NOTHING;

-- ── 2. try_claim_achievements — carried VERBATIM from 20260674 + tickle_volume ──
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
		-- NEW: lifetime tickles (home + visit) drive the Devotion ladder.
		WHEN 'tickle_volume'      THEN
			GREATEST(0, COALESCE(
				(SELECT tickles_earned FROM public.profiles WHERE id = target_user_id),
				0))
		ELSE 0
	END;

	FOR a IN
		SELECT * FROM public.achievements
		WHERE category = cat
		ORDER BY tier ASC
	LOOP
		IF current_progress < a.threshold THEN EXIT; END IF;

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

-- ── 3. my_achievements — carried VERBATIM from 20260674 + tickle_volume ─────
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
				WHEN 'tickle_volume'      THEN GREATEST(0, COALESCE((SELECT tickles_earned FROM public.profiles pr, me WHERE pr.id = me.uid), 0))
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

-- ── 4. Fire the Devotion ladder when lifetime tickles change ────────────────
CREATE OR REPLACE FUNCTION public.profiles_tickle_volume_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.tickles_earned IS DISTINCT FROM OLD.tickles_earned THEN
		BEGIN
			PERFORM public.try_claim_achievements(NEW.id, 'tickle_volume');
		EXCEPTION WHEN OTHERS THEN NULL;
		END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_tickle_volume_achievements ON public.profiles;
CREATE TRIGGER profiles_tickle_volume_achievements
	AFTER UPDATE OF tickles_earned ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_tickle_volume_achievements();

-- ── 5. Badge data: count of unclaimed (earned-but-unacknowledged) achievements ─
CREATE OR REPLACE FUNCTION public.my_unclaimed_achievement_count()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COUNT(*)::int FROM public.user_achievements
	WHERE user_id = auth.uid() AND viewed_at IS NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.my_unclaimed_achievement_count() TO authenticated;

-- ── 6. Titles: stop selling the 10 + make buy_title a hard no-op ────────────
UPDATE public.titles SET for_sale = false
WHERE id IN (
	'mud_connoisseur','truffle_hunter','curly_tail','ham_whisperer','squeal_master',
	'sow_supreme','notorious_pig','pork_royalty','hog_of_honor','sty_sovereign'
);

CREATE OR REPLACE FUNCTION public.buy_title(target_title_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	-- Titles are earned, never bought (20260677). Defensive no-op so a stale
	-- client that still calls buy_title gets a clean refusal, not a spend.
	RETURN jsonb_build_object('ok', false, 'reason', 'not_for_sale');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buy_title(text) TO authenticated;

-- ── 7. Backfill — auto-grant newly-qualifying achievements to existing users ─
-- try_claim_achievements is idempotent, so re-running the touched categories is
-- safe. The user_achievements push trigger is suspended so retroactive unlocks
-- don't blast every long-time player with a burst of notifications.
ALTER TABLE public.user_achievements DISABLE TRIGGER user_achievements_push;

DO $$
DECLARE
	u    uuid;
	c    text;
	cats text[] := ARRAY[
		'tickle_volume','trade_giver','bless_distinct',
		'curse_distinct','lucky_count','blessings_received'
	];
BEGIN
	FOR u IN SELECT id FROM auth.users LOOP
		FOREACH c IN ARRAY cats LOOP
			BEGIN
				PERFORM public.try_claim_achievements(u, c);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;
		END LOOP;
	END LOOP;
END $$;

ALTER TABLE public.user_achievements ENABLE TRIGGER user_achievements_push;
