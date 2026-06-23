-- Phase 1c — FRONTS OF THE BOG (contested Colonel-Blotto). HELD FOR REVIEW; push only on go.
--
-- Layers the validated "fronts" strategy engine on top of the daily-tug rope
-- (20260666). Each UTC day a war's 3 fronts are seeded from a deck; each crew
-- secretly commits its flat mud across them (front derived server-side from a
-- per-member plan row, NOT a client arg — anti-cheat preserved); at the cron
-- rollover the two crews' per-front mud are compared HEAD-TO-HEAD (more mud wins
-- the front, above a concede floor; near-tie -> higher mean band value), and the
-- day's front_margin adds a SEPARATE coord_notch on top of the existing
-- per-capita base_notch.
--
-- DESIGN PROVENANCE: docs/mudwar-clan-design.md + scripts/sim_fronts.py.
-- The MARGIN winner rule (not smoothstep-saturate) is load-bearing — the sim
-- proved saturate makes "(3,2,0): clear the two biggest" a dominant play (P1
-- fails). Locked constants: 3 fronts V=[5,4,3], hidden fuzzy P (band-base
-- [26,22,18] +/-20% deterministic jitter, NEVER stored/surfaced pre-fold),
-- per-member-per-front cap 12, FRONT_SCALE 4, base +/-4, total +/-5, ROUT 12,
-- 7-day week.
--
-- FLAG-GATE: every new behavior is gated on mud_wars.fronts_enabled, which is set
-- (at war start) from public.mud_fronts_on() — a one-line function returning FALSE
-- by default. With it false, score_mud_war_days / sweep / resolve_war reproduce
-- 20260666 byte-for-byte and the off-path is today's per-capita tug; war_state and
-- throw_mud return a strict SUPERSET (two additive keys: 'frontsEnabled' and
-- 'front', which existing clients ignore) but every rope/winner/payout result is
-- identical. Flip the mode on by CREATE OR REPLACE-ing mud_fronts_on() to true.
--
-- CARRY-LATEST: throw_mud carried from 20260665; score_mud_war_days / resolve_war /
-- war_state / sweep_mud_wars carried from 20260666; challenge_house / accept_challenge
-- from 20260647. Extensions are additive and gated.

-- ════════════════════════════════════════════════════════════════════════════
-- 0. SERVER FLAG
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mud_fronts_on()
RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$ SELECT false; $function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA — new tables + mud_wars columns
-- ════════════════════════════════════════════════════════════════════════════

-- The day's board. value + fuzzy p_band are PUBLIC to participants; the exact P is
-- NEVER stored (computed deterministically at fold from war+day+front) so a row
-- read can't leak it.
CREATE TABLE IF NOT EXISTS public.mud_war_fronts (
	war_id    uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	war_day   date NOT NULL,
	front_key text NOT NULL,
	value     int  NOT NULL CHECK (value BETWEEN 1 AND 9),
	p_band    text NOT NULL CHECK (p_band IN ('light', 'medium', 'heavy')),
	PRIMARY KEY (war_id, war_day, front_key)
);

-- Per-(member, day, front) mud pool. A member sits on one front at a time, but a
-- redeploy can move them mid-day, so they may have rows on >1 front (PK includes
-- front_key). The 12-cap is applied at FOLD time (read), never at write, so the
-- mud_slings budget clamp stays single-rowed + race-safe.
CREATE TABLE IF NOT EXISTS public.mud_front_pushes (
	war_id    uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	war_day   date NOT NULL,
	front_key text NOT NULL,
	crew_id   uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	mud       int  NOT NULL DEFAULT 0,
	throws    int  NOT NULL DEFAULT 0,
	PRIMARY KEY (war_id, user_id, war_day, front_key)
);
CREATE INDEX IF NOT EXISTS mud_front_pushes_fold_idx
	ON public.mud_front_pushes (war_id, war_day, front_key, crew_id);

-- The member's CURRENT front assignment for the day. locked flips on first throw.
CREATE TABLE IF NOT EXISTS public.mud_war_plans (
	war_id    uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	war_day   date NOT NULL,
	front_key text NOT NULL,
	locked    boolean NOT NULL DEFAULT false,
	PRIMARY KEY (war_id, user_id, war_day)
);

-- The ladder — the "list of clans with relative strength."
CREATE TABLE IF NOT EXISTS public.crew_ratings (
	crew_id          uuid PRIMARY KEY REFERENCES public.crews(id) ON DELETE CASCADE,
	rating           int NOT NULL DEFAULT 1200,
	provisional_wars int NOT NULL DEFAULT 0,
	wars_played      int NOT NULL DEFAULT 0,
	season           int NOT NULL DEFAULT 1,
	updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS fronts_enabled bool NOT NULL DEFAULT false;
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS weekly_modifier text;
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS redeploy_used_challenger bool NOT NULL DEFAULT false;
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS redeploy_used_defender   bool NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RLS — SELECT policies. The FOG is the load-bearing one (Pillar 1).
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.mud_war_fronts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_front_pushes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_war_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_ratings    ENABLE ROW LEVEL SECURITY;

-- The board (value + fuzzy band only) is shared to both participants.
DROP POLICY IF EXISTS "View the board in your wars" ON public.mud_war_fronts;
CREATE POLICY "View the board in your wars" ON public.mud_war_fronts FOR SELECT
	USING (public.is_war_participant(war_id, auth.uid()));

-- FOG: your OWN crew's pushes are visible live; the OPPONENT's only once that day
-- has been folded into the rope (mud_wars.last_scored_day >= war_day). This is
-- defense-in-depth behind war_state (which masks the same) — a direct select can
-- never reveal the opponent's unresolved-day allocation. (Regression-tested in
-- scripts/test_fog_rls.sql.)
DROP POLICY IF EXISTS "Fog: own crew live, opponent post-fold" ON public.mud_front_pushes;
CREATE POLICY "Fog: own crew live, opponent post-fold" ON public.mud_front_pushes FOR SELECT
	USING (
		public.is_war_participant(war_id, auth.uid())
		AND (
			public.is_crew_member(crew_id, auth.uid())
			OR EXISTS (SELECT 1 FROM public.mud_wars w
			           WHERE w.id = war_id AND w.last_scored_day IS NOT NULL
			             AND w.last_scored_day >= war_day)
		)
	);

-- Plans are private to your own crew (so the opponent can't read your assignments).
DROP POLICY IF EXISTS "View your crew's plans" ON public.mud_war_plans;
CREATE POLICY "View your crew's plans" ON public.mud_war_plans FOR SELECT
	USING (
		public.is_war_participant(war_id, auth.uid())
		AND EXISTS (SELECT 1 FROM public.crew_members cm
		            WHERE cm.user_id = mud_war_plans.user_id
		              AND public.is_crew_member(cm.crew_id, auth.uid()))
	);

-- Ratings are a public ladder.
DROP POLICY IF EXISTS "Ratings are public" ON public.crew_ratings;
CREATE POLICY "Ratings are public" ON public.crew_ratings FOR SELECT USING (true);

-- mud_war_fronts is shared, mud_war_plans/crew_ratings are fine to publish, but
-- mud_front_pushes is INTENTIONALLY NOT in the realtime publication (the fog must
-- not leak via a live subscription). Only the board + plans go realtime.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mud_war_fronts; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mud_war_plans;  EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. HELPERS — board seeding, P resolution, the front fold
-- ════════════════════════════════════════════════════════════════════════════

-- Public band -> base pressure P. Exact P at fold = base * deterministic jitter.
CREATE OR REPLACE FUNCTION public.band_base_p(p_band text)
RETURNS int LANGUAGE sql IMMUTABLE AS $function$
	SELECT CASE p_band WHEN 'heavy' THEN 26 WHEN 'medium' THEN 22 ELSE 18 END;
$function$;

-- Seed a day's 3-front board deterministically from war+day (idempotent). Picks 3
-- distinct fronts from the 6-deck and assigns V=[5,4,3] with a seed-shuffled band.
CREATE OR REPLACE FUNCTION public.seed_war_board(p_war uuid, p_day date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	deck   text[] := ARRAY['truffle','bridge','gate','sowpen','reed','wallow'];
	bands  text[] := ARRAY['light','medium','heavy'];
	vals   int[]  := ARRAY[5,4,3];
	chosen text[] := ARRAY[]::text[];
	seed   bigint; i int := 0; idx int; b text;
BEGIN
	IF EXISTS (SELECT 1 FROM public.mud_war_fronts WHERE war_id = p_war AND war_day = p_day) THEN
		RETURN;
	END IF;
	-- Mask the sign bit instead of abs() — abs(hashtext) overflows int4 at INT_MIN.
	seed := (hashtext(p_war::text || ':' || p_day::text) & 2147483647);
	WHILE COALESCE(array_length(chosen, 1), 0) < 3 AND i < 60 LOOP
		idx := ((seed / (i + 1)) % 6) + 1;
		IF NOT (deck[idx] = ANY(chosen)) THEN chosen := chosen || deck[idx]; END IF;
		i := i + 1;
	END LOOP;
	-- Contract: exactly 3 distinct fronts. Fail loud rather than NULL-insert if a
	-- future deck/divisor change ever starves the pick loop.
	IF COALESCE(array_length(chosen, 1), 0) < 3 THEN
		RAISE EXCEPTION 'seed_war_board: only % distinct fronts picked', COALESCE(array_length(chosen, 1), 0);
	END IF;
	FOR i IN 1..3 LOOP
		b := bands[((seed / (i * 7 + 3)) % 3) + 1];
		INSERT INTO public.mud_war_fronts (war_id, war_day, front_key, value, p_band)
		VALUES (p_war, p_day, chosen[i], vals[i], b)
		ON CONFLICT DO NOTHING;
	END LOOP;
END;
$function$;

-- Deterministic weekly modifier (display-only in v1; gameplay effects are a
-- follow-up — see docs/mudwar-clan-design.md open risks). Stored at war start.
CREATE OR REPLACE FUNCTION public.pick_weekly_modifier(p_war uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
	SELECT (ARRAY['none','marquee_double','fogged_gold','warboss_week'])[
		((hashtext(p_war::text) & 2147483647) % 4) + 1];
$function$;

-- The house's scripted per-front mud, by front rank (1=marquee … 3=cheapest):
-- stack the marquee hard, contest the cheapest lightly, concede the mid. ONE source
-- of truth so the rope fold and the recap reveal agree for bot wars.
CREATE OR REPLACE FUNCTION public.bot_front_eff(p_rank int)
RETURNS int LANGUAGE sql IMMUTABLE AS $function$
	SELECT CASE p_rank WHEN 1 THEN 30 WHEN 3 THEN 14 ELSE 0 END;
$function$;

-- Decide ONE front's outcome for a folded day: 'ch' / 'df' / 'none'. The single
-- source of truth used by BOTH fold_front_margin (the rope) and war_fronts_state
-- (the post-day recap) so the reveal can never contradict how the rope moved.
-- MARGIN rule: above the concede floor (0.6*P) more effMud (sum of min(mud,12))
-- wins; a near-tie (<1 mud) breaks to higher mean band value (skill). Bot defender
-- uses bot_front_eff(rank). P is deterministic from war+day+front (never stored).
CREATE OR REPLACE FUNCTION public.fold_front_outcome(p_war uuid, p_day date, p_front_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w        record;
	f        record;
	cap      int := 12;
	rank     int;
	P        numeric; concede numeric; jit int;
	ch_eff   numeric; ch_band numeric;
	df_eff   numeric; df_band numeric;
	winner   text;
BEGIN
	SELECT challenger_crew, defender_crew, is_bot_war INTO w FROM public.mud_wars WHERE id = p_war;
	SELECT value, p_band INTO f FROM public.mud_war_fronts
		WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key;
	IF f.value IS NULL THEN RETURN 'none'; END IF;
	rank := 1 + (SELECT count(*) FROM public.mud_war_fronts
		WHERE war_id = p_war AND war_day = p_day AND value > f.value);  -- V distinct (5,4,3)
	jit  := ((hashtext(p_war::text || ':' || p_day::text || ':' || p_front_key) & 2147483647) % 41) - 20;
	P    := GREATEST(1, round(public.band_base_p(f.p_band) * (1 + jit / 100.0)));
	concede := 0.6 * P;

	SELECT COALESCE(SUM(LEAST(mud, cap)), 0),
	       CASE WHEN COALESCE(SUM(throws), 0) > 0 THEN SUM(mud)::numeric / SUM(throws) ELSE 0 END
	  INTO ch_eff, ch_band
	  FROM public.mud_front_pushes
	  WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key AND crew_id = w.challenger_crew;

	IF w.is_bot_war THEN
		df_eff := public.bot_front_eff(rank); df_band := 2.0;
	ELSE
		SELECT COALESCE(SUM(LEAST(mud, cap)), 0),
		       CASE WHEN COALESCE(SUM(throws), 0) > 0 THEN SUM(mud)::numeric / SUM(throws) ELSE 0 END
		  INTO df_eff, df_band
		  FROM public.mud_front_pushes
		  WHERE war_id = p_war AND war_day = p_day AND front_key = p_front_key AND crew_id = w.defender_crew;
	END IF;

	IF ch_eff < concede AND df_eff < concede THEN RETURN 'none'; END IF;
	IF abs(ch_eff - df_eff) < 1 THEN          -- exact tie -> skill tiebreak (sim < 1.0)
		winner := CASE WHEN ch_band >= df_band THEN 'ch' ELSE 'df' END;
	ELSE
		winner := CASE WHEN ch_eff > df_eff THEN 'ch' ELSE 'df' END;
	END IF;
	IF winner = 'ch' AND ch_eff < concede THEN RETURN 'none'; END IF;
	IF winner = 'df' AND df_eff < concede THEN RETURN 'none'; END IF;
	RETURN winner;
END;
$function$;

-- Fold a day's fronts into a challenger-positive front_margin (+V per front the
-- challenger wins, -V per front the defender wins) via fold_front_outcome.
CREATE OR REPLACE FUNCTION public.fold_front_margin(p_war uuid, p_day date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE f record; margin int := 0; oc text;
BEGIN
	FOR f IN SELECT front_key, value FROM public.mud_war_fronts
	         WHERE war_id = p_war AND war_day = p_day LOOP
		oc := public.fold_front_outcome(p_war, p_day, f.front_key);
		IF    oc = 'ch' THEN margin := margin + f.value;
		ELSIF oc = 'df' THEN margin := margin - f.value;
		END IF;
	END LOOP;
	RETURN margin;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. score_mud_war_days — carried from 20260666 + the gated coord_notch fold.
--    fronts_enabled=false => identical to 20260666 (base path verbatim, ±4 clamp).
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
	c_maxtotal  int := 5;          -- MAX_NOTCH when fronts on
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'active' OR w.started_at IS NULL THEN RETURN; END IF;

	war_end_day := (w.ends_at AT TIME ZONE 'UTC')::date;
	-- An ended war scores its FINAL day even if that calendar day isn't over (no more
	-- slings can land past ends_at); a live war scores only fully-elapsed days.
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
		-- Per-day quorum: a real-war side that didn't field 2+ active scores 0 that day.
		-- Waived vs the house (bot grants no rank/cosmetics) so solo practice can win.
		ch_pc := CASE
			WHEN ch_active = 0 THEN 0
			WHEN w.is_bot_war OR ch_active >= c_quorum THEN ch_total::numeric / ch_active
			ELSE 0
		END;

		IF w.is_bot_war THEN
			df_pc := c_bot_pace;   -- the house keeps a fixed daily pace
		ELSE
			SELECT COALESCE(SUM(slings), 0), COUNT(*) FILTER (WHERE slings > 0)
				INTO df_total, df_active
				FROM public.mud_slings WHERE war_id = p_war AND crew_id = w.defender_crew AND war_day = d;
			df_pc := CASE WHEN df_active >= c_quorum THEN df_total::numeric / df_active ELSE 0 END;
		END IF;

		margin := ch_pc - df_pc;
		base_notch := GREATEST(-c_maxnotch, LEAST(c_maxnotch, round(margin / c_scale)::int));

		IF w.fronts_enabled THEN
			-- separate, clamped coordination term added on top of the base tug.
			-- round() on double precision is half-to-EVEN, matching sim_fronts.py's
			-- Python round() that certified FRONT_SCALE=4 (numeric round is half-away
			-- and would over-credit coordination at front_margin = +/-2).
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
-- 5. throw_mud — carried from 20260665 + the gated front sibling write.
--    Front is DERIVED server-side from the plan row (never a client arg).
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
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;

	-- Server OWNS the band -> points map. Unknown/forged band -> 0. Clamp [0,3] so a
	-- forged 'perfect' every throw only ever reaches a flawless honest day (exploit
	-- ceiling == skill ceiling).
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

	-- GATED: bank the same pts into the member's current front. Front comes from the
	-- plan row (default = the crew's lowest-P/cheapest front, never a dead Reserve);
	-- lock the plan on the first throw of the day.
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
-- 6. PLAN RPCs — self-assign + the one-per-war redeploy token
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_front_plan(p_war uuid, p_front_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	is_locked boolean;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL OR w.status <> 'active' OR NOT w.fronts_enabled THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_war');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;
	PERFORM public.seed_war_board(p_war, today);
	IF NOT EXISTS (SELECT 1 FROM public.mud_war_fronts
	               WHERE war_id = p_war AND war_day = today AND front_key = p_front_key) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_front');
	END IF;
	SELECT locked INTO is_locked FROM public.mud_war_plans
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
	IF COALESCE(is_locked, false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'locked');  -- already threw; use a redeploy
	END IF;
	-- The early-return above guarantees the row is unlocked, so the conflict path is
	-- always safe to update (no WHERE needed — a schema-qualified conflict-action
	-- WHERE is also non-idiomatic and fragile).
	INSERT INTO public.mud_war_plans (war_id, user_id, war_day, front_key, locked)
		VALUES (p_war, caller_id, today, p_front_key, false)
		ON CONFLICT (war_id, user_id, war_day) DO UPDATE SET front_key = EXCLUDED.front_key;
	RETURN jsonb_build_object('ok', true, 'front', p_front_key);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_front_plan(uuid, text) TO authenticated;

-- Leader spends the crew's ONE redeploy token to move a member (even a locked one)
-- to another front. Future throws land on the new front; already-thrown mud stays.
CREATE OR REPLACE FUNCTION public.redeploy_member(p_war uuid, p_user uuid, p_front_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	is_chal   boolean;
	used      boolean;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'active' OR NOT w.fronts_enabled THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_war');
	END IF;
	SELECT id INTO my_crew FROM public.crews
		WHERE leader_id = caller_id AND id IN (w.challenger_crew, w.defender_crew);
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	-- target must be on the leader's crew
	IF NOT EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = p_user AND crew_id = my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_your_member');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.mud_war_fronts
	               WHERE war_id = p_war AND war_day = today AND front_key = p_front_key) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_front');
	END IF;
	is_chal := (my_crew = w.challenger_crew);
	used    := CASE WHEN is_chal THEN w.redeploy_used_challenger ELSE w.redeploy_used_defender END;
	IF used THEN RETURN jsonb_build_object('ok', false, 'reason', 'redeploy_spent'); END IF;

	INSERT INTO public.mud_war_plans (war_id, user_id, war_day, front_key, locked)
		VALUES (p_war, p_user, today, p_front_key, true)
		ON CONFLICT (war_id, user_id, war_day) DO UPDATE SET front_key = EXCLUDED.front_key;
	IF is_chal THEN
		UPDATE public.mud_wars SET redeploy_used_challenger = true WHERE id = p_war;
	ELSE
		UPDATE public.mud_wars SET redeploy_used_defender = true WHERE id = p_war;
	END IF;
	RETURN jsonb_build_object('ok', true, 'front', p_front_key);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.redeploy_member(uuid, uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LADDER — Elo update + the public leaderboard ("list of clans w/ strength")
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.apply_crew_elo(p_a uuid, p_b uuid, p_winner uuid, p_rope int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	ra int; rb int; pa int; pb int;
	ea numeric; sa numeric; k_a int; k_b int; magnitude numeric;
BEGIN
	INSERT INTO public.crew_ratings (crew_id) VALUES (p_a) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_ratings (crew_id) VALUES (p_b) ON CONFLICT DO NOTHING;
	SELECT rating, provisional_wars INTO ra, pa FROM public.crew_ratings WHERE crew_id = p_a;
	SELECT rating, provisional_wars INTO rb, pb FROM public.crew_ratings WHERE crew_id = p_b;
	ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
	sa := CASE WHEN p_winner = p_a THEN 1.0 WHEN p_winner = p_b THEN 0.0 ELSE 0.5 END;
	-- K: high (40) while provisional (<3 wars), else 24; scaled up by rope margin
	-- (a rout moves more than a squeaker), capped.
	magnitude := 0.6 + 0.4 * LEAST(1.0, abs(p_rope)::numeric / 12.0);
	k_a := round((CASE WHEN pa < 3 THEN 40 ELSE 24 END) * magnitude);
	k_b := round((CASE WHEN pb < 3 THEN 40 ELSE 24 END) * magnitude);
	UPDATE public.crew_ratings
		SET rating = ra + round(k_a * (sa - ea)), provisional_wars = pa + 1,
		    wars_played = wars_played + 1, updated_at = now()
		WHERE crew_id = p_a;
	UPDATE public.crew_ratings
		SET rating = rb + round(k_b * ((1.0 - sa) - (1.0 - ea))), provisional_wars = pb + 1,
		    wars_played = wars_played + 1, updated_at = now()
		WHERE crew_id = p_b;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crew_leaderboard(p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	-- NB: never alias a column `row` (reserved keyword -> parses as a ROW() ctor).
	SELECT COALESCE(jsonb_agg(q.j ORDER BY q.rating DESC, q.wars DESC), '[]'::jsonb)
	FROM (
		SELECT jsonb_build_object(
			'crew_id', c.id, 'name', c.name, 'rating', r.rating,
			'wars_played', r.wars_played, 'provisional', r.provisional_wars < 3,
			'memberCount', (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id)
		) AS j, r.rating AS rating, r.wars_played AS wars
		FROM public.crew_ratings r
		JOIN public.crews c ON c.id = r.crew_id
		WHERE c.is_bot = false
		ORDER BY r.rating DESC, r.wars_played DESC
		LIMIT GREATEST(1, LEAST(200, p_limit))
	) q;
$function$;
GRANT EXECUTE ON FUNCTION public.crew_leaderboard(int) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. resolve_war — carried from 20260666 + a gated Elo update at resolution.
--    (Payout/buff/titles/announce mechanics UNCHANGED.)
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
-- 9. sweep_mud_wars — carried from 20260666 + gated board-seeding at each tick.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sweep_mud_wars()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	r record;
	c_pending_ttl interval := interval '48 hours';
	today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
	FOR r IN
		SELECT id, fronts_enabled FROM public.mud_wars WHERE status = 'active' AND resolved_at IS NULL
	LOOP
		-- GATED: make sure today's board exists before scoring/serving it.
		IF r.fronts_enabled THEN PERFORM public.seed_war_board(r.id, today); END IF;
		PERFORM public.resolve_war(r.id);
	END LOOP;

	FOR r IN
		SELECT id, challenger_crew, defender_crew FROM public.mud_wars
		WHERE status = 'pending' AND created_at <= now() - c_pending_ttl
	LOOP
		UPDATE public.mud_wars SET status = 'declined' WHERE id = r.id;
		BEGIN
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			SELECT cm.user_id, 'war_expired', 'Mud Fight challenge expired',
				'A challenge went unanswered for 48 hours and was called off.',
				jsonb_build_object('war_id', r.id)
			FROM public.crew_members cm
			WHERE cm.crew_id = r.challenger_crew OR cm.crew_id = r.defender_crew;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. war_fronts_state — the fronts payload for war_state (fog-respecting).
--     mine: live per-front build; them: ONLY for days already folded; recap: the
--     last folded day's both-sides outcome (the mandatory post-day reveal).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.war_fronts_state(p_war uuid, p_caller uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w        record;
	my_crew  uuid; them_crew uuid;
	today    date := (now() AT TIME ZONE 'UTC')::date;
	board    jsonb;
	myplan   jsonb;
	recap    jsonb;
	is_chal  boolean;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF NOT COALESCE(w.fronts_enabled, false) THEN RETURN NULL; END IF;
	-- Defense-in-depth (this fn is also REVOKEd from PUBLIC): only the war's own
	-- participant may read, and only for themselves — never a client-chosen p_caller.
	-- Without this, a direct call with another member's id would defeat the fog.
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

	-- recap of the last folded day (both sides revealed) — illegible without it. The
	-- 'winner' per front is the SERVER's authoritative fold outcome (fold_front_outcome),
	-- never a client raw-mud compare (which ignores the concede floor + band tiebreak).
	-- Bot themMud is the scripted bot_front_eff(rank) so the reveal matches the fold.
	IF w.last_scored_day IS NOT NULL THEN
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
		SELECT jsonb_build_object('day', w.last_scored_day, 'fronts',
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
		'board', COALESCE(board, '[]'::jsonb),
		'myPlan', myplan,
		'redeployUsed', CASE WHEN is_chal THEN w.redeploy_used_challenger ELSE w.redeploy_used_defender END,
		'weeklyModifier', w.weekly_modifier,
		'recap', recap);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. war_state — carried from 20260666 (rope) + the gated 'fronts' payload.
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

	base := jsonb_build_object(
		'warId', w.id, 'status', w.status, 'endsAt', w.ends_at, 'isBotWar', w.is_bot_war,
		'winnerCrew', w.winner_crew, 'iAmChallenger', my_crew = w.challenger_crew,
		'myRemainingToday', allotment - COALESCE(my_today, 0),
		'myThrowsRemaining', throws_cap - COALESCE(my_throws, 0),
		'ropePos', w.rope_pos,
		'ropeNorm', (CASE WHEN my_crew = w.challenger_crew THEN 1 ELSE -1 END)
			* GREATEST(-1.0, LEAST(1.0, w.rope_pos::numeric / c_rout)),
		'frontsEnabled', w.fronts_enabled,
		'mine', mine, 'them', them);

	IF w.fronts_enabled THEN
		base := base || jsonb_build_object('fronts', public.war_fronts_state(p_war, caller_id));
	END IF;
	RETURN base;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.war_state(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. challenge_house / accept_challenge — carried from 20260647, gated to set
--     fronts_enabled + weekly_modifier + 7-day length + seed day-1 board.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.challenge_house()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	new_war   uuid;
	m         record;
	bot_id    uuid := '00000000-0000-0000-0000-0000000000b0';
	use_fronts boolean := public.mud_fronts_on();
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
	war_days := CASE WHEN use_fronts THEN 7 ELSE 5 END;
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at, fronts_enabled)
		VALUES (my_crew, bot_id, 'active', true, now(), now() + (war_days || ' days')::interval, use_fronts)
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
	use_fronts boolean := public.mud_fronts_on();
	war_days  int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crews WHERE id = w.defender_crew AND leader_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_defender_leader');
	END IF;
	-- Defender must not already be in ANOTHER live war (e.g. a bot war as challenger).
	-- The partial unique indexes don't cover the cross-role case, so accepting would
	-- silently put the crew in two simultaneous wars — do NOT remove this guard.
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = w.defender_crew OR defender_crew = w.defender_crew)
	             AND status IN ('pending', 'active') AND id <> p_war) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'defender_busy');
	END IF;
	war_days := CASE WHEN use_fronts THEN 7 ELSE 5 END;
	UPDATE public.mud_wars
		SET status = 'active', started_at = now(), ends_at = now() + (war_days || ' days')::interval,
		    fronts_enabled = use_fronts,
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
-- 13. HARDEN internal SECURITY DEFINER helpers. Postgres grants EXECUTE to PUBLIC
--     by default; these are only ever called from owner-context RPCs, so a direct
--     PUBLIC call has no legitimate use and several would be exploitable:
--       • war_fronts_state / fold_front_margin -> would LEAK the opponent's
--         unresolved-day allocation (defeats the fog / Pillar 1).
--       • apply_crew_elo / seed_war_board -> unauthorized writes (ladder tamper /
--         board seeding for arbitrary wars).
--     Mirrors the war_side hardening in 20260647. (war_state, set_front_plan,
--     redeploy_member, crew_leaderboard stay GRANTed — they self-authorize on
--     auth.uid().)
-- ════════════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.war_fronts_state(uuid, uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fold_front_margin(uuid, date)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fold_front_outcome(uuid, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bot_front_eff(int)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_crew_elo(uuid, uuid, uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_war_board(uuid, date)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.band_base_p(text)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_weekly_modifier(uuid)          FROM PUBLIC;
