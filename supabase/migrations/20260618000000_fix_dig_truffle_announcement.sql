-- Fix (regression): dig_truffle silently failed for every NON-admin user.
--
-- The shared-pot rewrite (20260610) and the xp rewrite (20260613) reintroduced a
-- call to public.send_system_announcement(...), which is ADMIN-GATED — it does
-- `IF NOT COALESCE(caller_is_test,false) THEN RAISE EXCEPTION 'admin_only'`
-- (20260556_system_announcements.sql). dig_truffle is one transaction, so for a
-- normal player that exception rolled back the ENTIRE dig: no payout, no ledger
-- row, no notification — the shovel just vanished with no reward. It only
-- "worked" for admin/test accounts (is_test=true), which is exactly why it
-- looked fine in testing but was "broken for some users" in the wild.
--
-- 20260593_fix_barn_notifications.sql had already fixed this exact class of bug
-- for tickle_at_barn + dig_truffle by INSERTing the announcement row directly
-- (these RPCs are SECURITY DEFINER, so they can write system_announcements
-- without the admin wrapper). 20260613 kept that inline INSERT for tickle_at_barn
-- but reverted dig_truffle to send_system_announcement. This restores the inline
-- INSERT for dig_truffle. Logic is otherwise byte-for-byte the live 20260613
-- version (shared-pot share math, one-dig-per-visitor ledger, first-dig-of-day
-- season XP). Best-effort push is intentionally dropped (push isn't wired yet —
-- missing aps-environment entitlement); the row surfaces via the WhileAway modal.

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

	-- First dig of the (UTC) day? Checked BEFORE inserting this dig's ledger row.
	SELECT NOT EXISTS (
		SELECT 1 FROM public.truffle_digs
		WHERE digger_id = caller_id
		  AND (dug_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	INSERT INTO public.truffle_digs (truffle_id, digger_id, amount)
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
