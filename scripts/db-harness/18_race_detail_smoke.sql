-- Functional smoke for race_crew_detail (20260722): the per-member ledger for
-- the CURRENT weekly cycle — current members (0-find lines included) ∪ departed
-- diggers whose finds still sit in the crew total, weekly `finds` + cumulative
-- `season_finds`, finds-DESC ordering, and NULL for an unknown crew. Fixtures
-- live in their own df/dd20 namespace — no coupling to 16's race seeds.
\set ON_ERROR_STOP on

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000df01', 'rd-lead'),
	('00000000-0000-0000-0000-00000000df02', 'rd-digger'),
	('00000000-0000-0000-0000-00000000df03', 'rd-idle'),
	('00000000-0000-0000-0000-00000000df04', 'rd-gone');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000df%';

INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000dd77', 'CrewDetail',
	 '00000000-0000-0000-0000-00000000df01');
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000dd77', '00000000-0000-0000-0000-00000000df01', 'leader'),
	('00000000-0000-0000-0000-00000000dd77', '00000000-0000-0000-0000-00000000df02', 'member'),
	('00000000-0000-0000-0000-00000000dd77', '00000000-0000-0000-0000-00000000df03', 'member');

DO $smoke_rd$
DECLARE
	cw   uuid := '00000000-0000-0000-0000-00000000dd77';
	lead uuid := '00000000-0000-0000-0000-00000000df01';
	digr uuid := '00000000-0000-0000-0000-00000000df02';
	cyc  record;
	res  jsonb;
	m    jsonb;
BEGIN
	SELECT * INTO cyc FROM public.race_current_cycle();

	-- lead: 3 this cycle + 2 in a long-gone cycle (season = 5). digger: 4 this
	-- cycle. idle member: nothing. gone (NOT a crew_member): 1 this cycle —
	-- the departed-digger line.
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds) VALUES
		(cyc.cycle_key, lead, 1, cw, 3),
		('20200101',    lead, 1, cw, 2),
		(cyc.cycle_key, digr, 1, cw, 4),
		(cyc.cycle_key, '00000000-0000-0000-0000-00000000df04', 1, cw, 1);

	res := public.race_crew_detail(cw);
	IF res IS NULL THEN
		RAISE EXCEPTION 'detail: NULL for a real crew'; END IF;
	IF res->>'crew_id' <> cw::text OR res->>'name' <> 'CrewDetail'
			OR res->>'cycle_key' <> cyc.cycle_key THEN
		RAISE EXCEPTION 'detail: header wrong: %', res; END IF;

	m := res->'members';
	IF jsonb_array_length(m) <> 4 THEN
		RAISE EXCEPTION 'detail: want 4 lines (3 members + 1 departed digger), got %', m; END IF;

	-- finds DESC → digger(4) · lead(3) · gone(1) · idle(0).
	IF m->0->>'username' <> 'rd-digger' OR (m->0->>'finds')::int <> 4 THEN
		RAISE EXCEPTION 'detail: line 0 wrong: %', m->0; END IF;
	IF m->1->>'username' <> 'rd-lead' OR (m->1->>'finds')::int <> 3
			OR (m->1->>'season_finds')::int <> 5 THEN
		RAISE EXCEPTION 'detail: lead line wants weekly 3 / season 5: %', m->1; END IF;
	IF m->2->>'username' <> 'rd-gone' OR (m->2->>'finds')::int <> 1 THEN
		RAISE EXCEPTION 'detail: departed digger line wrong: %', m->2; END IF;
	IF m->3->>'username' <> 'rd-idle' OR (m->3->>'finds')::int <> 0
			OR (m->3->>'season_finds')::int <> 0 THEN
		RAISE EXCEPTION 'detail: idle member wants a 0/0 line: %', m->3; END IF;

	IF public.race_crew_detail('00000000-0000-0000-0000-00000000ddff') IS NOT NULL THEN
		RAISE EXCEPTION 'detail: unknown crew must be NULL'; END IF;
	IF public.race_crew_detail(NULL) IS NOT NULL THEN
		RAISE EXCEPTION 'detail: NULL arg must be NULL'; END IF;

	RAISE NOTICE 'chk race_crew_detail: shape + order + season sums + NULLs OK';
END $smoke_rd$;
