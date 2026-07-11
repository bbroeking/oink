-- Functional smoke for rename_crew (20260723): leader renames, member can't,
-- name rules mirror create_crew (btrim, 1..24), unauthenticated rejected.
-- Reuses 18's CrewDetail fixtures (df01 leader, df03 plain member, dd77 crew).
\set ON_ERROR_STOP on

DO $smoke_rn$
DECLARE
	cw   uuid := '00000000-0000-0000-0000-00000000dd77';
	lead uuid := '00000000-0000-0000-0000-00000000df01';
	memb uuid := '00000000-0000-0000-0000-00000000df03';
	res  jsonb;
	nm   text;
BEGIN
	-- A plain member may not rename.
	PERFORM set_config('smoke.uid', memb::text, true);
	res := public.rename_crew('Sneaky Rename');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_leader' THEN
		RAISE EXCEPTION 'rename: member must get not_leader, got %', res; END IF;

	-- The leader renames; whitespace is trimmed.
	PERFORM set_config('smoke.uid', lead::text, true);
	res := public.rename_crew('  The Velvet Hooves  ');
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'rename: leader rename failed: %', res; END IF;
	SELECT name INTO nm FROM public.crews WHERE id = cw;
	IF nm <> 'The Velvet Hooves' THEN
		RAISE EXCEPTION 'rename: want trimmed name, got %', nm; END IF;

	-- Name rules mirror create_crew: empty and >24 both reject, no write.
	res := public.rename_crew('   ');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_name' THEN
		RAISE EXCEPTION 'rename: blank must be bad_name, got %', res; END IF;
	res := public.rename_crew(repeat('x', 25));
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_name' THEN
		RAISE EXCEPTION 'rename: 25 chars must be bad_name, got %', res; END IF;
	SELECT name INTO nm FROM public.crews WHERE id = cw;
	IF nm <> 'The Velvet Hooves' THEN
		RAISE EXCEPTION 'rename: rejected renames must not write, got %', nm; END IF;

	-- No auth, no rename.
	PERFORM set_config('smoke.uid', '', true);
	res := public.rename_crew('Ghost Herd');
	IF (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'rename: unauthenticated must reject, got %', res; END IF;

	RAISE NOTICE 'chk rename_crew: leader-only + name rules + no-write-on-reject OK';
END $smoke_rn$;
