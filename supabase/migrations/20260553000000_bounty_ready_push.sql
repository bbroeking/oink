-- Bounty-ready push + bounty_ready_count() RPC for a Season-tab
-- badge dot.
--
-- Until now, when a bounty's progress reached its goal, the only
-- feedback was the Claim button appearing on the card next time
-- the player opened the Season tab. No push, no badge. Tier-2+
-- players left snouts on the table.
--
-- This migration adds:
--   1. user_bounty_notified — tracks per-week pushes so a single
--      cross of the goal fires exactly one push (not one per
--      subsequent underlying write).
--   2. notify_ready_bounties(uid) — pushes any not-yet-notified
--      ready bounties for the user; uses INSERT-then-check-FOUND
--      to win the race against concurrent triggers.
--   3. bounty_ready_count() RPC — for the badge dot, polled by the
--      client on focus.
--   4. Triggers on tickle_trades / blessings / curses — the three
--      tables whose writes can move bounty progress — to fire
--      notify_ready_bounties for the affected users.

-- ── 1. Notification log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bounty_notified (
	user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	bounty_code text        NOT NULL,
	week_start  date        NOT NULL,
	notified_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, bounty_code, week_start)
);

ALTER TABLE public.user_bounty_notified ENABLE ROW LEVEL SECURITY;
-- No user-facing SELECT policy; this is server-only state.

-- ── 2. notify_ready_bounties ──────────────────────────────────────
-- For each currently-ready (progress >= goal, NOT claimed) bounty
-- that hasn't been notified yet this week, push the user and log
-- the notification. Race-safe via insert-then-check-FOUND.
CREATE OR REPLACE FUNCTION public.notify_ready_bounties(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	wk_start date := public.current_week_start();
	b        record;
BEGIN
	IF target_user_id IS NULL THEN RETURN; END IF;

	-- my_weekly_bounties() reads auth.uid() — we need to run as
	-- the target user. Re-derive its result inline here with a
	-- direct query keyed on the target_user_id (mirrors what
	-- my_weekly_bounties does but parameterized).
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
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_blessings,
				(SELECT COUNT(*) FROM public.curses, wk
					WHERE sender_id = target_user_id AND sent_at >= ws) AS n_curses,
				(SELECT COUNT(DISTINCT partner) FROM (
					SELECT CASE WHEN requester_id = target_user_id THEN target_id
					            ELSE requester_id END AS partner
					FROM public.tickle_trades, wk
					WHERE (requester_id = target_user_id OR target_id = target_user_id)
					  AND status='fulfilled' AND created_at >= ws
				) p) AS n_distinct
		),
		rot AS (
			SELECT EXTRACT(WEEK FROM (now() AT TIME ZONE 'UTC'))::int % 6 AS r
		),
		pool(idx, code, name, goal, progress) AS (
			SELECT * FROM (VALUES
				(0, 'generous_hoof',   'Generous Hoof',    3, (SELECT n_fulfilled FROM counters)),
				(1, 'well_asked',      'Asked & Answered', 3, (SELECT n_received  FROM counters)),
				(2, 'daily_light',     'Daily Light',      5, (SELECT n_blessings FROM counters)),
				(3, 'mischief_maker',  'Mischief Maker',   5, (SELECT n_curses    FROM counters)),
				(4, 'even_hand',       'Even Hand',        4, LEAST((SELECT n_fulfilled FROM counters),2) + LEAST((SELECT n_received FROM counters),2)),
				(5, 'social_butterfly','Social Butterfly', 3, (SELECT n_distinct  FROM counters))
			) AS v(idx, code, name, goal, progress)
		)
		SELECT pl.code, pl.name, pl.goal
		FROM pool pl, rot
		WHERE pl.idx IN (rot.r, (rot.r + 1) % 6, (rot.r + 2) % 6)
		  AND pl.progress >= pl.goal
		  -- Not already claimed
		  AND NOT EXISTS (
		    SELECT 1 FROM public.user_bounty_claims c
		    WHERE c.user_id = target_user_id
		      AND c.bounty_code = pl.code
		      AND c.week_start = wk_start
		  )
	LOOP
		-- Race-safe: try the INSERT first, only push if WE landed it.
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

GRANT EXECUTE ON FUNCTION public.notify_ready_bounties(uuid) TO authenticated;

-- ── 3. bounty_ready_count — for the Season-tab badge dot ──────────
CREATE OR REPLACE FUNCTION public.bounty_ready_count()
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COUNT(*)::int
	FROM public.my_weekly_bounties()
	WHERE progress >= goal AND NOT claimed;
$function$;

GRANT EXECUTE ON FUNCTION public.bounty_ready_count() TO authenticated;

-- ── 4. Triggers on the bounty-moving tables ───────────────────────
-- Wrapped so a notify failure can't cascade into the underlying
-- write rolling back.

CREATE OR REPLACE FUNCTION public.tickle_trades_bounty_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	IF NEW.status = 'fulfilled'
	   AND (OLD.status IS DISTINCT FROM NEW.status) THEN
		BEGIN PERFORM public.notify_ready_bounties(NEW.requester_id); EXCEPTION WHEN OTHERS THEN NULL; END;
		BEGIN PERFORM public.notify_ready_bounties(NEW.target_id);    EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickle_trades_bounty ON public.tickle_trades;
CREATE TRIGGER tickle_trades_bounty
	AFTER INSERT OR UPDATE OF status ON public.tickle_trades
	FOR EACH ROW EXECUTE FUNCTION public.tickle_trades_bounty_check();

CREATE OR REPLACE FUNCTION public.blessings_bounty_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	BEGIN PERFORM public.notify_ready_bounties(NEW.sender_id); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS blessings_bounty ON public.blessings;
CREATE TRIGGER blessings_bounty
	AFTER INSERT ON public.blessings
	FOR EACH ROW EXECUTE FUNCTION public.blessings_bounty_check();

CREATE OR REPLACE FUNCTION public.curses_bounty_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	BEGIN PERFORM public.notify_ready_bounties(NEW.sender_id); EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS curses_bounty ON public.curses;
CREATE TRIGGER curses_bounty
	AFTER INSERT ON public.curses
	FOR EACH ROW EXECUTE FUNCTION public.curses_bounty_check();
