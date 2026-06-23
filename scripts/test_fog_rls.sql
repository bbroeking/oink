-- Fog regression test for the Mud War "Fronts" (20260667) + "Rhythm" (20260668) features.
-- PROVES: an opponent cannot read your CURRENT-day (unresolved) per-front allocation
-- (mud_front_pushes) NOR your hidden DEPLOY (mud_war_deploys) via RLS, and CAN read both
-- once the day is folded (mud_wars.last_scored_day >= war_day). Also asserts both tables are
-- excluded from the realtime publication (the fog must not leak via a live subscription).
--
-- RUN (against a local supabase with the migration applied):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/test_fog_rls.sql
-- Wrapped in a transaction that ROLLBACKs — non-destructive.
--
-- Impersonation uses the Supabase RLS pattern: SET ROLE authenticated + a
-- request.jwt.claims JSON whose `sub` is the user id auth.uid() reads.

BEGIN;
SET LOCAL search_path TO public;

-- ── fixture: 2 users, 2 crews, 1 fronts-enabled active war, today's board ──────
DO $$
DECLARE
	u_chal uuid := gen_random_uuid();
	u_def  uuid := gen_random_uuid();
	c_chal uuid; c_def uuid; w_id uuid;
	today  date := (now() AT TIME ZONE 'UTC')::date;
	fk     text;
BEGIN
	INSERT INTO auth.users (id, email) VALUES
		(u_chal, 'chal_fogtest@example.com'),
		(u_def,  'def_fogtest@example.com');

	INSERT INTO public.crews (name, leader_id) VALUES ('FogChal', u_chal) RETURNING id INTO c_chal;
	INSERT INTO public.crews (name, leader_id) VALUES ('FogDef',  u_def)  RETURNING id INTO c_def;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
		(c_chal, u_chal, 'leader'), (c_def, u_def, 'leader');

	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at, fronts_enabled)
		VALUES (c_chal, c_def, 'active', false, now(), now() + interval '7 days', true)
		RETURNING id INTO w_id;

	PERFORM public.seed_war_board(w_id, today);
	SELECT front_key INTO fk FROM public.mud_war_fronts WHERE war_id = w_id AND war_day = today LIMIT 1;

	-- both crews push mud on the SAME unresolved day
	INSERT INTO public.mud_front_pushes (war_id, user_id, war_day, front_key, crew_id, mud, throws) VALUES
		(w_id, u_chal, today, fk, c_chal, 15, 7),
		(w_id, u_def,  today, fk, c_def,  12, 6);

	-- both crews also DEPLOY a hidden wave on the same unresolved day (20260668 fog target)
	INSERT INTO public.mud_war_deploys (war_id, war_day, crew_id, target_area, difficulty) VALUES
		(w_id, today, c_chal, fk, 'hard'),
		(w_id, today, c_def,  fk, 'easy');

	-- stash ids for the assertion blocks
	CREATE TEMP TABLE _fog (k text, v uuid) ON COMMIT DROP;
	INSERT INTO _fog VALUES ('u_chal',u_chal),('u_def',u_def),('c_chal',c_chal),('c_def',c_def),('w',w_id);
END $$;

-- ── ASSERT 1: defender CANNOT see challenger's unresolved-day pushes ───────────
DO $$
DECLARE u_def uuid; c_chal uuid; n int;
BEGIN
	SELECT v INTO u_def  FROM _fog WHERE k='u_def';
	SELECT v INTO c_chal FROM _fog WHERE k='c_chal';
	PERFORM set_config('role','authenticated',true);
	PERFORM set_config('request.jwt.claims', json_build_object('sub', u_def)::text, true);

	SELECT count(*) INTO n FROM public.mud_front_pushes WHERE crew_id = c_chal;
	IF n <> 0 THEN RAISE EXCEPTION 'FOG LEAK: defender saw % challenger unresolved-day push rows (want 0)', n; END IF;

	-- but the defender CAN see their own crew's live pushes
	SELECT count(*) INTO n FROM public.mud_front_pushes WHERE crew_id = (SELECT v FROM _fog WHERE k='c_def');
	IF n < 1 THEN RAISE EXCEPTION 'OWN-READ BROKEN: defender cannot see own push rows'; END IF;
	RESET ROLE;
	RAISE NOTICE 'ASSERT 1 PASS — opponent unresolved-day pushes hidden, own pushes visible';
END $$;

-- ── ASSERT 1b: defender CANNOT see challenger's unresolved-day DEPLOY (20260668) ──
DO $$
DECLARE u_def uuid; c_chal uuid; n int;
BEGIN
	SELECT v INTO u_def  FROM _fog WHERE k='u_def';
	SELECT v INTO c_chal FROM _fog WHERE k='c_chal';
	PERFORM set_config('role','authenticated',true);
	PERFORM set_config('request.jwt.claims', json_build_object('sub', u_def)::text, true);

	SELECT count(*) INTO n FROM public.mud_war_deploys WHERE crew_id = c_chal;
	IF n <> 0 THEN RAISE EXCEPTION 'DEPLOY FOG LEAK: defender saw % challenger unresolved-day deploy rows (want 0)', n; END IF;

	-- but the defender CAN see their own crew's live deploy
	SELECT count(*) INTO n FROM public.mud_war_deploys WHERE crew_id = (SELECT v FROM _fog WHERE k='c_def');
	IF n < 1 THEN RAISE EXCEPTION 'OWN-DEPLOY READ BROKEN: defender cannot see own deploy rows'; END IF;
	RESET ROLE;
	RAISE NOTICE 'ASSERT 1b PASS — opponent unresolved-day DEPLOY hidden, own deploy visible';
END $$;

-- ── ASSERT 2: after the day is folded, the opponent's pushes become visible ────
DO $$
DECLARE u_def uuid; c_chal uuid; w uuid; today date := (now() AT TIME ZONE 'UTC')::date; n int;
BEGIN
	SELECT v INTO w FROM _fog WHERE k='w';
	UPDATE public.mud_wars SET last_scored_day = today WHERE id = w;  -- simulate the fold

	SELECT v INTO u_def  FROM _fog WHERE k='u_def';
	SELECT v INTO c_chal FROM _fog WHERE k='c_chal';
	PERFORM set_config('role','authenticated',true);
	PERFORM set_config('request.jwt.claims', json_build_object('sub', u_def)::text, true);

	SELECT count(*) INTO n FROM public.mud_front_pushes WHERE crew_id = c_chal;
	IF n < 1 THEN RAISE EXCEPTION 'POST-FOLD REVEAL BROKEN: defender still cannot see folded-day challenger pushes'; END IF;
	-- the deploy reveals on the same post-fold rule
	SELECT count(*) INTO n FROM public.mud_war_deploys WHERE crew_id = c_chal;
	IF n < 1 THEN RAISE EXCEPTION 'POST-FOLD DEPLOY REVEAL BROKEN: defender still cannot see folded-day challenger deploy'; END IF;
	RESET ROLE;
	RAISE NOTICE 'ASSERT 2 PASS — opponent pushes + deploy revealed after the day is folded';
END $$;

-- ── ASSERT 3: mud_front_pushes is NOT in the realtime publication ──────────────
DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM pg_publication_tables
		WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mud_front_pushes';
	IF n <> 0 THEN RAISE EXCEPTION 'FOG LEAK: mud_front_pushes is in the realtime publication (must not be)'; END IF;
	RAISE NOTICE 'ASSERT 3 PASS — mud_front_pushes excluded from realtime';
END $$;

-- ── ASSERT 3b: mud_war_deploys is NOT in the realtime publication (20260668) ──────
DO $$
DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM pg_publication_tables
		WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mud_war_deploys';
	IF n <> 0 THEN RAISE EXCEPTION 'DEPLOY FOG LEAK: mud_war_deploys is in the realtime publication (must not be)'; END IF;
	RAISE NOTICE 'ASSERT 3b PASS — mud_war_deploys excluded from realtime';
END $$;

DO $$ BEGIN RAISE NOTICE '✓ ALL FOG TESTS PASSED'; END $$;
ROLLBACK;
