-- Phase 1d — SONGS OF THE BOG (Guitar-Hero rhythm + hidden deployment Blotto).
-- HELD FOR REVIEW; push only on go.
--
-- Layers a rhythm skill core + an active hidden-deployment Blotto on top of the
-- Fronts substrate (20260667). The three fronts become three defended AREAS; each
-- crew secretly DEPLOYS one easy/med/hard wave onto each of the opponent's areas
-- (mud_war_deploys, fogged). A harder wave raises an area's HOLD-PRESSURE
-- (HOLD_COEF*P*PRESS[diff]), forcing the defender to commit more bodies — the
-- sim-validated lever (scripts/sim_deploy.py: genuine dilemma across 5 seeds,
-- coord>scatter 78-80%, skilled-scatter>unskilled-coord 86-93%).
--
-- MODE NESTING: rhythm ⊃ fronts ⊃ classic. rhythm_enabled implies fronts_enabled
-- (it reuses mud_war_fronts/mud_front_pushes/mud_war_plans verbatim). The KEY
-- difference is the FOLD: where fronts is HEAD-TO-HEAD (both crews push the same
-- pile; more mud wins — fold_front_margin), rhythm is a MIRROR — each crew defends
-- its OWN mud on each area vs the opponent's deployed pressure, and the day's
-- margin = challenger_held_V - defender_held_V (fold_rhythm_margin). This is what
-- the sim validated; the head-to-head fold is NOT used for rhythm wars.
--
-- PHASE: build_ends_at = started_at + 48h. Tend days (throws via throw_mud) fold
-- under NEUTRAL pressure (deploys default 'med' when unset); Hold days (rhythm via
-- submit_run) fold under the real deployed pressure. No scorer special-case — the
-- 'med' default makes Tend a gentle even build and the deploy read only bites once
-- difficulties diverge.
--
-- ANTI-CHEAT: the wire stays band-enum-only. submit_run takes an ARRAY of up to 3
-- bands; the server maps each via the SAME CASE throw_mud uses (perfect/good/weak ->
-- 3/2/1 else 0), clamps per note, sums, caps the note count, and enforces a per-day
-- RUN budget via the same race-safe conditional ON CONFLICT. A forged all-'perfect'
-- array yields exactly a flawless honest run (exploit ceiling == skill ceiling).
-- Difficulty NEVER changes a hit's value — the rope moves on normalized band-mud, so
-- the floor stays flat and a skilled defender saturates on any difficulty.
--
-- FLAG-GATE: every rhythm behavior is gated on mud_wars.rhythm_enabled, set at war start
-- from public.mud_rhythm_on() (FALSE by default). With it false the rhythm branch is dead and
-- the new columns default false/null, so score_mud_war_days / war_state / war_fronts_state /
-- challenge_house / accept_challenge / throw_mud reproduce 20260667 as a STRICT SUPERSET
-- (additive jsonb keys only — e.g. war_state.phase, the fronts recap's 'mode'; existing clients
-- ignore unknown keys). The ONE intentional GLOBAL off-path change: resolve_war now stamps a 24h
-- crews.next_war_at on REAL crew-vs-crew wars (the win-trade cooldown), enforced by a BEFORE
-- INSERT trigger — this applies to all real wars, not just rhythm, and is by design (bot/practice
-- wars are NOT stamped). scripts/golden_output.sql is a smoke regression that resolves a classic +
-- a fronts war with both flags false and asserts rope/winner/payout/war_state are unchanged
-- (modulo that documented cooldown stamp).
--
-- CARRY-LATEST: only the SEVEN functions that change are re-declared, each carrying its 20260667
-- body verbatim + a gated delta — throw_mud (Hold phase-gate), score_mud_war_days, resolve_war,
-- war_fronts_state, war_state, challenge_house, accept_challenge. set_front_plan / redeploy_member /
-- the fold_front_* helpers / seed_war_board / sweep_mud_wars / apply_crew_elo / crew_leaderboard are
-- UNCHANGED and persist from 20260667 (NOT re-declared — avoids the build-93 clobber footgun).

-- ════════════════════════════════════════════════════════════════════════════
-- 0. SERVER FLAG. Flip on by CREATE OR REPLACE-ing to true in a later one-line migration.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mud_rhythm_on()
RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$ SELECT false; $function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA — additive columns + two new tables.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS rhythm_enabled bool NOT NULL DEFAULT false;
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS build_ends_at  timestamptz;  -- = started_at + 48h
-- The win-trade cooldown lives on the crew (per-crew, not per-war).
ALTER TABLE public.crews    ADD COLUMN IF NOT EXISTS next_war_at    timestamptz;
-- HOLD-day run budget counter (Tend uses throws_today; the phase gate makes a war day
-- exclusively one or the other). Lower-bound CHECK mirrors throws_today's defense-in-depth;
-- no upper bound because runs_cap is dynamic (baseline + access tokens).
ALTER TABLE public.mud_slings ADD COLUMN IF NOT EXISTS runs_today   int NOT NULL DEFAULT 0;
DO $$ BEGIN
	ALTER TABLE public.mud_slings ADD CONSTRAINT mud_slings_runs_check CHECK (runs_today >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The hidden double-blind deployment. One row per (war, day, attacking crew, target
-- area): the difficulty THIS crew sends at the opponent's defense of that area. The
-- bijection (one easy/med/hard) is enforced in set_deploy, not the schema.
CREATE TABLE IF NOT EXISTS public.mud_war_deploys (
	war_id      uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	war_day     date NOT NULL,
	crew_id     uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	target_area text NOT NULL,
	difficulty  text NOT NULL CHECK (difficulty IN ('easy', 'med', 'hard')),
	PRIMARY KEY (war_id, war_day, crew_id, target_area)
);

-- War-scoped ACCESS pool minted from barn visits (P5 hook). Grants an extra HOLD
-- short-song attempt. The ONLY place tickles/barns touch the war. Flat-capped.
CREATE TABLE IF NOT EXISTS public.mud_war_access (
	war_id       uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	war_day      date NOT NULL,
	tokens       int  NOT NULL DEFAULT 0 CHECK (tokens >= 0),
	PRIMARY KEY (war_id, recipient_id, war_day)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RLS — the deploy FOG mirrors mud_front_pushes (own crew live, opponent post-fold).
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.mud_war_deploys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_war_access  ENABLE ROW LEVEL SECURITY;

-- FOG: your own crew's deploys are visible live; the opponent's only once the day is
-- folded (last_scored_day >= war_day). Defense-in-depth behind war_fronts_state.
DROP POLICY IF EXISTS "Fog: own deploy live, opponent post-fold" ON public.mud_war_deploys;
CREATE POLICY "Fog: own deploy live, opponent post-fold" ON public.mud_war_deploys FOR SELECT
	USING (
		public.is_war_participant(war_id, auth.uid())
		AND (
			public.is_crew_member(crew_id, auth.uid())
			OR EXISTS (SELECT 1 FROM public.mud_wars w
			           WHERE w.id = war_id AND w.last_scored_day IS NOT NULL
			             AND w.last_scored_day >= war_day)
		)
	);

-- Access tokens are private to the recipient.
DROP POLICY IF EXISTS "View your own access tokens" ON public.mud_war_access;
CREATE POLICY "View your own access tokens" ON public.mud_war_access FOR SELECT
	USING (recipient_id = auth.uid());

-- mud_war_deploys is INTENTIONALLY NOT in the realtime publication (the fog must not
-- leak via a live subscription) — exactly like mud_front_pushes.

-- ════════════════════════════════════════════════════════════════════════════
-- 3. HELPERS — difficulty pressure, the bot's scripted deploy, the MIRROR fold.
-- ════════════════════════════════════════════════════════════════════════════

-- Hold-pressure multiplier by deployed difficulty (sim-locked: scripts/sim_deploy.py).
CREATE OR REPLACE FUNCTION public.deploy_press(p_diff text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $function$
	SELECT CASE p_diff WHEN 'hard' THEN 1.30 WHEN 'easy' THEN 0.80 ELSE 1.0 END;
$function$;

-- The house's scripted deployment by front rank (1=marquee..3=cheapest): a clean
-- bijection — point HARD at the marquee, EASY at the cheapest. ONE source of truth so
-- the rope fold and the recap reveal agree for bot wars.
CREATE OR REPLACE FUNCTION public.bot_deploy(p_rank int)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
	SELECT CASE p_rank WHEN 1 THEN 'hard' WHEN 2 THEN 'med' ELSE 'easy' END;
$function$;

-- ONE area's mirror outcome for a folded day, as jsonb. The single source of truth
-- used by BOTH fold_rhythm_margin (the rope) and war_fronts_state (the recap) so the
-- reveal can never contradict how the rope moved. Each crew HOLDS its own area iff its
-- banked mud (sum of min(mud,12)) >= HOLD_COEF * P * PRESS[opponent's deploy here]. P
-- is deterministic from war+day+front (never stored), reusing fold_front_outcome's jitter.
CREATE OR REPLACE FUNCTION public.rhythm_area_holds(p_war uuid, p_day date, p_front_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w         record;
	f         record;
	cap       int := 12;
	hold_coef numeric := 0.78;   -- HOLD_COEF (sim-locked)
	rank      int;
	P         numeric; jit int;
	ch_mud    numeric; df_mud numeric;
	ch_deploy text; df_deploy text;   -- the difficulty each crew sends at the OTHER's defense of this area
	ch_holds  boolean; df_holds boolean;
BEGIN
	SELECT challenger_crew, defender_crew, is_bot_war INTO w FROM public.mud_wars WHERE id = p_war;
	SELECT value, p_band INTO f FROM public.mud_war_fronts
		WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key;
	IF f.value IS NULL THEN RETURN NULL; END IF;
	rank := 1 + (SELECT count(*) FROM public.mud_war_fronts
		WHERE war_id = p_war AND war_day = p_day AND value > f.value);  -- V distinct (5,4,3)
	jit := ((hashtext(p_war::text || ':' || p_day::text || ':' || p_front_key) & 2147483647) % 41) - 20;
	P   := GREATEST(1, round(public.band_base_p(f.p_band) * (1 + jit / 100.0)));

	-- challenger's banked mud on this area + the deploy hitting it (= defender's deploy)
	SELECT COALESCE(SUM(LEAST(mud, cap)), 0) INTO ch_mud FROM public.mud_front_pushes
		WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key AND crew_id = w.challenger_crew;
	IF w.is_bot_war THEN
		df_deploy := public.bot_deploy(rank);
	ELSE
		SELECT difficulty INTO df_deploy FROM public.mud_war_deploys
			WHERE war_id = p_war AND war_day = p_day AND crew_id = w.defender_crew AND target_area = p_front_key;
		df_deploy := COALESCE(df_deploy, 'med');
	END IF;
	ch_holds := ch_mud >= hold_coef * P * public.deploy_press(df_deploy);

	-- defender's banked mud + the deploy hitting it (= challenger's deploy)
	IF w.is_bot_war THEN
		df_mud := public.bot_front_eff(rank);
	ELSE
		SELECT COALESCE(SUM(LEAST(mud, cap)), 0) INTO df_mud FROM public.mud_front_pushes
			WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key AND crew_id = w.defender_crew;
	END IF;
	SELECT difficulty INTO ch_deploy FROM public.mud_war_deploys
		WHERE war_id = p_war AND war_day = p_day AND crew_id = w.challenger_crew AND target_area = p_front_key;
	ch_deploy := COALESCE(ch_deploy, 'med');
	df_holds := df_mud >= hold_coef * P * public.deploy_press(ch_deploy);

	RETURN jsonb_build_object(
		'value', f.value, 'chHolds', ch_holds, 'dfHolds', df_holds,
		'chMud', ch_mud, 'dfMud', df_mud,
		'chDeploy', ch_deploy,   -- challenger's wave onto the defender's area
		'dfDeploy', df_deploy);  -- defender's wave onto the challenger's area
END;
$function$;

-- Fold a day's areas into a challenger-positive margin: +V per area the challenger
-- holds, -V per area the defender holds (each independently vs the opponent's pressure).
CREATE OR REPLACE FUNCTION public.fold_rhythm_margin(p_war uuid, p_day date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE f record; margin int := 0; h jsonb;
BEGIN
	FOR f IN SELECT front_key, value FROM public.mud_war_fronts
	         WHERE war_id = p_war AND war_day = p_day LOOP
		h := public.rhythm_area_holds(p_war, p_day, f.front_key);
		IF h IS NULL THEN CONTINUE; END IF;
		IF (h->>'chHolds')::boolean THEN margin := margin + f.value; END IF;
		IF (h->>'dfHolds')::boolean THEN margin := margin - f.value; END IF;
	END LOOP;
	RETURN margin;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. score_mud_war_days — carried from 20260667 + the gated rhythm fold branch.
--    rhythm_enabled=false => identical to 20260667 (fronts/base path verbatim).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.score_mud_war_days(p_war uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	d           date;
	last_day    date;
	war_end_day date;
	ch_total    int; ch_active int; ch_pc numeric;
	df_total    int; df_active int; df_pc numeric;
	margin      numeric; base_notch int; coord_notch int; tot int;
	c_quorum    int := 2;
	c_bot_pace  int := 12;
	c_scale     numeric := 5;
	c_maxnotch  int := 4;
	c_rout      int := 12;
	c_front_scale double precision := 4.0;  -- FRONT_SCALE (sim-tuned)
	c_maxtotal  int := 5;          -- MAX_NOTCH when fronts/rhythm on
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'active' OR w.started_at IS NULL THEN RETURN; END IF;

	war_end_day := (w.ends_at AT TIME ZONE 'UTC')::date;
	IF w.ends_at <= now() THEN
		last_day := war_end_day;
	ELSE
		last_day := LEAST((now() AT TIME ZONE 'UTC')::date - 1, war_end_day);
	END IF;

	IF w.last_scored_day IS NOT NULL THEN
		d := w.last_scored_day + 1;
	ELSE
		d := (w.started_at AT TIME ZONE 'UTC')::date;
	END IF;

	WHILE d <= last_day LOOP
		SELECT COALESCE(SUM(slings), 0), COUNT(*) FILTER (WHERE slings > 0)
			INTO ch_total, ch_active
			FROM public.mud_slings WHERE war_id = p_war AND crew_id = w.challenger_crew AND war_day = d;
		ch_pc := CASE
			WHEN ch_active = 0 THEN 0
			WHEN w.is_bot_war OR ch_active >= c_quorum THEN ch_total::numeric / ch_active
			ELSE 0
		END;

		IF w.is_bot_war THEN
			df_pc := c_bot_pace;
		ELSE
			SELECT COALESCE(SUM(slings), 0), COUNT(*) FILTER (WHERE slings > 0)
				INTO df_total, df_active
				FROM public.mud_slings WHERE war_id = p_war AND crew_id = w.defender_crew AND war_day = d;
			df_pc := CASE WHEN df_active >= c_quorum THEN df_total::numeric / df_active ELSE 0 END;
		END IF;

		margin := ch_pc - df_pc;
		base_notch := GREATEST(-c_maxnotch, LEAST(c_maxnotch, round(margin / c_scale)::int));

		-- round() on double precision is half-to-EVEN, matching the sim's Python round().
		IF w.rhythm_enabled THEN
			-- MIRROR fold: each crew defends its own areas vs the opponent's deployed pressure.
			coord_notch := GREATEST(-2, LEAST(2, round(public.fold_rhythm_margin(p_war, d)::double precision / c_front_scale)::int));
			tot := GREATEST(-c_maxtotal, LEAST(c_maxtotal, base_notch + coord_notch));
		ELSIF w.fronts_enabled THEN
			-- HEAD-TO-HEAD fold (20260667), byte-for-byte.
			coord_notch := GREATEST(-2, LEAST(2, round(public.fold_front_margin(p_war, d)::double precision / c_front_scale)::int));
			tot := GREATEST(-c_maxtotal, LEAST(c_maxtotal, base_notch + coord_notch));
		ELSE
			tot := base_notch;   -- 20260666 behavior, byte-for-byte
		END IF;

		UPDATE public.mud_wars
			SET rope_pos = GREATEST(-c_rout, LEAST(c_rout, rope_pos + tot)),
			    last_scored_day = d
			WHERE id = p_war;
		d := d + 1;
	END LOOP;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4b. throw_mud — carried VERBATIM from 20260667 + one gated phase guard. In a rhythm
--     war the Tend toss is BUILD-only; once Hold opens, build via submit_run instead.
--     Non-rhythm wars are byte-identical (rhythm_enabled false / build_ends_at NULL).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.throw_mud(p_war uuid, p_band text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	w          record;
	my_crew    uuid;
	today      date := (now() AT TIME ZONE 'UTC')::date;
	cur_throws int;
	pts        int;
	throws_cap int := 7;
	per_throw  int := 3;
	day_cap    int := 21;
	new_slings int;
	new_throws int;
	my_front   text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		RETURN jsonb_build_object('ok', false, 'reason', 'war_over');
	END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'war_not_active'); END IF;
	-- PHASE GATE (rhythm wars only): once Hold opens, the toss closes — use submit_run.
	IF w.rhythm_enabled AND w.build_ends_at IS NOT NULL AND now() >= w.build_ends_at THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'use_run');
	END IF;
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

	IF new_throws IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_throws_spent', 'throws_remaining', 0);
	END IF;

	-- GATED: bank the same pts into the member's current front (derived from the plan).
	IF w.fronts_enabled THEN
		PERFORM public.seed_war_board(p_war, today);
		SELECT front_key INTO my_front FROM public.mud_war_plans
			WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
		IF my_front IS NULL THEN
			SELECT front_key INTO my_front FROM public.mud_war_fronts
				WHERE war_id = p_war AND war_day = today ORDER BY value ASC LIMIT 1;
			INSERT INTO public.mud_war_plans (war_id, user_id, war_day, front_key, locked)
				VALUES (p_war, caller_id, today, my_front, true)
				ON CONFLICT (war_id, user_id, war_day) DO UPDATE SET locked = true
				RETURNING front_key INTO my_front;
		ELSE
			UPDATE public.mud_war_plans SET locked = true
				WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
		END IF;
		INSERT INTO public.mud_front_pushes (war_id, user_id, war_day, front_key, crew_id, mud, throws)
			VALUES (p_war, caller_id, today, my_front, my_crew, pts, 1)
			ON CONFLICT (war_id, user_id, war_day, front_key) DO UPDATE
				SET mud = mud_front_pushes.mud + pts, throws = mud_front_pushes.throws + 1;
	END IF;

	RETURN jsonb_build_object('ok', true,
		'pts_awarded', pts,
		'slings_today', new_slings,
		'throws_remaining', throws_cap - new_throws,
		'front', my_front);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.throw_mud(uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. submit_run — the HOLD rhythm RPC. A band ARRAY -> normalized mud, derived front,
--    per-day RUN budget (2 baseline + access tokens). Mirrors throw_mud's anti-cheat.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_run(p_war uuid, p_bands text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	w          record;
	my_crew    uuid;
	today      date := (now() AT TIME ZONE 'UTC')::date;
	notes_max  int := 3;     -- NOTES_PER_RUN
	runs_base  int := 2;     -- RUNS_PER_DAY baseline
	per_note   int := 3;
	day_cap    int := 21;
	run_pts    int := 0;
	scored     int := 0;
	b          text;
	my_tokens  int;
	runs_cap   int;
	my_front   text;
	new_slings int;
	new_runs   int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		RETURN jsonb_build_object('ok', false, 'reason', 'war_over');
	END IF;
	IF w.status <> 'active' OR NOT w.rhythm_enabled THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'war_not_active');
	END IF;
	-- PHASE GATE: rhythm runs are HOLD-only. During Tend (now < build_ends_at) the crew
	-- builds via throw_mud (the toss). This + throw_mud's symmetric Hold-gate makes a war
	-- day exclusively one phase, so a member can't double-bank throws AND runs into the cap.
	IF w.build_ends_at IS NOT NULL AND now() < w.build_ends_at THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'tend_phase');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;

	-- Server OWNS the band -> points map. Unknown/forged band -> 0, clamped [0,3]. Note
	-- count capped at notes_max so a padded/overlong array can't exceed the honest run.
	IF p_bands IS NOT NULL THEN
		FOREACH b IN ARRAY p_bands LOOP
			EXIT WHEN scored >= notes_max;
			run_pts := run_pts + LEAST(per_note, GREATEST(0,
				CASE b WHEN 'perfect' THEN 3 WHEN 'good' THEN 2 WHEN 'weak' THEN 1 ELSE 0 END));
			scored := scored + 1;
		END LOOP;
	END IF;
	-- A no-op submission (empty/NULL array) must not burn a run from the daily budget.
	IF scored = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty_run'); END IF;

	-- Run budget = baseline + this recipient's access tokens for today.
	SELECT COALESCE(a.tokens, 0) INTO my_tokens FROM public.mud_war_access a
		WHERE a.war_id = p_war AND a.recipient_id = caller_id AND a.war_day = today;
	runs_cap := runs_base + COALESCE(my_tokens, 0);

	-- Race-safe per-day RUN budget on mud_slings (Tend uses throws_today; Hold uses
	-- runs_today; a war day is exclusively one phase). slings also accrues run mud so the
	-- per-capita base_notch + quorum keep working in Hold.
	INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, throws_today, runs_today, war_day)
		VALUES (p_war, my_crew, caller_id, run_pts, 0, 1, today)
	ON CONFLICT (war_id, user_id, war_day) DO UPDATE
		SET slings     = LEAST(day_cap, mud_slings.slings + run_pts),
		    runs_today = mud_slings.runs_today + 1
		WHERE mud_slings.runs_today < runs_cap
	RETURNING slings, runs_today INTO new_slings, new_runs;

	IF new_runs IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_runs_spent', 'runs_remaining', 0);
	END IF;

	-- Bank the run into the member's current area (derived from the plan, never a client
	-- arg). Default = the crew's lowest-P/cheapest area; lock the plan on the first run.
	PERFORM public.seed_war_board(p_war, today);
	SELECT front_key INTO my_front FROM public.mud_war_plans
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
	IF my_front IS NULL THEN
		SELECT front_key INTO my_front FROM public.mud_war_fronts
			WHERE war_id = p_war AND war_day = today ORDER BY value ASC LIMIT 1;
		INSERT INTO public.mud_war_plans (war_id, user_id, war_day, front_key, locked)
			VALUES (p_war, caller_id, today, my_front, true)
			ON CONFLICT (war_id, user_id, war_day) DO UPDATE SET locked = true
			RETURNING front_key INTO my_front;
	ELSE
		UPDATE public.mud_war_plans SET locked = true
			WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
	END IF;
	INSERT INTO public.mud_front_pushes (war_id, user_id, war_day, front_key, crew_id, mud, throws)
		VALUES (p_war, caller_id, today, my_front, my_crew, run_pts, scored)
		ON CONFLICT (war_id, user_id, war_day, front_key) DO UPDATE
			SET mud = mud_front_pushes.mud + run_pts, throws = mud_front_pushes.throws + scored;

	RETURN jsonb_build_object('ok', true,
		'run_pts', run_pts,
		'notes_scored', scored,
		'slings_today', new_slings,
		'runs_remaining', runs_cap - new_runs,
		'front', my_front);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.submit_run(uuid, text[]) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. set_deploy — the leader assigns the crew's one easy/med/hard wave onto the THREE
--    opponent areas (a bijection). Fogged; re-choosable until the day folds.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_deploy(p_war uuid, p_hard_front text, p_med_front text, p_easy_front text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	n_fronts  int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'active' OR NOT w.rhythm_enabled THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_war');
	END IF;
	-- Leader-only (matches redeploy_member) for a clean single-caller double-blind.
	SELECT id INTO my_crew FROM public.crews
		WHERE leader_id = caller_id AND id IN (w.challenger_crew, w.defender_crew);
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	-- Deploys open in the HOLD phase only, so Tend days fold under neutral (med) pressure.
	IF w.build_ends_at IS NOT NULL AND now() < w.build_ends_at THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'deploy_opens_in_hold');
	END IF;
	-- The three targets must be the day's three DISTINCT seeded areas (a bijection).
	IF p_hard_front = p_med_front OR p_med_front = p_easy_front OR p_hard_front = p_easy_front THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_distinct');
	END IF;
	PERFORM public.seed_war_board(p_war, today);
	SELECT count(*) INTO n_fronts FROM public.mud_war_fronts
		WHERE war_id = p_war AND war_day = today AND front_key IN (p_hard_front, p_med_front, p_easy_front);
	IF n_fronts <> 3 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_front'); END IF;

	INSERT INTO public.mud_war_deploys (war_id, war_day, crew_id, target_area, difficulty) VALUES
		(p_war, today, my_crew, p_hard_front, 'hard'),
		(p_war, today, my_crew, p_med_front,  'med'),
		(p_war, today, my_crew, p_easy_front, 'easy')
	ON CONFLICT (war_id, war_day, crew_id, target_area) DO UPDATE SET difficulty = EXCLUDED.difficulty;

	RETURN jsonb_build_object('ok', true,
		'deploy', jsonb_build_object('hard', p_hard_front, 'med', p_med_front, 'easy', p_easy_front));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_deploy(uuid, text, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. WIN-TRADE COOLDOWN — crews.next_war_at stamped at resolve, enforced by a BEFORE
--    INSERT trigger (covers challenge_house + challenge_crew without carrying them).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_war_cooldown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
	IF NEW.status IN ('pending', 'active') THEN
		IF EXISTS (SELECT 1 FROM public.crews c
		           WHERE c.id IN (NEW.challenger_crew, NEW.defender_crew)
		             AND c.is_bot = false AND c.next_war_at IS NOT NULL AND c.next_war_at > now()) THEN
			RAISE EXCEPTION 'war_cooldown_active' USING ERRCODE = 'check_violation';
		END IF;
	END IF;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_enforce_war_cooldown ON public.mud_wars;
CREATE TRIGGER trg_enforce_war_cooldown BEFORE INSERT ON public.mud_wars
	FOR EACH ROW EXECUTE FUNCTION public.enforce_war_cooldown();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. resolve_war — carried from 20260667 + the win-trade cooldown stamp.
--    (Payout / buff / titles / Elo / announce UNCHANGED.)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	c_house     int := 25;
	ch_total    int; ch_active int;
	df_total    int; df_active int;
	winner      uuid := NULL;
	win_active  int := 0;
	loser_pot   int := 0;
	share       int := 0;
	m           record;
	reward      int;
	wins_now    int;
	c_rout      int := 12;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status <> 'active' OR w.resolved_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', true, 'noop', true);
	END IF;

	PERFORM public.score_mud_war_days(p_war);
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;

	IF w.ends_at > now() AND ABS(w.rope_pos) < c_rout THEN
		RETURN jsonb_build_object('ok', true, 'not_yet', true, 'rope_pos', w.rope_pos);
	END IF;

	SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
		INTO ch_total, ch_active
		FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
		      WHERE war_id = p_war AND crew_id = w.challenger_crew GROUP BY user_id) s;
	IF w.is_bot_war THEN
		df_total := 0; df_active := 0;
	ELSE
		SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
			INTO df_total, df_active
			FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			      WHERE war_id = p_war AND crew_id = w.defender_crew GROUP BY user_id) s;
	END IF;

	winner := CASE
		WHEN w.rope_pos > 0 THEN w.challenger_crew
		WHEN w.rope_pos < 0 THEN w.defender_crew
		ELSE NULL
	END;

	IF winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew) THEN
		IF winner = w.challenger_crew THEN win_active := ch_active; ELSE win_active := df_active; END IF;
		IF w.is_bot_war THEN
			loser_pot := 0; share := c_house;
		ELSE
			IF winner = w.challenger_crew THEN loser_pot := df_total; ELSE loser_pot := ch_total; END IF;
			share := CASE WHEN win_active > 0 THEN floor((loser_pot * 0.5) / win_active)::int ELSE 0 END;
		END IF;

		FOR m IN
			SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			WHERE war_id = p_war AND crew_id = winner GROUP BY user_id HAVING SUM(slings) > 0
		LOOP
			IF w.is_bot_war THEN
				UPDATE public.profiles SET counter = counter + c_house WHERE id = m.user_id;
			ELSE
				reward := m.own + share;
				UPDATE public.profiles
					SET counter        = counter + reward,
					    tickles_earned = tickles_earned + reward,
					    war_wins       = war_wins + 1
					WHERE id = m.user_id
					RETURNING war_wins INTO wins_now;
			END IF;
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			IF NOT w.is_bot_war THEN
				BEGIN
					INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_champion')
						ON CONFLICT DO NOTHING;
					IF wins_now >= 5 THEN
						INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_veteran')
							ON CONFLICT DO NOTHING;
					END IF;
					IF wins_now >= 25 THEN
						INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_legend')
							ON CONFLICT DO NOTHING;
					END IF;
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;
		END LOOP;
	END IF;

	UPDATE public.mud_wars SET status = 'resolved', winner_crew = winner, resolved_at = now()
		WHERE id = p_war;

	-- NEW: stamp the 24h win-trade cooldown — REAL crew-vs-crew wars ONLY. A bot/practice
	-- war must NOT stamp the human crew (win-trading needs two real crews), else a single
	-- house war would lock the crew out of practice + PvP for 24h. The trigger enforces it
	-- on the next challenge insert.
	IF NOT w.is_bot_war THEN
		UPDATE public.crews SET next_war_at = now() + interval '24 hours'
			WHERE id IN (w.challenger_crew, w.defender_crew) AND is_bot = false;
	END IF;

	-- GATED: ladder update for real (non-bot) wars only.
	IF w.fronts_enabled AND NOT w.is_bot_war THEN
		BEGIN
			PERFORM public.apply_crew_elo(w.challenger_crew, w.defender_crew, winner, w.rope_pos);
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	BEGIN
		FOR m IN SELECT user_id, crew_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id,
				CASE WHEN winner IS NULL THEN 'war_draw'
				     WHEN m.crew_id = winner THEN 'war_won' ELSE 'war_lost' END,
				CASE WHEN winner IS NULL THEN 'Mud Fight: a draw'
				     WHEN m.crew_id = winner THEN 'Mud Fight won!' ELSE 'Mud Fight lost' END,
				CASE WHEN winner IS NULL THEN 'The rope held dead even. Rally your Sounder next time.'
				     WHEN m.crew_id = winner THEN 'Your Sounder dragged the rope home! Snouts paid and a 72h regen buff is on you.'
				     ELSE 'Your Sounder lost the tug this time.' END,
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'winner', winner, 'rope_pos', w.rope_pos,
		'routed', ABS(w.rope_pos) >= c_rout);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. war_fronts_state — carried from 20260667 + phase / my deploy / access tokens, and
--    a MIRROR recap when rhythm_enabled (both sides' holds + revealed deploys).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.war_fronts_state(p_war uuid, p_caller uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w        record;
	my_crew  uuid; them_crew uuid;
	today    date := (now() AT TIME ZONE 'UTC')::date;
	board    jsonb;
	myplan   jsonb;
	mydeploy jsonb;
	recap    jsonb;
	is_chal  boolean;
	my_tokens int;
	phase    text;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF NOT COALESCE(w.fronts_enabled, false) THEN RETURN NULL; END IF;
	IF p_caller IS DISTINCT FROM auth.uid() OR NOT public.is_war_participant(p_war, p_caller) THEN
		RETURN NULL;
	END IF;
	PERFORM public.seed_war_board(p_war, today);
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = p_caller;
	IF my_crew = w.defender_crew THEN them_crew := w.challenger_crew; ELSE them_crew := w.defender_crew; END IF;
	is_chal := (my_crew = w.challenger_crew);

	-- today's board with MY per-front mud (live); opponent mud withheld
	SELECT jsonb_agg(jsonb_build_object(
		'front_key', f.front_key, 'value', f.value, 'p_band', f.p_band,
		'mineMud', COALESCE((SELECT SUM(LEAST(mud,12)) FROM public.mud_front_pushes mp
			WHERE mp.war_id = p_war AND mp.war_day = today AND mp.front_key = f.front_key AND mp.crew_id = my_crew), 0),
		'mineCommitters', COALESCE((SELECT count(*) FROM public.mud_front_pushes mp
			WHERE mp.war_id = p_war AND mp.war_day = today AND mp.front_key = f.front_key AND mp.crew_id = my_crew), 0)
	) ORDER BY f.value DESC) INTO board
	FROM public.mud_war_fronts f WHERE f.war_id = p_war AND f.war_day = today;

	SELECT jsonb_build_object('front_key', front_key, 'locked', locked) INTO myplan
		FROM public.mud_war_plans WHERE war_id = p_war AND user_id = p_caller AND war_day = today;

	-- MY crew's deploy today (own — never fogged from me). The opponent's stays hidden.
	SELECT jsonb_object_agg(target_area, difficulty) INTO mydeploy
		FROM public.mud_war_deploys WHERE war_id = p_war AND war_day = today AND crew_id = my_crew;

	SELECT COALESCE(tokens, 0) INTO my_tokens FROM public.mud_war_access
		WHERE war_id = p_war AND recipient_id = p_caller AND war_day = today;

	phase := CASE
		WHEN w.status <> 'active' THEN w.status
		WHEN w.build_ends_at IS NOT NULL AND now() < w.build_ends_at THEN 'build'
		ELSE 'war'
	END;

	-- recap of the last folded day (both sides revealed). Rhythm uses the MIRROR
	-- outcome (rhythm_area_holds) so the reveal matches how the rope moved; the
	-- head-to-head path (fronts-only) keeps 20260667's fold_front_outcome recap.
	IF w.last_scored_day IS NOT NULL AND w.rhythm_enabled THEN
		WITH rf AS (
			SELECT f.front_key, f.value,
				public.rhythm_area_holds(p_war, w.last_scored_day, f.front_key) AS h
			FROM public.mud_war_fronts f
			WHERE f.war_id = p_war AND f.war_day = w.last_scored_day
		)
		SELECT jsonb_build_object('day', w.last_scored_day, 'mode', 'rhythm', 'fronts',
			COALESCE(jsonb_agg(jsonb_build_object(
				'front_key', rf.front_key, 'value', rf.value,
				'mineMud',  CASE WHEN is_chal THEN (rf.h->>'chMud')::numeric ELSE (rf.h->>'dfMud')::numeric END,
				'themMud',  CASE WHEN is_chal THEN (rf.h->>'dfMud')::numeric ELSE (rf.h->>'chMud')::numeric END,
				'mineHeld', CASE WHEN is_chal THEN (rf.h->>'chHolds')::boolean ELSE (rf.h->>'dfHolds')::boolean END,
				'themHeld', CASE WHEN is_chal THEN (rf.h->>'dfHolds')::boolean ELSE (rf.h->>'chHolds')::boolean END,
				-- the wave that attacked MY area = the opponent's deploy onto it
				'attackingMe', CASE WHEN is_chal THEN rf.h->>'dfDeploy' ELSE rf.h->>'chDeploy' END,
				'iDeployed',   CASE WHEN is_chal THEN rf.h->>'chDeploy' ELSE rf.h->>'dfDeploy' END
			) ORDER BY rf.value DESC), '[]'::jsonb)) INTO recap
		FROM rf;
	ELSIF w.last_scored_day IS NOT NULL THEN
		WITH rf AS (
			SELECT f.front_key, f.value,
				1 + (SELECT count(*) FROM public.mud_war_fronts g
				     WHERE g.war_id = p_war AND g.war_day = w.last_scored_day AND g.value > f.value) AS rank,
				COALESCE((SELECT SUM(LEAST(mud,12)) FROM public.mud_front_pushes mp
					WHERE mp.war_id=p_war AND mp.war_day=w.last_scored_day AND mp.front_key=f.front_key AND mp.crew_id=my_crew),0) AS mine_mud,
				public.fold_front_outcome(p_war, w.last_scored_day, f.front_key) AS oc
			FROM public.mud_war_fronts f
			WHERE f.war_id = p_war AND f.war_day = w.last_scored_day
		)
		SELECT jsonb_build_object('day', w.last_scored_day, 'mode', 'fronts', 'fronts',
			COALESCE(jsonb_agg(jsonb_build_object(
				'front_key', rf.front_key, 'value', rf.value,
				'mineMud', rf.mine_mud,
				'themMud', CASE WHEN w.is_bot_war THEN public.bot_front_eff(rf.rank)
					ELSE COALESCE((SELECT SUM(LEAST(mud,12)) FROM public.mud_front_pushes mp
						WHERE mp.war_id=p_war AND mp.war_day=w.last_scored_day AND mp.front_key=rf.front_key AND mp.crew_id=them_crew),0) END,
				'winner', CASE WHEN rf.oc = 'none' THEN 'none'
					WHEN rf.oc = (CASE WHEN is_chal THEN 'ch' ELSE 'df' END) THEN 'mine' ELSE 'them' END
			) ORDER BY rf.value DESC), '[]'::jsonb)) INTO recap
		FROM rf;
	END IF;

	RETURN jsonb_build_object(
		'phase', phase,
		'board', COALESCE(board, '[]'::jsonb),
		'myPlan', myplan,
		'myDeploy', mydeploy,
		'accessTokens', COALESCE(my_tokens, 0),
		'redeployUsed', CASE WHEN is_chal THEN w.redeploy_used_challenger ELSE w.redeploy_used_defender END,
		'weeklyModifier', w.weekly_modifier,
		'recap', recap);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. war_state — carried from 20260667 + 'phase' + 'rhythmEnabled'.
-- ════════════════════════════════════════════════════════════════════════════
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
	c_rout    int := 12;
	elapsed   numeric;
	mine      jsonb;
	them      jsonb;
	base      jsonb;
	phase     text;
BEGIN
	IF caller_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN 'null'::jsonb; END IF;
	IF NOT public.is_war_participant(p_war, caller_id) THEN RETURN 'null'::jsonb; END IF;
	IF w.status = 'active' AND (w.ends_at <= now() OR ABS(w.rope_pos) >= c_rout) THEN
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

	phase := CASE
		WHEN w.status <> 'active' THEN w.status
		WHEN NOT w.rhythm_enabled THEN 'war'
		WHEN w.build_ends_at IS NOT NULL AND now() < w.build_ends_at THEN 'build'
		ELSE 'war'
	END;

	base := jsonb_build_object(
		'warId', w.id, 'status', w.status, 'endsAt', w.ends_at, 'isBotWar', w.is_bot_war,
		'winnerCrew', w.winner_crew, 'iAmChallenger', my_crew = w.challenger_crew,
		'myRemainingToday', allotment - COALESCE(my_today, 0),
		'myThrowsRemaining', throws_cap - COALESCE(my_throws, 0),
		'ropePos', w.rope_pos,
		'ropeNorm', (CASE WHEN my_crew = w.challenger_crew THEN 1 ELSE -1 END)
			* GREATEST(-1.0, LEAST(1.0, w.rope_pos::numeric / c_rout)),
		'frontsEnabled', w.fronts_enabled,
		'rhythmEnabled', w.rhythm_enabled,
		'phase', phase,
		'buildEndsAt', w.build_ends_at,
		'mine', mine, 'them', them);

	IF w.fronts_enabled THEN
		base := base || jsonb_build_object('fronts', public.war_fronts_state(p_war, caller_id));
	END IF;
	RETURN base;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.war_state(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. challenge_house / accept_challenge — carried from 20260667, gated to set
--     rhythm_enabled + build_ends_at (and the 7-day length via use_fronts) + a friendly
--     cooldown pre-check. rhythm implies fronts (it reuses the fronts substrate).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.challenge_house()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	new_war   uuid;
	m         record;
	bot_id    uuid := '00000000-0000-0000-0000-0000000000b0';
	use_rhythm boolean := public.mud_rhythm_on();
	use_fronts boolean := public.mud_rhythm_on() OR public.mud_fronts_on();
	war_days  int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT id INTO my_crew FROM public.crews WHERE leader_id = caller_id AND is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_war');
	END IF;
	-- Friendly cooldown pre-check (the trigger is the hard backstop).
	IF EXISTS (SELECT 1 FROM public.crews WHERE id = my_crew AND next_war_at IS NOT NULL AND next_war_at > now()) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'cooldown');
	END IF;
	war_days := CASE WHEN use_fronts THEN 7 ELSE 5 END;
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at,
		fronts_enabled, rhythm_enabled, build_ends_at)
		VALUES (my_crew, bot_id, 'active', true, now(), now() + (war_days || ' days')::interval,
			use_fronts, use_rhythm, CASE WHEN use_rhythm THEN now() + interval '2 days' ELSE NULL END)
		RETURNING id INTO new_war;
	IF use_fronts THEN
		UPDATE public.mud_wars SET weekly_modifier = public.pick_weekly_modifier(new_war) WHERE id = new_war;
		PERFORM public.seed_war_board(new_war, (now() AT TIME ZONE 'UTC')::date);
	END IF;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_started', 'Mud Fight on!',
				'Your Sounder is fighting The Mudlarks. Sling mud daily to win!',
				jsonb_build_object('war_id', new_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'war_id', new_war);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_challenge(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	m         record;
	use_rhythm boolean := public.mud_rhythm_on();
	use_fronts boolean := public.mud_rhythm_on() OR public.mud_fronts_on();
	war_days  int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crews WHERE id = w.defender_crew AND leader_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_defender_leader');
	END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = w.defender_crew OR defender_crew = w.defender_crew)
	             AND status IN ('pending', 'active') AND id <> p_war) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'defender_busy');
	END IF;
	-- Defender cooldown (the BEFORE INSERT trigger only gates the challenger at create).
	IF EXISTS (SELECT 1 FROM public.crews WHERE id = w.defender_crew AND next_war_at IS NOT NULL AND next_war_at > now()) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'cooldown');
	END IF;
	war_days := CASE WHEN use_fronts THEN 7 ELSE 5 END;
	UPDATE public.mud_wars
		SET status = 'active', started_at = now(), ends_at = now() + (war_days || ' days')::interval,
		    fronts_enabled = use_fronts,
		    rhythm_enabled = use_rhythm,
		    build_ends_at = CASE WHEN use_rhythm THEN now() + interval '2 days' ELSE NULL END,
		    weekly_modifier = CASE WHEN use_fronts THEN public.pick_weekly_modifier(p_war) ELSE NULL END
		WHERE id = p_war;
	IF use_fronts THEN
		PERFORM public.seed_war_board(p_war, (now() AT TIME ZONE 'UTC')::date);
	END IF;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_started', 'Mud Fight on!',
				'The Mud Fight has begun. Sling mud daily to win for your Sounder!',
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'war_id', p_war);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. ACCESS minting — called by the barn-visit hook (P5). Crew+war-scoped, flat-capped
--     (1 token per recipient per HOLD day) so VIP tickle-wealth + alt rings can't farm it.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.grant_war_access(p_war uuid, p_recipient uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w     record;
	today date := (now() AT TIME ZONE 'UTC')::date;
	cap   int := 1;   -- ATTEMPT_TOKEN_CAP
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL OR w.status <> 'active' OR NOT w.rhythm_enabled THEN RETURN false; END IF;
	-- recipient must be a crew member of a participating crew (NOT the open friend graph).
	IF NOT (public.is_crew_member(w.challenger_crew, p_recipient) OR public.is_crew_member(w.defender_crew, p_recipient)) THEN
		RETURN false;
	END IF;
	INSERT INTO public.mud_war_access (war_id, recipient_id, war_day, tokens)
		VALUES (p_war, p_recipient, today, 1)
	ON CONFLICT (war_id, recipient_id, war_day) DO UPDATE
		SET tokens = LEAST(cap, mud_war_access.tokens + 1);
	RETURN true;
END;
$function$;
-- Internal: only the barn-visit hook (SECURITY DEFINER) calls it. No PUBLIC execute.

-- ════════════════════════════════════════════════════════════════════════════
-- 13. HARDEN internal SECURITY DEFINER helpers (PUBLIC grant is default; revoke the
--     ones a direct call could exploit or that leak the fog). Mirrors 20260667.
-- ════════════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.rhythm_area_holds(uuid, date, text) FROM PUBLIC;  -- would leak opp deploy/mud pre-fold
REVOKE EXECUTE ON FUNCTION public.fold_rhythm_margin(uuid, date)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deploy_press(text)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bot_deploy(int)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_war_access(uuid, uuid)        FROM PUBLIC;  -- only the barn hook mints
-- Idempotently restate the fog backstop on war_fronts_state (carried in-place here; this keeps the
-- REVOKE self-contained in 20260668 rather than relying on 20260667's ACL surviving the re-create).
REVOKE EXECUTE ON FUNCTION public.war_fronts_state(uuid, uuid)        FROM PUBLIC;
