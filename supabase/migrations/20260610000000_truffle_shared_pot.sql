-- Shared truffle pot 🐽 (barn visiting v4). A buried truffle is no longer a
-- single winner-takes-all prize — it's a depleting pot. Each visitor digs up a
-- SHARE of what's left (40% of remaining), so later visitors still get a cut.
-- When fewer than 5 snouts remain, the next dig takes the rest and the truffle
-- is emptied. One dig per visitor per truffle (tracked in truffle_digs), so the
-- leftover is genuinely for OTHER friends. See docs/barn-visiting-design.md §3b.

-- 1. Truffles gain a `remaining` balance that depletes across digs. `reward`
--    keeps its meaning as the total originally buried.
ALTER TABLE public.truffles ADD COLUMN IF NOT EXISTS remaining int;
UPDATE public.truffles
   SET remaining = CASE WHEN dug_at IS NULL THEN reward ELSE 0 END
 WHERE remaining IS NULL;
ALTER TABLE public.truffles ALTER COLUMN remaining SET DEFAULT 0;
ALTER TABLE public.truffles ALTER COLUMN remaining SET NOT NULL;

-- 2. Per-digger ledger — enforces one dig per visitor per truffle (PK) and
--    records how much each visitor took. Read-only to its own owner; all writes
--    go through the SECURITY DEFINER RPC below.
CREATE TABLE IF NOT EXISTS public.truffle_digs (
	truffle_id bigint      NOT NULL REFERENCES public.truffles(id) ON DELETE CASCADE,
	digger_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	amount     int         NOT NULL,
	dug_at     timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (truffle_id, digger_id)
);
ALTER TABLE public.truffle_digs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS truffle_digs_read_own ON public.truffle_digs;
CREATE POLICY truffle_digs_read_own ON public.truffle_digs
	FOR SELECT TO authenticated USING (digger_id = auth.uid());

-- 3. bury_truffle(): unchanged except it now seeds `remaining` = the full pot.
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

	UPDATE public.profiles
		SET counter = counter - cost
		WHERE id = caller_id AND counter >= cost
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', cost);
	END IF;

	INSERT INTO public.truffles (host_id, reward, remaining) VALUES (caller_id, reward, reward);
	RETURN jsonb_build_object('ok', true, 'reward', reward, 'balance', paid);
END;
$function$;

-- 4. dig_truffle(p_host): take a SHARE of the host's active truffle.
--    • 40% of what's left, rounded; if under 5 remain, take it all.
--    • one dig per visitor per truffle (truffle_digs PK).
--    • the truffle stays active (dug_at NULL) until depleted, then dug_at is set
--      so the host can bury a fresh one. Row-locked for a clean concurrent race.
CREATE OR REPLACE FUNCTION public.dig_truffle(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	share        constant numeric := 0.40;  -- fraction of remaining per dig
	floor_all    constant int := 5;         -- under this many left → take the rest
	v_truffle_id bigint;
	v_remaining  int;
	v_take       int;
	v_left       int;
	host_name    text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	-- Lock the host's active truffle so concurrent diggers serialise.
	SELECT id, remaining INTO v_truffle_id, v_remaining
	FROM public.truffles
	WHERE host_id = p_host AND dug_at IS NULL
	FOR UPDATE;

	IF v_truffle_id IS NULL OR v_remaining <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- One share per visitor.
	IF EXISTS (
		SELECT 1 FROM public.truffle_digs
		WHERE truffle_id = v_truffle_id AND digger_id = caller_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_dug');
	END IF;

	-- Your share of what's left.
	IF v_remaining < floor_all THEN
		v_take := v_remaining;
	ELSE
		v_take := GREATEST(1, round(v_remaining * share)::int);
	END IF;
	v_take := LEAST(v_take, v_remaining);
	v_left := v_remaining - v_take;

	UPDATE public.truffles
		SET remaining = v_left,
		    dug_by    = caller_id,
		    dug_at    = CASE WHEN v_left <= 0 THEN now() ELSE dug_at END
		WHERE id = v_truffle_id;

	INSERT INTO public.truffle_digs (truffle_id, digger_id, amount)
		VALUES (v_truffle_id, caller_id, v_take);

	-- Pay the digger; thank the host (generous, tied to a real dig) + notify.
	UPDATE public.profiles SET counter = counter + v_take WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	SELECT username INTO host_name FROM public.profiles WHERE id = caller_id;
	PERFORM public.send_system_announcement(
		p_host, 'truffle_dug',
		'Your truffle was found! 🐽',
		COALESCE(host_name, 'A visitor') || ' dug up ' || v_take || ' snouts from your truffle.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object('ok', true, 'reward', v_take, 'remaining', v_left);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bury_truffle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dig_truffle(uuid) TO authenticated;
