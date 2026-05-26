-- Expand the bounty pool from 6 to 11 for more weekly variety.
--
-- Original 6 covered trade-give, trade-receive, blessing-send,
-- curse-send, mixed-trade, and distinct-friend-trade. New 5 add:
--   • lucky_hog        — Hit 1 Lucky Pig this week (luck mechanic)
--   • got_blessed      — Receive 2 blessings (receiver-side encouragement)
--   • cleanser         — Cleanse a curse (reactive mechanic)
--   • bless_distinct   — Bless 3 different friends (encourages spread)
--   • curse_distinct   — Curse 3 different friends (mirror; goblin path)
--
-- Pool size 11 with the same 3-active rotation gives an 11-week
-- cycle through every code (each bounty appears 3 times per 11
-- weeks). Rerolls still pull from the 8 inactive codes.
--
-- Rewrites my_weekly_bounties + reroll_bounty to include the new
-- pool definition. Schema doesn't change.

set check_function_bodies = off;

-- ── my_weekly_bounties — 11-row pool ─────────────────────────────
DROP FUNCTION IF EXISTS public.my_weekly_bounties();
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
	SELECT COUNT(*) INTO n_lucky FROM public.daily_lucky_claims
		WHERE user_id = caller_id AND claimed_at >= wk_ts;
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

-- ── reroll_bounty — pool list bumped to 11 ──────────────────────
-- Same logic as before; just the pool VALUES list expanded so the
-- reroll picks from the full set of inactive codes.
CREATE OR REPLACE FUNCTION public.reroll_bounty(bounty_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	wk_start     date := public.current_week_start();
	week_num     int  := EXTRACT(WEEK FROM (now() AT TIME ZONE 'UTC'))::int;
	pool_size    int  := 11;
	rot          int;
	active_slots text[];
	target_slot  text;
	replacement  text;
	rows_updated int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	rot := week_num % pool_size;
	WITH pool(idx, code) AS (
		VALUES
		(0,  'generous_hoof'), (1,  'well_asked'), (2,  'daily_light'),
		(3,  'mischief_maker'), (4,  'even_hand'), (5,  'social_butterfly'),
		(6,  'lucky_hog'), (7,  'got_blessed'), (8,  'cleanser'),
		(9,  'bless_distinct'), (10, 'curse_distinct')
	)
	SELECT ARRAY_AGG(code ORDER BY idx) INTO active_slots
	FROM pool WHERE idx IN (rot, (rot + 1) % pool_size, (rot + 2) % pool_size);

	IF bounty_code = ANY(active_slots) THEN
		target_slot := bounty_code;
	ELSE
		SELECT slot_code INTO target_slot
		FROM public.user_bounty_rerolls
		WHERE user_id = caller_id AND week_start = wk_start AND new_code = bounty_code;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_active');
		END IF;
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.user_bounty_rerolls
		WHERE user_id = caller_id AND week_start = wk_start AND slot_code = target_slot
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rerolled');
	END IF;

	WITH pool(code) AS (
		VALUES
		('generous_hoof'), ('well_asked'), ('daily_light'),
		('mischief_maker'), ('even_hand'), ('social_butterfly'),
		('lucky_hog'), ('got_blessed'), ('cleanser'),
		('bless_distinct'), ('curse_distinct')
	)
	SELECT pool.code INTO replacement
	FROM pool
	WHERE pool.code <> ALL(active_slots)
	ORDER BY random()
	LIMIT 1;

	IF replacement IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_replacement');
	END IF;

	UPDATE public.profiles
		SET counter = counter - 25
		WHERE id = caller_id AND counter >= 25;
	GET DIAGNOSTICS rows_updated = ROW_COUNT;
	IF rows_updated = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_snouts');
	END IF;

	INSERT INTO public.user_bounty_rerolls (user_id, week_start, slot_code, new_code)
		VALUES (caller_id, wk_start, target_slot, replacement)
		ON CONFLICT DO NOTHING;

	RETURN jsonb_build_object(
		'ok', true,
		'slot_code', target_slot,
		'new_code', replacement,
		'snouts_paid', 25
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reroll_bounty(text) TO authenticated;

-- ── notify_ready_bounties — pool list bumped to 11 ──────────────
-- Same race-safe push/log pattern; pool inline definition
-- expanded.
CREATE OR REPLACE FUNCTION public.notify_ready_bounties(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	wk_start  date := public.current_week_start();
	pool_size int  := 11;
	b         record;
BEGIN
	IF target_user_id IS NULL THEN RETURN; END IF;

	FOR b IN
		WITH wk AS (SELECT wk_start::timestamptz AS ws),
		counters AS (
			SELECT
				(SELECT COUNT(*) FROM public.tickle_trades, wk
					WHERE target_id = target_user_id AND status='fulfilled'
					  AND fulfilled_at >= ws) AS n_fulfilled,
				(SELECT COUNT(*) FROM public.tickle_trades, wk
					WHERE requester_id = target_user_id AND status='fulfilled'
					  AND fulfilled_at >= ws) AS n_received,
				(SELECT COUNT(*) FROM public.blessings, wk
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_blessings_sent,
				(SELECT COUNT(*) FROM public.curses, wk
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_curses_sent,
				(SELECT COUNT(*) FROM public.blessings, wk
					WHERE receiver_id = target_user_id AND sent_at >= ws) AS n_blessings_recv,
				(SELECT COUNT(DISTINCT partner) FROM (
					SELECT CASE WHEN requester_id = target_user_id THEN target_id
					            ELSE requester_id END AS partner
					FROM public.tickle_trades, wk
					WHERE (requester_id = target_user_id OR target_id = target_user_id)
					  AND status='fulfilled' AND created_at >= ws
				) p) AS n_distinct_partners,
				(SELECT COUNT(DISTINCT receiver_id) FROM public.blessings, wk
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_distinct_blessed,
				(SELECT COUNT(DISTINCT receiver_id) FROM public.curses, wk
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_distinct_cursed,
				(SELECT COUNT(*) FROM public.daily_lucky_claims, wk
					WHERE user_id = target_user_id AND claimed_at >= ws) AS n_lucky,
				(SELECT COUNT(*) FROM public.curses, wk
					WHERE receiver_id = target_user_id
					  AND cleared_at IS NOT NULL AND cleared_at >= ws) AS n_cleansed
		),
		rot_cte AS (
			SELECT EXTRACT(WEEK FROM (now() AT TIME ZONE 'UTC'))::int % pool_size AS r
		),
		pool(idx, code, name, goal, progress) AS (
			SELECT * FROM (VALUES
				(0,  'generous_hoof',   'Generous Hoof',    3, (SELECT n_fulfilled FROM counters)),
				(1,  'well_asked',      'Asked & Answered', 3, (SELECT n_received  FROM counters)),
				(2,  'daily_light',     'Daily Light',      5, (SELECT n_blessings_sent FROM counters)),
				(3,  'mischief_maker',  'Mischief Maker',   5, (SELECT n_curses_sent FROM counters)),
				(4,  'even_hand',       'Even Hand',        4, LEAST((SELECT n_fulfilled FROM counters),2) + LEAST((SELECT n_received FROM counters),2)),
				(5,  'social_butterfly','Social Butterfly', 3, (SELECT n_distinct_partners FROM counters)),
				(6,  'lucky_hog',       'Lucky Hog',        1, (SELECT n_lucky FROM counters)),
				(7,  'got_blessed',     'Well-Wished',      2, (SELECT n_blessings_recv FROM counters)),
				(8,  'cleanser',        'Cleanser',         1, (SELECT n_cleansed FROM counters)),
				(9,  'bless_distinct',  'Patron',           3, (SELECT n_distinct_blessed FROM counters)),
				(10, 'curse_distinct',  'Hexsmith',         3, (SELECT n_distinct_cursed FROM counters))
			) AS v(idx, code, name, goal, progress)
		)
		SELECT pl.code, pl.name, pl.goal
		FROM pool pl, rot_cte
		WHERE pl.idx IN (rot_cte.r, (rot_cte.r + 1) % pool_size, (rot_cte.r + 2) % pool_size)
		  AND pl.progress >= pl.goal
		  AND NOT EXISTS (
		    SELECT 1 FROM public.user_bounty_claims c
		    WHERE c.user_id = target_user_id
		      AND c.bounty_code = pl.code
		      AND c.week_start = wk_start
		  )
	LOOP
		INSERT INTO public.user_bounty_notified (user_id, bounty_code, week_start)
			VALUES (target_user_id, b.code, wk_start)
			ON CONFLICT DO NOTHING;
		IF FOUND THEN
			BEGIN
				PERFORM public.send_push_to_user(
					target_user_id,
					'Bounty ready: ' || b.name,
					'Tap Season to claim your snouts.',
					jsonb_build_object(
						'kind', 'bounty_ready',
						'bounty_code', b.code,
						'screen', 'season'
					)
				);
			EXCEPTION WHEN OTHERS THEN
				NULL;
			END;
		END IF;
	END LOOP;
END;
$function$;

-- The Lucky Pig + Cleanse paths need triggers to fire bounty
-- progress checks (the other action paths already do via
-- tickle_trades / blessings / curses bounty triggers).
-- daily_lucky_claims is new to the trigger set.

CREATE OR REPLACE FUNCTION public.daily_lucky_claims_bounty_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	BEGIN PERFORM public.notify_ready_bounties(NEW.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS daily_lucky_claims_bounty ON public.daily_lucky_claims;
CREATE TRIGGER daily_lucky_claims_bounty
	AFTER INSERT ON public.daily_lucky_claims
	FOR EACH ROW EXECUTE FUNCTION public.daily_lucky_claims_bounty_check();

-- Cleanse triggers on UPDATE of curses.cleared_at — the curses_bounty
-- trigger from 20260553 was INSERT only (for the sender). Add an
-- UPDATE trigger on cleared_at for the receiver-side cleanser bounty.
CREATE OR REPLACE FUNCTION public.curses_cleanse_bounty_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	IF NEW.cleared_at IS NOT NULL
	   AND (OLD.cleared_at IS NULL) THEN
		BEGIN PERFORM public.notify_ready_bounties(NEW.receiver_id); EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS curses_cleanse_bounty ON public.curses;
CREATE TRIGGER curses_cleanse_bounty
	AFTER UPDATE OF cleared_at ON public.curses
	FOR EACH ROW EXECUTE FUNCTION public.curses_cleanse_bounty_check();
