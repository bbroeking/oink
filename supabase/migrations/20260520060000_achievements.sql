-- Unified Achievement system.
--
-- Each achievement has:
--   - a category (currently 'trade_giver' | 'trade_receiver'; will
--     grow to cover sounder, lucky, collection, etc.)
--   - a threshold (numeric — interpreted by the category's progress
--     function: tickles given, tickles received, friends recruited)
--   - optional rewards: title, item (free hat row), snouts, bank cap
--
-- Past the named tiers, the same category continues into an INFINITE
-- numeric "Level N" progression with ×2 thresholds and +500 snouts
-- per level. Stored implicitly in user_achievements via a `level`
-- column on the row for the top-tier achievement.

-- ── 1. achievements (catalog) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.achievements (
	id              text        PRIMARY KEY,
	category        text        NOT NULL,
	tier            int         NOT NULL,         -- 1 = bronze, 2 = silver, 3 = gold, 4 = platinum
	name            text        NOT NULL,
	description     text,
	threshold       int         NOT NULL,
	reward_title_id text        REFERENCES public.titles(id) ON DELETE SET NULL,
	reward_item_id  text        REFERENCES public.hats(id)   ON DELETE SET NULL,
	reward_snouts   int         NOT NULL DEFAULT 0,
	icon            text,                            -- emoji or short label
	display_order   int         NOT NULL DEFAULT 0,
	is_top_tier     boolean     NOT NULL DEFAULT false  -- if true, continues into numeric "Level N"
);

CREATE INDEX IF NOT EXISTS achievements_category_idx
	ON public.achievements (category, display_order);

-- ── 2. user_achievements (claims + progression) ────────────────────
-- Each row tracks a single achievement claim for a single user.
-- For top-tier (Lvl N) achievements, `level` may be > 0 meaning the
-- user has earned bonus levels past the named ceiling.
CREATE TABLE IF NOT EXISTS public.user_achievements (
	user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	achievement_id text        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
	claimed_at     timestamptz NOT NULL DEFAULT now(),
	progress       int         NOT NULL DEFAULT 0,  -- snapshot at claim
	level          int         NOT NULL DEFAULT 0,  -- 0 = base tier; >0 = bonus levels past top tier
	PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx
	ON public.user_achievements (user_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own achievements" ON public.user_achievements;
CREATE POLICY "View own achievements"
	ON public.user_achievements FOR SELECT
	USING (auth.uid() = user_id);

-- Achievements catalog is public-read for the UI.
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read achievements catalog" ON public.achievements;
CREATE POLICY "Read achievements catalog"
	ON public.achievements FOR SELECT
	USING (true);

-- ── 3. Reward titles for Trade Masters ─────────────────────────────
-- Extend titles.source CHECK to allow 'achievement' BEFORE the insert.
ALTER TABLE public.titles DROP CONSTRAINT IF EXISTS titles_source_check;
ALTER TABLE public.titles
	ADD CONSTRAINT titles_source_check
	CHECK (source IS NULL OR source IN ('battle_pass', 'shop', 'lucky', 'sounder', 'achievement'));

INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	-- Generous
	('open_hoof',        'Open Hoof',        'pre',  'Gave 10 tickles via trades.',       'achievement', false, 300),
	('snout_saint',      'Snout Saint',      'pre',  'Gave 50 tickles via trades.',       'achievement', false, 301),
	('bacon_bountiful',  'Bacon Bountiful',  'pre',  'Gave 250 tickles via trades.',      'achievement', false, 302),
	('hog_of_hearts',    'Hog of Hearts',    'pre',  'Gave 1000 tickles via trades.',     'achievement', false, 303),
	-- Greedy
	('hungry_hog',       'Hungry Hog',       'pre',  'Received 10 tickles via trades.',   'achievement', false, 310),
	('trough_sniffer',   'Trough Sniffer',   'pre',  'Received 50 tickles via trades.',   'achievement', false, 311),
	('bottomless',       'Bottomless',       'pre',  'Received 250 tickles via trades.',  'achievement', false, 312),
	('glutton_king',     'Glutton King',     'pre',  'Received 1000 tickles via trades.', 'achievement', false, 313)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Seed Trade Masters achievements ─────────────────────────────
INSERT INTO public.achievements
	(id, category, tier, name, description, threshold,
	 reward_title_id, reward_item_id, reward_snouts, icon, display_order, is_top_tier)
VALUES
	-- Generous (tickles GIVEN via trades)
	('generous_t1', 'trade_giver', 1, 'Open Hoof',       'Give 10 tickles via trades.',   10,
		'open_hoof',       NULL,           100, '🤝', 100, false),
	('generous_t2', 'trade_giver', 2, 'Snout Saint',     'Give 50 tickles via trades.',   50,
		'snout_saint',     'pink_bow',     250, '🎀', 101, false),
	('generous_t3', 'trade_giver', 3, 'Bacon Bountiful', 'Give 250 tickles via trades.',  250,
		'bacon_bountiful', 'gift_bow',    1000, '🎁', 102, false),
	('generous_t4', 'trade_giver', 4, 'Hog of Hearts',   'Give 1000 tickles via trades.', 1000,
		'hog_of_hearts',   'crown',       2500, '👑', 103, true),
	-- Greedy (tickles RECEIVED via trades)
	('greedy_t1', 'trade_receiver', 1, 'Hungry Hog',     'Receive 10 tickles via trades.',   10,
		'hungry_hog',      NULL,           100, '🐽', 110, false),
	('greedy_t2', 'trade_receiver', 2, 'Trough Sniffer', 'Receive 50 tickles via trades.',   50,
		'trough_sniffer',  'pizza_slice',  250, '🍕', 111, false),
	('greedy_t3', 'trade_receiver', 3, 'Bottomless',     'Receive 250 tickles via trades.',  250,
		'bottomless',      'ice_cream',   1000, '🍦', 112, false),
	('greedy_t4', 'trade_receiver', 4, 'Glutton King',   'Receive 1000 tickles via trades.', 1000,
		'glutton_king',    'coffee_mug',  2500, '☕', 113, true)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Volume views ───────────────────────────────────────────────
-- Lifetime tickles GIVEN / RECEIVED via trades. A fulfilled trade =
-- the giver (target_id) gave N from their bank; the asker
-- (requester_id) received 2N. There is no repay step. Computed on
-- demand; cheap at TestFlight scale.
CREATE OR REPLACE VIEW public.user_trade_given AS
	-- You fulfilled someone's request → you gave `amount`.
	SELECT target_id AS user_id, SUM(amount) AS amount
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		GROUP BY target_id;

CREATE OR REPLACE VIEW public.user_trade_received AS
	-- Your request was fulfilled → you pocketed 2 × `amount`.
	SELECT requester_id AS user_id, SUM(amount * 2) AS amount
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		GROUP BY requester_id;

CREATE OR REPLACE FUNCTION public.trade_given_total(target_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
	SELECT COALESCE(SUM(amount), 0)::int
	FROM public.user_trade_given WHERE user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.trade_received_total(target_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
	SELECT COALESCE(SUM(amount), 0)::int
	FROM public.user_trade_received WHERE user_id = target_user_id;
$$;

-- ── 6. Universal claim helper ─────────────────────────────────────
-- Called whenever a category's progress might have advanced. Iterates
-- through all unclaimed tiers in that category, granting each whose
-- threshold the user has met. For top-tier achievements (is_top_tier),
-- also computes infinite-level progression: every 2× past base
-- threshold grants +500 snouts and bumps `level`.
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
	-- Progress lookup per category
	current_progress := CASE cat
		WHEN 'trade_giver'    THEN public.trade_given_total(target_user_id)
		WHEN 'trade_receiver' THEN public.trade_received_total(target_user_id)
		ELSE 0
	END;

	-- Walk named tiers in order.
	FOR a IN
		SELECT * FROM public.achievements
		WHERE category = cat
		ORDER BY tier ASC
	LOOP
		IF current_progress < a.threshold THEN
			EXIT;  -- Tiers are ordered; subsequent ones can't be met yet.
		END IF;

		-- Top-tier path: compute infinite levels.
		IF a.is_top_tier THEN
			-- new_level = floor(log2(progress / threshold)) for progress >= threshold
			new_level := GREATEST(0, FLOOR(LOG(2, GREATEST(1, current_progress::numeric / a.threshold)))::int);

			-- Already-claimed row + previous level, OR new claim at level new_level.
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, new_level)
				ON CONFLICT (user_id, achievement_id) DO NOTHING;

			-- Bump level + pay out per-level bonus if we crossed any.
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
			-- The base reward (title/item/snouts) is granted by the
			-- INSERT path below when claim is brand new.
		END IF;

		-- Brand-new claim → grant rewards once.
		IF NOT EXISTS (
			SELECT 1 FROM public.user_achievements
			WHERE user_id = target_user_id AND achievement_id = a.id
		) THEN
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, 0);

			-- Title
			IF a.reward_title_id IS NOT NULL THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (target_user_id, a.reward_title_id)
					ON CONFLICT DO NOTHING;
			END IF;
			-- Item (grants a free hat row)
			IF a.reward_item_id IS NOT NULL THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (target_user_id, a.reward_item_id)
					ON CONFLICT DO NOTHING;
			END IF;
			-- Snouts
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

-- ── 7. Trigger: re-evaluate on every trade status change ──────────
CREATE OR REPLACE FUNCTION public.tickle_trades_achievement_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	-- Only 'fulfilled' moves trade volume now (no repay step). Both
	-- sides are re-evaluated for both ladders — try_claim is
	-- idempotent and reads the volume views, so the irrelevant
	-- (user, category) pairs are cheap no-ops.
	IF NEW.status = 'fulfilled'
	   AND (OLD.status IS DISTINCT FROM NEW.status) THEN
		PERFORM public.try_claim_achievements(NEW.requester_id, 'trade_giver');
		PERFORM public.try_claim_achievements(NEW.requester_id, 'trade_receiver');
		PERFORM public.try_claim_achievements(NEW.target_id,    'trade_giver');
		PERFORM public.try_claim_achievements(NEW.target_id,    'trade_receiver');
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickle_trades_achievements ON public.tickle_trades;
CREATE TRIGGER tickle_trades_achievements
	AFTER INSERT OR UPDATE OF status ON public.tickle_trades
	FOR EACH ROW EXECUTE FUNCTION public.tickle_trades_achievement_check();

-- ── 8. Read API for the achievements screen ───────────────────────
-- Returns every achievement with the caller's progress + claimed
-- status + level (for top-tier ones). Optimized for one round-trip.
CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE (
	id              text,
	category        text,
	tier            int,
	name            text,
	description     text,
	threshold       int,
	reward_title_id text,
	reward_item_id  text,
	reward_snouts   int,
	icon            text,
	display_order   int,
	is_top_tier     boolean,
	progress        int,
	claimed         boolean,
	level           int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	prog_giver  int := 0;
	prog_recv   int := 0;
BEGIN
	IF caller_id IS NOT NULL THEN
		prog_giver := public.trade_given_total(caller_id);
		prog_recv  := public.trade_received_total(caller_id);
	END IF;

	RETURN QUERY
	SELECT
		a.id,
		a.category,
		a.tier,
		a.name,
		a.description,
		a.threshold,
		a.reward_title_id,
		a.reward_item_id,
		a.reward_snouts,
		a.icon,
		a.display_order,
		a.is_top_tier,
		CASE a.category
			WHEN 'trade_giver'    THEN prog_giver
			WHEN 'trade_receiver' THEN prog_recv
			ELSE 0
		END AS progress,
		EXISTS (
			SELECT 1 FROM public.user_achievements ua
			WHERE ua.user_id = caller_id AND ua.achievement_id = a.id
		) AS claimed,
		COALESCE(
			(SELECT level FROM public.user_achievements ua
			 WHERE ua.user_id = caller_id AND ua.achievement_id = a.id),
			0
		) AS level
	FROM public.achievements a
	ORDER BY a.display_order ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;
