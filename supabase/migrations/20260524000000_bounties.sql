-- Phase 3 of Season 1: weekly bounty board.
--
-- 6 bounty definitions; 3 are active each ISO week, picked by a
-- deterministic rotating window (week_number % 6). Progress is
-- computed live from existing tables (tickle_trades, blessings,
-- curses) — there is no per-action progress write, so bounties
-- can't drift out of sync.
--
-- Claims are recorded in user_bounty_claims, unique per
-- (user, code, week_start), so a bounty can be claimed once per
-- week and re-appears fresh when its week comes around again.

CREATE TABLE IF NOT EXISTS public.user_bounty_claims (
	user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	bounty_code text        NOT NULL,
	week_start  date        NOT NULL,
	claimed_at  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, bounty_code, week_start)
);

ALTER TABLE public.user_bounty_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own bounty claims" ON public.user_bounty_claims;
CREATE POLICY "View own bounty claims"
	ON public.user_bounty_claims FOR SELECT
	USING (auth.uid() = user_id);

-- ── ISO-week start (Monday 00:00 UTC) as a date. Stable anchor for
-- both progress windows and claim uniqueness.
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS date
LANGUAGE sql
STABLE
AS $$
	SELECT (date_trunc('week', now() AT TIME ZONE 'UTC'))::date;
$$;

-- ── my_weekly_bounties: the 3 bounties active this week, each with
-- the caller's live progress + claimed flag.
--
-- The 6-bounty pool, in rotation order:
--   0 generous_hoof   fulfill 3 trades            +150
--   1 debt_settler    repay 2 trades              +200
--   2 daily_light     send 5 blessings            +100
--   3 mischief_maker  send 5 curses               +100
--   4 loop_closer     fulfill >=1 AND repay >=1   +150
--   5 social_butterfly trade with 3 distinct friends +200
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
	-- live counters
	n_fulfilled    int := 0;   -- trades the caller GAVE (fulfilled others)
	n_received     int := 0;   -- caller's own requests that got fulfilled
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
		(0, 'generous_hoof',   'Generous Hoof',   'Fulfill 3 trade requests this week.',          3, n_fulfilled, 150),
		(1, 'well_asked',      'Asked & Answered','Have 3 of your requests fulfilled this week.', 3, n_received,  200),
		(2, 'daily_light',     'Daily Light',     'Send 5 blessings this week.',                  5, n_blessings, 100),
		(3, 'mischief_maker',  'Mischief Maker',  'Send 5 curses this week.',                     5, n_curses,    100),
		(4, 'even_hand',       'Even Hand',       'Give 2 trades and receive 2 this week.',       4, LEAST(n_fulfilled,2) + LEAST(n_received,2), 150),
		(5, 'social_butterfly','Social Butterfly','Trade with 3 different friends this week.',    3, n_distinct,  200)
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
	-- the 3 active this week: rot, rot+1, rot+2 (mod 6)
	WHERE pl.idx IN (rot, (rot + 1) % 6, (rot + 2) % 6)
	ORDER BY pl.idx;
END;
$function$;

-- ── claim_bounty: grant the reward if progress met + not yet
-- claimed this week. Re-derives progress server-side (never trusts
-- a client-passed number).
CREATE OR REPLACE FUNCTION public.claim_bounty(bounty_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	wk_start  date := public.current_week_start();
	b         record;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO b FROM public.my_weekly_bounties()
		WHERE code = bounty_code;
	IF b IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_active');
	END IF;
	IF b.claimed THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;
	IF b.progress < b.goal THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'incomplete');
	END IF;

	-- Insert the claim FIRST, then check FOUND. Two concurrent calls
	-- can both pass the b.claimed check above; only the one whose
	-- INSERT actually lands may grant snouts. Without this guard the
	-- losing call's INSERT no-ops on conflict but the UPDATE below
	-- still runs → reward paid twice. (Same pattern as finalize_season.)
	INSERT INTO public.user_bounty_claims (user_id, bounty_code, week_start)
		VALUES (caller_id, bounty_code, wk_start)
		ON CONFLICT DO NOTHING;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	UPDATE public.profiles SET counter = counter + b.reward_snouts
		WHERE id = caller_id;

	RETURN jsonb_build_object('ok', true, 'reward_snouts', b.reward_snouts);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.current_week_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_weekly_bounties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bounty(text) TO authenticated;
