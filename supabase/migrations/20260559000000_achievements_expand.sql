-- Expand the achievement catalog from 8 trade-based ladders to a
-- 17-achievement set across 3 display categories (Generous, Greedy,
-- Social) matching the new achievements page design.
--
-- Reuses the existing claim machinery (try_claim_achievements +
-- auto-grant on threshold + viewed_at acknowledgment). Adds 7 new
-- progress categories so the function knows how to read each new
-- ladder's underlying counter, plus 4 new triggers (blessings,
-- curses, profiles.alignment*, friendships, daily_lucky_claims) so
-- the right achievement-claim check fires on every relevant write.
--
-- The existing 8 trade achievements are RENAMED (not removed) to
-- match the mockup ("Open Hoof" → "Open Hand", "Snout Saint" →
-- "Free Trotter"). The achievement_id PKs are unchanged so user
-- claim history persists.

set check_function_bodies = off;

-- ── 1. New display_category column ───────────────────────────────
-- Decouples the technical `category` (which the claim engine
-- switches on to find the right counter) from the player-facing
-- group ("Generous", "Greedy", "Social"). Multiple categories can
-- live under the same display group.
ALTER TABLE public.achievements
	ADD COLUMN IF NOT EXISTS display_category text NOT NULL DEFAULT 'generous';

-- Backfill the original 8 by category.
UPDATE public.achievements SET display_category = 'generous' WHERE category = 'trade_giver';
UPDATE public.achievements SET display_category = 'greedy'   WHERE category = 'trade_receiver';

-- ── 2. New reward titles (achievement-source) ─────────────────────
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	-- Renamed trade titles (replace open_hoof, snout_saint)
	('open_hand',       'Open Hand',       'pre', 'Fulfilled 10 trades.',         'achievement', false, 320),
	('free_trotter',    'Free Trotter',    'pre', 'Fulfilled 50 trades.',         'achievement', false, 321),
	-- Generous new
	('soft_heart',      'Soft Heart',      'pre', 'Blessed 25 different friends.','achievement', false, 322),
	('saint',           'Saint',           'pre', 'Hit +75 alignment.',           'achievement', false, 323),
	('halo_bearer',     'Halo Bearer',     'pre', 'Hit +100 alignment.',          'achievement', false, 324),
	-- Greedy new
	('hexsmith',        'Hexsmith',        'pre', 'Cursed 25 different friends.', 'achievement', false, 325),
	('lucky_lover',     'Lucky Lover',     'pre', 'Hit 5 Lucky Pigs.',            'achievement', false, 326),
	('goblin_king',     'Goblin King',     'pre', 'Hit -100 alignment.',          'achievement', false, 327),
	-- Social new
	('sounder_builder', 'Sounder Builder', 'pre', 'Built a sounder of 5.',        'achievement', false, 328),
	('full_sounder',    'Full Sounder',    'pre', 'A full sounder of 100.',       'achievement', false, 329)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Rename existing 8 to match mockup ─────────────────────────
-- Keep their IDs intact (claim history relies on them); update
-- name / description / reward_title_id to point at the new titles.
UPDATE public.achievements
	SET name = 'Open Hand', description = 'Fulfill 10 trades.',
	    reward_title_id = 'open_hand'
	WHERE id = 'generous_t1';
UPDATE public.achievements
	SET name = 'Free Trotter', description = 'Fulfill 50 trades.',
	    reward_title_id = 'free_trotter'
	WHERE id = 'generous_t2';
UPDATE public.achievements
	SET name = 'Bacon Bountiful', description = 'Fulfill 250 trades.'
	WHERE id = 'generous_t3';
UPDATE public.achievements
	SET name = 'Hog of Hearts', description = 'Fulfill 1000 trades.'
	WHERE id = 'generous_t4';
UPDATE public.achievements
	SET name = 'Hungry Hog', description = 'Have 10 of your requests fulfilled.'
	WHERE id = 'greedy_t1';
UPDATE public.achievements
	SET name = 'Trough Sniffer', description = 'Have 50 of your requests fulfilled.'
	WHERE id = 'greedy_t2';
UPDATE public.achievements
	SET name = 'Bottomless', description = 'Have 250 of your requests fulfilled.'
	WHERE id = 'greedy_t3';
UPDATE public.achievements
	SET name = 'Glutton King', description = 'Have 1000 of your requests fulfilled.'
	WHERE id = 'greedy_t4';

-- ── 4. The 9 new achievements ────────────────────────────────────
INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES
	-- Generous: bless distinct friends + alignment milestones
	('soft_heart',   'bless_distinct',     1, 'Soft Heart',   'Bless 25 different friends.',
	 25, 'soft_heart',   NULL,         200, '💗', 130, false, 'generous'),
	('saint',        'alignment_positive', 1, 'Saint',        'Hit +75 alignment.',
	 75, 'saint',        NULL,         300, '✦', 131, false, 'generous'),
	('halo_bearer',  'alignment_positive', 2, 'Halo Bearer',  'Hit +100 alignment.',
	 100,'halo_bearer',  'halo',       500, '😇', 132, true,  'generous'),

	-- Greedy: curse distinct + lucky volume + alignment milestone
	('hexsmith',     'curse_distinct',     1, 'Hexsmith',     'Curse 25 different friends.',
	 25, 'hexsmith',     NULL,         200, '☁', 140, false, 'greedy'),
	('lucky_lover',  'lucky_count',        1, 'Lucky Lover',  'Hit 5 Lucky Pigs.',
	 5,  'lucky_lover',  'pizza_slice',150, '✨', 141, false, 'greedy'),
	('goblin_king',  'alignment_negative', 1, 'Goblin King',  'Hit -100 alignment.',
	 100,'goblin_king',  'devil_horns',500, '👹', 142, true,  'greedy'),

	-- Social: sounder size + blessings received
	('first_friend',  'friend_count',        1, 'First Friend',
	 'Add your first friend.',
	 1,   NULL,             NULL, 25,  '🤝', 150, false, 'social'),
	('small_sounder', 'friend_count',        2, 'Small Sounder',
	 '5 friends in your sounder.',
	 5,   'sounder_builder', NULL, 100, '👥', 151, false, 'social'),
	('growing_herd',  'friend_count',        3, 'Growing Herd',
	 '20 friends in your sounder.',
	 20,  NULL,              NULL, 250, '👫', 152, false, 'social'),
	('full_sounder',  'friend_count',        4, 'Full Sounder',
	 'A full sounder of 100.',
	 100, 'full_sounder',    NULL, 500, '🐷', 153, true,  'social'),
	('well_wished',   'blessings_received',  1, 'Well-Wished',
	 'Receive 10 blessings.',
	 10,  NULL,              NULL, 100, '✦', 154, false, 'social')
ON CONFLICT (id) DO NOTHING;

-- ── 5. Rewritten try_claim_achievements — knows all 9 categories ─
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
			SELECT COUNT(*)::int FROM public.daily_lucky_claims
			WHERE user_id = target_user_id)
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

-- ── 6. Triggers for the new categories ───────────────────────────
-- Blessings: fires bless_distinct (sender) + blessings_received (receiver)
CREATE OR REPLACE FUNCTION public.blessings_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
	BEGIN PERFORM public.try_claim_achievements(NEW.sender_id,   'bless_distinct');     EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM public.try_claim_achievements(NEW.receiver_id, 'blessings_received'); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS blessings_achievements ON public.blessings;
CREATE TRIGGER blessings_achievements
	AFTER INSERT ON public.blessings
	FOR EACH ROW EXECUTE FUNCTION public.blessings_achievement_check();

-- Curses: fires curse_distinct (sender)
CREATE OR REPLACE FUNCTION public.curses_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
	BEGIN PERFORM public.try_claim_achievements(NEW.sender_id, 'curse_distinct'); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS curses_achievements ON public.curses;
CREATE TRIGGER curses_achievements
	AFTER INSERT ON public.curses
	FOR EACH ROW EXECUTE FUNCTION public.curses_achievement_check();

-- Friendships: fires friend_count for both sides on acceptance.
CREATE OR REPLACE FUNCTION public.friendships_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
	IF NEW.status = 'accepted'
	   AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
		BEGIN PERFORM public.try_claim_achievements(NEW.requester_id, 'friend_count'); EXCEPTION WHEN OTHERS THEN NULL; END;
		BEGIN PERFORM public.try_claim_achievements(NEW.receiver_id,  'friend_count'); EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS friendships_achievements ON public.friendships;
CREATE TRIGGER friendships_achievements
	AFTER INSERT OR UPDATE OF status ON public.friendships
	FOR EACH ROW EXECUTE FUNCTION public.friendships_achievement_check();

-- Profiles: fires alignment_positive / alignment_negative on
-- alignment_max_pos / alignment_max_neg changes (which the
-- existing alignment_notifications RPC updates).
CREATE OR REPLACE FUNCTION public.profiles_alignment_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
	IF NEW.alignment_max_pos IS DISTINCT FROM OLD.alignment_max_pos THEN
		BEGIN PERFORM public.try_claim_achievements(NEW.id, 'alignment_positive'); EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	IF NEW.alignment_max_neg IS DISTINCT FROM OLD.alignment_max_neg THEN
		BEGIN PERFORM public.try_claim_achievements(NEW.id, 'alignment_negative'); EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS profiles_alignment_achievements ON public.profiles;
CREATE TRIGGER profiles_alignment_achievements
	AFTER UPDATE OF alignment_max_pos, alignment_max_neg ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_alignment_achievement_check();

-- Daily lucky claims: fires lucky_count.
CREATE OR REPLACE FUNCTION public.daily_lucky_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
	BEGIN PERFORM public.try_claim_achievements(NEW.user_id, 'lucky_count'); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS daily_lucky_achievements ON public.daily_lucky_claims;
CREATE TRIGGER daily_lucky_achievements
	AFTER INSERT ON public.daily_lucky_claims
	FOR EACH ROW EXECUTE FUNCTION public.daily_lucky_achievement_check();

-- ── 7. my_achievements RPC — return display_category too ─────────
-- The page filters by display group; carry the field through so
-- the client doesn't have to second-lookup the catalog. Written
-- in LANGUAGE sql to avoid the plpgsql OUT-param name collision
-- with profiles.id in the subquery (the OUT param `id` shadowed
-- the column reference).
DROP FUNCTION IF EXISTS public.my_achievements();
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
				WHEN 'lucky_count'        THEN (SELECT COUNT(*)::int FROM public.daily_lucky_claims dlc, me WHERE dlc.user_id = me.uid)
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

-- ── 8. Retroactive backfill ──────────────────────────────────────
-- Existing users who hit a new ladder's threshold historically (e.g.
-- already have 5+ Lucky Pig claims, already have 1+ friend) should
-- get the achievement granted now, not wait for their next relevant
-- action to trigger the check. Iterate every user × new category;
-- try_claim_achievements is idempotent so categories that don't
-- apply (or were already claimed) are cheap no-ops.
DO $$
DECLARE
	u uuid;
	cats text[] := ARRAY[
		'bless_distinct', 'curse_distinct',
		'alignment_positive', 'alignment_negative',
		'blessings_received', 'friend_count', 'lucky_count'
	];
	c text;
BEGIN
	FOR u IN SELECT id FROM auth.users LOOP
		FOREACH c IN ARRAY cats LOOP
			BEGIN PERFORM public.try_claim_achievements(u, c); EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END LOOP;
END
$$;
