-- Truffle bury XP scales with the stake (player request): 10/20/50 snouts
-- bury -> 1/2/5 season XP, on EVERY bury (was a flat +5 on the first bury of
-- the UTC day). Anti-farm holds without the daily gate: one active truffle
-- per host, and the pot must be dug empty (friends' 3h dig cadence) before a
-- re-bury — worst case is a handful of buries/day. Body otherwise verbatim
-- from 20260613 (latest def). Return gains an additive 'xp' key.

CREATE OR REPLACE FUNCTION public.bury_truffle(p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	have_active boolean;
	paid        int;
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

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	INSERT INTO public.truffles (host_id, reward, remaining) VALUES (caller_id, p_amount, p_amount);
	-- XP scales with the stake: 10/20/50 snouts -> 1/2/5 XP, EVERY bury.
	-- Throughput is naturally capped (one active truffle per host; it must
	-- be dug dry before a re-bury), so no first-per-day gate needed.
	PERFORM public.grant_season_xp(caller_id, p_amount / 10);
	RETURN jsonb_build_object('ok', true, 'reward', p_amount, 'balance', paid, 'xp', p_amount / 10);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bury_truffle(integer) TO authenticated;
