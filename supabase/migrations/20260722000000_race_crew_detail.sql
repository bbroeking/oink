-- ═══════════════════════════════════════════════════════════════════════════
-- RACE CREW DETAIL — per-member contribution readout for the dig-off board.
--
-- race_crew_detail(p_crew_id) → jsonb: the named crew's member lines for the
-- CURRENT weekly cycle — every current member (0-find members included; the
-- quiet snouts are the social signal) plus any departed digger whose finds
-- still count toward the crew's cycle total. Each line carries the weekly
-- `finds` and the season-cumulative `season_finds` (SUM over ALL race_digs
-- for that crew, mirroring the season board's accumulation semantics in
-- 20260720). Unknown crew id → NULL.
--
-- SECURITY DEFINER on purpose: race_digs RLS stays own-crew-only, but the
-- race is global — any signed-in pig may inspect any crew's breakdown; it's
-- the same data the board already aggregates (names are public via profiles,
-- finds via the standings totals). New function — no carry-latest-def
-- concerns.
-- ═══════════════════════════════════════════════════════════════════════════

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
			'finds', l.finds, 'season_finds', l.season_finds)
		ORDER BY l.finds DESC, l.season_finds DESC, l.username), '[]'::jsonb)
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
