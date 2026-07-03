-- ═══════════════════════════════════════════════════════════════════════════
-- TRUFFLE PATCH — the 8-hour feeding-window dig heartbeat (Season 2, P1).
-- HELD FOR REVIEW: push only on Brian's explicit "go" (see CLAUDE.md — DB
-- pushes are never autonomous). Applied head at authoring time: 20260692.
--
-- Design: docs/wiki/outputs/memos/mudwar-dig-minigame-2026-07.md §2 (L1) +
-- mudwar-rewards-spec-2026-07.md (Golden Truffle sources) +
-- mudwar-hunger-arc-cadence-2026-07.md (the window heartbeat).
--
-- What ships here:
--   • golden_truffles pouch (profiles column, cap 999) + war_truffles ledger
--     + mint_truffles() — the ONE audited mint path (internal-only).
--   • war_rootings — one rooting per member per 8h window per war.
--   • open_rooting()/submit_rooting() — the dig RPCs. Server-seeded board,
--     finds-only wire, caps make cheating pointless (≤2 mud/window, ≤6/day).
--   • throw_mud + submit_run CARRIED from their latest defs (20260668) with
--     ONE change each: the total slings clamp 21 → 27, because rooting mud
--     shares the mud_slings.slings counter (21 skill + 6 root). Their own
--     budgets (7 throws / run budget) still bound skill mud at 21.
--   • mud_slings slings CHECK re-capped 21 → 27 to match.
--
-- Board parity contract (client mirror = utils/rooting.ts): PRNG is
-- Park–Miller minstd — state := (state * 16807) % 2147483647, nextInt(n) :=
-- state % n after advancing; seed is pre-normalized into [1, 2147483646] by
-- open_rooting. THE FIRST FOUR DRAWS DEFINE THE FIND SET (1: L-orientation,
-- 2: domino orientation, 3: shimmer present, 4: junk type); the server only
-- consumes those four (rooting_finds). Draws 5+ (layers, placement) are
-- layout-only and live client-side. Changing draw order breaks parity.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Schema ────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS golden_truffles int NOT NULL DEFAULT 0;
DO $$ BEGIN
	ALTER TABLE public.profiles
		ADD CONSTRAINT profiles_golden_truffles_check
		CHECK (golden_truffles >= 0 AND golden_truffles <= 999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.war_truffles (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	amount     int         NOT NULL CHECK (amount > 0),
	reason     text        NOT NULL,
	war_id     uuid        REFERENCES public.mud_wars(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_truffles_user_idx ON public.war_truffles (user_id);

CREATE TABLE IF NOT EXISTS public.war_rootings (
	war_id          uuid        NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	crew_id         uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	window_index    bigint      NOT NULL,  -- floor(epoch/28800): the 8h feeding
	seed            int         NOT NULL,  -- normalized [1, 2147483646]
	war_day         date        NOT NULL,  -- UTC day bucket (root-mud day cap)
	opened_at       timestamptz NOT NULL DEFAULT now(),
	submitted_at    timestamptz,
	finds           text[],
	actions         int,
	mud_minted      int         NOT NULL DEFAULT 0,
	truffles_minted int         NOT NULL DEFAULT 0,
	echo_credited   boolean     NOT NULL DEFAULT false,
	PRIMARY KEY (war_id, user_id, window_index)
);
-- Echo lookup: "which crewmates rooted this window?"
CREATE INDEX IF NOT EXISTS war_rootings_echo_idx
	ON public.war_rootings (war_id, crew_id, window_index);

ALTER TABLE public.war_truffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_rootings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own truffle ledger" ON public.war_truffles;
CREATE POLICY "Own truffle ledger" ON public.war_truffles FOR SELECT
	USING (user_id = auth.uid());
-- Mirror mud_slings visibility: members of either crew in the war may read.
DROP POLICY IF EXISTS "View rootings in your wars" ON public.war_rootings;
CREATE POLICY "View rootings in your wars" ON public.war_rootings FOR SELECT
	USING (EXISTS (
		SELECT 1 FROM public.mud_wars w
		JOIN public.crew_members cm
		  ON cm.crew_id IN (w.challenger_crew, w.defender_crew)
		WHERE w.id = war_rootings.war_id AND cm.user_id = auth.uid()
	));

-- Re-cap slings 21 → 27 (21 skill + ROOT_MUD_CAP_DAY 6). Named constraint from
-- 20260665, so a plain drop/re-add is safe and idempotent.
ALTER TABLE public.mud_slings DROP CONSTRAINT IF EXISTS mud_slings_slings_check;
ALTER TABLE public.mud_slings
	ADD CONSTRAINT mud_slings_slings_check CHECK (slings >= 0 AND slings <= 27);

-- ── 2. mint_truffles — the ONE audited mint path (internal only) ─────────────
-- Cap-aware and never lossy: mints LEAST(amount, room-to-999); the un-minted
-- remainder simply doesn't exist (no silent conversion — the rewards spec's
-- anti-CoC-overflow rule). Returns the amount actually minted.
CREATE OR REPLACE FUNCTION public.mint_truffles(
	p_user uuid, p_amount int, p_reason text, p_war uuid
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	bal    int;
	actual int;
BEGIN
	IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
	SELECT golden_truffles INTO bal FROM public.profiles
		WHERE id = p_user FOR UPDATE;
	IF bal IS NULL THEN RETURN 0; END IF;
	actual := LEAST(p_amount, GREATEST(0, 999 - bal));
	IF actual = 0 THEN RETURN 0; END IF;
	UPDATE public.profiles SET golden_truffles = golden_truffles + actual
		WHERE id = p_user;
	INSERT INTO public.war_truffles (user_id, amount, reason, war_id)
		VALUES (p_user, actual, p_reason, p_war);
	RETURN actual;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.mint_truffles(uuid, int, text, uuid)
	FROM PUBLIC, anon, authenticated;

-- ── 3. rooting_finds — the server's view of a seeded board ───────────────────
-- Consumes EXACTLY the first four PRNG draws (see parity contract above) and
-- returns the find-id set for validation. Layout never matters server-side.
CREATE OR REPLACE FUNCTION public.rooting_finds(p_seed int)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE
	state   bigint := p_seed;
	orient  int;   -- draw 1 (layout-only, but consumes the stream)
	vert    int;   -- draw 2 (layout-only)
	shimmer int;   -- draw 3
	junk    int;   -- draw 4
	finds   text[] := ARRAY['truffle_l', 'truffle_d'];
BEGIN
	state := (state * 16807) % 2147483647; orient  := (state % 4)::int;
	state := (state * 16807) % 2147483647; vert    := (state % 2)::int;
	state := (state * 16807) % 2147483647; shimmer := (state % 2)::int;
	state := (state * 16807) % 2147483647; junk    := (state % 2)::int;
	IF shimmer = 1 THEN finds := finds || 'shimmer'; END IF;
	finds := finds || (CASE junk WHEN 0 THEN 'junk_boot' ELSE 'junk_wrap' END);
	RETURN finds;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rooting_finds(int)
	FROM PUBLIC, anon, authenticated;

-- ── 4. open_rooting — stamp the window, hand back the seed ───────────────────
CREATE OR REPLACE FUNCTION public.open_rooting(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	win       bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	the_seed  int;
	existing  record;
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

	-- Normalized Park–Miller seed in [1, 2147483646] (parity contract).
	the_seed := (abs(hashtext(p_war::text || ':' || win::text || ':' || caller_id::text))
		% 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win;
	IF existing.war_id IS NOT NULL THEN
		IF existing.submitted_at IS NOT NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted',
				'window_ends_at', to_timestamp((win + 1) * 28800));
		END IF;
		-- Re-open of an unfinished rooting: same seed (idempotent).
		RETURN jsonb_build_object('ok', true, 'seed', existing.seed,
			'window_index', win, 'window_ends_at', to_timestamp((win + 1) * 28800));
	END IF;

	INSERT INTO public.war_rootings (war_id, user_id, crew_id, window_index, seed, war_day)
		VALUES (p_war, caller_id, my_crew, win, the_seed, today);
	RETURN jsonb_build_object('ok', true, 'seed', the_seed,
		'window_index', win, 'window_ends_at', to_timestamp((win + 1) * 28800));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.open_rooting(uuid) TO authenticated;

-- ── 5. submit_rooting — validate finds against the seed, mint mud + truffles ─
CREATE OR REPLACE FUNCTION public.submit_rooting(p_war uuid, p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	w           record;
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today       date := (now() AT TIME ZONE 'UTC')::date;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	root_today  int;
	pts         int;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	r           record;
	bal         int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF p_actions IS NULL OR p_actions < 0 OR p_actions > 20 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_actions');
	END IF;
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

	SELECT * INTO row_r FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win
		FOR UPDATE;
	IF row_r.war_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting'); END IF;
	IF row_r.submitted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted'); END IF;

	-- Finds must exist on THIS seed's board (dedupe first; stones are inert and
	-- not claimable; a forged find rejects the whole submit).
	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		IF NOT (f = ANY (valid)) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;

	-- Mud: +1 per truffle, ≤2/window by construction, ≤6/day across windows.
	SELECT COALESCE(SUM(mud_minted), 0) INTO root_today FROM public.war_rootings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today
		  AND submitted_at IS NOT NULL;
	pts := LEAST(truffle_cnt, 2, GREATEST(0, 6 - root_today));

	IF pts > 0 THEN
		-- Plain add (no LEAST clamp): skill RPCs bound themselves at 21 via their
		-- own budgets; rooting bounds itself at 6/day here; CHECK caps the sum at 27.
		INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, war_day)
			VALUES (p_war, my_crew, caller_id, pts, today)
		ON CONFLICT (war_id, user_id, war_day) DO UPDATE
			SET slings = mud_slings.slings + pts;
	END IF;

	-- Golden Truffles: first truffle = +1; golden echo when 2+ distinct
	-- crewmates rooted this window (async sync — the whole "multiplayer").
	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE war_id = p_war AND crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'rooting', p_war);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'rooting_echo', p_war);
			my_echo := true;
		END IF;
	END IF;
	-- Retroactive gild: my dig completes the echo for earlier crew diggers who
	-- found a truffle and haven't been credited (first-mover never taxed, A6).
	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE war_id = p_war AND crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'rooting_echo', p_war);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE war_id = p_war AND user_id = r.user_id AND window_index = win;
	END LOOP;

	UPDATE public.war_rootings SET
		submitted_at    = now(),
		finds           = claimed,
		actions         = p_actions,
		mud_minted      = pts,
		truffles_minted = minted,
		echo_credited   = my_echo
		WHERE war_id = p_war AND user_id = caller_id AND window_index = win;

	SELECT golden_truffles INTO bal FROM public.profiles WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true,
		'mud', pts,
		'truffles', minted,
		'echo', my_echo,
		'golden_truffles', COALESCE(bal, 0),
		'root_mud_today', root_today + pts,
		'window_ends_at', to_timestamp((win + 1) * 28800));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.submit_rooting(uuid, text[], int) TO authenticated;

-- ── 6. throw_mud — CARRIED from 20260668 (latest def). ONE change: the total
--       slings clamp 21 → 27 (total_cap), since rooting mud shares the counter.
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
	total_cap  int := 27;  -- CARRY DIFF: day_cap(21) + ROOT_MUD_CAP_DAY(6)
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
		SET slings       = LEAST(total_cap, mud_slings.slings + pts),
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

-- ── 7. submit_run — CARRIED from 20260668 (latest def). Same single change:
--       total slings clamp 21 → 27.
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
	total_cap  int := 27;    -- CARRY DIFF: day_cap(21) + ROOT_MUD_CAP_DAY(6)
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
		SET slings     = LEAST(total_cap, mud_slings.slings + run_pts),
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
