-- ════════════════════════════════════════════════════════════════════════
-- ⚠️  DO NOT PUSH — awaiting founder "go" (CLAUDE.md DB rule).  ⚠️
-- ════════════════════════════════════════════════════════════════════════
-- Season-1 scuffle scoring is PLAIN TOTALS (SKILL.md decision, 2026-07-06):
-- games give the pig points → pig points sum into team points → team totals
-- compare at term end. The fronts/area-picking Blotto layer (and Rhythm Hold,
-- which rides fronts) is CUT from S1 fixture wars. The board renders only on
-- legacy fronts-on wars; day scoring reads "whoever scooped more joy today
-- pulls the rope."
--
-- The ONLY change vs the sole def in 20260707000000_sounder_league.sql:
-- advance_war_term() now creates every fixture war fronts_enabled=false,
-- rhythm_enabled=false, build_ends_at=NULL — dropping the mud_rhythm_on() /
-- mud_fronts_on() reads and the pick_weekly_modifier() / seed_war_board()
-- calls. Everything else is carried VERBATIM.
--
-- WHY THIS IS SAFE (verified against the chain):
--   • score_mud_war_days' non-fronts path (predates fronts, 20260666; the
--     fronts branch is an ELSIF added in 20260668) folds each completed UTC
--     day into rope_pos by PLAIN daily sling totals — exactly plain totals.
--   • Elo/ribbons for fronts-OFF real fixtures are covered by the
--     record_fixture_result trigger (20260708 §3): it PERFORMs apply_crew_elo
--     when NOT is_bot_war AND NOT fronts_enabled — no double-apply, since
--     resolve_war only applies Elo when fronts_enabled.
-- ════════════════════════════════════════════════════════════════════════

-- advance_war_term — carried VERBATIM from 20260707000000_sounder_league.sql;
-- ONLY the fixture-war INSERT changes (fronts/rhythm forced off, board seed
-- dropped) per the 2026-07-06 plain-totals decision.
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
			-- 2026-07-06 plain-totals decision (SKILL.md log): S1 fixture wars
			-- are created fronts-OFF / rhythm-OFF. Games give the pig points,
			-- pig points sum into team points, team totals decide the rope;
			-- the fronts/area-picking Blotto board (and Rhythm Hold, which rides
			-- it) is cut from S1 fixtures — no pick_weekly_modifier / seed_war_board.
			-- score_mud_war_days' non-fronts path already folds plain daily totals
			-- into rope_pos; the record_fixture_result trigger (20260708) applies
			-- ribbons on this fronts-off path.
			INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war,
					started_at, ends_at, fronts_enabled, rhythm_enabled, build_ends_at)
				VALUES (c.id, partner, 'active', partner = bot_id, now(), term_end,
					false, false, NULL)
				RETURNING id INTO new_war;
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

REVOKE ALL ON FUNCTION public.advance_war_term() FROM PUBLIC, anon, authenticated;
