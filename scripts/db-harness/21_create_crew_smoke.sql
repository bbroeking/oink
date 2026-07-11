-- Functional smoke for random Sounder names (20260725): create_crew ignores
-- p_name and always assigns a "The {adj} {noun}" random name (≤ 24 chars), sets
-- the caller leader, mints crew_members, returns {ok, crew_id, name}, and still
-- enforces auth + the one-Sounder guard. Fresh cg-namespace user, no coupling.
\set ON_ERROR_STOP on

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000ce01', 'cc-founder'),
	('00000000-0000-0000-0000-00000000ce02', 'cc-second');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000ce%';

DO $smoke_cc$
DECLARE
	founder uuid := '00000000-0000-0000-0000-00000000ce01';
	res     jsonb;
	nm      text;
	cid     uuid;
	role_ok text;
BEGIN
	-- Unauthenticated → reject, no write.
	PERFORM set_config('smoke.uid', '', true);
	res := public.create_crew('Whatever');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'unauthenticated' THEN
		RAISE EXCEPTION 'create_crew: anon must reject, got %', res; END IF;

	-- The founder creates a Sounder passing a name that must be IGNORED.
	PERFORM set_config('smoke.uid', founder::text, true);
	res := public.create_crew('My Hand-Picked Name');
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'create_crew: founder create failed: %', res; END IF;
	cid := (res->>'crew_id')::uuid;
	nm  := res->>'name';

	-- Name must be the RANDOM server name, not the passed p_name.
	IF nm = 'My Hand-Picked Name' THEN
		RAISE EXCEPTION 'create_crew: p_name was NOT ignored (got the typed name)'; END IF;
	IF nm IS NULL OR char_length(nm) < 1 OR char_length(nm) > 24 THEN
		RAISE EXCEPTION 'create_crew: bad random name %', nm; END IF;
	IF nm !~ '^(The )?[A-Z][a-z]+ [A-Z][a-z]+$' THEN
		RAISE EXCEPTION 'create_crew: random name shape wrong: %', nm; END IF;

	-- Stored name matches the returned name; founder is leader.
	IF (SELECT name FROM public.crews WHERE id = cid) <> nm THEN
		RAISE EXCEPTION 'create_crew: stored name != returned name'; END IF;
	SELECT role INTO role_ok FROM public.crew_members
		WHERE crew_id = cid AND user_id = founder;
	IF role_ok <> 'leader' THEN
		RAISE EXCEPTION 'create_crew: founder is not leader (%)', role_ok; END IF;

	-- One-Sounder guard: a second create by the same user rejects.
	res := public.create_crew('Again');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_in_crew' THEN
		RAISE EXCEPTION 'create_crew: second create must be already_in_crew, got %', res; END IF;

	-- random_crew_name alone: 20 draws all ≤ 24 chars and non-empty.
	FOR i IN 1..20 LOOP
		nm := public.random_crew_name();
		IF nm IS NULL OR char_length(nm) < 1 OR char_length(nm) > 24 THEN
			RAISE EXCEPTION 'random_crew_name draw % bad: %', i, nm; END IF;
	END LOOP;

	-- Bulk reroll (mirrors the migration's one-time UPDATE): every targeted crew
	-- gets its OWN random name (VOLATILE → per-row), none retains the old name.
	INSERT INTO public.crews (id, name, leader_id, is_bot) VALUES
		('00000000-0000-0000-0000-00000000ce11', 'OLDNAME', founder, false),
		('00000000-0000-0000-0000-00000000ce12', 'OLDNAME', founder, false),
		('00000000-0000-0000-0000-00000000ce13', 'OLDNAME', founder, false);
	UPDATE public.crews SET name = public.random_crew_name()
		WHERE id IN ('00000000-0000-0000-0000-00000000ce11',
		             '00000000-0000-0000-0000-00000000ce12',
		             '00000000-0000-0000-0000-00000000ce13');
	IF EXISTS (SELECT 1 FROM public.crews
	           WHERE id::text LIKE '00000000-0000-0000-0000-00000000ce1_'
	             AND name = 'OLDNAME') THEN
		RAISE EXCEPTION 'bulk reroll: a crew kept OLDNAME (per-row VOLATILE broke)'; END IF;
	IF EXISTS (SELECT 1 FROM public.crews
	           WHERE id::text LIKE '00000000-0000-0000-0000-00000000ce1_'
	             AND (name IS NULL OR char_length(name) > 24
	                  OR name !~ '^(The )?[A-Z][a-z]+ [A-Z][a-z]+$')) THEN
		RAISE EXCEPTION 'bulk reroll: a crew got a bad random name'; END IF;

	RAISE NOTICE 'chk create_crew: random name + p_name ignored + leader + one-Sounder guard + bulk reroll OK';
END $smoke_cc$;
