-- ═══════════════════════════════════════════════════════════════════════════
-- SEASON 1 (THE GREAT HUNGER) — Scuffle achievements.
--
-- PUBLIC TEASE: seeding `achievements` rows is instantly visible on the live
-- Achievements screen — my_achievements() returns ALL catalog rows, so these
-- render LOCKED the moment this migration lands and they move the "N/M
-- unlocked" denominator. That is DELIBERATE here (the war surfaces flip
-- Jul 12; the locked Scuffle trophies are an intended pre-flip teaser), not an
-- accident. See docs/wiki/outputs/memos/db-push-safety-audit-2026-07.md §4
-- (the codified seeding rule: treat `achievements` inserts as a public
-- announcement) + §3.2.
--
-- Carry-latest-def: try_claim_achievements + my_achievements are carried
-- VERBATIM from 20260677 (the authoritative defs) with ONLY the three new
-- Scuffle branches added to each. Verified: no migration between 20260677 and
-- the current head (20260709) touches either function — a stale-base CREATE OR
-- REPLACE silently drops features (see project memory: carry-latest-def
-- footgun). New titles seed BEFORE the achievements insert that FK-references
-- them (achievements.reward_title_id → titles.id).
--
-- NO BACKFILL: unlike 20260677, this migration does NOT re-run try_claim for
-- existing users. The three counters are near-zero in beta (war_wins,
-- war_rootings, echo_claims) and the next war event self-heals via the AFTER
-- triggers below — a backfill would only add churn for no unlock.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Reward titles (source='achievement') ────────────────────────────────
-- titles.source CHECK already allows 'achievement' (20260520060000). Seed
-- FIRST so the achievements FK below resolves. display_order continues the
-- achievement-title block (last used 329 in 20260559).
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('bog_general',  'Bog General',  'pre', 'Fifty ropes dragged home.',                      'achievement', false, 330),
	('steady_snout', 'Steady Snout', 'pre', 'Twenty-five diggings while the Hungerer gorged.', 'achievement', false, 331),
	('truffle_baron','Truffle Baron','pre', 'A fortune rooted from under his snout.',          'achievement', false, 332)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Scuffle achievement rows (display_category 'scuffle') ────────────────
-- display_category is a plain text column (no CHECK); the client adds a
-- matching 'scuffle' filter chip. icon is keyed by achievement id in the
-- client (trophy fallback), so the column value here is incidental — kept as a
-- short non-emoji label like the 20260677 rows. display_order continues after
-- the current max (214).
INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon,
	 display_order, is_top_tier, display_category)
VALUES
	-- Scuffle wins (profiles.war_wins)
	('first_rope',      'war_wins',    1, 'First Rope',   'Win your first scuffle.',              1,   NULL,           NULL, 50,   'rope', 215, false, 'scuffle'),
	('rope_handler',    'war_wins',    2, 'Rope Handler', 'Win 10 scuffles.',                     10,  NULL,           NULL, 400,  'rope', 216, false, 'scuffle'),
	('bog_general_a',   'war_wins',    3, 'Bog General',  'Win 50 scuffles.',                     50,  'bog_general',  NULL, 2000, 'rope', 217, true,  'scuffle'),
	-- Diggings (war_rootings, submitted)
	('first_rooting',   'dig_count',   1, 'First Rooting','Complete your first digging.',         1,   NULL,           NULL, 25,   'dig',  218, false, 'scuffle'),
	('steady_snout_a',  'dig_count',   2, 'Steady Snout', 'Complete 25 diggings.',                25,  'steady_snout', NULL, 200,  'dig',  219, false, 'scuffle'),
	('truffle_baron_a', 'dig_count',   3, 'Truffle Baron','Complete 150 diggings.',               150, 'truffle_baron',NULL, 1000, 'dig',  220, true,  'scuffle'),
	-- Echoes (echo_claims)
	('heard_the_call',  'echo_claims', 1, 'Heard the Call','Catch your first echo.',              1,   NULL,           NULL, 25,   'echo', 221, false, 'scuffle'),
	('always_listening','echo_claims', 2, 'Always Listening','Catch 20 echoes.',                  20,  NULL,           NULL, 300,  'echo', 222, false, 'scuffle')
ON CONFLICT (id) DO NOTHING;

-- ── 3. try_claim_achievements — carried VERBATIM from 20260677 + 3 branches ──
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
		-- NEW (Season 1 / Scuffle): scuffle wins, submitted diggings, echoes.
		WHEN 'war_wins'           THEN
			GREATEST(0, COALESCE(
				(SELECT war_wins FROM public.profiles WHERE id = target_user_id),
				0))
		WHEN 'dig_count'          THEN (
			SELECT COUNT(*)::int FROM public.war_rootings
			WHERE user_id = target_user_id AND submitted_at IS NOT NULL)
		WHEN 'echo_claims'        THEN (
			SELECT COUNT(*)::int FROM public.echo_claims WHERE user_id = target_user_id)
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

-- ── 4. my_achievements — carried VERBATIM from 20260677 + 3 branches ────────
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
				-- NEW (Season 1 / Scuffle): scuffle wins, submitted diggings, echoes.
				WHEN 'war_wins'           THEN GREATEST(0, COALESCE((SELECT war_wins FROM public.profiles pr, me WHERE pr.id = me.uid), 0))
				WHEN 'dig_count'          THEN (SELECT COUNT(*)::int FROM public.war_rootings wr, me WHERE wr.user_id = me.uid AND wr.submitted_at IS NOT NULL)
				WHEN 'echo_claims'        THEN (SELECT COUNT(*)::int FROM public.echo_claims ec, me WHERE ec.user_id = me.uid)
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

-- ── 5. Triggers: fire the Scuffle ladders when their counters change ────────
-- Each follows the guarded/idempotent style of profiles_tickle_volume_
-- achievements (20260677): a DISTINCT-FROM (or transition) guard + a savepoint
-- so a claim failure never rolls back the source write. try_claim is
-- idempotent, so re-firing is a cheap no-op.

-- 5a. profiles.war_wins → 'war_wins'
CREATE OR REPLACE FUNCTION public.profiles_war_wins_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.war_wins IS DISTINCT FROM OLD.war_wins THEN
		BEGIN
			PERFORM public.try_claim_achievements(NEW.id, 'war_wins');
		EXCEPTION WHEN OTHERS THEN NULL;
		END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_war_wins_achievements ON public.profiles;
CREATE TRIGGER profiles_war_wins_achievements
	AFTER UPDATE OF war_wins ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_war_wins_achievements();

-- 5b. war_rootings submitted → 'dig_count'
CREATE OR REPLACE FUNCTION public.war_rootings_dig_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
		BEGIN
			PERFORM public.try_claim_achievements(NEW.user_id, 'dig_count');
		EXCEPTION WHEN OTHERS THEN NULL;
		END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS war_rootings_dig_achievements ON public.war_rootings;
CREATE TRIGGER war_rootings_dig_achievements
	AFTER UPDATE OF submitted_at ON public.war_rootings
	FOR EACH ROW EXECUTE FUNCTION public.war_rootings_dig_achievements();

-- 5c. echo_claims insert → 'echo_claims'
CREATE OR REPLACE FUNCTION public.echo_claims_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		PERFORM public.try_claim_achievements(NEW.user_id, 'echo_claims');
	EXCEPTION WHEN OTHERS THEN NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS echo_claims_achievements ON public.echo_claims;
CREATE TRIGGER echo_claims_achievements
	AFTER INSERT ON public.echo_claims
	FOR EACH ROW EXECUTE FUNCTION public.echo_claims_achievements();
