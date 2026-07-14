-- Reclaim → re-bury cooldown (12h) — closes the free-XP loop.
--
-- bury_truffle's anti-farm note (20260637) assumed the pot "must be dug empty
-- before a re-bury". reclaim_truffle (20260656, added later) broke that: it
-- frees the one-per-host slot AND refunds the full remaining, so
--   bury 50 (+5 XP) → reclaim (full refund) → bury 50 (+5 XP) → …
-- was unlimited XP at zero cost. Fix: digging up YOUR OWN truffle starts a
-- 12h cooldown before you can bury again. Friends digging the pot dry keeps
-- allowing an immediate re-bury — that loop is the designed social cadence,
-- and it costs real snouts to real diggers.
--
-- Carried latest defs:
--   bury_truffle    ← 20260637000000_bury_xp_scales.sql
--   reclaim_truffle ← 20260656000000_truffle_reclaim_and_topup.sql

ALTER TABLE public.truffles
	ADD COLUMN IF NOT EXISTS reclaimed_at timestamptz;

-- 1. reclaim_truffle — verbatim from 20260656; CARRY DIFF: stamp reclaimed_at
--    on the close and surface next_bury_at so the client can speak plainly.
CREATE OR REPLACE FUNCTION public.reclaim_truffle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	reclaim_wait constant interval := interval '12 hours';
	v_id         bigint;
	v_remaining  int;
	v_balance    int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	SELECT id, remaining INTO v_id, v_remaining
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL
	FOR UPDATE;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- Close it (dug_at set → slot freed, no longer diggable) and refund the
	-- rest. reclaimed_at marks this as a HOST dig-up: bury_truffle reads it
	-- for the 12h re-bury cooldown (friends digging it dry never sets it).
	UPDATE public.truffles
		SET remaining = 0, dug_at = now(), reclaimed_at = now()
		WHERE id = v_id;

	UPDATE public.profiles
		SET counter = counter + v_remaining
		WHERE id = caller_id
		RETURNING counter INTO v_balance;

	RETURN jsonb_build_object('ok', true, 'refunded', v_remaining,
		'balance', v_balance, 'next_bury_at', now() + reclaim_wait);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reclaim_truffle() TO authenticated;

-- 2. bury_truffle — verbatim from 20260637; CARRY DIFF: reclaim cooldown gate
--    between the active-truffle check and the charge.
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
	IF p_amount NOT IN (10, 20, 50) THEN
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
