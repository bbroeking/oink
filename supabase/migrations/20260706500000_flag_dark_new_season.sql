-- ════════════════════════════════════════════════════════════════════════
-- FLAG-DARK the entire new season. Directive (Brian, Jul 6): the next
-- season and every system built for it must be invisible to ALL live
-- players — only Brian's own account previews it. No date auto-flips.
--
--   1. The Jul-12 pass auto-flip is KILLED: snout_season_2 moves to a
--      far-future placeholder window (2027-01-01). Launch day = one
--      UPDATE of both season rows (documented in the flip runbook).
--      Season 1's pass extends through Aug 9 so no player ever hits the
--      "no active season" hole again while the flip date is undecided.
--   2. Globals forced dark: world_boss AND mud_wars are disabled in
--      app_config for everyone (upserted false).
--   3. Brian's account gets per-user overrides for both flags — the
--      preview path already honored by the client flag hook, the new
--      active_season(), and (below) the golden barn roll.
--   4. dig_truffle — carried from 20260706200000; the golden-barn gate
--      now uses the EFFECTIVE flag (per-user override wins over the
--      global) so the preview account can test golden finds pre-flip.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.seasons SET ends_at = '2026-08-09 00:00:00+00'
	WHERE id = 'snout_season_1';
UPDATE public.seasons
	SET starts_at = '2027-01-01 00:00:00+00', ends_at = '2027-02-01 00:00:00+00'
	WHERE id = 'snout_season_2';

INSERT INTO public.app_config (key, enabled) VALUES
	('world_boss', false), ('mud_wars', false)
ON CONFLICT (key) DO UPDATE SET enabled = false;

UPDATE public.profiles
	SET feature_overrides = feature_overrides
		|| '{"world_boss": true, "mud_wars": true}'::jsonb
	WHERE username = 'Brian';

-- dig_truffle — carried VERBATIM from 20260706200000; ONE change: the
-- golden gate reads the caller's EFFECTIVE world_boss flag.
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
	v_world_boss boolean := false;
	v_golden     boolean := false;
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
	-- stranded the pot in small Sounders — see 20260629 header).
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

	-- GOLDEN barn truffle: 20% per dig, once per digger per UTC day — +5 to
	-- the DIGGER's leaderboard count (tickles_earned), never the bank.
	-- CARRY DIFF: gate on the caller's EFFECTIVE world_boss flag (per-user
	-- override wins over the global) so the preview account can test it.
	v_world_boss := COALESCE(
		(SELECT (feature_overrides ->> 'world_boss')::boolean
		   FROM public.profiles WHERE id = caller_id),
		NULL);
	IF v_world_boss IS NULL THEN
		v_world_boss := COALESCE(
			(SELECT enabled FROM public.app_config WHERE key = 'world_boss'), false);
	END IF;
	IF v_world_boss AND random() < 0.20 THEN
		BEGIN
			INSERT INTO public.golden_barn_finds (user_id, found_on)
				VALUES (caller_id, (now() AT TIME ZONE 'UTC')::date);
			UPDATE public.profiles SET tickles_earned = tickles_earned + 5
				WHERE id = caller_id;
			v_golden := true;
		EXCEPTION WHEN unique_violation THEN
			v_golden := false;  -- already struck gold today
		END;
	END IF;

	-- Inline the announcement INSERT instead of send_system_announcement() —
	-- that wrapper is admin-gated and would abort this whole dig for non-admins.
	SELECT username INTO digger_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'truffle_dug', 'Your truffle was found!',
		COALESCE(digger_name, 'A visitor') || ' dug up ' || v_take || ' snouts from your truffle.'
			|| CASE WHEN v_golden THEN ' It came up GOLDEN.' ELSE '' END,
		'{}'::jsonb
	);

	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 3); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', v_take, 'remaining', v_left,
		'golden', v_golden);
END;
$function$;
