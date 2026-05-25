-- Bounty reroll mechanic.
--
-- 25 snouts swaps a bounty you don't want with a random one from
-- the 3-bounty inactive pool (the ones the weekly rotation didn't
-- pick this week). Each slot can be rerolled at most ONCE per
-- week — no thrash-rerolling to land on the easiest option.
--
-- Schema: user_bounty_rerolls(user_id, week_start, slot_code, new_code).
-- The "slot" identity is the ORIGINAL bounty code from the rotation;
-- the replacement lives in new_code. Composite PK enforces one reroll
-- per slot per week.
--
-- my_weekly_bounties is rewritten to apply rerolls when computing
-- the 3 visible bounties: for each slot, if a reroll row exists,
-- swap the slot's code for the replacement. Returns both `code`
-- (visible) and `slot_code` (immutable) so the client can show
-- "already rerolled this slot" state.

-- ── 1. The rerolls log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bounty_rerolls (
	user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	week_start   date        NOT NULL,
	slot_code    text        NOT NULL,
	new_code     text        NOT NULL,
	snouts_paid  int         NOT NULL DEFAULT 25,
	rerolled_at  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, week_start, slot_code)
);

ALTER TABLE public.user_bounty_rerolls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own bounty rerolls" ON public.user_bounty_rerolls;
CREATE POLICY "View own bounty rerolls"
	ON public.user_bounty_rerolls FOR SELECT
	USING (auth.uid() = user_id);

-- ── 2. Rewritten my_weekly_bounties — applies rerolls ────────────
-- Adds `slot_code` (immutable per slot per week) + `rerolled` bool
-- alongside the existing fields. The `code` field is the VISIBLE
-- bounty (replacement if rerolled, original otherwise).
--
-- Drop+recreate because the return-type signature changed (added 2
-- columns); CREATE OR REPLACE rejects signature changes.
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
	n_fulfilled int := 0;
	n_received  int := 0;
	n_blessings int := 0;
	n_curses    int := 0;
	n_distinct  int := 0;
BEGIN
	IF caller_id IS NULL THEN RETURN; END IF;

	SELECT COUNT(*) INTO n_fulfilled FROM public.tickle_trades
		WHERE target_id = caller_id AND status = 'fulfilled' AND fulfilled_at >= wk_ts;
	SELECT COUNT(*) INTO n_received FROM public.tickle_trades
		WHERE requester_id = caller_id AND status = 'fulfilled' AND fulfilled_at >= wk_ts;
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
	),
	rotation AS (
		-- The 3 originals for this week's rotation.
		SELECT pl.code AS slot_code, pl.idx
		FROM pool pl
		WHERE pl.idx IN (rot, (rot + 1) % 6, (rot + 2) % 6)
	),
	resolved AS (
		-- For each rotation slot, apply any reroll: if user has a
		-- reroll row for this slot this week, use new_code; else
		-- the original.
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
		pl.code,
		res.slot_code,
		res.rerolled,
		pl.name,
		pl.description,
		pl.goal,
		LEAST(pl.progress, pl.goal) AS progress,
		pl.reward_snouts,
		EXISTS (
			SELECT 1 FROM public.user_bounty_claims ubc
			WHERE ubc.user_id = caller_id
			  AND ubc.bounty_code = pl.code
			  AND ubc.week_start = wk_start
		) AS claimed
	FROM resolved res
	JOIN pool pl ON pl.code = res.visible_code
	ORDER BY pl.idx;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_weekly_bounties() TO authenticated;

-- ── 3. reroll_bounty — swap a slot for 25 snouts ─────────────────
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
	rot          int;
	active_slots text[];
	target_slot  text;
	replacement  text;
	rows_updated int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- The 3 rotation slots this week (immutable from week_num)
	rot := week_num % 6;
	WITH pool(idx, code) AS (
		VALUES
		(0, 'generous_hoof'), (1, 'well_asked'), (2, 'daily_light'),
		(3, 'mischief_maker'), (4, 'even_hand'), (5, 'social_butterfly')
	)
	SELECT ARRAY_AGG(code ORDER BY idx) INTO active_slots
	FROM pool WHERE idx IN (rot, (rot + 1) % 6, (rot + 2) % 6);

	-- Identify which slot the passed code belongs to. Either it's
	-- one of the original 3 (no reroll yet), or it's a replacement
	-- from an existing reroll.
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

	-- Already rerolled this slot this week? Hard reject.
	IF EXISTS (
		SELECT 1 FROM public.user_bounty_rerolls
		WHERE user_id = caller_id AND week_start = wk_start AND slot_code = target_slot
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rerolled');
	END IF;

	-- Pick a replacement from the 3 INACTIVE codes (not in this
	-- week's rotation). ORDER BY random() picks one of those 3.
	WITH pool(code) AS (
		VALUES
		('generous_hoof'), ('well_asked'), ('daily_light'),
		('mischief_maker'), ('even_hand'), ('social_butterfly')
	)
	SELECT pool.code INTO replacement
	FROM pool
	WHERE pool.code <> ALL(active_slots)
	ORDER BY random()
	LIMIT 1;

	IF replacement IS NULL THEN
		-- Shouldn't happen with a 6-pool / 3-active rotation, but
		-- be defensive in case the pool grows past 6 with all
		-- inactive ones already rerolled-into.
		RETURN jsonb_build_object('ok', false, 'reason', 'no_replacement');
	END IF;

	-- Charge 25 snouts. Atomic — won't deduct if you can't afford.
	UPDATE public.profiles
		SET counter = counter - 25
		WHERE id = caller_id AND counter >= 25;
	GET DIAGNOSTICS rows_updated = ROW_COUNT;
	IF rows_updated = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_snouts');
	END IF;

	-- Record the reroll. ON CONFLICT shouldn't fire (we checked
	-- above) but belt-and-suspenders.
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
