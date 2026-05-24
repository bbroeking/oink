-- Economy rebalance — tighten shop bands + tone down bounty rewards.
--
-- Shop bands (target: "100-800 general, super-rares in the 1000s"):
--
--                old                  new
--   common      25-100               100-200
--   uncommon    100-400              200-400
--   rare        400-1500             400-800
--   epic        1500-5000            800-2000
--   legendary   5000-25000           2000-5000
--
-- Clamps preserve every item that's already inside the new band and
-- pull outliers in: e.g. Royal Crown (epic, 8000) → 2000, Halo
-- (rare, 1200) → 800, Beanie (common, 60) → 100, etc. Season-pass
-- exclusives (cost = 0 — see migration 20260544000000) are skipped
-- via WHERE cost > 0 so they stay invisible in the buy paths.
--
-- Bounty rewards drop ~40-50% across the board. Player claiming all
-- 3 weekly bounties now earns ~225-275 snouts (was ~450-500),
-- pacing toward one rare-item-per-2-weeks / one epic-per-3-6 weeks
-- without trivializing the cosmetic economy.

-- ── Shop cost clamps ────────────────────────────────────────────
UPDATE public.hats
	SET cost = GREATEST(100, LEAST(200, cost))
	WHERE rarity = 'common' AND cost > 0;

UPDATE public.hats
	SET cost = GREATEST(200, LEAST(400, cost))
	WHERE rarity = 'uncommon' AND cost > 0;

UPDATE public.hats
	SET cost = GREATEST(400, LEAST(800, cost))
	WHERE rarity = 'rare' AND cost > 0;

UPDATE public.hats
	SET cost = GREATEST(800, LEAST(2000, cost))
	WHERE rarity = 'epic' AND cost > 0;

UPDATE public.hats
	SET cost = GREATEST(2000, LEAST(5000, cost))
	WHERE rarity = 'legendary' AND cost > 0;

-- ── Bounty rewards (rebuild my_weekly_bounties with new payouts) ──
-- Function body is otherwise identical to migration 20260524000000 —
-- only the reward_snouts values in the VALUES list shift.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.my_weekly_bounties()
RETURNS TABLE (
	code          text,
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
	n_fulfilled    int := 0;
	n_received     int := 0;
	n_blessings    int := 0;
	n_curses       int := 0;
	n_distinct     int := 0;
	rot int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN;
	END IF;

	SELECT COUNT(*) INTO n_fulfilled FROM public.tickle_trades
		WHERE target_id = caller_id AND status = 'fulfilled'
		  AND fulfilled_at >= wk_ts;
	SELECT COUNT(*) INTO n_received FROM public.tickle_trades
		WHERE requester_id = caller_id AND status = 'fulfilled'
		  AND fulfilled_at >= wk_ts;
	SELECT COUNT(*) INTO n_blessings FROM public.blessings
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(*) INTO n_curses FROM public.curses
		WHERE sender_id = caller_id AND sent_at >= wk_ts;
	SELECT COUNT(DISTINCT partner) INTO n_distinct FROM (
		SELECT CASE WHEN requester_id = caller_id THEN target_id
		            ELSE requester_id END AS partner
			FROM public.tickle_trades
			WHERE (requester_id = caller_id OR target_id = caller_id)
			  AND status = 'fulfilled'
			  AND created_at >= wk_ts
	) p;

	rot := week_num % 6;

	RETURN QUERY
	WITH pool(idx, code, name, description, goal, progress, reward_snouts) AS (
		VALUES
		-- reward_snouts toned down ~40-50% from migration 20260524000000.
		(0, 'generous_hoof',   'Generous Hoof',   'Fulfill 3 trade requests this week.',          3, n_fulfilled,  75),
		(1, 'well_asked',      'Asked & Answered','Have 3 of your requests fulfilled this week.', 3, n_received,  100),
		(2, 'daily_light',     'Daily Light',     'Send 5 blessings this week.',                  5, n_blessings,  50),
		(3, 'mischief_maker',  'Mischief Maker',  'Send 5 curses this week.',                     5, n_curses,     50),
		(4, 'even_hand',       'Even Hand',       'Give 2 trades and receive 2 this week.',       4, LEAST(n_fulfilled,2) + LEAST(n_received,2), 100),
		(5, 'social_butterfly','Social Butterfly','Trade with 3 different friends this week.',    3, n_distinct,  125)
	)
	SELECT
		pl.code, pl.name, pl.description, pl.goal,
		LEAST(pl.progress, pl.goal) AS progress,
		pl.reward_snouts,
		EXISTS (
			SELECT 1 FROM public.user_bounty_claims ubc
			WHERE ubc.user_id = caller_id
			  AND ubc.bounty_code = pl.code
			  AND ubc.week_start = wk_start
		) AS claimed
	FROM pool pl
	WHERE pl.idx IN (rot, (rot + 1) % 6, (rot + 2) % 6)
	ORDER BY pl.idx;
END;
$function$;
