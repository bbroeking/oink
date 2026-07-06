-- ════════════════════════════════════════════════════════════════════════
-- Sounder League, Phase 1 — the Alignment slot becomes the clan ladder.
-- Spec: docs/sounder-league-spec.md (adopted 2026-07-05, SKILL.md log).
--
--   TERMS      — the season splits into weekly war terms; each term every
--                Sounder gets ONE scheduled fixture (prefer-unplayed pairing,
--                rematches legal this season; the ghost crew fills the odd
--                bye). advance_war_term() is the hourly idempotent scheduler:
--                it closes ended terms and opens the next one when none runs.
--   SCORING    — no draws: every fixture yields a win or a loss. The rope
--                decides; a dead-even rope falls to the tiebreak (most active
--                snouts → most submitted digs → elder banner). Results are
--                recorded by an AFTER UPDATE trigger on mud_wars' status
--                flip (the grant_war_spoils_on_resolve pattern), so
--                resolve_war is NOT carried here.
--   CAP 4      — CREW_CAP drops 5 → 4 across the trigger + every RPC
--                pre-check. Existing 5-member crews are grandfathered: the
--                cap only gates INSERTs, nobody is kicked.
--   NO END DATE— league_seasons.ends_at is NULLable; season_2 is seeded
--                with no end (the finale arrives with the Hungerer arc, not
--                a countdown).
--
-- Carried latest defs: enforce_crew_cap + accept_crew_invite ← 20260647;
-- invite_to_crew ← 20260704800000 (any-member version);
-- join_crew + find_joinable_crews ← 20260704700000.
-- pg_cron is ALREADY installed (20260579) — do NOT CREATE EXTENSION.
--   Cancel:  SELECT cron.unschedule('war-term-advance');
--   Verify:  SELECT * FROM cron.job;
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Schedule schema ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_seasons (
	key       text        PRIMARY KEY,
	starts_at timestamptz NOT NULL,
	ends_at   timestamptz            -- NULL = unannounced (S2 hides the date)
);

CREATE TABLE IF NOT EXISTS public.war_terms (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	season_key text        NOT NULL REFERENCES public.league_seasons(key) ON DELETE CASCADE,
	term_no    int         NOT NULL,
	starts_at  timestamptz NOT NULL,
	ends_at    timestamptz NOT NULL,
	UNIQUE (season_key, term_no)
);

CREATE TABLE IF NOT EXISTS public.term_fixtures (
	id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	term_id     uuid        NOT NULL REFERENCES public.war_terms(id) ON DELETE CASCADE,
	crew_a      uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	crew_b      uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	war_id      uuid        REFERENCES public.mud_wars(id) ON DELETE SET NULL,
	-- 'a'/'b' = that side won (no draws in the league); 'unanswered' = the
	-- fixture never produced a result (war couldn't be created / errored).
	result      text        CHECK (result IN ('a', 'b', 'unanswered')),
	resolved_at timestamptz,
	created_at  timestamptz NOT NULL DEFAULT now(),
	CHECK (crew_a <> crew_b),
	UNIQUE (term_id, crew_a),
	UNIQUE (term_id, crew_b)
);
CREATE INDEX IF NOT EXISTS term_fixtures_war_idx  ON public.term_fixtures (war_id);
CREATE INDEX IF NOT EXISTS term_fixtures_term_idx ON public.term_fixtures (term_id);

-- Season 2 starts at the flip; end unannounced.
INSERT INTO public.league_seasons (key, starts_at, ends_at)
	VALUES ('season_2', '2026-07-12T00:00:00Z', NULL)
	ON CONFLICT (key) DO NOTHING;

-- Read-only for players; every write flows through definer functions.
ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_terms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.term_fixtures  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS league_seasons_read ON public.league_seasons;
CREATE POLICY league_seasons_read ON public.league_seasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS war_terms_read ON public.war_terms;
CREATE POLICY war_terms_read ON public.war_terms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS term_fixtures_read ON public.term_fixtures;
CREATE POLICY term_fixtures_read ON public.term_fixtures FOR SELECT TO authenticated USING (true);

-- ── 2. CREW_CAP 5 → 4 ───────────────────────────────────────────────────
-- Existing 5-member crews are grandfathered: the trigger only gates INSERT,
-- so an over-cap crew simply can't add a 5th/6th — nobody is removed.

-- enforce_crew_cap — carried from 20260647; ONLY the cap changes.
CREATE OR REPLACE FUNCTION public.enforce_crew_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
	bot boolean;
	cnt int;
BEGIN
	-- FOR UPDATE locks the crews row so concurrent inserts for the SAME crew
	-- serialize — otherwise two simultaneous accepts both read count=3 and both
	-- pass, overfilling past CREW_CAP.
	SELECT is_bot INTO bot FROM public.crews WHERE id = NEW.crew_id FOR UPDATE;
	IF COALESCE(bot, false) THEN RETURN NEW; END IF;   -- bot crew unbounded (no real members)
	SELECT count(*) INTO cnt FROM public.crew_members WHERE crew_id = NEW.crew_id;
	IF cnt >= 4 THEN RAISE EXCEPTION 'crew_full'; END IF;
	RETURN NEW;
END;
$function$;

-- invite_to_crew — carried VERBATIM from 20260704800000 (any member can
-- invite); ONLY the cap pre-check changes.
CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	member_count int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name
		FROM public.crew_members mm
		JOIN public.crews c ON c.id = mm.crew_id AND c.is_bot = false
		WHERE mm.user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	IF NOT public.are_friends(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = my_crew;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invitee_in_crew');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
	END IF;
	INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id) VALUES (my_crew, caller_id, p_invitee);
	-- Inline announce, savepoint-guarded.
	BEGIN
		SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_invitee, 'crew_invite', 'Sounder invite',
			COALESCE(caller_name, 'A friend') || ' invited you to join ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- accept_crew_invite — carried VERBATIM from 20260647 (already auto-declines
-- the caller's other pending invites); ONLY the cap pre-check changes.
CREATE OR REPLACE FUNCTION public.accept_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	inv          record;
	member_count int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO inv FROM public.crew_invites WHERE id = p_invite FOR UPDATE;
	IF inv.id IS NULL OR inv.invitee_id <> caller_id OR inv.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = inv.crew_id;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (inv.crew_id, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending' AND id <> p_invite;
	RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
END;
$function$;

-- join_crew — carried VERBATIM from 20260704700000; ONLY the cap changes.
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
	-- FOR UPDATE pairs with the cap trigger's crews-row lock: concurrent joins
	-- to the same crew serialize here instead of racing to the trigger error.
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false FOR UPDATE;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars w
	           WHERE (w.challenger_crew = p_crew OR w.defender_crew = p_crew)
	             AND w.status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'crew_in_war');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (p_crew, caller_id, 'member');
	-- Joining moots the joiner's other pending invites (mirrors accept_crew_invite).
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	-- Tell the leader a new snout arrived. Inline announce, savepoint-guarded
	-- (send_system_announcement is admin-gated and would roll the join back).
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

-- find_joinable_crews — carried VERBATIM from 20260704700000; the free-slot
-- band shrinks with the cap (1..3 members leaves room for one more at cap 4).
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
		  AND NOT EXISTS (SELECT 1 FROM public.mud_wars w
		        WHERE (w.challenger_crew = c.id OR w.defender_crew = c.id)
		          AND w.status IN ('pending', 'active'))
	) j
	WHERE j.member_count BETWEEN 1 AND 3;
$function$;

-- ── 3. Fixture results — trigger on the resolve flip ────────────────────
-- Rides mud_wars' status flip like grant_war_spoils_on_resolve, so future
-- resolve_war carries can't silently drop league scoring. No draws: a dead-
-- even rope falls to (1) most distinct active snouts, (2) most submitted
-- digs, (3) the elder banner — all derivable from stored data ("first to
-- the score" isn't: mud_slings is day-granular).

CREATE OR REPLACE FUNCTION public.record_fixture_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	fx             record;
	fixture_winner uuid;
	a_active       int;
	b_active       int;
	a_digs         int;
	b_digs         int;
BEGIN
	IF NEW.status <> 'resolved' OR OLD.status = 'resolved' THEN RETURN NEW; END IF;
	SELECT * INTO fx FROM public.term_fixtures WHERE war_id = NEW.id AND result IS NULL;
	IF fx.id IS NULL THEN RETURN NEW; END IF;   -- not a league fixture (house war, manual challenge)

	IF NEW.winner_crew IS NOT NULL THEN
		fixture_winner := NEW.winner_crew;
	ELSE
		SELECT count(DISTINCT u.user_id) INTO a_active FROM (
			SELECT user_id FROM public.mud_slings   WHERE war_id = NEW.id AND crew_id = fx.crew_a AND slings > 0
			UNION
			SELECT user_id FROM public.war_rootings WHERE war_id = NEW.id AND crew_id = fx.crew_a AND submitted_at IS NOT NULL) u;
		SELECT count(DISTINCT u.user_id) INTO b_active FROM (
			SELECT user_id FROM public.mud_slings   WHERE war_id = NEW.id AND crew_id = fx.crew_b AND slings > 0
			UNION
			SELECT user_id FROM public.war_rootings WHERE war_id = NEW.id AND crew_id = fx.crew_b AND submitted_at IS NOT NULL) u;
		SELECT count(*) INTO a_digs FROM public.war_rootings
			WHERE war_id = NEW.id AND crew_id = fx.crew_a AND submitted_at IS NOT NULL;
		SELECT count(*) INTO b_digs FROM public.war_rootings
			WHERE war_id = NEW.id AND crew_id = fx.crew_b AND submitted_at IS NOT NULL;
		fixture_winner := CASE
			WHEN a_active > b_active THEN fx.crew_a
			WHEN b_active > a_active THEN fx.crew_b
			WHEN a_digs   > b_digs   THEN fx.crew_a
			WHEN b_digs   > a_digs   THEN fx.crew_b
			ELSE (SELECT id FROM public.crews WHERE id IN (fx.crew_a, fx.crew_b)
			      ORDER BY created_at ASC, id ASC LIMIT 1)
		END;
	END IF;

	UPDATE public.term_fixtures
		SET result = CASE WHEN fixture_winner = fx.crew_a THEN 'a' ELSE 'b' END,
		    resolved_at = now()
		WHERE id = fx.id;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_record_fixture_result ON public.mud_wars;
CREATE TRIGGER trg_record_fixture_result AFTER UPDATE ON public.mud_wars
	FOR EACH ROW EXECUTE FUNCTION public.record_fixture_result();

-- ── 4. The term scheduler ───────────────────────────────────────────────
-- Hourly + idempotent: closes any ended term (resolving its overdue wars),
-- then opens the next term when none is running. Fixture wars are created
-- ACTIVE with ends_at = term end, so the existing 15-min sweep resolves
-- them on time even between scheduler runs.

CREATE OR REPLACE FUNCTION public.advance_war_term()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	season     record;
	cur        record;
	f          record;
	c          record;
	partner    uuid;
	paired     uuid[] := '{}';
	new_term   uuid;
	next_no    int;
	term_end   timestamptz;
	new_war    uuid;
	opp_name   text;
	m          record;
	bot_id     uuid := '00000000-0000-0000-0000-0000000000b0';
	use_rhythm boolean := public.mud_rhythm_on();
	use_fronts boolean := public.mud_rhythm_on() OR public.mud_fronts_on();
BEGIN
	SELECT * INTO season FROM public.league_seasons
		WHERE starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
		ORDER BY starts_at DESC LIMIT 1;
	IF season.key IS NULL THEN RETURN; END IF;

	-- 1. Close ended terms: resolve overdue fixture wars (the trigger records
	--    each result), then mark anything still result-less as unanswered.
	FOR cur IN
		SELECT t.* FROM public.war_terms t
		WHERE t.season_key = season.key AND t.ends_at <= now()
		  AND EXISTS (SELECT 1 FROM public.term_fixtures x WHERE x.term_id = t.id AND x.result IS NULL)
	LOOP
		FOR f IN
			SELECT x.war_id FROM public.term_fixtures x
			JOIN public.mud_wars w ON w.id = x.war_id
			WHERE x.term_id = cur.id AND x.result IS NULL AND w.status = 'active'
		LOOP
			BEGIN
				PERFORM public.resolve_war(f.war_id);
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
		UPDATE public.term_fixtures SET result = 'unanswered', resolved_at = now()
			WHERE term_id = cur.id AND result IS NULL;
	END LOOP;

	-- 2. Open the next term when none is running.
	IF EXISTS (SELECT 1 FROM public.war_terms
	           WHERE season_key = season.key AND ends_at > now()) THEN
		RETURN;
	END IF;
	SELECT COALESCE(MAX(term_no), 0) + 1 INTO next_no FROM public.war_terms WHERE season_key = season.key;
	term_end := now() + interval '7 days';
	INSERT INTO public.war_terms (season_key, term_no, starts_at, ends_at)
		VALUES (season.key, next_no, now(), term_end)
		RETURNING id INTO new_term;

	-- Pair every free crew (has members, not already in a war): prefer an
	-- opponent never played in the league, else the least-recently-played
	-- rematch. The odd crew out gets the ghost crew — nobody sits a term out.
	FOR c IN
		SELECT cr.id, cr.name FROM public.crews cr
		WHERE cr.is_bot = false
		  AND EXISTS (SELECT 1 FROM public.crew_members mm WHERE mm.crew_id = cr.id)
		  AND NOT EXISTS (SELECT 1 FROM public.mud_wars w
		        WHERE (w.challenger_crew = cr.id OR w.defender_crew = cr.id)
		          AND w.status IN ('pending', 'active'))
		ORDER BY cr.created_at ASC
	LOOP
		IF c.id = ANY (paired) THEN CONTINUE; END IF;
		SELECT cr2.id INTO partner FROM public.crews cr2
			WHERE cr2.is_bot = false AND cr2.id <> c.id AND NOT (cr2.id = ANY (paired))
			  AND EXISTS (SELECT 1 FROM public.crew_members mm WHERE mm.crew_id = cr2.id)
			  AND NOT EXISTS (SELECT 1 FROM public.mud_wars w
			        WHERE (w.challenger_crew = cr2.id OR w.defender_crew = cr2.id)
			          AND w.status IN ('pending', 'active'))
			ORDER BY (SELECT MAX(t.starts_at) FROM public.term_fixtures x
			          JOIN public.war_terms t ON t.id = x.term_id
			          WHERE (x.crew_a = c.id AND x.crew_b = cr2.id)
			             OR (x.crew_a = cr2.id AND x.crew_b = c.id)) ASC NULLS FIRST,
			         cr2.created_at ASC
			LIMIT 1;
		partner := COALESCE(partner, bot_id);

		paired := paired || c.id;
		IF partner <> bot_id THEN paired := paired || partner; END IF;

		-- The schedule replaces matchmaking: the win-trade cooldown exists to
		-- stop farmed rematches, which a weekly fixture list can't produce.
		UPDATE public.crews SET next_war_at = NULL
			WHERE id IN (c.id, partner) AND is_bot = false;

		BEGIN
			INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war,
					started_at, ends_at, fronts_enabled, rhythm_enabled, build_ends_at)
				VALUES (c.id, partner, 'active', partner = bot_id, now(), term_end,
					use_fronts, use_rhythm,
					CASE WHEN use_rhythm THEN now() + interval '2 days' ELSE NULL END)
				RETURNING id INTO new_war;
			IF use_fronts THEN
				UPDATE public.mud_wars SET weekly_modifier = public.pick_weekly_modifier(new_war) WHERE id = new_war;
				PERFORM public.seed_war_board(new_war, (now() AT TIME ZONE 'UTC')::date);
			END IF;
			INSERT INTO public.term_fixtures (term_id, crew_a, crew_b, war_id)
				VALUES (new_term, c.id, partner, new_war);

			-- Announce to both rosters (savepoint-guarded).
			BEGIN
				SELECT CASE WHEN partner = bot_id THEN 'The Mudlarks'
				            ELSE (SELECT name FROM public.crews WHERE id = partner) END
					INTO opp_name;
				FOR m IN SELECT user_id, crew_id FROM public.crew_members
				         WHERE crew_id IN (c.id, partner) LOOP
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					VALUES (m.user_id, 'war_started', 'A new war term!',
						'Your Sounder faces ' ||
						CASE WHEN m.crew_id = c.id THEN opp_name ELSE c.name END ||
						' this term. Sling mud and dig truffles together!',
						jsonb_build_object('war_id', new_war));
				END LOOP;
			EXCEPTION WHEN OTHERS THEN NULL; END;
		EXCEPTION WHEN OTHERS THEN
			-- One bad pairing (e.g. a cooldown/index race) must not kill the
			-- whole term roll — the pair simply sits this term out.
			NULL;
		END;
	END LOOP;
END;
$function$;

-- Hourly at :10 — cheap no-op while the season is dark or a term is live.
SELECT cron.schedule(
	'war-term-advance',
	'10 * * * *',
	$$SELECT public.advance_war_term()$$
);

-- ── 5. Read RPCs ────────────────────────────────────────────────────────
-- NOTE the name: the hidden referral feature already owns sounder_leaderboard.

-- The season table: every real crew with members, ranked by wins, then mud
-- differential (rope from that crew's side), then name. Roster included for
-- the expandable rows, spirit fields NOT duplicated here — the Spirit tab
-- keeps calling sounder_standings.
CREATE OR REPLACE FUNCTION public.sounder_league_standings(p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	WITH season AS (
		SELECT key FROM public.league_seasons
		WHERE starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
		ORDER BY starts_at DESC LIMIT 1
	),
	fx AS (
		SELECT x.*, w.rope_pos
		FROM public.term_fixtures x
		JOIN public.war_terms t ON t.id = x.term_id
		JOIN season s ON s.key = t.season_key
		LEFT JOIN public.mud_wars w ON w.id = x.war_id
		WHERE x.result IN ('a', 'b')
	),
	rec AS (
		SELECT c.id, c.name,
			(SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id) AS member_count,
			count(f.id) FILTER (WHERE (f.crew_a = c.id AND f.result = 'a')
			                       OR (f.crew_b = c.id AND f.result = 'b')) AS wins,
			count(f.id) FILTER (WHERE (f.crew_a = c.id AND f.result = 'b')
			                       OR (f.crew_b = c.id AND f.result = 'a')) AS losses,
			COALESCE(SUM(CASE WHEN f.crew_a = c.id THEN f.rope_pos
			                  WHEN f.crew_b = c.id THEN -f.rope_pos END), 0) AS diff
		FROM public.crews c
		LEFT JOIN fx f ON f.crew_a = c.id OR f.crew_b = c.id
		WHERE c.is_bot = false
		GROUP BY c.id, c.name
	)
	SELECT COALESCE(jsonb_agg(q.j ORDER BY q.wins DESC, q.diff DESC, q.nm ASC), '[]'::jsonb)
	FROM (
		SELECT jsonb_build_object(
			'crew_id', r.id, 'name', r.name, 'memberCount', r.member_count,
			'played', r.wins + r.losses, 'wins', r.wins, 'losses', r.losses,
			'diff', r.diff,
			'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
					'username', p.username, 'role', m.role)
					ORDER BY m.role ASC, p.username ASC), '[]'::jsonb)
				FROM public.crew_members m
				JOIN public.profiles p ON p.id = m.user_id
				WHERE m.crew_id = r.id)
		) AS j, r.wins AS wins, r.diff AS diff, r.name AS nm
		FROM rec r
		WHERE r.member_count > 0
		ORDER BY wins DESC, diff DESC, nm ASC
		LIMIT GREATEST(1, LEAST(200, p_limit))
	) q;
$function$;

-- The season placard's one call: current term + my fixture + my record +
-- my table position (derived from the standings fn so the orderings can't
-- drift apart). NULL fields when crewless / season dark / no open term.
CREATE OR REPLACE FUNCTION public.my_league_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	season    record;
	term      record;
	fx        record;
	opp       uuid;
	opp_name  text;
	wins      int := 0;
	losses    int := 0;
	pos       int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO season FROM public.league_seasons
		WHERE starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
		ORDER BY starts_at DESC LIMIT 1;
	IF season.key IS NULL THEN RETURN jsonb_build_object('ok', true, 'season', NULL); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;

	SELECT * INTO term FROM public.war_terms
		WHERE season_key = season.key AND starts_at <= now() AND ends_at > now()
		ORDER BY term_no DESC LIMIT 1;

	IF my_crew IS NOT NULL AND term.id IS NOT NULL THEN
		SELECT * INTO fx FROM public.term_fixtures
			WHERE term_id = term.id AND (crew_a = my_crew OR crew_b = my_crew);
	END IF;
	IF fx.id IS NOT NULL THEN
		opp := CASE WHEN fx.crew_a = my_crew THEN fx.crew_b ELSE fx.crew_a END;
		SELECT CASE WHEN is_bot THEN 'The Mudlarks' ELSE name END INTO opp_name
			FROM public.crews WHERE id = opp;
	END IF;

	IF my_crew IS NOT NULL THEN
		SELECT
			count(*) FILTER (WHERE (x.crew_a = my_crew AND x.result = 'a')
			                    OR (x.crew_b = my_crew AND x.result = 'b')),
			count(*) FILTER (WHERE (x.crew_a = my_crew AND x.result = 'b')
			                    OR (x.crew_b = my_crew AND x.result = 'a'))
			INTO wins, losses
		FROM public.term_fixtures x
		JOIN public.war_terms t ON t.id = x.term_id AND t.season_key = season.key
		WHERE (x.crew_a = my_crew OR x.crew_b = my_crew) AND x.result IN ('a', 'b');
		SELECT o INTO pos
			FROM jsonb_array_elements(public.sounder_league_standings(200))
			WITH ORDINALITY t(row, o)
			WHERE (t.row ->> 'crew_id')::uuid = my_crew;
	END IF;

	RETURN jsonb_build_object('ok', true,
		'season', season.key,
		'term', CASE WHEN term.id IS NULL THEN NULL ELSE jsonb_build_object(
			'term_no', term.term_no, 'starts_at', term.starts_at, 'ends_at', term.ends_at) END,
		'fixture', CASE WHEN fx.id IS NULL THEN NULL ELSE jsonb_build_object(
			'war_id', fx.war_id, 'opponent', opp_name, 'opponent_crew', opp,
			'is_bot', opp = '00000000-0000-0000-0000-0000000000b0'::uuid,
			'result', fx.result,
			-- Which way the result fell for MY crew ('a'/'b' is sides, not us).
			'won', CASE WHEN fx.result IN ('a', 'b')
				THEN (fx.result = 'a') = (fx.crew_a = my_crew) ELSE NULL END) END,
		'record', CASE WHEN my_crew IS NULL THEN NULL ELSE jsonb_build_object(
			'played', wins + losses, 'wins', wins, 'losses', losses) END,
		'position', pos);
END;
$function$;

-- ── 6. Grants ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sounder_league_standings(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_league_state()             TO authenticated;
-- Internal-only (cron / trigger): no player should reach these directly.
REVOKE ALL ON FUNCTION public.advance_war_term()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_fixture_result() FROM PUBLIC, anon, authenticated;
