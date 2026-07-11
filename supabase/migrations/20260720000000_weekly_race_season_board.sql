-- ═══════════════════════════════════════════════════════════════════════════
-- WEEKLY RACE + SEASON BOARD — two founder-approved deltas on the global race
-- (20260719, already applied on the remote — this is a pure delta).
--
-- 1. CYCLES BECOME WEEKLY, MONDAY-ANCHORED (client MUST mirror in utils/dig.ts):
--      d          = UTC date of T
--      since_mon  = (isodow(d) - 1) mod 7      -- isodow: 1=Mon … 7=Sun
--      start_date = d - since_mon              -- most recent Monday 00:00 UTC ≤ T
--      ends_at    = start_date + 7 days        -- always the following Monday
--      cycle_key  = 'YYYYMMDD' of start_date   -- sorts chronologically
--    The Mon/Thu alternation is gone. Everything downstream (attribution,
--    standings, payout, pushes, sweeper) keys off race_cycle_at /
--    race_current_cycle — verified: the ONLY other Mon/Thu-aware spot was the
--    race_start push body ("⟨3/4⟩ days on the clock"), replaced below with the
--    weekly copy. Historical cycle_keys (some are Thursdays) stay valid
--    strings; cycle_payouts rows are untouched.
--
-- 2. SEASON-CUMULATIVE BOARD: race_standings() gains top-level `season` +
--    `mine_season`. Season rank = DENSE_RANK over SUM(finds) DESC across ALL
--    race_digs (accumulation, not weekly fairness → NO quorum: every non-bot
--    crew with ≥1 find appears; 1-digger crews rank here while staying
--    unranked weekly). The existing cycle/ranked/unranked/mine/last keys are
--    EXACTLY as in 20260719. race_digs only exists since the race began, so
--    "season" = since launch — acceptable; a future season reset will
--    TRUNCATE/partition race_digs by season (leave that to the reset
--    migration).
--
-- FOOTGUNS honored: carry-latest-def — race_standings + sweep_race carried
-- VERBATIM from 20260719 with only the documented deltas. race_current_cycle
-- (SQL wrapper over race_cycle_at) needs no recreate — name resolution is at
-- call time.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Weekly Monday-anchored cycle math (same signature as 20260719) ────────
CREATE OR REPLACE FUNCTION public.race_cycle_at(p_at timestamptz)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	d       date := (p_at AT TIME ZONE 'UTC')::date;
	start_d date;
BEGIN
	start_d   := d - ((extract(isodow FROM d)::int - 1) % 7);   -- most recent Monday
	cycle_key := to_char(start_d, 'YYYYMMDD');
	starts_at := (start_d::timestamp AT TIME ZONE 'UTC');
	ends_at   := ((start_d + 7)::timestamp AT TIME ZONE 'UTC'); -- the following Monday
	RETURN NEXT;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.race_cycle_at(timestamptz) TO authenticated;

-- ── 2. race_standings — carried from 20260719; + season / mine_season ────────
CREATE OR REPLACE FUNCTION public.race_standings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cyc       record;
	my_crew   uuid;
	ranked    jsonb;
	unranked  jsonb;
	mine      jsonb := NULL;
	last_res  jsonb := NULL;
	season    jsonb;
	mine_season jsonb := NULL;
BEGIN
	SELECT * INTO cyc FROM public.race_current_cycle();

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'rank', t.rnk, 'crew_id', t.crew_id, 'name', t.crew_name,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds,
			'roster_size', t.roster_size)
		ORDER BY t.rnk, t.crew_name), '[]'::jsonb) INTO ranked
		FROM public._race_table(cyc.cycle_key) t WHERE t.rnk IS NOT NULL;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'crew_id', t.crew_id, 'name', t.crew_name,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds,
			'roster_size', t.roster_size)
		ORDER BY t.avg DESC, t.crew_name), '[]'::jsonb) INTO unranked
		FROM public._race_table(cyc.cycle_key) t WHERE t.rnk IS NULL;

	-- Season-cumulative board: SUM(finds) DESC over ALL race_digs, dense rank,
	-- no quorum (accumulation, not weekly fairness), bot excluded.
	WITH per_crew AS (
		SELECT d.crew_id,
		       sum(d.finds)::int AS total_finds,
		       count(DISTINCT d.user_id)::int AS diggers
		FROM public.race_digs d
		JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
		GROUP BY d.crew_id
		HAVING sum(d.finds) >= 1
	),
	board AS (
		SELECT pc.*, c.name,
		       (DENSE_RANK() OVER (ORDER BY pc.total_finds DESC))::int AS rnk,
		       (SELECT count(*)::int FROM public.crew_members cm
		        WHERE cm.crew_id = pc.crew_id) AS roster_size
		FROM per_crew pc JOIN public.crews c ON c.id = pc.crew_id
	)
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'rank', b.rnk, 'crew_id', b.crew_id, 'name', b.name,
			'total_finds', b.total_finds, 'diggers', b.diggers,
			'roster_size', b.roster_size)
		ORDER BY b.rnk, b.name), '[]'::jsonb) INTO season
		FROM board b;

	IF caller_id IS NOT NULL THEN
		SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
		IF my_crew IS NOT NULL THEN
			SELECT jsonb_build_object('crew_id', t.crew_id, 'rank', t.rnk, 'avg', t.avg,
					'diggers', t.diggers, 'total_finds', t.total_finds) INTO mine
				FROM public._race_table(cyc.cycle_key) t WHERE t.crew_id = my_crew;
			IF mine IS NULL THEN   -- crew hasn't dug this cycle yet
				mine := jsonb_build_object('crew_id', my_crew, 'rank', NULL,
					'avg', 0, 'diggers', 0, 'total_finds', 0);
			END IF;
			-- The caller's crew on the season board (null until its first find).
			WITH per_crew AS (
				SELECT d.crew_id, sum(d.finds)::int AS total_finds
				FROM public.race_digs d
				JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
				GROUP BY d.crew_id
				HAVING sum(d.finds) >= 1
			),
			board AS (
				SELECT pc.crew_id, pc.total_finds,
				       (DENSE_RANK() OVER (ORDER BY pc.total_finds DESC))::int AS rnk
				FROM per_crew pc
			)
			SELECT jsonb_build_object('rank', b.rnk, 'total_finds', b.total_finds)
				INTO mine_season FROM board b WHERE b.crew_id = my_crew;
			-- The caller's most recent recorded payout (usually last cycle).
			SELECT (cp.detail->'members'->(caller_id::text))
			       || jsonb_build_object('cycle_key', cp.cycle_key) INTO last_res
				FROM public.cycle_payouts cp
				WHERE cp.detail->'members' ? caller_id::text
				ORDER BY cp.cycle_key DESC LIMIT 1;
		END IF;
	END IF;

	RETURN jsonb_build_object(
		'cycle', jsonb_build_object('key', cyc.cycle_key,
			'starts_at', cyc.starts_at, 'ends_at', cyc.ends_at),
		'ranked', ranked, 'unranked', unranked, 'mine', mine, 'last', last_res,
		'season', season, 'mine_season', mine_season);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_standings() TO authenticated;

-- ── 3. sweep_race — carried from 20260719; race_start body goes weekly ───────
CREATE OR REPLACE FUNCTION public.sweep_race()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cur     record;
	k       text;
	landed  int;
	n_paid  int := 0;
	started boolean := false;
	m       record;
BEGIN
	SELECT * INTO cur FROM public.race_current_cycle();

	-- (a) race_start push — once per cycle (cycle_notices = sent-ness lock).
	INSERT INTO public.cycle_notices (cycle_key) VALUES (cur.cycle_key) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed > 0 THEN
		started := true;
		FOR m IN SELECT cm.user_id FROM public.crew_members cm
			JOIN public.crews c ON c.id = cm.crew_id AND c.is_bot = false
		LOOP
			BEGIN
				PERFORM public.send_push_to_user(m.user_id, 'A new race is on',
					'Every Sounder digs — spoils on Monday.',
					jsonb_build_object('kind', 'race_start', 'cycle_key', cur.cycle_key,
						'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END IF;

	-- (b) payouts: any ENDED cycle with digs and no payout row. cycle_key is
	-- YYYYMMDD, so string < compares chronologically; cycles with zero digs
	-- have nothing to pay and are skipped.
	FOR k IN SELECT DISTINCT d.cycle_key FROM public.race_digs d
		WHERE d.cycle_key < cur.cycle_key
		  AND NOT EXISTS (SELECT 1 FROM public.cycle_payouts cp WHERE cp.cycle_key = d.cycle_key)
		ORDER BY d.cycle_key
	LOOP
		IF public._race_pay_cycle(k) THEN n_paid := n_paid + 1; END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'cycle', cur.cycle_key,
		'started', started, 'paid', n_paid);
END;
$function$;
REVOKE ALL ON FUNCTION public.sweep_race() FROM PUBLIC, anon, authenticated;
