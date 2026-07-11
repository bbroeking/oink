-- ═══════════════════════════════════════════════════════════════════════════
-- CO-OP DIG REBUILD — tear out Sounder-vs-Sounder war/league, rebuild Season 1
-- team play as a pure co-op dig against the Great Hungerer.
--
-- WHY: nothing of the war system ever shipped (the `mud_wars` UI flag is
-- globally false and stays that way forever, so old dark builds never light
-- up). A full drop is safe. Season-1 team play becomes: pigs in a Sounder dig
-- the Truffle Patch once per 8h feeding window — each find mints personal
-- Golden Truffles AND drains a single barnyard-wide hunger meter, and the crew
-- accrues lifetime dig milestones. No scuffles, fixtures, ribbons/Elo, fronts,
-- rhythm, or rope.
--
-- WHAT SURVIVES (do NOT drop): crews / crew_members / crew_invites, the golden
-- truffle ledger (war_truffles) + mint_truffles(), the truffle-exchange stack,
-- the Chorus + blessings machinery (send_blessing rebuilt only to drop its
-- league-Elo bump), profiles.war_wins (harmless), the mud_* title ROWS
-- (re-themed in place). The `war_rootings` table NAME is kept (now crew-keyed,
-- war-free) so the dig-count achievement + its trigger keep working without
-- rebuilding those large carried functions (carry-latest-def footgun).
--
-- BOARD PARITY (unchanged): rooting_finds(seed) + the client's generateBoard
-- (utils/rooting.ts) still share the Park–Miller minstd contract. This
-- migration does NOT touch rooting_finds. The server seed is now derived from
-- (window_index, user) instead of (war, window, user) — the client never
-- derives the seed, it receives it, so parity is unaffected.
--
-- FOOTGUNS honored: milestone announcements are INLINE system_announcements
-- INSERTs (send_system_announcement() is admin-gated → silent rollback for
-- users). Every rebuilt crew RPC is carried from its LATEST def with only the
-- war gate removed. Cron unschedule tolerates pg_cron being absent (local
-- harness stubs it) AND the job being absent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Unschedule the war/league cron jobs ──────────────────────────────────
-- Tolerate pg_cron being absent (harness) AND the job being absent.
DO $$ BEGIN
	BEGIN PERFORM cron.unschedule('mud-wars-sweep');   EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM cron.unschedule('war-term-advance'); EXCEPTION WHEN OTHERS THEN NULL; END;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 1. Drop triggers on SURVIVING tables ────────────────────────────────────
-- (Triggers on mud_wars vanish with the table below; this one is on the kept
-- barn_visits table, which may not exist in the harness — guard on regclass.)
DO $$ BEGIN
	IF to_regclass('public.barn_visits') IS NOT NULL THEN
		DROP TRIGGER IF EXISTS trg_mint_war_access ON public.barn_visits;
	END IF;
END $$;

-- ── 2. Keep the golden-truffle ledger; sever its FK to the doomed mud_wars ───
DO $$ BEGIN
	IF to_regclass('public.war_truffles') IS NOT NULL THEN
		ALTER TABLE public.war_truffles DROP CONSTRAINT IF EXISTS war_truffles_war_id_fkey;
	END IF;
END $$;

-- ── 3. Drop war/league TABLES (dependency order; CASCADE for war-only) ───────
DROP TABLE IF EXISTS public.term_fixtures    CASCADE;
DROP TABLE IF EXISTS public.war_terms        CASCADE;
DROP TABLE IF EXISTS public.league_seasons   CASCADE;
DROP TABLE IF EXISTS public.mud_war_deploys  CASCADE;
DROP TABLE IF EXISTS public.mud_war_access   CASCADE;
DROP TABLE IF EXISTS public.mud_front_pushes CASCADE;
DROP TABLE IF EXISTS public.mud_war_plans    CASCADE;
DROP TABLE IF EXISTS public.mud_war_fronts   CASCADE;
DROP TABLE IF EXISTS public.crew_ratings     CASCADE;
DROP TABLE IF EXISTS public.mud_slings       CASCADE;
-- war_rootings: plain drop (NO cascade) so a stray SQL-function dependency can't
-- silently take my_achievements with it. Its dig trigger drops with the table;
-- we recreate the table (crew-keyed) + trigger in §5d.
DROP TABLE IF EXISTS public.war_rootings;
-- mud_wars last — CASCADE mops up its triggers + any leftover inbound FKs.
DROP TABLE IF EXISTS public.mud_wars CASCADE;

-- ── 4. Drop war/league FUNCTIONS (exact signatures) ─────────────────────────
-- Lifecycle / query RPCs
DROP FUNCTION IF EXISTS public.challenge_crew(uuid);
DROP FUNCTION IF EXISTS public.challenge_house();
DROP FUNCTION IF EXISTS public.accept_challenge(uuid);
DROP FUNCTION IF EXISTS public.decline_challenge(uuid);
DROP FUNCTION IF EXISTS public.sling_mud(uuid);
DROP FUNCTION IF EXISTS public.throw_mud(uuid, text);
DROP FUNCTION IF EXISTS public.submit_run(uuid, text[]);
DROP FUNCTION IF EXISTS public.set_deploy(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.set_front_plan(uuid, text);
DROP FUNCTION IF EXISTS public.redeploy_member(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.war_state(uuid);
DROP FUNCTION IF EXISTS public.war_side(uuid, uuid);
DROP FUNCTION IF EXISTS public.war_fronts_state(uuid, uuid);
DROP FUNCTION IF EXISTS public.my_war();
DROP FUNCTION IF EXISTS public.find_challengeable_crews();
DROP FUNCTION IF EXISTS public.forfeit_war(uuid);
DROP FUNCTION IF EXISTS public.crew_match_history(int);
-- Scoring / resolution / sweep
DROP FUNCTION IF EXISTS public.resolve_war(uuid);
DROP FUNCTION IF EXISTS public.score_mud_war_days(uuid);
DROP FUNCTION IF EXISTS public.sweep_mud_wars();
DROP FUNCTION IF EXISTS public.seed_war_board(uuid, date);
DROP FUNCTION IF EXISTS public.pick_weekly_modifier(uuid);
DROP FUNCTION IF EXISTS public.band_base_p(text);
DROP FUNCTION IF EXISTS public.bot_front_eff(int);
DROP FUNCTION IF EXISTS public.fold_front_outcome(uuid, date, text);
DROP FUNCTION IF EXISTS public.fold_front_margin(uuid, date);
DROP FUNCTION IF EXISTS public.apply_crew_elo(uuid, uuid, uuid, int);
DROP FUNCTION IF EXISTS public.crew_leaderboard(int);
DROP FUNCTION IF EXISTS public.mud_fronts_on();
DROP FUNCTION IF EXISTS public.mud_rhythm_on();
DROP FUNCTION IF EXISTS public.deploy_press(text);
DROP FUNCTION IF EXISTS public.bot_deploy(int);
DROP FUNCTION IF EXISTS public.rhythm_area_holds(uuid, date, text);
DROP FUNCTION IF EXISTS public.fold_rhythm_margin(uuid, date);
DROP FUNCTION IF EXISTS public.grant_war_access(uuid, uuid);
-- Trigger functions (their triggers dropped with mud_wars/mud_slings/barn_visits above)
DROP FUNCTION IF EXISTS public.enforce_war_cooldown();
DROP FUNCTION IF EXISTS public.mint_war_access_on_visit();
DROP FUNCTION IF EXISTS public.grant_war_spoils_on_resolve();
DROP FUNCTION IF EXISTS public.record_fixture_result();
-- The truffle-exchange in-week milestone minter was a mud_slings AFTER trigger
-- (cross 10/25/50 personal mud → 5/10/15 truffles). Its trigger drops with
-- mud_slings; drop the now-orphaned function so it can't dangle on the dropped
-- table. (The rest of the truffle-exchange stack — redeem_war_cosmetic etc. —
-- is war-free and stays.)
DROP FUNCTION IF EXISTS public.mint_mud_milestones();
-- League
DROP FUNCTION IF EXISTS public.advance_war_term();
DROP FUNCTION IF EXISTS public.sounder_league_standings(int);
DROP FUNCTION IF EXISTS public.my_league_state();
DROP FUNCTION IF EXISTS public.sounder_standings(int);
-- Dev helpers + war RLS helper
DROP FUNCTION IF EXISTS public.dev_skip_to_hold(uuid);
DROP FUNCTION IF EXISTS public.dev_end_war_now(uuid);
DROP FUNCTION IF EXISTS public.is_war_participant(uuid, uuid);
-- Old dig RPCs (war-keyed signatures) — rebuilt below as no-arg / (text[],int)
DROP FUNCTION IF EXISTS public.open_rooting(uuid);
DROP FUNCTION IF EXISTS public.submit_rooting(uuid, text[], int);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REBUILD (war-free)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 5a. Crew lifetime dig total ─────────────────────────────────────────────
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS lifetime_finds bigint NOT NULL DEFAULT 0;

-- ── 5b. Barnyard-wide hunger drain (single-row counter, server-written) ──────
CREATE TABLE IF NOT EXISTS public.hunger_drain (
	id    boolean PRIMARY KEY DEFAULT true CHECK (id),  -- single-row guard
	total bigint  NOT NULL DEFAULT 0
);
INSERT INTO public.hunger_drain (id, total) VALUES (true, 0) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.hunger_drain ENABLE ROW LEVEL SECURITY;  -- RLS on, no policies → client-denied

-- ── 5c. Crew milestone claim table (idempotent per crew per threshold) ───────
CREATE TABLE IF NOT EXISTS public.crew_milestones (
	crew_id    uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	threshold  int         NOT NULL,
	reached_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (crew_id, threshold)
);
ALTER TABLE public.crew_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View your crew milestones" ON public.crew_milestones;
CREATE POLICY "View your crew milestones" ON public.crew_milestones FOR SELECT
	USING (public.is_crew_member(crew_id, auth.uid()));

-- ── 5d. Rooting sessions — crew-keyed, war-free (name kept for achievements) ─
CREATE TABLE public.war_rootings (
	user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	crew_id         uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	window_index    bigint      NOT NULL,               -- floor(epoch/28800): the 8h feeding
	seed            int         NOT NULL,               -- normalized [1, 2147483646]
	dig_day         date        NOT NULL,               -- UTC day bucket
	opened_at       timestamptz NOT NULL DEFAULT now(),
	submitted_at    timestamptz,
	finds           text[],
	actions         int,
	truffles_minted int         NOT NULL DEFAULT 0,
	echo_credited   boolean     NOT NULL DEFAULT false,
	credited_finds  int         NOT NULL DEFAULT 0,     -- count that drained him / grew the herd total
	PRIMARY KEY (user_id, window_index)                 -- one dig per pig per feeding window
);
-- Echo lookup: "which crewmates dug this window?"
CREATE INDEX IF NOT EXISTS war_rootings_echo_idx ON public.war_rootings (crew_id, window_index);
ALTER TABLE public.war_rootings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View rootings in your crew" ON public.war_rootings;
CREATE POLICY "View rootings in your crew" ON public.war_rootings FOR SELECT
	USING (public.is_crew_member(crew_id, auth.uid()));

-- Re-attach the dig-count achievement trigger (war_rootings_dig_achievements()
-- is the carried def from 20260710; it counts submitted rootings by user).
DROP TRIGGER IF EXISTS war_rootings_dig_achievements ON public.war_rootings;
CREATE TRIGGER war_rootings_dig_achievements
	AFTER UPDATE OF submitted_at ON public.war_rootings
	FOR EACH ROW EXECUTE FUNCTION public.war_rootings_dig_achievements();

-- ── 5e. Re-theme the three mud-war titles as co-op dig milestones ───────────
-- ids stay stable (mud_champion / mud_veteran / mud_legend); names + fiction move.
UPDATE public.titles SET name = 'Root Rustler',
	description = 'Your Sounder rustled 150 truffles out from under his snout.'
	WHERE id = 'mud_champion';
UPDATE public.titles SET name = 'Truffle Baron',
	description = 'Your Sounder pried 600 truffles from the Great Hungerer''s hoard.'
	WHERE id = 'mud_veteran';
UPDATE public.titles SET name = 'Hunger''s Bane',
	description = 'Your Sounder starved him of 1,800 truffles — a legend of the bog.'
	WHERE id = 'mud_legend';

-- ── 5f. Feature flag: coop_dig global OFF + Brian override ON ────────────────
-- Mirrors 20260692's mud_wars override target. NEVER touch the mud_wars flag —
-- it must stay false forever so old dark builds never light up.
INSERT INTO public.app_config (key, enabled) VALUES ('coop_dig', false)
	ON CONFLICT (key) DO NOTHING;
UPDATE public.profiles
	SET feature_overrides = COALESCE(feature_overrides, '{}'::jsonb) || '{"coop_dig": true}'::jsonb
	WHERE lower(username) = 'brian';

-- ── 5g. hunger_meter() — rebuilt, denominated in FINDS ──────────────────────
-- Total credited finds barnyard-wide, all-time. Stage thresholds retuned for
-- the new unit. ASSUMPTION (retune from live instrumentation at the flip):
-- ~15-25 active pigs × ~2-3 digs/day × ~3 finds/dig ≈ 90-225 finds/day. At the
-- central ~150/day, famished (9000) lands ~8-9 weeks in — inside the 6-10 week
-- target arc. Client renders the STAGE as a vignette, never the number.
-- MUST match the six stage names in the client hunger-stage constant.
CREATE OR REPLACE FUNCTION public.hunger_meter()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	thresholds  CONSTANT bigint[] := ARRAY[600, 1800, 3600, 6000, 9000];
	stage_names CONSTANT text[]   :=
		ARRAY['gorged', 'stuffed', 'full', 'peckish', 'hungry', 'famished'];
	total       bigint := 0;
	stage_idx   int := 0;   -- 0=gorged … 5=famished
	next_thresh bigint := NULL;
	i           int;
BEGIN
	SELECT COALESCE(hd.total, 0) INTO total FROM public.hunger_drain hd WHERE hd.id = true;
	total := COALESCE(total, 0);
	FOR i IN 1 .. array_length(thresholds, 1) LOOP
		IF total >= thresholds[i] THEN stage_idx := i; END IF;
	END LOOP;
	IF stage_idx < array_length(thresholds, 1) THEN
		next_thresh := thresholds[stage_idx + 1];
	END IF;
	RETURN jsonb_build_object(
		'available',      true,
		'total',          total,
		'stage',          stage_names[stage_idx + 1],
		'stage_index',    stage_idx,
		'next_threshold', next_thresh
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.hunger_meter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hunger_meter() TO authenticated;

-- ── 5h. feeding_state() — cheap poll for the season tab strip ───────────────
CREATE OR REPLACE FUNCTION public.feeding_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	win       bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	dug       boolean := false;
	crew_dug  jsonb := '[]'::jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('window_index', win,
			'window_ends_at', to_timestamp((win + 1) * 28800), 'dug', false, 'crew_dug', crew_dug);
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	dug := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win AND submitted_at IS NOT NULL);
	IF my_crew IS NOT NULL THEN
		SELECT COALESCE(jsonb_agg(jsonb_build_object(
				'user_id', r.user_id, 'display_name', p.username)), '[]'::jsonb)
			INTO crew_dug
			FROM public.war_rootings r JOIN public.profiles p ON p.id = r.user_id
			WHERE r.crew_id = my_crew AND r.window_index = win
			  AND r.submitted_at IS NOT NULL AND r.user_id <> caller_id;
	END IF;
	RETURN jsonb_build_object('window_index', win,
		'window_ends_at', to_timestamp((win + 1) * 28800), 'dug', dug, 'crew_dug', crew_dug);
END;
$function$;
REVOKE ALL ON FUNCTION public.feeding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feeding_state() TO authenticated;

-- ── 5i. open_rooting() — no args, Sounder-gated ─────────────────────────────
-- One session per pig per 8h feeding window. Same seed-normalization + re-open
-- idempotency as the old def, minus the war. rooting_finds(seed) is unchanged.
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	today       date := (now() AT TIME ZONE 'UTC')::date;
	the_seed    int;
	existing    record;
	coop_now    boolean;
	blessed_now boolean;
	crew_dug    jsonb;
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;   -- the dig is Sounder-gated

	coop_now := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL);
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', r.user_id, 'display_name', p.username)), '[]'::jsonb)
		INTO crew_dug
		FROM public.war_rootings r JOIN public.profiles p ON p.id = r.user_id
		WHERE r.crew_id = my_crew AND r.window_index = win
		  AND r.submitted_at IS NOT NULL AND r.user_id <> caller_id;

	-- Normalized Park–Miller seed in [1, 2147483646] (client receives it; parity
	-- is in board generation from the seed, not the seed derivation).
	the_seed := (abs(hashtext(win::text || ':' || caller_id::text)) % 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win;
	IF existing.user_id IS NOT NULL THEN
		RETURN jsonb_build_object(
			'already', existing.submitted_at IS NOT NULL,
			'window_index', win, 'seed', existing.seed, 'opened_at', existing.opened_at,
			'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug);
	END IF;

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day)
		VALUES (caller_id, my_crew, win, the_seed, today);
	RETURN jsonb_build_object(
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', now(),
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 5j. submit_rooting(finds, actions) — validate, mint, drain, milestone ────
-- Golden Truffles: first truffle = +1; async golden echo (+1) when a crewmate
-- already dug this window (+ retroactive gild of earlier crew diggers, so the
-- first-mover is never taxed); blessed dig = +1. Every credited find drains the
-- Great Hungerer and grows the crew's lifetime herd total; +20 season XP/dig.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	n_credited  int := 0;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[];
	drain_total bigint;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;

	-- Crewmates who already dug this window — powers the co-op depth (deeper
	-- action budget) AND the golden echo.
	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RAISE EXCEPTION 'bad_actions';
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win FOR UPDATE;
	IF row_r.user_id IS NULL THEN RAISE EXCEPTION 'no_open_rooting'; END IF;
	IF row_r.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'already_rooted'; END IF;

	-- Finds must exist on THIS seed's board (dedupe first; a forged find rejects
	-- the whole submit). rooting_finds is unchanged from truffle_patch.
	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		IF NOT (f = ANY (valid)) THEN RAISE EXCEPTION 'bad_finds'; END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	n_credited := COALESCE(array_length(claimed, 1), 0);

	-- Golden Truffles (war-free reason strings).
	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'dig', NULL);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'dig_echo', NULL);
			my_echo := true;
		END IF;
		IF blessed THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'blessed_dig', NULL);
		END IF;
	END IF;

	-- Retroactive gild: my dig completes the echo for earlier crew diggers who
	-- found a truffle and haven't been credited (first-mover never taxed).
	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE user_id = r.user_id AND window_index = win;
		-- Their truffle tally grew — nudge the truffles-dug achievement ladder.
		BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;

	-- My truffle tally grew — fire the truffles-dug achievement ladder (the
	-- re-themed former scuffle-wins category). Guarded + idempotent.
	IF minted > 0 THEN
		BEGIN PERFORM public.try_claim_achievements(caller_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	-- The crewmates whose digs echo-gilded with mine this window.
	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- Drain the Great Hungerer + grow the herd total (every credited find counts).
	UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
		RETURNING total INTO drain_total;

	SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = my_crew FOR UPDATE;
	old_life := COALESCE(old_life, 0);
	new_life := old_life + n_credited;
	UPDATE public.crews SET lifetime_finds = new_life WHERE id = my_crew;

	-- Lifetime dig milestones. Thresholds MUST match constants (client)
	-- MILESTONE_THRESHOLDS in constants/dig.ts = [150, 600, 1800]. Grant every
	-- CURRENT member a re-themed title + a snout purse (purses mirror
	-- season1_achievements tiers: 200 / 1000 / 2000), idempotent per crew per
	-- threshold, INLINE announce (send_system_announcement is admin-gated).
	FOR t IN SELECT * FROM (VALUES
		(150,  'mud_champion', 200,  'Root Rustler'),
		(600,  'mud_veteran',  1000, 'Truffle Baron'),
		(1800, 'mud_legend',   2000, 'Hunger''s Bane')
	) AS v(thresh, title_id, purse, title_name)
	LOOP
		IF old_life < t.thresh AND new_life >= t.thresh THEN
			INSERT INTO public.crew_milestones (crew_id, threshold)
				VALUES (my_crew, t.thresh) ON CONFLICT DO NOTHING;
			GET DIAGNOSTICS landed = ROW_COUNT;
			IF landed > 0 THEN
				FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
					INSERT INTO public.user_titles (user_id, title_id)
						VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
					UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
					BEGIN
						INSERT INTO public.system_announcements (user_id, kind, title, body, data)
						VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
							'Your Sounder has rooted ' || t.thresh ||
							' truffles out from under the Great Hungerer. The title "' ||
							t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
							jsonb_build_object('crew_id', my_crew, 'threshold', t.thresh, 'title_id', t.title_id));
					EXCEPTION WHEN OTHERS THEN NULL; END;
				END LOOP;
				milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
			END IF;
		END IF;
	END LOOP;

	-- Stamp my session (fires the dig-count achievement via the submitted_at trigger).
	UPDATE public.war_rootings SET
		submitted_at    = now(),
		finds           = claimed,
		actions         = p_actions,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited
		WHERE user_id = caller_id AND window_index = win;

	-- The pass is earned in the bog — +20 season XP per submitted dig.
	PERFORM public.grant_season_xp(caller_id, 20);

	RETURN jsonb_build_object(
		'credited',    claimed,
		'truffles',    minted,
		'echo_names',  echo_names,
		'drain_total', drain_total,
		'milestone',   milestone);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;

-- ── 5k. crew_state() — war/league fields removed ────────────────────────────
-- Carried from 20260647 (only prior def); drops inWar/warId; adds lifetime_finds.
CREATE OR REPLACE FUNCTION public.crew_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	crew_row    record;
	members     jsonb;
	invites_in  jsonb;
	invites_out jsonb;
	milestones  int[];
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('crew', NULL); END IF;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', ci.id, 'crew_id', ci.crew_id, 'crew_name', c.name,
			'inviter_id', ci.inviter_id, 'inviter_name', p.username
		) ORDER BY ci.created_at DESC), '[]'::jsonb) INTO invites_in
		FROM public.crew_invites ci
		JOIN public.crews c ON c.id = ci.crew_id
		JOIN public.profiles p ON p.id = ci.inviter_id
		WHERE ci.invitee_id = caller_id AND ci.status = 'pending';

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('crew', NULL, 'members', '[]'::jsonb,
			'invitesIn', invites_in, 'invitesOut', '[]'::jsonb);
	END IF;

	SELECT * INTO crew_row FROM public.crews WHERE id = my_crew;
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', cm.user_id, 'username', p.username, 'role', cm.role,
			'active_title', p.active_title_id
		) ORDER BY (cm.role = 'leader') DESC, cm.joined_at), '[]'::jsonb) INTO members
		FROM public.crew_members cm JOIN public.profiles p ON p.id = cm.user_id
		WHERE cm.crew_id = my_crew;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', ci.id, 'invitee_id', ci.invitee_id, 'invitee_name', p.username
		) ORDER BY ci.created_at DESC), '[]'::jsonb) INTO invites_out
		FROM public.crew_invites ci JOIN public.profiles p ON p.id = ci.invitee_id
		WHERE ci.crew_id = my_crew AND ci.status = 'pending';

	-- Herd milestone data for the season tab (thresholds crossed, e.g. [150, 600]).
	SELECT COALESCE(array_agg(threshold ORDER BY threshold), '{}'::int[]) INTO milestones
		FROM public.crew_milestones WHERE crew_id = my_crew;

	RETURN jsonb_build_object(
		'crew', jsonb_build_object('id', crew_row.id, 'name', crew_row.name,
			'leader_id', crew_row.leader_id, 'is_bot', crew_row.is_bot,
			'lifetime_finds', crew_row.lifetime_finds,
			'milestones_claimed', to_jsonb(milestones)),
		'members', members, 'invitesIn', invites_in, 'invitesOut', invites_out);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.crew_state() TO authenticated;

-- ── 5l. Crew lifecycle — carried LATEST defs, war gates removed ─────────────

-- join_crew — from 20260707; dropped the crew_in_war gate. The >= 4 cap MUST
-- match constants (client) CREW_CAP in constants/crews.ts.
CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	joiner_name  text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false FOR UPDATE;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (p_crew, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	BEGIN
		SELECT username INTO joiner_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (target.leader_id, 'crew_join', 'A new snout',
			COALESCE(joiner_name, 'A pig') || ' joined ' || target.name || '.',
			jsonb_build_object('crew_id', p_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'crew_id', p_crew);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.join_crew(uuid) TO authenticated;

-- leave_crew — from 20260647; dropped the in_war gate.
CREATE OR REPLACE FUNCTION public.leave_crew()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	am_leader   boolean;
	next_leader uuid;
	remaining   int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	SELECT (leader_id = caller_id) INTO am_leader FROM public.crews WHERE id = my_crew;
	DELETE FROM public.crew_members WHERE crew_id = my_crew AND user_id = caller_id;
	SELECT count(*) INTO remaining FROM public.crew_members WHERE crew_id = my_crew;
	IF remaining = 0 THEN
		DELETE FROM public.crews WHERE id = my_crew;
	ELSIF am_leader THEN
		SELECT user_id INTO next_leader FROM public.crew_members
			WHERE crew_id = my_crew ORDER BY joined_at ASC LIMIT 1;
		UPDATE public.crews SET leader_id = next_leader WHERE id = my_crew;
		UPDATE public.crew_members SET role = 'leader' WHERE crew_id = my_crew AND user_id = next_leader;
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.leave_crew() TO authenticated;

-- kick_crew_member — from 20260705100000; dropped the in_war gate.
CREATE OR REPLACE FUNCTION public.kick_crew_member(p_member uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	crew_name text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF caller_id = p_member THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crew_members
	               WHERE crew_id = my_crew AND user_id = p_member) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
	END IF;
	DELETE FROM public.crew_members WHERE crew_id = my_crew AND user_id = p_member;
	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_member, 'crew_kick', 'Paths part',
			crew_name || ' has parted ways with you. No mud lost — the bog is full of banners.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.kick_crew_member(uuid) TO authenticated;

-- find_joinable_crews — from 20260707; dropped the not-mid-war gate.
CREATE OR REPLACE FUNCTION public.find_joinable_crews()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE(jsonb_agg(
		jsonb_build_object(
			'id', j.id, 'name', j.name,
			'memberCount', j.member_count,
			'leaderName', j.leader_name
		) ORDER BY j.member_count DESC, j.created_at ASC), '[]'::jsonb)
	FROM (
		SELECT c.id, c.name, c.created_at,
		       (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id) AS member_count,
		       (SELECT p.username FROM public.profiles p WHERE p.id = c.leader_id) AS leader_name
		FROM public.crews c
		WHERE c.is_bot = false
		  AND c.id <> COALESCE(
		        (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()),
		        '00000000-0000-0000-0000-000000000000'::uuid)
	) j
	WHERE j.member_count BETWEEN 1 AND 3;
$function$;
GRANT EXECUTE ON FUNCTION public.find_joinable_crews() TO authenticated;

-- ── 5m. send_blessing() — carried from 20260705100000; league Elo bump removed ─
-- crew_ratings is gone; the Chorus glow + announce stay, the +3 Elo does not.
CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_blessing_kind();
	casts_today   int;
	cast_cap      int;
	new_id        uuid;
	exp           timestamptz;
	bf            numeric;
	base          interval;
	my_crew       uuid;
	chorus_voices int;
	glow_rows     int := 0;
	chorus_fired  boolean := false;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT (public.are_friends(caller_id, target_user_id)
	        OR public.is_crewmates(caller_id, target_user_id)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date
		  AND kind NOT IN ('war_winner_regen', 'chorus_glow');
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'        THEN interval '3 hours'
		WHEN 'mud_wrap'        THEN interval '3 hours'
		WHEN 'sun_beam'        THEN interval '4 hours'
		WHEN 'glimmer_truffle' THEN interval '4 hours'
		ELSE NULL
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	IF kind_today IN ('bountiful_snouts', 'trough_bounty') THEN
		UPDATE public.profiles SET counter = counter + 5 WHERE id = target_user_id;
	ELSIF kind_today IN ('halo_kiss', 'snoot_boop') THEN
		PERFORM public.grant_tickles(target_user_id, 5);
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	-- THE CHORUS — 3+ distinct crewmates cast within 30 minutes → the whole
	-- Sounder glows for an hour. (The league +3 Elo bump was removed with the
	-- ratings table; the glow + announce are the co-op payoff now.)
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NOT NULL THEN
		SELECT count(DISTINCT b.sender_id) INTO chorus_voices
			FROM public.blessings b
			JOIN public.crew_members cm
			  ON cm.user_id = b.sender_id AND cm.crew_id = my_crew
			WHERE b.sent_at > now() - interval '30 minutes'
			  AND b.kind NOT IN ('war_winner_regen', 'chorus_glow');
		IF chorus_voices >= 3 AND NOT EXISTS (
			SELECT 1 FROM public.blessings cb
			JOIN public.crew_members cm2
			  ON cm2.user_id = cb.receiver_id AND cm2.crew_id = my_crew
			WHERE cb.kind = 'chorus_glow'
			  AND cb.sent_on = (now() AT TIME ZONE 'UTC')::date
		) THEN
			INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
				SELECT cm.user_id, cm.user_id, 'chorus_glow', now() + interval '1 hour'
				FROM public.crew_members cm WHERE cm.crew_id = my_crew
			ON CONFLICT (sender_id, receiver_id, sent_on) DO NOTHING;
			GET DIAGNOSTICS glow_rows = ROW_COUNT;
			IF glow_rows > 0 THEN
				chorus_fired := true;
				BEGIN
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					SELECT cm.user_id, 'chorus_glow', 'The Chorus rises',
						'Three voices blessed within the half hour — the whole Sounder glows for an hour.',
						jsonb_build_object('crew_id', my_crew)
					FROM public.crew_members cm WHERE cm.crew_id = my_crew;
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;
		END IF;
	END IF;

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id,
		'chorus', chorus_fired);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.send_blessing(uuid) TO authenticated;

-- ── 5n. Season-1 achievements — re-theme the un-earnable scuffle ladders ─────
-- The three 'war_wins' achievements were credited by profiles.war_wins, which
-- the (now-dropped) resolve_war stack incremented — they can never be earned
-- again. Re-point that category to TRUFFLES DUG (lifetime golden-truffle mints,
-- from the war_truffles ledger) and re-theme the fiction. The 'dig_count'
-- ladder (submitted digs = digs in distinct feeding windows) and 'echo_claims'
-- ladder already survive on live credit paths — only their display label moves.
--
-- CLIENT ALIGNMENT: display_category 'scuffle' → 'the_dig' (client chip label
-- "The Dig", app/achievements.tsx). Category key 'war_wins' → 'truffles_dug'.

-- Re-theme the former scuffle-wins rows → truffles dug (thresholds 1 / 10 / 50).
UPDATE public.achievements SET category = 'truffles_dug', icon = 'truffle',
	name = 'First Truffle', description = 'Root your first Golden Truffle.'
	WHERE id = 'first_rope';
UPDATE public.achievements SET category = 'truffles_dug', icon = 'truffle',
	name = 'Golden Snout', description = 'Root ten Golden Truffles.'
	WHERE id = 'rope_handler';
UPDATE public.achievements SET category = 'truffles_dug', icon = 'truffle',
	name = 'Truffle Hoard', description = 'Root fifty Golden Truffles.'
	WHERE id = 'bog_general_a';

-- The dig-fiction description for the top-tier reward title.
UPDATE public.titles SET name = 'Truffle Hoarder',
	description = 'Fifty Golden Truffles rooted from under his snout.'
	WHERE id = 'bog_general';

-- Move all Season-1 (co-op dig) achievements off the "Scuffle" chip.
UPDATE public.achievements SET display_category = 'the_dig'
	WHERE display_category = 'scuffle';

-- try_claim_achievements — carried VERBATIM from 20260710; the 'war_wins'
-- branch becomes 'truffles_dug' (war_truffles ledger count).
CREATE OR REPLACE FUNCTION public.try_claim_achievements(
	target_user_id uuid,
	cat text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	current_progress int;
	a                record;
	claims_made      int := 0;
	new_level        int;
	level_diff       int;
	bonus_snouts     int;
BEGIN
	current_progress := CASE cat
		WHEN 'trade_giver'        THEN public.trade_given_total(target_user_id)
		WHEN 'trade_receiver'     THEN public.trade_received_total(target_user_id)
		WHEN 'bless_distinct'     THEN (
			SELECT COUNT(DISTINCT receiver_id)::int
			FROM public.blessings WHERE sender_id = target_user_id)
		WHEN 'curse_distinct'     THEN (
			SELECT COUNT(DISTINCT receiver_id)::int
			FROM public.curses    WHERE sender_id = target_user_id)
		WHEN 'alignment_positive' THEN
			GREATEST(0, COALESCE(
				(SELECT alignment_max_pos FROM public.profiles WHERE id = target_user_id),
				0))
		WHEN 'alignment_negative' THEN
			GREATEST(0, -COALESCE(
				(SELECT alignment_max_neg FROM public.profiles WHERE id = target_user_id),
				0))
		WHEN 'blessings_received' THEN (
			SELECT COUNT(*)::int FROM public.blessings WHERE receiver_id = target_user_id)
		WHEN 'friend_count'       THEN (
			SELECT COUNT(*)::int FROM public.friendships
			WHERE status = 'accepted'
			  AND (requester_id = target_user_id OR receiver_id = target_user_id))
		WHEN 'lucky_count'        THEN (
			(SELECT COUNT(*)::int FROM public.daily_lucky_claims WHERE user_id = target_user_id)
			+ (SELECT COUNT(*)::int FROM public.lucky_pig_hits WHERE user_id = target_user_id))
		WHEN 'tickle_volume'      THEN
			GREATEST(0, COALESCE(
				(SELECT tickles_earned FROM public.profiles WHERE id = target_user_id),
				0))
		-- Season 1 / The Dig: golden truffles rooted, submitted digs, echoes.
		WHEN 'truffles_dug'       THEN (
			SELECT COUNT(*)::int FROM public.war_truffles WHERE user_id = target_user_id)
		WHEN 'dig_count'          THEN (
			SELECT COUNT(*)::int FROM public.war_rootings
			WHERE user_id = target_user_id AND submitted_at IS NOT NULL)
		WHEN 'echo_claims'        THEN (
			SELECT COUNT(*)::int FROM public.echo_claims WHERE user_id = target_user_id)
		ELSE 0
	END;

	FOR a IN
		SELECT * FROM public.achievements
		WHERE category = cat
		ORDER BY tier ASC
	LOOP
		IF current_progress < a.threshold THEN EXIT; END IF;

		IF a.is_top_tier THEN
			new_level := GREATEST(0, FLOOR(LOG(2, GREATEST(1, current_progress::numeric / a.threshold)))::int);
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, new_level)
				ON CONFLICT (user_id, achievement_id) DO NOTHING;
			SELECT level INTO level_diff FROM public.user_achievements
				WHERE user_id = target_user_id AND achievement_id = a.id;
			IF level_diff IS NULL THEN level_diff := 0; END IF;
			IF new_level > level_diff THEN
				bonus_snouts := (new_level - level_diff) * 500;
				UPDATE public.user_achievements
					SET level = new_level, progress = current_progress
					WHERE user_id = target_user_id AND achievement_id = a.id;
				UPDATE public.profiles SET counter = counter + bonus_snouts
					WHERE id = target_user_id;
				claims_made := claims_made + (new_level - level_diff);
			END IF;
		END IF;

		IF NOT EXISTS (
			SELECT 1 FROM public.user_achievements
			WHERE user_id = target_user_id AND achievement_id = a.id
		) THEN
			INSERT INTO public.user_achievements (user_id, achievement_id, progress, level)
				VALUES (target_user_id, a.id, current_progress, 0);
			IF a.reward_title_id IS NOT NULL THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (target_user_id, a.reward_title_id)
					ON CONFLICT DO NOTHING;
			END IF;
			IF a.reward_item_id IS NOT NULL THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (target_user_id, a.reward_item_id)
					ON CONFLICT DO NOTHING;
			END IF;
			IF a.reward_snouts > 0 THEN
				UPDATE public.profiles
					SET counter = counter + a.reward_snouts
					WHERE id = target_user_id;
			END IF;
			claims_made := claims_made + 1;
		END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'claims_made', claims_made, 'progress', current_progress);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.try_claim_achievements(uuid, text) TO authenticated;

-- my_achievements — carried VERBATIM from 20260710; 'war_wins' → 'truffles_dug'.
CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE (
	id               text,
	category         text,
	display_category text,
	tier             int,
	name             text,
	description      text,
	threshold        int,
	reward_title_id  text,
	reward_item_id   text,
	reward_snouts    int,
	icon             text,
	display_order    int,
	is_top_tier      boolean,
	progress         int,
	claimed          boolean,
	level            int,
	viewed_at        timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH me AS (SELECT auth.uid() AS uid),
	p AS (
		SELECT alignment_max_pos AS amp, alignment_max_neg AS amn
		FROM public.profiles, me
		WHERE public.profiles.id = me.uid
	)
	SELECT
		a.id, a.category, a.display_category, a.tier, a.name, a.description, a.threshold,
		a.reward_title_id, a.reward_item_id, a.reward_snouts, a.icon, a.display_order,
		a.is_top_tier,
		COALESCE(
			ua.progress,
			CASE a.category
				WHEN 'trade_giver'        THEN public.trade_given_total((SELECT uid FROM me))
				WHEN 'trade_receiver'     THEN public.trade_received_total((SELECT uid FROM me))
				WHEN 'bless_distinct'     THEN (SELECT COUNT(DISTINCT b.receiver_id)::int FROM public.blessings b, me WHERE b.sender_id = me.uid)
				WHEN 'curse_distinct'     THEN (SELECT COUNT(DISTINCT c.receiver_id)::int FROM public.curses c, me WHERE c.sender_id = me.uid)
				WHEN 'alignment_positive' THEN GREATEST(0, COALESCE((SELECT amp FROM p), 0))
				WHEN 'alignment_negative' THEN GREATEST(0, -COALESCE((SELECT amn FROM p), 0))
				WHEN 'blessings_received' THEN (SELECT COUNT(*)::int FROM public.blessings b, me WHERE b.receiver_id = me.uid)
				WHEN 'friend_count'       THEN (SELECT COUNT(*)::int FROM public.friendships f, me WHERE f.status='accepted' AND (f.requester_id = me.uid OR f.receiver_id = me.uid))
				WHEN 'lucky_count'        THEN ((SELECT COUNT(*)::int FROM public.daily_lucky_claims dlc, me WHERE dlc.user_id = me.uid) + (SELECT COUNT(*)::int FROM public.lucky_pig_hits lph, me WHERE lph.user_id = me.uid))
				WHEN 'tickle_volume'      THEN GREATEST(0, COALESCE((SELECT tickles_earned FROM public.profiles pr, me WHERE pr.id = me.uid), 0))
				-- Season 1 / The Dig: golden truffles rooted, submitted digs, echoes.
				WHEN 'truffles_dug'       THEN (SELECT COUNT(*)::int FROM public.war_truffles wt, me WHERE wt.user_id = me.uid)
				WHEN 'dig_count'          THEN (SELECT COUNT(*)::int FROM public.war_rootings wr, me WHERE wr.user_id = me.uid AND wr.submitted_at IS NOT NULL)
				WHEN 'echo_claims'        THEN (SELECT COUNT(*)::int FROM public.echo_claims ec, me WHERE ec.user_id = me.uid)
				ELSE 0
			END
		)::int AS progress,
		(ua.user_id IS NOT NULL) AS claimed,
		COALESCE(ua.level, 0) AS level,
		ua.viewed_at
	FROM public.achievements a
	LEFT JOIN public.user_achievements ua
		ON ua.achievement_id = a.id AND ua.user_id = (SELECT uid FROM me)
	ORDER BY a.display_order;
$function$;
GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;

-- The war_wins credit path is dead (war_wins never moves again): drop its
-- trigger + fn. truffles_dug is credited from submit_rooting; dig_count from
-- the war_rootings submitted_at trigger (re-attached in §5d); echo_claims from
-- its own insert trigger — all still live.
DROP TRIGGER IF EXISTS profiles_war_wins_achievements ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_war_wins_achievements();
