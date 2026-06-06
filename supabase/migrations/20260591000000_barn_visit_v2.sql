-- Barn visiting v2 — the warmth loop. Two additions to tickle_at_barn:
--   1. Generosity: visiting is a GIVING act, so the visitor's alignment shifts
--      +1 (generous). Calibrated below the +2 of a full tickle-trade gift since
--      it's smaller + repeatable. This makes barn visiting the game's most
--      natural generosity source (see docs/barn-visiting-design.md).
--   2. Daily visit budget: only the first N rewarded visits/day grant anything
--      (gift + generosity). Beyond the budget you can still look + tickle, but
--      it's a no-reward "just saying hi" — a legible rate limit, like the
--      tickle bank. Combined with the existing per-target hourly cooldown.

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	cooldown     constant interval := '1 hour';
	reward       constant int := 3;
	daily_budget constant int := 5;
	todays_visits int;
	last_at      timestamptz;
	visitor_name text;
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

	-- Daily budget: count today's rewarded visits (UTC day).
	SELECT count(*) INTO todays_visits
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND created_at >= date_trunc('day', now());

	IF todays_visits >= daily_budget THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'budget', 'budget', daily_budget
		);
	END IF;

	-- Per-target hourly cooldown (anti-farm on a single barn).
	SELECT max(created_at) INTO last_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;

	IF last_at IS NOT NULL AND last_at > now() - cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown', 'next_at', last_at + cooldown
		);
	END IF;

	-- Gift: top off the host's tickle bank (over-cap allowed).
	PERFORM public.grant_tickles(p_target, reward);
	-- Generosity: giving raises the visitor's alignment toward generous.
	PERFORM public.shift_alignment(caller_id, 1);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, reward);

	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	PERFORM public.send_system_announcement(
		p_target, 'barn_visit',
		'Someone visited your Barn!',
		COALESCE(visitor_name, 'A friend') || ' tickled your pig — +'
			|| reward || ' tickles for you.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', reward,
		'visits_left', daily_budget - todays_visits - 1
	);
END;
$function$;
