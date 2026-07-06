-- Functional smoke for the Sounder League scheduler + trigger + standings.
\set ON_ERROR_STOP on

-- Season live for the test (seed date is the future S2 flip).
UPDATE public.league_seasons SET starts_at = now() - interval '1 day';  -- key renamed by 20260709; activate whatever the current season row is

-- Ghost crew + three real crews (staggered created_at for deterministic pairing).
INSERT INTO public.crews (id, name, is_bot, created_at) VALUES
	('00000000-0000-0000-0000-0000000000b0', 'The Mudlarks', true, now() - interval '30 days');
INSERT INTO public.crews (id, name, leader_id, created_at) VALUES
	('00000000-0000-0000-0000-00000000c001', 'Mud Maulers',  '00000000-0000-0000-0000-00000000a001', now() - interval '10 days'),
	('00000000-0000-0000-0000-00000000c002', 'Bog Standard', '00000000-0000-0000-0000-00000000a002', now() - interval '9 days'),
	('00000000-0000-0000-0000-00000000c003', 'Trough Trust', '00000000-0000-0000-0000-00000000a003', now() - interval '8 days');
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000a001', 'rosie'),
	('00000000-0000-0000-0000-00000000a002', 'denny'),
	('00000000-0000-0000-0000-00000000a003', 'jen');
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'leader'),
	('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a002', 'leader'),
	('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000a003', 'leader');

-- Roll the first term: expect 1 term, 2 fixtures (one pair + one bot bye).
SELECT public.advance_war_term();
SELECT 'terms after roll 1' AS chk, count(*) FROM public.war_terms;
SELECT 'fixtures after roll 1' AS chk, count(*) FROM public.term_fixtures;
SELECT 'bot bye exists' AS chk, count(*) FROM public.term_fixtures
	WHERE crew_b = '00000000-0000-0000-0000-0000000000b0';
SELECT 'wars created active' AS chk, count(*) FROM public.mud_wars WHERE status = 'active';

-- Idempotent while a term runs: second call adds nothing.
SELECT public.advance_war_term();
SELECT 'terms after roll 2 (still 1)' AS chk, count(*) FROM public.war_terms;

-- Resolve the real pair's war dead-even (winner NULL) → tiebreak must fire.
-- Give crew c002 MORE active snouts than c001 so c002 takes it.
INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, war_day)
SELECT f.war_id, f.crew_b, '00000000-0000-0000-0000-00000000a002', 5, current_date
	FROM public.term_fixtures f WHERE f.crew_b <> '00000000-0000-0000-0000-0000000000b0';
UPDATE public.mud_wars SET status = 'resolved', winner_crew = NULL, resolved_at = now()
	WHERE id = (SELECT war_id FROM public.term_fixtures
	            WHERE crew_b <> '00000000-0000-0000-0000-0000000000b0');
SELECT 'tiebreak result (want b)' AS chk, result FROM public.term_fixtures
	WHERE crew_b <> '00000000-0000-0000-0000-0000000000b0';

-- Close the term: age it out, advance, expect unanswered mark + a NEW term
-- whose pairing avoids the last opponent (c001 vs c003 now).
UPDATE public.war_terms SET ends_at = now() - interval '1 minute';
UPDATE public.mud_wars SET status = 'resolved', resolved_at = now(), winner_crew = challenger_crew
	WHERE status = 'active';  -- bot war resolved so crews are free
SELECT public.advance_war_term();
SELECT 'terms after roll 3 (want 2)' AS chk, count(*) FROM public.war_terms;
SELECT 'no result-less fixtures in term 1' AS chk, count(*) FROM public.term_fixtures f
	JOIN public.war_terms t ON t.id = f.term_id AND t.term_no = 1 WHERE f.result IS NULL;
SELECT 'term 2 pairings' AS chk, c1.name AS a, c2.name AS b
	FROM public.term_fixtures f
	JOIN public.war_terms t ON t.id = f.term_id AND t.term_no = 2
	JOIN public.crews c1 ON c1.id = f.crew_a JOIN public.crews c2 ON c2.id = f.crew_b;

-- Resolve term 2's real war WITH a winner → ribbons must move (+K/−K
-- around the 200 rebase; provisional K=40 × 0.6 rope-magnitude = 24 → ±12).
UPDATE public.mud_wars w SET status = 'resolved', resolved_at = now(),
	winner_crew = w.challenger_crew
	FROM public.term_fixtures f JOIN public.war_terms t ON t.id = f.term_id AND t.term_no = 2
	WHERE w.id = f.war_id AND w.status = 'active' AND w.is_bot_war = false;

-- Ribbons sanity: the dead-even resolve was a war-level draw (no ribbon
-- change at equal ratings); the term-2 real war resolved with a winner →
-- +K/−K around the 200 rebase, floored at 0. Bot wars untouched.
SELECT 'ribbons after resolves' AS chk, c.name, r.rating, r.wars_played
	FROM public.crew_ratings r JOIN public.crews c ON c.id = r.crew_id
	ORDER BY c.name;

-- Standings sanity: three crews, ribbons-ranked JSON with records.
SELECT jsonb_pretty(public.sounder_league_standings(10));
