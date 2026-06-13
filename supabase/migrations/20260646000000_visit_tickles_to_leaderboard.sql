-- Barn-visit economy rework (player request):
--   1. Visiting NO LONGER spends the visitor's tickle bank — the whole
--      cost block (materialize regen + deduct from user_items) is gone,
--      and the 'no_tickles' refusal with it. The visit budget is the
--      client's random 3–7 sleepy roll, bounded by the server's
--      unchanged 7/hour per-barn tired ceiling.
--   2. Each tap pays the HOST's leaderboard count directly —
--      counter + tickles_earned, the 20260628 Trough precedent — instead
--      of dripping into their tickle bank via grant_tickles ("applied to
--      their leaderboard count, rather than their available").
--
-- Unchanged: 3h one-friend cooldown, 7/hr tired ceiling, mutual
-- happiness, first-tap generosity + inline announcement, +5 XP per tap.
-- Return drops 'visitor_balance' (nothing is spent); old clients guard
-- with `typeof === "number"` so its absence is safe. barn_visit_status
-- still returns the bank fields for pre-97 clients' YOUR TICKLES bar.
--
-- Body otherwise verbatim from 20260613 (latest tickle_at_barn def).

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;
	tired_cap      constant int := 7;
	visit_cooldown constant interval := '3 hours';
	taps_this_hour int;
	last_other_at  timestamptz;
	visitor_name   text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_target');
	END IF;

	-- One person every 3 hours: if you've tickled a DIFFERENT barn inside the
	-- cooldown, you can't start on this one yet. Re-tapping the same barn is ok.
	SELECT max(created_at) INTO last_other_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id <> p_target;
	IF last_other_at IS NOT NULL AND last_other_at > now() - visit_cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown', 'next_at', last_other_at + visit_cooldown
		);
	END IF;

	-- Per-barn tired ceiling: at most tired_cap taps/hour on the same barn.
	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';
	IF taps_this_hour >= tired_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'tired');
	END IF;

	-- The given tickle lands on the host's LEADERBOARD (counter +
	-- tickles_earned, the 20260628 payout shape) — not their bank.
	UPDATE public.profiles
	SET counter = counter + host_reward,
	    tickles_earned = tickles_earned + host_reward
	WHERE id = p_target;

	-- Both pigs get happier (yours full, theirs 25%, both window-capped).
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	-- First tap of the session: generosity + notify (once).
	IF taps_this_hour = 0 THEN
		PERFORM public.shift_alignment(caller_id, 1);
		SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			p_target, 'barn_visit', 'Someone visited your Barn!',
			COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!',
			'{}'::jsonb
		);
	END IF;

	PERFORM public.grant_season_xp(caller_id, 5);

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'taps_left', tired_cap - taps_this_hour - 1
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;
