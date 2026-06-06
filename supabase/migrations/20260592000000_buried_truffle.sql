-- Buried truffle 🐽 (barn visiting v3). The host buries a truffle in their barn
-- (pays snouts — a treat left for visitors, a TRANSFER not minted); the first
-- visitor to dig it up wins the snouts. Self-limiting: one active truffle per
-- host, first-come-first-served. The host earns +1 generous only when a real
-- visitor digs it (tied to a recipient, so it can't be cheaply self-farmed).
-- See docs/barn-visiting-design.md §3b.

CREATE TABLE IF NOT EXISTS public.truffles (
	id        bigserial PRIMARY KEY,
	host_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reward    int  NOT NULL,
	buried_at timestamptz NOT NULL DEFAULT now(),
	dug_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	dug_at    timestamptz
);
-- At most one un-dug truffle per host.
CREATE UNIQUE INDEX IF NOT EXISTS truffles_one_active_per_host
	ON public.truffles (host_id) WHERE dug_at IS NULL;

ALTER TABLE public.truffles ENABLE ROW LEVEL SECURITY;
-- Read-only to clients so the visit screen can show "a truffle is here"; writes
-- go only through the SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS truffles_read ON public.truffles;
CREATE POLICY truffles_read ON public.truffles FOR SELECT TO authenticated USING (true);

-- bury_truffle(): host pays `cost` snouts to set out a treat. No-op (returns the
-- existing one) if they already have an active truffle.
CREATE OR REPLACE FUNCTION public.bury_truffle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost   constant int := 20;
	reward constant int := 20;
	have_active boolean;
	paid int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	SELECT EXISTS (
		SELECT 1 FROM public.truffles WHERE host_id = caller_id AND dug_at IS NULL
	) INTO have_active;
	IF have_active THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_buried');
	END IF;

	-- Pay for the treat (snouts = profiles.counter).
	UPDATE public.profiles
		SET counter = counter - cost
		WHERE id = caller_id AND counter >= cost
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', cost);
	END IF;

	INSERT INTO public.truffles (host_id, reward) VALUES (caller_id, reward);
	RETURN jsonb_build_object('ok', true, 'reward', reward, 'balance', paid);
END;
$function$;

-- dig_truffle(p_host): first visitor to call wins the host's active truffle.
-- The UPDATE ... WHERE dug_at IS NULL RETURNING makes the race atomic — only one
-- caller gets a row back.
CREATE OR REPLACE FUNCTION public.dig_truffle(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	won_reward int;
	host_name  text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	UPDATE public.truffles
		SET dug_by = caller_id, dug_at = now()
		WHERE host_id = p_host AND dug_at IS NULL
		RETURNING reward INTO won_reward;

	IF won_reward IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- Pay the digger; thank the host (generous, tied to a real dig) + notify.
	UPDATE public.profiles SET counter = counter + won_reward WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	SELECT username INTO host_name FROM public.profiles WHERE id = caller_id;
	PERFORM public.send_system_announcement(
		p_host, 'truffle_dug',
		'Your truffle was found! 🐽',
		COALESCE(host_name, 'A visitor') || ' dug up the truffle you buried.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object('ok', true, 'reward', won_reward);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bury_truffle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dig_truffle(uuid) TO authenticated;
