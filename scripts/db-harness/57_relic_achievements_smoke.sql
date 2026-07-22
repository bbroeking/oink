-- Smoke: archaeology achievements follow distinct Burrow Book discoveries,
-- including the rare set, both named heirlooms, and full-set title reward.
\set ON_ERROR_STOP on

DO $relic_achievements$
DECLARE
	pig uuid := '00000000-0000-0000-0000-000000057001';
	claimed_ids text[];
	book_progress int;
	rare_progress int;
	snouts int;
BEGIN
	INSERT INTO auth.users (id) VALUES (pig);
	INSERT INTO public.profiles (id, username, counter)
		VALUES (pig, 'archaeologypig', 0);

	INSERT INTO public.user_uniques (user_id, unique_id) VALUES (pig, 'old_boot');
	IF NOT EXISTS (SELECT 1 FROM public.user_achievements
		WHERE user_id = pig AND achievement_id = 'muddy_trowel') THEN
		RAISE EXCEPTION 'first relic did not award Muddy Trowel';
	END IF;

	INSERT INTO public.user_uniques (user_id, unique_id)
		VALUES (pig, 'music_box_heart'), (pig, 'tiny_crown');
	IF EXISTS (SELECT 1 FROM public.user_achievements
		WHERE user_id = pig AND achievement_id = 'rare_relics') THEN
		RAISE EXCEPTION 'rare set awarded before all three rares';
	END IF;

	INSERT INTO public.user_uniques (user_id, unique_id)
		VALUES (pig, 'first_truffle'), (pig, 'thin_portrait');
	IF (SELECT count(*) FROM public.user_achievements
		WHERE user_id = pig
		  AND achievement_id IN ('first_truffle_heirloom', 'thin_portrait_heirloom')) <> 2 THEN
		RAISE EXCEPTION 'named heirloom achievements were not both awarded';
	END IF;

	INSERT INTO public.user_uniques (user_id, unique_id) VALUES (pig, 'petrified_tickle');
	IF NOT EXISTS (SELECT 1 FROM public.user_achievements
		WHERE user_id = pig AND achievement_id = 'rare_relics') THEN
		RAISE EXCEPTION 'all three rares did not award Cabinet of Wonders';
	END IF;

	INSERT INTO public.user_uniques (user_id, unique_id)
		SELECT pig, p.unique_id FROM public.unique_pool() p
		ON CONFLICT (user_id, unique_id) DO NOTHING;

	SELECT array_agg(achievement_id ORDER BY achievement_id) INTO claimed_ids
	FROM public.user_achievements WHERE user_id = pig;
	IF (SELECT count(*) FROM public.user_achievements WHERE user_id = pig) <> 6 THEN
		RAISE EXCEPTION 'expected all 6 relic achievements, got %', claimed_ids;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_titles
		WHERE user_id = pig AND title_id = 'burrow_archaeologist') THEN
		RAISE EXCEPTION 'full Book did not award Burrow Archaeologist title';
	END IF;
	SELECT counter INTO snouts FROM public.profiles WHERE id = pig;
	IF snouts <> 3250 THEN
		RAISE EXCEPTION 'relic achievement rewards expected 3250 snouts, got %', snouts;
	END IF;

	PERFORM set_config('smoke.uid', pig::text, true);
	SELECT progress INTO book_progress FROM public.my_achievements()
		WHERE id = 'burrow_book_complete';
	SELECT progress INTO rare_progress FROM public.my_achievements()
		WHERE id = 'rare_relics';
	IF book_progress <> 12 OR rare_progress <> 3 THEN
		RAISE EXCEPTION 'read-model progress mismatch: book=% rare=%', book_progress, rare_progress;
	END IF;

	RAISE NOTICE 'chk relic achievements: first/five/rare/heirlooms/full-set + title + progress OK';
END;
$relic_achievements$;
