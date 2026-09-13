-- Smoke: a full Monday-to-Monday slate of submitted Feedings awards the
-- one-time Every Last Feeding achievement, 500 snouts, and "the Unmissable".
-- Missing even one window does not qualify; a zero-find submission still does.
\set ON_ERROR_STOP on

DO $perfect_feeding_week$
DECLARE
	perfect_pig uuid := '00000000-0000-0000-0000-000000069001';
	zero_find_pig uuid := '00000000-0000-0000-0000-000000069002';
	missed_pig uuid := '00000000-0000-0000-0000-000000069003';
	crew uuid := '00000000-0000-0000-0000-000000069010';
	cycle text := '20260105';
	expected_windows int;
	awarded int;
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.achievements
		WHERE id = 'every_last_feeding'
		  AND reward_title_id = 'the_unmissable'
		  AND reward_snouts = 500
	) THEN
		RAISE EXCEPTION 'Every Last Feeding achievement catalog row missing or wrong';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.titles
		WHERE id = 'the_unmissable'
		  AND name = 'the Unmissable'
		  AND placement = 'post'
		  AND source = 'achievement'
	) THEN
		RAISE EXCEPTION 'the Unmissable title catalog row missing or wrong';
	END IF;

	-- The currently-live uniform schedule remains 21 Feedings per week.
	UPDATE public.app_settings
	SET value = '{"window_secs":28800,"open_secs":14400,"offset_secs":0}'::jsonb
	WHERE key = 'feeding_schedule';
	SELECT count(*)::int INTO expected_windows
	FROM public.race_cycle_feeding_windows(cycle);
	IF expected_windows <> 21 THEN
		RAISE EXCEPTION 'uniform schedule should expose 21 weekly Feedings, got %', expected_windows;
	END IF;

	-- Restore the future commuter geometry. A Sunday-evening opening that began
	-- before Monday 00:00 UTC belongs to the prior race, leaving 28 in this one.
	UPDATE public.app_settings
	SET value = '{"mode":"commuter_eastern","time_zone":"America/New_York","anchor_min":360,"bucket_starts":[0,360,660,900],"open_mins":[240,120,180,120]}'::jsonb
	WHERE key = 'feeding_schedule';
	SELECT count(*)::int INTO expected_windows
	FROM public.race_cycle_feeding_windows(cycle);
	IF expected_windows <> 28 THEN
		RAISE EXCEPTION 'commuter schedule should expose 28 weekly Feedings, got %, ids=%',
			expected_windows,
			(SELECT array_agg(window_index) FROM public.race_cycle_feeding_windows(cycle));
	END IF;

	INSERT INTO auth.users (id) VALUES (perfect_pig), (zero_find_pig), (missed_pig);
	INSERT INTO public.profiles (id, username, counter) VALUES
		(perfect_pig, 'perfectpig', 10),
		(zero_find_pig, 'zerofindpig', 20),
		(missed_pig, 'missedpig', 30);
	INSERT INTO public.crews (id, name, leader_id)
		VALUES (crew, 'The Clockwork Rooters', perfect_pig);
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
		(crew, perfect_pig, 'leader'),
		(crew, zero_find_pig, 'member'),
		(crew, missed_pig, 'member');

	-- Both complete pigs submit every server-defined window. Finds are deliberately
	-- zero for one pig: attendance is the behavior being honored, not luck/yield.
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
	SELECT cycle, perfect_pig, window_index, crew, 2
	FROM public.race_cycle_feeding_windows(cycle);
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
	SELECT cycle, zero_find_pig, window_index, crew, 0
	FROM public.race_cycle_feeding_windows(cycle);
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
	SELECT cycle, missed_pig, window_index, crew, 1
	FROM public.race_cycle_feeding_windows(cycle)
	ORDER BY window_index
	OFFSET 1;

	-- _race_pay_cycle creates this row at settlement; its AFTER INSERT trigger is
	-- the award seam. A direct fixture keeps this smoke independent of race spoils.
	INSERT INTO public.cycle_payouts (cycle_key) VALUES (cycle);

	IF (SELECT count(*) FROM public.user_achievements
		WHERE achievement_id = 'every_last_feeding'
		  AND user_id IN (perfect_pig, zero_find_pig)) <> 2 THEN
		RAISE EXCEPTION 'both full-week pigs should earn Every Last Feeding';
	END IF;
	IF EXISTS (
		SELECT 1 FROM public.user_achievements
		WHERE achievement_id = 'every_last_feeding' AND user_id = missed_pig
	) THEN
		RAISE EXCEPTION 'a pig missing one Feeding must not earn the achievement';
	END IF;
	IF (SELECT count(*) FROM public.user_titles
		WHERE title_id = 'the_unmissable'
		  AND user_id IN (perfect_pig, zero_find_pig)) <> 2 THEN
		RAISE EXCEPTION 'both full-week pigs should own the Unmissable title';
	END IF;
	IF (SELECT counter FROM public.profiles WHERE id = perfect_pig) <> 510
		OR (SELECT counter FROM public.profiles WHERE id = zero_find_pig) <> 520
		OR (SELECT counter FROM public.profiles WHERE id = missed_pig) <> 30 THEN
		RAISE EXCEPTION '500-snout reward was not applied exactly to qualifiers';
	END IF;

	-- Re-evaluation is safe: the achievement PK is the reward idempotency lock.
	SELECT public.award_perfect_feeding_week(cycle) INTO awarded;
	IF awarded <> 0
		OR (SELECT counter FROM public.profiles WHERE id = perfect_pig) <> 510
		OR (SELECT counter FROM public.profiles WHERE id = zero_find_pig) <> 520 THEN
		RAISE EXCEPTION 'repeat award should be a no-op, awarded=%', awarded;
	END IF;

	PERFORM set_config('smoke.uid', perfect_pig::text, true);
	IF NOT EXISTS (
		SELECT 1 FROM public.my_achievements()
		WHERE id = 'every_last_feeding'
		  AND claimed
		  AND progress = expected_windows
	) THEN
		RAISE EXCEPTION 'achievement read model did not expose the claimed perfect week';
	END IF;

	RAISE NOTICE 'chk perfect feeding week: full/zero-find/missed/idempotent/read-model OK';
END;
$perfect_feeding_week$;
