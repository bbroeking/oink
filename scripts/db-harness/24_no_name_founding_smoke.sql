-- Functional smoke for no-name founding (20260738600000): create_crew(NULL) and
-- create_crew('anything') both mint a Sounder with a server-random name; TWO
-- different users can each found their own (crews.name has no unique constraint —
-- both succeed even on a name collision). Widened pools (16 adj × 12 noun) still
-- produce "The {adj} {noun}" ≤ 24 chars. Fresh cf-namespace users, no coupling.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC so the smoke can act "as" a given pig
-- (idempotent CREATE OR REPLACE — 15_coop_dig_smoke installs the same shim).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000cf01', 'cf-alpha'),
	('00000000-0000-0000-0000-00000000cf02', 'cf-beta');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000cf%';

DO $smoke_cf$
DECLARE
	alpha uuid := '00000000-0000-0000-0000-00000000cf01';
	beta  uuid := '00000000-0000-0000-0000-00000000cf02';
	res   jsonb;
	nm    text;
	fmt   text := '^[A-Za-z]+ [A-Za-z]+( \d+)?$';  -- with "The " stripped for the check
BEGIN
	-- Alpha founds with NO name (p_name := NULL) → ok + random name.
	PERFORM set_config('smoke.uid', alpha::text, true);
	res := public.create_crew(NULL);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'create_crew(NULL): must succeed, got %', res; END IF;
	nm := res->>'name';
	IF nm IS NULL OR char_length(nm) < 1 OR char_length(nm) > 24 THEN
		RAISE EXCEPTION 'create_crew(NULL): bad random name %', nm; END IF;
	-- Name is two words (optionally "The "-prefixed); strip a leading "The " and
	-- assert the two-part shape the task requires.
	IF regexp_replace(nm, '^The ', '') !~ fmt THEN
		RAISE EXCEPTION 'create_crew(NULL): name shape wrong: %', nm; END IF;

	-- Beta founds too (independent user) → also succeeds, even if the random
	-- draw collides (no unique constraint on crews.name).
	PERFORM set_config('smoke.uid', beta::text, true);
	res := public.create_crew('ignored typed name');
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'create_crew (2nd user): must succeed, got %', res; END IF;
	nm := res->>'name';
	IF nm = 'ignored typed name' THEN
		RAISE EXCEPTION 'create_crew: p_name was NOT ignored'; END IF;
	IF nm IS NULL OR char_length(nm) > 24
	   OR regexp_replace(nm, '^The ', '') !~ fmt THEN
		RAISE EXCEPTION 'create_crew (2nd user): bad name %', nm; END IF;

	-- Forced collision: two crews with the SAME name are allowed (parity with the
	-- no-unique-constraint client generator). Insert directly to prove the column
	-- takes a dup — create_crew is one-per-user so it can't itself repeat.
	INSERT INTO public.crews (name, leader_id, is_bot) VALUES
		('The Muddy Snouts', alpha, false),
		('The Muddy Snouts', beta,  false);
	IF (SELECT count(*) FROM public.crews WHERE name = 'The Muddy Snouts') < 2 THEN
		RAISE EXCEPTION 'collision: crews.name should allow duplicates'; END IF;

	-- Widened generator: 40 draws all ≤ 24 chars, non-empty, correct shape.
	FOR i IN 1..40 LOOP
		nm := public.random_crew_name();
		IF nm IS NULL OR char_length(nm) < 1 OR char_length(nm) > 24
		   OR regexp_replace(nm, '^The ', '') !~ fmt THEN
			RAISE EXCEPTION 'random_crew_name draw % bad: %', i, nm; END IF;
	END LOOP;

	RAISE NOTICE 'chk no-name founding: create_crew(NULL) ok + two users found + collisions allowed + widened pools OK';
END $smoke_cf$;
