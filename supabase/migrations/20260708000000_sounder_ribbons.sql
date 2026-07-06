-- ════════════════════════════════════════════════════════════════════════
-- Prize Ribbons — the Sounder League table ranks by an Elo, worn pig-style.
-- Spec: docs/sounder-league-spec.md (2026-07-06 revision; SKILL.md log).
--
-- The league table stops ranking by raw wins and starts ranking by
-- **Prize Ribbons** — the county-fair trophy read of the crew Elo that has
-- been running as matchmaking plumbing all along (crew_ratings +
-- apply_crew_elo, 20260667). The math is untouched classic Elo (expected
-- score over a 400-point curve; K 40 provisional → 24; scaled by rope
-- margin so a rout moves more than a squeaker). What changes:
--
--   REBASE    — ratings shift down 1000 so the numbers read as trophies:
--               a new Sounder arrives at the fair with 200 ribbons
--               (rating DEFAULT 1200 → 200; existing rows shifted).
--               Elo math only ever uses rating DIFFERENCES, so matchmaking
--               and seeding are unaffected by the constant shift.
--   FLOOR 0   — ribbons never go negative (cozy; mildly inflationary at
--               the bottom, which trophy systems accept on purpose).
--   COVERAGE  — every REAL league fixture moves ribbons: resolve_war
--               already applies Elo when fronts are enabled; the fixture
--               trigger now covers the fronts-off path (no double-apply).
--               Bot byes stay ribbon-neutral (the ghost crew is a
--               participation filler; the W still lands on the record).
--   RANKING   — sounder_league_standings orders by ribbons, then wins,
--               mud diff, name. W–L demotes to the record subline.
--
-- The Chorus's +3 (20260705100000, "kindness stays tiny vs scuffle
-- swings") writes rating directly and survives the rebase unchanged —
-- kindness now visibly ribbons the banner.
--
-- Carried latest defs: apply_crew_elo ← 20260667;
-- record_fixture_result, sounder_league_standings, my_league_state
-- ← 20260707000000.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Rebase to the trophy scale ───────────────────────────────────────
UPDATE public.crew_ratings SET rating = GREATEST(0, rating - 1000);
ALTER TABLE public.crew_ratings ALTER COLUMN rating SET DEFAULT 200;

-- ── 2. apply_crew_elo — carried from 20260667; adds the 0 floor ─────────
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
	-- CARRY DIFF: ribbons never go negative — the fair doesn't repossess.
	UPDATE public.crew_ratings
		SET rating = GREATEST(0, ra + round(k_a * (sa - ea))), provisional_wars = pa + 1,
		    wars_played = wars_played + 1, updated_at = now()
		WHERE crew_id = p_a;
	UPDATE public.crew_ratings
		SET rating = GREATEST(0, rb + round(k_b * ((1.0 - sa) - (1.0 - ea)))), provisional_wars = pb + 1,
		    wars_played = wars_played + 1, updated_at = now()
		WHERE crew_id = p_b;
END;
$function$;

-- ── 3. record_fixture_result — carried from 20260707; adds Elo coverage ─
-- resolve_war applies Elo only when fronts_enabled AND NOT is_bot_war; the
-- trigger now covers real league fixtures on the fronts-OFF path so a flag
-- state can never leave the ladder frozen. Passes the WAR result (draws =
-- half-ribbons each), not the tiebroken fixture winner — Elo measures the
-- scuffle, the table records the fixture.
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

	-- CARRY DIFF: ribbon coverage for real fixtures resolve_war skipped
	-- (fronts off). Savepoint-guarded — the fixture record must survive a
	-- ratings hiccup.
	IF NOT NEW.is_bot_war AND NOT COALESCE(NEW.fronts_enabled, false) THEN
		BEGIN
			PERFORM public.apply_crew_elo(NEW.challenger_crew, NEW.defender_crew,
				NEW.winner_crew, COALESCE(NEW.rope_pos, 0));
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;
	RETURN NEW;
END;
$function$;

-- ── 4. The table ranks by ribbons ───────────────────────────────────────
-- Carried from 20260707; adds ribbons/provisional and the new ordering.
-- Crews that haven't fought yet show the 200-ribbon starting stock.
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
			COALESCE(r.rating, 200) AS ribbons,
			COALESCE(r.provisional_wars, 0) < 3 AS provisional,
			count(f.id) FILTER (WHERE (f.crew_a = c.id AND f.result = 'a')
			                       OR (f.crew_b = c.id AND f.result = 'b')) AS wins,
			count(f.id) FILTER (WHERE (f.crew_a = c.id AND f.result = 'b')
			                       OR (f.crew_b = c.id AND f.result = 'a')) AS losses,
			COALESCE(SUM(CASE WHEN f.crew_a = c.id THEN f.rope_pos
			                  WHEN f.crew_b = c.id THEN -f.rope_pos END), 0) AS diff
		FROM public.crews c
		LEFT JOIN public.crew_ratings r ON r.crew_id = c.id
		LEFT JOIN fx f ON f.crew_a = c.id OR f.crew_b = c.id
		WHERE c.is_bot = false
		GROUP BY c.id, c.name, r.rating, r.provisional_wars
	)
	SELECT COALESCE(jsonb_agg(q.j ORDER BY q.ribbons DESC, q.wins DESC, q.diff DESC, q.nm ASC), '[]'::jsonb)
	FROM (
		SELECT jsonb_build_object(
			'crew_id', r.id, 'name', r.name, 'memberCount', r.member_count,
			'ribbons', r.ribbons, 'provisional', r.provisional,
			'played', r.wins + r.losses, 'wins', r.wins, 'losses', r.losses,
			'diff', r.diff,
			'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
					'username', p.username, 'role', m.role)
					ORDER BY m.role ASC, p.username ASC), '[]'::jsonb)
				FROM public.crew_members m
				JOIN public.profiles p ON p.id = m.user_id
				WHERE m.crew_id = r.id)
		) AS j, r.ribbons AS ribbons, r.wins AS wins, r.diff AS diff, r.name AS nm
		FROM rec r
		WHERE r.member_count > 0
		ORDER BY ribbons DESC, wins DESC, diff DESC, nm ASC
		LIMIT GREATEST(1, LEAST(200, p_limit))
	) q;
$function$;

-- ── 5. my_league_state — carried from 20260707; adds ribbons ────────────
-- Position derives from sounder_league_standings, so it follows the new
-- ribbon ordering automatically.
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
	ribbons   int;
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
		SELECT COALESCE(r.rating, 200) INTO ribbons
			FROM public.crews c
			LEFT JOIN public.crew_ratings r ON r.crew_id = c.id
			WHERE c.id = my_crew;
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
		'ribbons', ribbons,
		'position', pos);
END;
$function$;
