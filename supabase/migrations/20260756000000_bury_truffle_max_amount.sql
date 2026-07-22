-- "Max" bury/top-up — relax the hard {10,20,50} amount whitelist to a range so
-- the client's new Max chip (fill to the 50-snout pot cap, bounded by balance)
-- can stake any concrete number the caps allow, not just the three set chips.
--
-- Both functions keep their signature → CREATE OR REPLACE (no DROP). The four
-- economy governors are untouched: the 50-snout pot cap (top_up's FOR-UPDATE
-- check), one active pot per host, the 3h dig cadence, and the 12h reclaim
-- cooldown. bury_truffle's XP line (p_amount / 10) already generalizes across
-- the range; top-ups grant no XP, so a min of 1 opens no farming angle.
--
-- Carried latest defs (VERBATIM bodies, whitelist swapped for a range):
--   bury_truffle   ← 20260738400000_truffle_reclaim_cooldown.sql
--   top_up_truffle ← 20260657000000_truffle_topup_cap.sql

-- 1. bury_truffle — verbatim from 20260738400000; CARRY DIFF: the {10,20,50}
--    whitelist becomes a [10,50] range check (10 = server min stake, 50 = cap).
CREATE OR REPLACE FUNCTION public.bury_truffle(p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	reclaim_wait constant interval := interval '12 hours';
	have_active  boolean;
	last_reclaim timestamptz;
	paid         int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_amount < 10 OR p_amount > 50 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
	END IF;

	SELECT EXISTS (
		SELECT 1 FROM public.truffles WHERE host_id = caller_id AND dug_at IS NULL
	) INTO have_active;
	IF have_active THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_buried');
	END IF;

	-- Dug up your own truffle? The patch needs 12h to settle before another
	-- bury — otherwise bury→reclaim→bury farms the per-bury XP for free.
	SELECT max(reclaimed_at) INTO last_reclaim
	FROM public.truffles WHERE host_id = caller_id;
	IF last_reclaim IS NOT NULL AND last_reclaim + reclaim_wait > now() THEN
		RETURN jsonb_build_object('ok', false, 'error', 'reclaim_cooldown',
			'next_at', last_reclaim + reclaim_wait);
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	INSERT INTO public.truffles (host_id, reward, remaining) VALUES (caller_id, p_amount, p_amount);
	-- XP scales with the stake: 10/20/50 snouts -> 1/2/5 XP, EVERY bury.
	-- Throughput is capped by the dig-dry cadence + the reclaim cooldown above.
	PERFORM public.grant_season_xp(caller_id, p_amount / 10);
	RETURN jsonb_build_object('ok', true, 'reward', p_amount, 'balance', paid, 'xp', p_amount / 10);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bury_truffle(integer) TO authenticated;

-- 2. top_up_truffle — verbatim from 20260657000000; CARRY DIFF: the {10,20,50}
--    whitelist becomes a [1,50] range check (1 = min add so Max can top a 43/50
--    pot to exactly 50; the FOR-UPDATE pot-cap check below still blocks overshoot).
CREATE OR REPLACE FUNCTION public.top_up_truffle(p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	pot_cap     constant int := 50;
	v_id        bigint;
	v_total     int;
	v_remaining int;
	v_balance   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_amount < 1 OR p_amount > 50 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
	END IF;

	SELECT id, reward, remaining INTO v_id, v_total, v_remaining
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL
	FOR UPDATE;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- Pot cap: never let the live pot exceed 50 snouts. Checked BEFORE charging.
	IF v_remaining + p_amount > pot_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'max_reached', 'cap', pot_cap, 'remaining', v_remaining);
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO v_balance;
	IF v_balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	UPDATE public.truffles
		SET remaining = v_remaining + p_amount,
		    reward    = GREATEST(reward, v_remaining + p_amount)
		WHERE id = v_id
		RETURNING reward, remaining INTO v_total, v_remaining;

	RETURN jsonb_build_object('ok', true, 'total', v_total, 'remaining', v_remaining, 'balance', v_balance);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.top_up_truffle(int) TO authenticated;
