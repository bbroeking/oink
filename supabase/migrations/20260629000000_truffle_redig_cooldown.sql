-- Truffle re-digs after a cooldown (tracker #1).
--
-- truffle_digs' composite PK (truffle_id, digger_id) meant one dig EVER per
-- visitor per truffle. In a small Sounder the shared pot strands: live report —
-- Jen took 8, Freddy took 5, and the last ~7 snouts sat stuck forever, because
-- nobody was left who hadn't dug and the host can't bury a fresh truffle while
-- one is still active (one active truffle per host). With ≤3 active friends the
-- 40%-of-remaining share math only drains the pot if friends can come BACK.
--
-- Fix: visitors may re-dig the SAME truffle after a 3h cooldown (matching the
-- one-visit-per-3h cadence from 20260605), each re-dig a standard bite (40% of
-- remaining, LEAST-capped). dig_truffle's body is otherwise carried verbatim
-- from 20260618 — in particular the announcement stays an INLINE INSERT into
-- system_announcements, never the admin-gated send_system_announcement() (that
-- wrapper rolls back the whole dig for non-admins). Every truffle_digs
-- reference is aliased (dd.) — the 42702 param-vs-column landmine class.

-- 1. Surrogate PK so a (truffle, digger) pair can hold multiple ledger rows.
--    Existing rows are preserved; the cooldown probe (latest dig for this
--    truffle + digger) is covered by the replacement index.
ALTER TABLE public.truffle_digs DROP CONSTRAINT truffle_digs_pkey;
ALTER TABLE public.truffle_digs ADD COLUMN id bigserial PRIMARY KEY;
CREATE INDEX truffle_digs_truffle_digger_dug_at_idx
	ON public.truffle_digs (truffle_id, digger_id, dug_at);

-- 2. dig_truffle: one-dig-ever EXISTS check → 3h-per-(truffle, digger) cooldown.
--    Return shapes unchanged except the new failure reason:
--    { ok:false, error:'dig_cooldown', next_at:<latest dug_at + 3h> }.
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
	redig_wait   constant interval := interval '3 hours';  -- matches visit cadence
	v_truffle_id bigint;
	v_remaining  int;
	v_take       int;
	v_left       int;
	last_dig     timestamptz;
	digger_name  text;
	first_today  boolean;
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

	-- One share per visitor per 3h on THIS truffle (was: one dig EVER, which
	-- stranded the pot in small Sounders — see header).
	SELECT dd.dug_at INTO last_dig
	FROM public.truffle_digs dd
	WHERE dd.truffle_id = v_truffle_id AND dd.digger_id = caller_id
	ORDER BY dd.dug_at DESC
	LIMIT 1;
	IF last_dig IS NOT NULL AND last_dig + redig_wait > now() THEN
		RETURN jsonb_build_object('ok', false, 'error', 'dig_cooldown',
			'next_at', last_dig + redig_wait);
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

	-- First dig of the (UTC) day? Checked BEFORE inserting this dig's ledger row.
	SELECT NOT EXISTS (
		SELECT 1 FROM public.truffle_digs dd
		WHERE dd.digger_id = caller_id
		  AND (dd.dug_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	INSERT INTO public.truffle_digs AS dd (truffle_id, digger_id, amount)
		VALUES (v_truffle_id, caller_id, v_take);

	-- Pay the digger; thank the host (generous, tied to a real dig) + notify.
	UPDATE public.profiles SET counter = counter + v_take WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	-- Inline the announcement INSERT instead of send_system_announcement() —
	-- that wrapper is admin-gated and would abort this whole dig for non-admins.
	SELECT username INTO digger_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'truffle_dug', 'Your truffle was found! 🐽',
		COALESCE(digger_name, 'A visitor') || ' dug up ' || v_take || ' snouts from your truffle.',
		'{}'::jsonb
	);

	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 3); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', v_take, 'remaining', v_left);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dig_truffle(uuid) TO authenticated;
