-- DIG-OFF WEEKLY HISTORY — expose every settled weekly table for the current
-- season. `race_digs` is the season-scoped attribution ledger (the season flip
-- clears/partitions it), so its past cycle keys are exactly the archive we need.
--
-- This stays separate from race_standings(): the compact season-tab card should
-- not pay to rebuild every old table. Only the full Dig-Off page calls it.

CREATE OR REPLACE FUNCTION public.race_history()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cur       record;
	k         text;
	ranked    jsonb;
	unranked  jsonb;
	history   jsonb := '[]'::jsonb;
	starts    timestamptz;
	ends      timestamptz;
BEGIN
	SELECT * INTO cur FROM public.race_current_cycle();

	-- Newest week first. A cycle is historical only after the Monday bell; the
	-- live cycle belongs to race_standings(), even while its payout is settling.
	FOR k IN
		SELECT DISTINCT d.cycle_key
		FROM public.race_digs d
		WHERE d.cycle_key < cur.cycle_key
		ORDER BY d.cycle_key DESC
	LOOP
		SELECT COALESCE(jsonb_agg(jsonb_build_object(
				'rank', t.rnk, 'crew_id', t.crew_id, 'name', t.crew_name,
				'avg', t.avg, 'diggers', t.diggers,
				'total_finds', t.total_finds, 'roster_size', t.roster_size)
			ORDER BY t.rnk, t.crew_name), '[]'::jsonb)
		INTO ranked
		FROM public._race_table(k) t
		WHERE t.rnk IS NOT NULL;

		SELECT COALESCE(jsonb_agg(jsonb_build_object(
				'crew_id', t.crew_id, 'name', t.crew_name,
				'avg', t.avg, 'diggers', t.diggers,
				'total_finds', t.total_finds, 'roster_size', t.roster_size)
			ORDER BY t.avg DESC, t.crew_name), '[]'::jsonb)
		INTO unranked
		FROM public._race_table(k) t
		WHERE t.rnk IS NULL;

		starts := (to_date(k, 'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
		ends := starts + interval '7 days';
		history := history || jsonb_build_array(jsonb_build_object(
			'cycle', jsonb_build_object(
				'key', k, 'starts_at', starts, 'ends_at', ends),
			'ranked', ranked,
			'unranked', unranked));
	END LOOP;

	RETURN history;
END;
$function$;

REVOKE ALL ON FUNCTION public.race_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_history() TO authenticated;
