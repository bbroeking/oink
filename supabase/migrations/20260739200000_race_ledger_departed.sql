-- The ledger tells the truth about membership: a departed digger's finds stay
-- with the crew they were dug for (clawing them back would shrink the herd's
-- tally through no fault of its own — the charter's no-shame rule), but the
-- row must READ as historical. Live case: sivleg dug 4 for The Truffle Barons,
-- left, joined The Bramble Snouts — and showed as an indistinguishable member
-- line in both crews' ledgers.
--
-- Carried VERBATIM from 20260722000000_race_crew_detail.sql; CARRY DIFF: each
-- member line gains 'departed' (true when the digger is no longer in
-- crew_members), and departed rows sort after current members.

CREATE OR REPLACE FUNCTION public.race_crew_detail(p_crew_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cyc       record;
	crew_name text;
	members   jsonb;
BEGIN
	IF p_crew_id IS NULL THEN RETURN NULL; END IF;
	SELECT name INTO crew_name FROM public.crews WHERE id = p_crew_id;
	IF crew_name IS NULL THEN RETURN NULL; END IF;

	SELECT * INTO cyc FROM public.race_current_cycle();

	-- Every snout with a stake: current members ∪ this cycle's diggers (a
	-- departed digger's finds still sit in the crew's total — show the line).
	WITH snouts AS (
		SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = p_crew_id
		UNION
		SELECT d.user_id FROM public.race_digs d
			WHERE d.crew_id = p_crew_id AND d.cycle_key = cyc.cycle_key
	), lines AS (
		SELECT s.user_id,
		       COALESCE(p.username, 'a pig') AS username,
		       NOT EXISTS (SELECT 1 FROM public.crew_members cm
		                   WHERE cm.crew_id = p_crew_id
		                     AND cm.user_id = s.user_id) AS departed,
		       COALESCE((SELECT sum(d.finds)::int FROM public.race_digs d
		                 WHERE d.user_id = s.user_id AND d.crew_id = p_crew_id
		                   AND d.cycle_key = cyc.cycle_key), 0) AS finds,
		       COALESCE((SELECT sum(d.finds)::int FROM public.race_digs d
		                 WHERE d.user_id = s.user_id AND d.crew_id = p_crew_id), 0)
		           AS season_finds
		FROM snouts s LEFT JOIN public.profiles p ON p.id = s.user_id
	)
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', l.user_id, 'username', l.username,
			'departed', l.departed,
			'finds', l.finds, 'season_finds', l.season_finds)
		ORDER BY l.departed, l.finds DESC, l.season_finds DESC, l.username), '[]'::jsonb)
		INTO members FROM lines l;

	RETURN jsonb_build_object(
		'cycle_key', cyc.cycle_key,
		'crew_id', p_crew_id,
		'name', crew_name,
		'members', members);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_crew_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_crew_detail(uuid) TO authenticated;
