-- Schema integrity — after the teardown, NO surviving function body may still
-- reference a dropped war/league table (a runtime time-bomb the smokes can't
-- catch unless the function happens to be called).
\set ON_ERROR_STOP on

DO $$
DECLARE
	bad text;
BEGIN
	SELECT string_agg(p.proname, ', ') INTO bad
	FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
	WHERE n.nspname = 'public'
	  AND p.prosrc ~ ('\y(' || array_to_string(ARRAY[
		'mud_wars','mud_slings','mud_war_fronts','mud_front_pushes','mud_war_plans',
		'mud_war_deploys','mud_war_access','crew_ratings','league_seasons',
		'war_terms','term_fixtures'], '|') || ')\y');
	IF bad IS NOT NULL THEN
		RAISE EXCEPTION 'functions still reference dropped war/league tables: %', bad;
	END IF;
	RAISE NOTICE 'schema integrity: no dangling war/league table references';
END $$;

SELECT 'dropped tables gone' AS chk, count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname = 'public' AND c.relkind = 'r'
	  AND c.relname IN ('mud_wars','mud_slings','mud_war_fronts','mud_front_pushes',
		'mud_war_plans','mud_war_deploys','mud_war_access','crew_ratings',
		'league_seasons','war_terms','term_fixtures');
SELECT 'kept tables present' AS chk, count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname = 'public' AND c.relkind = 'r'
	  AND c.relname IN ('crews','crew_members','crew_invites','war_truffles',
		'war_rootings','hunger_drain','crew_milestones');
