-- PERFECT FEEDING WEEK
--
-- Award a one-time achievement to a pig who submits a dig in every Feeding of
-- one full Monday-to-Monday Dig-Off cycle. Attendance is the behavior: a
-- zero-find submission counts, while joining late or missing one window does
-- not. The server clock owns the set of possible windows, so the rule follows
-- both the live uniform schedule (21/week) and the dormant commuter schedule
-- (28/week) without trusting a client-supplied count.
--
-- Settlement seam: _race_pay_cycle inserts cycle_payouts exactly once. An AFTER
-- INSERT trigger evaluates the completed cycle without carrying that large,
-- frequently revised payout function forward. The trigger is fail-soft so an
-- achievement problem can never block Dig-Off spoils.

-- ── 1. Catalog: achievement + title + one-time currency reward ───────────────

INSERT INTO public.titles
	(id, name, placement, description, source, for_sale, display_order)
VALUES (
	'the_unmissable', 'the Unmissable', 'post',
	'Dug every Feeding in a full Dig-Off week.',
	'achievement', false, 334
)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	placement = EXCLUDED.placement,
	description = EXCLUDED.description,
	source = EXCLUDED.source,
	for_sale = EXCLUDED.for_sale;

INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES (
	'every_last_feeding', 'perfect_feeding_week', 4, 'Every Last Feeding',
	'Dig in every Feeding of a full Dig-Off week.', 1,
	'the_unmissable', NULL, 500, 'bell',
	229, false, 'the_dig'
)
ON CONFLICT (id) DO UPDATE SET
	category = EXCLUDED.category,
	tier = EXCLUDED.tier,
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	threshold = EXCLUDED.threshold,
	reward_title_id = EXCLUDED.reward_title_id,
	reward_item_id = EXCLUDED.reward_item_id,
	reward_snouts = EXCLUDED.reward_snouts,
	icon = EXCLUDED.icon,
	display_order = EXCLUDED.display_order,
	is_top_tier = EXCLUDED.is_top_tier,
	display_category = EXCLUDED.display_category;

-- ── 2. Canonical Feeding windows inside one weekly race cycle ────────────────
--
-- _patch_clock is the authoritative schedule seam. A Feeding belongs to the
-- weekly race in which its open phase BEGINS. That matters when an Eastern
-- commuter window straddles Monday 00:00 UTC: the already-open window belongs
-- to the prior race, while a window that opens before this race ends belongs
-- here even if its open phase continues past the bell. Sampling each minute
-- keeps this helper independent of uniform-vs-commuter geometry and safely
-- catches the shortest currently supported two-hour opening. Invalid or
-- non-Monday cycle keys return none.

CREATE OR REPLACE FUNCTION public.race_cycle_feeding_windows(p_cycle text)
RETURNS TABLE (window_index bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cycle_row record;
	clock_row record;
	prior_clock record;
	sample_at timestamptz;
	seen bigint[] := ARRAY[]::bigint[];
BEGIN
	IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{8}$' THEN
		RETURN;
	END IF;
	SELECT * INTO cycle_row
	FROM public.race_cycle_at(
		to_date(p_cycle, 'YYYYMMDD')::timestamp AT TIME ZONE 'UTC'
	);
	IF cycle_row.cycle_key IS DISTINCT FROM p_cycle THEN
		RETURN;
	END IF;

	-- A race boundary can land inside an already-open commuter Feeding. Seed
	-- that id as seen so the opening remains owned by the prior weekly cycle.
	SELECT * INTO prior_clock
	FROM public._patch_clock(cycle_row.starts_at - interval '1 minute');
	SELECT * INTO clock_row
	FROM public._patch_clock(cycle_row.starts_at);
	IF prior_clock.phase_open
		AND clock_row.phase_open
		AND prior_clock.window_index = clock_row.window_index THEN
		seen := array_append(seen, clock_row.window_index);
	END IF;

	FOR sample_at IN
		SELECT generate_series(
			cycle_row.starts_at,
			cycle_row.ends_at - interval '1 minute',
			interval '1 minute'
		)
	LOOP
		SELECT * INTO clock_row FROM public._patch_clock(sample_at);
		IF clock_row.phase_open
			AND NOT clock_row.window_index = ANY(seen) THEN
			seen := array_append(seen, clock_row.window_index);
			window_index := clock_row.window_index;
			RETURN NEXT;
		END IF;
	END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.race_cycle_feeding_windows(text)
	FROM PUBLIC, anon, authenticated;

-- ── 3. Idempotent award engine ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.award_perfect_feeding_week(p_cycle text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cycle_row record;
	achievement_row record;
	expected_windows int;
	qualified record;
	inserted int;
	awarded int := 0;
BEGIN
	IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{8}$' THEN
		RETURN 0;
	END IF;

	SELECT * INTO cycle_row
	FROM public.race_cycle_at(
		to_date(p_cycle, 'YYYYMMDD')::timestamp AT TIME ZONE 'UTC'
	);
	IF cycle_row.cycle_key IS DISTINCT FROM p_cycle
		OR cycle_row.ends_at > now() THEN
		RETURN 0;
	END IF;

	SELECT count(*)::int INTO expected_windows
	FROM public.race_cycle_feeding_windows(p_cycle);
	IF expected_windows <= 0 THEN
		RETURN 0;
	END IF;

	SELECT * INTO achievement_row
	FROM public.achievements
	WHERE id = 'every_last_feeding';
	IF achievement_row.id IS NULL THEN
		RETURN 0;
	END IF;

	FOR qualified IN
		WITH expected AS (
			SELECT window_index
			FROM public.race_cycle_feeding_windows(p_cycle)
		)
		SELECT d.user_id
		FROM public.race_digs d
		JOIN expected e ON e.window_index = d.window_index
		JOIN public.profiles p ON p.id = d.user_id AND p.is_test = false
		JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
		WHERE d.cycle_key = p_cycle
		GROUP BY d.user_id
		HAVING count(DISTINCT d.window_index) = expected_windows
	LOOP
		INSERT INTO public.user_achievements
			(user_id, achievement_id, claimed_at, progress, level)
		VALUES (
			qualified.user_id,
			achievement_row.id,
			now(),
			expected_windows,
			0
		)
		ON CONFLICT (user_id, achievement_id) DO NOTHING;
		GET DIAGNOSTICS inserted = ROW_COUNT;
		IF inserted = 0 THEN
			CONTINUE;
		END IF;

		IF achievement_row.reward_title_id IS NOT NULL THEN
			INSERT INTO public.user_titles (user_id, title_id)
			VALUES (qualified.user_id, achievement_row.reward_title_id)
			ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_item_id IS NOT NULL THEN
			INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (qualified.user_id, achievement_row.reward_item_id)
			ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_snouts > 0 THEN
			UPDATE public.profiles
			SET counter = counter + achievement_row.reward_snouts
			WHERE id = qualified.user_id;
		END IF;

		awarded := awarded + 1;
	END LOOP;

	RETURN awarded;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_perfect_feeding_week(text)
	FROM PUBLIC, anon, authenticated;

-- ── 4. Weekly settlement hook — fail-soft around the non-core award ──────────

CREATE OR REPLACE FUNCTION public.cycle_payout_perfect_feeding_week()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		PERFORM public.award_perfect_feeding_week(NEW.cycle_key);
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'perfect Feeding award failed for cycle %: %', NEW.cycle_key, SQLERRM;
	END;
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.cycle_payout_perfect_feeding_week()
	FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cycle_payout_perfect_feeding_week
	ON public.cycle_payouts;
CREATE TRIGGER cycle_payout_perfect_feeding_week
	AFTER INSERT ON public.cycle_payouts
	FOR EACH ROW EXECUTE FUNCTION public.cycle_payout_perfect_feeding_week();

-- ── 5. Backfill settled full weeks ───────────────────────────────────────────
-- The weekly Dig-Off began on 2026-07-20; earlier race rows belong to partial
-- transition cycles and cannot represent a full opportunity slate.

DO $backfill_perfect_feeding_weeks$
DECLARE
	settled_cycle text;
BEGIN
	FOR settled_cycle IN
		SELECT cp.cycle_key
		FROM public.cycle_payouts cp
		WHERE cp.cycle_key >= '20260720'
		ORDER BY cp.cycle_key
	LOOP
		PERFORM public.award_perfect_feeding_week(settled_cycle);
	END LOOP;
END;
$backfill_perfect_feeding_weeks$;

-- ── 6. One-time launch notice for every current real player ─────────────────
-- This is intentionally an in-app system announcement, not an immediate push:
-- it persists until the player next signs in/opens the app and dismisses the
-- While-Away sheet. The release key makes the insert replay-safe for local
-- harnesses or a manually retried statement.

INSERT INTO public.system_announcements (user_id, kind, title, body, data)
SELECT
	p.id,
	'feature_update',
	'Never miss a Feeding',
	'Show up for every scheduled Feeding in a full Dig-Off week to earn Every Last Feeding, 500 snouts, and the Unmissable title.',
	jsonb_build_object(
		'release', 'perfect-feeding-week',
		'screen', 'achievements'
	)
FROM public.profiles p
WHERE COALESCE(p.is_test, false) = false
	AND NOT EXISTS (
		SELECT 1
		FROM public.system_announcements sa
		WHERE sa.user_id = p.id
			AND sa.kind = 'feature_update'
			AND sa.data->>'release' = 'perfect-feeding-week'
	);
