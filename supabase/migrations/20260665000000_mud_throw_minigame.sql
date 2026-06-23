-- Mud-throw minigame scoring (Phase 1a). Re-denominates the daily 20 "+1 taps"
-- into a daily THROW BUDGET: 7 throws/day, each worth at most 3 mud (band enum
-- whiff/weak/good/perfect -> 0/1/2/3), daily ceiling 7*3 = 21.
--
-- ANTI-CHEAT: the wire carries a 4-value BAND ENUM, never a number. The server
-- owns the band->points map (unknown/forged band -> 0), clamps per-throw to 3,
-- and caps throws/day at 7 (atomically, via a conditional ON CONFLICT). So a
-- cheater POSTing 'perfect' every throw lands at exactly a flawless honest day
-- (21) and the 8th throw is refused — exploit ceiling == skill ceiling. The
-- granular "score" the player sees is pure client juice (vanity); only this
-- bounded mud-pull touches the war.
--
-- BACK-COMPAT: slings stays the same integer everything downstream reads
-- (war_side / resolve_war / per-capita / quorum / bot pace are UNTOUCHED — they
-- can't tell a tap from a throw). sling_mud is kept as a flag-off fallback for
-- one release. The daily-tug / rout resolve rework is a SEPARATE later migration
-- (Phase 1b) — this one ships the minigame on the existing resolve.
--
-- HELD FOR REVIEW — push only on explicit go.

-- 1. Per-day throw counter (additive; existing rows default 0, all valid).
ALTER TABLE public.mud_slings
	ADD COLUMN IF NOT EXISTS throws_today int NOT NULL DEFAULT 0;

-- 2. Re-cap slings 20 -> 21 (7*3). The original CHECK is inline/auto-named, so
--    find + drop it by oid (don't guess the name), then add a named one.
DO $$
DECLARE cname text;
BEGIN
	SELECT conname INTO cname
		FROM pg_constraint
		WHERE conrelid = 'public.mud_slings'::regclass
		  AND contype = 'c'
		  AND pg_get_constraintdef(oid) ILIKE '%slings%';
	IF cname IS NOT NULL THEN
		EXECUTE format('ALTER TABLE public.mud_slings DROP CONSTRAINT %I', cname);
	END IF;
END $$;

ALTER TABLE public.mud_slings
	ADD CONSTRAINT mud_slings_slings_check CHECK (slings >= 0 AND slings <= 21);
ALTER TABLE public.mud_slings
	ADD CONSTRAINT mud_slings_throws_check CHECK (throws_today >= 0 AND throws_today <= 7);

-- 3. throw_mud — the new hot path. Mirrors sling_mud's guards (auth, war load,
--    lazy-resolve-on-expiry, active check, crew membership), then maps the band
--    to clamped points and banks one throw, capped 7/day + 21 mud/day.
CREATE OR REPLACE FUNCTION public.throw_mud(p_war uuid, p_band text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	w          record;
	my_crew    uuid;
	today      date := (now() AT TIME ZONE 'UTC')::date;
	cur_throws int;
	pts        int;
	throws_cap int := 7;    -- THROWS_PER_DAY  (mirror constants/mudFights.ts)
	per_throw  int := 3;    -- PER_THROW_MAX
	day_cap    int := 21;   -- throws_cap * per_throw
	new_slings int;
	new_throws int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		RETURN jsonb_build_object('ok', false, 'reason', 'war_over');
	END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'war_not_active'); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;

	-- Server OWNS the band -> points map. Unknown/forged band -> 0. Clamp [0,3].
	pts := CASE p_band
		WHEN 'perfect' THEN 3
		WHEN 'good'    THEN 2
		WHEN 'weak'    THEN 1
		ELSE 0
	END;
	pts := LEAST(per_throw, GREATEST(0, pts));

	-- Fast-path reject when the budget is already spent (the atomic guard is the
	-- conditional ON CONFLICT WHERE below, which is race-safe under the row lock).
	SELECT throws_today INTO cur_throws FROM public.mud_slings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
	IF COALESCE(cur_throws, 0) >= throws_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_throws_spent', 'throws_remaining', 0);
	END IF;

	INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, throws_today, war_day)
		VALUES (p_war, my_crew, caller_id, pts, 1, today)
	ON CONFLICT (war_id, user_id, war_day) DO UPDATE
		SET slings       = LEAST(day_cap, mud_slings.slings + pts),
		    throws_today = mud_slings.throws_today + 1
		WHERE mud_slings.throws_today < throws_cap
	RETURNING slings, throws_today INTO new_slings, new_throws;

	-- Conflict row existed but the WHERE blocked it (budget raced to full).
	IF new_throws IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_throws_spent', 'throws_remaining', 0);
	END IF;

	RETURN jsonb_build_object('ok', true,
		'pts_awarded', pts,
		'slings_today', new_slings,
		'throws_remaining', throws_cap - new_throws);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.throw_mud(uuid, text) TO authenticated;

-- 4. war_state — carried VERBATIM from 20260647 (its only/latest definition) and
--    extended with myThrowsRemaining. myRemainingToday is kept for one release so
--    the sling_mud fallback path still renders.
CREATE OR REPLACE FUNCTION public.war_state(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	them_crew uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	my_today  int;
	my_throws int;
	allotment int := 20;
	throws_cap int := 7;
	bot_pace  int := 12;
	elapsed   numeric;
	mine      jsonb;
	them      jsonb;
BEGIN
	IF caller_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN 'null'::jsonb; END IF;
	IF NOT public.is_war_participant(p_war, caller_id) THEN RETURN 'null'::jsonb; END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	END IF;

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew = w.defender_crew THEN them_crew := w.challenger_crew; ELSE them_crew := w.defender_crew; END IF;

	mine := public.war_side(p_war, my_crew);
	IF w.is_bot_war AND them_crew = w.defender_crew THEN
		elapsed := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (LEAST(now(), w.ends_at) - w.started_at)) / 86400.0));
		them := jsonb_build_object(
			'crew', jsonb_build_object('id', them_crew, 'name', 'The Mudlarks', 'is_bot', true),
			'members', '[]'::jsonb, 'total', bot_pace * elapsed, 'active', NULL,
			'perCapita', bot_pace * elapsed, 'quorumMet', true);
	ELSE
		them := public.war_side(p_war, them_crew);
	END IF;

	SELECT slings, throws_today INTO my_today, my_throws FROM public.mud_slings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;

	RETURN jsonb_build_object(
		'warId', w.id, 'status', w.status, 'endsAt', w.ends_at, 'isBotWar', w.is_bot_war,
		'winnerCrew', w.winner_crew, 'iAmChallenger', my_crew = w.challenger_crew,
		'myRemainingToday', allotment - COALESCE(my_today, 0),
		'myThrowsRemaining', throws_cap - COALESCE(my_throws, 0),
		'mine', mine, 'them', them);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.war_state(uuid) TO authenticated;
