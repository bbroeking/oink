-- Functional smoke for player_dig_stats(): submitted-only lifetime totals for
-- digs, credited finds, freed motes, and Sounder echoes.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $smoke_player_dig_stats$
DECLARE
	viewer uuid := '00000000-0000-0000-0000-000000063001';
	digger uuid := '00000000-0000-0000-0000-000000063002';
	crew uuid := '00000000-0000-0000-0000-00000000c001';
	res jsonb;
BEGIN
	INSERT INTO auth.users (id) VALUES (viewer), (digger) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		(viewer, 'ledger_viewer'), (digger, 'ledger_digger')
	ON CONFLICT (id) DO NOTHING;

	-- Three completed digs: 2 + 3 + 1 credited finds, one shimmer, two echoes.
	-- The fourth row was merely opened and must be invisible to every total.
	INSERT INTO public.war_rootings (
		user_id, crew_id, window_index, seed, dig_day, opened_at, submitted_at,
		finds, actions, truffles_minted, echo_credited, credited_finds
	) VALUES
		(digger, crew, 63001, 1, current_date, now(), now(),
		 ARRAY['truffle_l','shimmer'], 4, 1, true, 2),
		(digger, crew, 63002, 2, current_date, now(), now(),
		 ARRAY['truffle_l','truffle_d','junk_boot'], 6, 1, false, 3),
		(digger, crew, 63003, 3, current_date, now(), now(),
		 ARRAY['junk_wrap'], 2, 0, true, 1),
		(digger, crew, 63004, 4, current_date, now(), NULL,
		 ARRAY['shimmer'], 1, 0, true, 99);

	PERFORM set_config('smoke.uid', '', true);
	res := public.player_dig_stats(digger);
	IF res->>'reason' <> 'unauthenticated' THEN
		RAISE EXCEPTION 'dig stats: unauthenticated call should refuse, got %', res;
	END IF;

	PERFORM set_config('smoke.uid', viewer::text, true);
	res := public.player_dig_stats(digger);
	IF NOT (res->>'ok')::boolean
		OR (res->>'digs')::int <> 3
		OR (res->>'finds')::int <> 6
		OR (res->>'motes')::int <> 1
		OR (res->>'echoes')::int <> 2 THEN
		RAISE EXCEPTION 'dig stats: expected 3 digs / 6 finds / 1 mote / 2 echoes, got %', res;
	END IF;

	-- The no-argument path is the caller's own record and must return real zeros,
	-- not a missing row or NULL aggregate.
	res := public.player_dig_stats();
	IF NOT (res->>'ok')::boolean
		OR (res->>'digs')::int <> 0
		OR (res->>'finds')::int <> 0
		OR (res->>'motes')::int <> 0
		OR (res->>'echoes')::int <> 0 THEN
		RAISE EXCEPTION 'dig stats: fresh self should return four zeros, got %', res;
	END IF;

	RAISE NOTICE 'chk player_dig_stats: auth + submitted-only + canonical four totals OK';
END $smoke_player_dig_stats$;
