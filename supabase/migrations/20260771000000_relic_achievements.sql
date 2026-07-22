-- Burrow Book archaeology achievements.
--
-- Rarity semantics deliberately follow constants/uniques.ts + unique_pool():
--   rare     = music-box heart, tiny crown, petrified tickle
--   heirloom = first truffle, thin portrait
-- The trigger runs after a NEW Book entry, so duplicate found_count updates do
-- not retrigger collection achievements. Existing collectors are backfilled.

INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES (
	'burrow_archaeologist', 'Burrow Archaeologist', 'pre',
	'Completed the Season 1 Burrow Book.', 'achievement', false, 333
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES
	('muddy_trowel',          'unique_count',          1, 'Muddy Trowel',
		'Unearth your first relic from the Truffle Patch.', 1,
		NULL, NULL, 50, 'trowel', 223, false, 'the_dig'),
	('field_archaeologist',   'unique_count',          2, 'Field Archaeologist',
		'Unearth five different relics.', 5,
		NULL, NULL, 200, 'trowel', 224, false, 'the_dig'),
	('rare_relics',           'unique_rare_count',     3, 'Cabinet of Wonders',
		'Unearth every rare relic.', 3,
		NULL, NULL, 500, 'relic', 225, false, 'the_dig'),
	('first_truffle_heirloom','unique_first_truffle',  4, 'The First Course',
		'Unearth The First Truffle.', 1,
		NULL, NULL, 500, 'relic', 226, false, 'the_dig'),
	('thin_portrait_heirloom','unique_thin_portrait',  4, 'A Face from the Mud',
		'Unearth The Thin Portrait.', 1,
		NULL, NULL, 500, 'relic', 227, false, 'the_dig'),
	('burrow_book_complete',  'unique_count',          4, 'Burrow Book Complete',
		'Unearth all twelve Season 1 relics.', 12,
		'burrow_archaeologist', NULL, 1500, 'book', 228, false, 'the_dig')
ON CONFLICT (id) DO NOTHING;

-- One source of truth shared by claiming and the achievement read model.
CREATE OR REPLACE FUNCTION public.relic_achievement_progress(
	target_user_id uuid,
	cat text
)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE cat
		WHEN 'unique_count' THEN (
			SELECT COUNT(*)::int FROM public.user_uniques
			WHERE user_id = target_user_id
		)
		WHEN 'unique_rare_count' THEN (
			SELECT COUNT(*)::int FROM public.user_uniques
			WHERE user_id = target_user_id
			  AND unique_id IN ('music_box_heart', 'tiny_crown', 'petrified_tickle')
		)
		WHEN 'unique_first_truffle' THEN CASE WHEN EXISTS (
			SELECT 1 FROM public.user_uniques
			WHERE user_id = target_user_id AND unique_id = 'first_truffle'
		) THEN 1 ELSE 0 END
		WHEN 'unique_thin_portrait' THEN CASE WHEN EXISTS (
			SELECT 1 FROM public.user_uniques
			WHERE user_id = target_user_id AND unique_id = 'thin_portrait'
		) THEN 1 ELSE 0 END
		ELSE 0
	END;
$function$;
REVOKE ALL ON FUNCTION public.relic_achievement_progress(uuid, text)
	FROM PUBLIC, anon, authenticated;

-- Preserve the latest 20260714 implementation for every existing category,
-- then wrap only the four new relic categories. This avoids carrying a large,
-- easy-to-stale CASE body forward.
ALTER FUNCTION public.try_claim_achievements(uuid, text)
	RENAME TO try_claim_achievements_pre_relics;
REVOKE ALL ON FUNCTION public.try_claim_achievements_pre_relics(uuid, text)
	FROM PUBLIC, anon, authenticated;

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
BEGIN
	IF cat NOT IN (
		'unique_count', 'unique_rare_count',
		'unique_first_truffle', 'unique_thin_portrait'
	) THEN
		RETURN public.try_claim_achievements_pre_relics(target_user_id, cat);
	END IF;

	current_progress := public.relic_achievement_progress(target_user_id, cat);
	FOR a IN
		SELECT * FROM public.achievements
		WHERE category = cat
		ORDER BY threshold ASC, tier ASC
	LOOP
		IF current_progress < a.threshold THEN EXIT; END IF;
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
				UPDATE public.profiles SET counter = counter + a.reward_snouts
				WHERE id = target_user_id;
			END IF;
			claims_made := claims_made + 1;
		END IF;
	END LOOP;

	RETURN jsonb_build_object(
		'ok', true, 'claims_made', claims_made, 'progress', current_progress
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.try_claim_achievements(uuid, text) TO authenticated;

-- Keep the existing read function as the catalog/reward authority, overriding
-- only progress for the new categories so locked cards show honest live counts.
ALTER FUNCTION public.my_achievements()
	RENAME TO my_achievements_pre_relics;
REVOKE ALL ON FUNCTION public.my_achievements_pre_relics()
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE (
	id text, category text, display_category text, tier int, name text,
	description text, threshold int, reward_title_id text, reward_item_id text,
	reward_snouts int, icon text, display_order int, is_top_tier boolean,
	progress int, claimed boolean, level int, viewed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT
		r.id, r.category, r.display_category, r.tier, r.name, r.description,
		r.threshold, r.reward_title_id, r.reward_item_id, r.reward_snouts,
		r.icon, r.display_order, r.is_top_tier,
		CASE WHEN r.category IN (
			'unique_count', 'unique_rare_count',
			'unique_first_truffle', 'unique_thin_portrait'
		) THEN public.relic_achievement_progress(auth.uid(), r.category)
		ELSE r.progress END AS progress,
		r.claimed, r.level, r.viewed_at
	FROM public.my_achievements_pre_relics() r
	ORDER BY r.display_order;
$function$;
GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_uniques_achievement_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
	-- Achievement plumbing must never block the relic catch itself. Each category
	-- is isolated so one bad catalog row cannot suppress the others either.
	BEGIN PERFORM public.try_claim_achievements(NEW.user_id, 'unique_count');
	EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM public.try_claim_achievements(NEW.user_id, 'unique_rare_count');
	EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM public.try_claim_achievements(NEW.user_id, 'unique_first_truffle');
	EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM public.try_claim_achievements(NEW.user_id, 'unique_thin_portrait');
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_uniques_achievements ON public.user_uniques;
CREATE TRIGGER user_uniques_achievements
	AFTER INSERT ON public.user_uniques
	FOR EACH ROW EXECUTE FUNCTION public.user_uniques_achievement_check();

-- Existing collectors should receive anything they already earned.
DO $backfill$
DECLARE
	uuid_to_check uuid;
BEGIN
	FOR uuid_to_check IN SELECT DISTINCT user_id FROM public.user_uniques LOOP
		PERFORM public.try_claim_achievements(uuid_to_check, 'unique_count');
		PERFORM public.try_claim_achievements(uuid_to_check, 'unique_rare_count');
		PERFORM public.try_claim_achievements(uuid_to_check, 'unique_first_truffle');
		PERFORM public.try_claim_achievements(uuid_to_check, 'unique_thin_portrait');
	END LOOP;
END;
$backfill$;
