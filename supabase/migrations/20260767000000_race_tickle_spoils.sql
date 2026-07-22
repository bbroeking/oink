-- ═══════════════════════════════════════════════════════════════════════════
-- RACE TICKLE SPOILS — the weekly dig-off gains a TICKLE reward layer on top of
-- its Golden-Truffle + podium-cosmetic spoils. Founder call (spec 21):
--
--   • EVERY digging snout in a Sounder that logged ≥1 find this cycle banks a
--     PARTICIPATION grant of tickles — ranked OR sub-quorum. A solo digger's
--     week is never a public zero: showing up strong earns something.
--   • Podium ranks bank visibly more, top-heavy (see _race_tickles_for_rank).
--
-- CRITICAL ECONOMY CONSTRAINT (spec 15 / spec 17 tiebreak honesty): the tickle
-- rewards are paid to the SPENDABLE TAP POOL via grant_tickles() (user_items.
-- item_count — the "ready to tickle" bank, can push over cap). They NEVER touch
-- profiles.tickles_earned, which is the season's Most-Tickles tiebreak and must
-- stay EARNED-BY-TICKLING. Granting into tickles_earned would repeat exactly the
-- pollution the spec-15 clawback just removed. grant_tickles is the audited
-- chokepoint (20260580) and touches item_count only — verified.
--
-- CARRY-LATEST-DEF (build-93 law): everything recreated here is carried VERBATIM
-- from its alphabetically-latest live definition, with ONLY the documented delta:
--   • _race_pay_cycle  — latest def is 20260719 (20260720 did NOT touch it).
--       Carried verbatim + tickle grants on the ranked diggers + a new sub-quorum
--       participation loop + tickles_paid folded into cycle_payouts.detail +
--       announcement copy.
--   • race_standings   — latest def is 20260720. Carried verbatim + a top-level
--       `prizes` config so the client can SHOW the ladder before Monday.
-- _race_truffles_for_rank (20260719) and grant_tickles (20260580) are unchanged
-- and reused. No client push-order hazard: pre-push the client reads a compiled
-- fallback ladder (utils/dig.ts DEFAULT_RACE_PRIZES); the section is feature-dark
-- until this ships anyway.
--
-- NO-SHAME RULE honored: sub-quorum crews still get NO race_end PUSH (charter,
-- 20260719). But their diggers now bank a warm IN-APP participation announcement
-- (a positive reward, not a "you placed nowhere") + the tickle grant. Leavers
-- still forfeit — participation is paid to CURRENT crew members who dug, exactly
-- like the ranked branch (20260739200000 departed-ledger decision).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The tickle prize ladder — the payout source of truth ──────────────────
-- Rank 0 (or any non-positive rank) is the PARTICIPATION FLOOR paid to every
-- digging snout in a sub-quorum crew. Podium amounts are ranked_n-independent
-- (the 1/2/3 branches catch before the top-half branch). MUST be mirrored by the
-- client's DEFAULT_RACE_PRIZES fallback in utils/dig.ts.
CREATE OR REPLACE FUNCTION public._race_tickles_for_rank(p_rank int, p_ranked int)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	-- Juiced 2026-07-21 (founder: "juice up the tickle prizes"): the grand
	-- prize doubles the full 25-cap bank; even the floor feels like a handful.
	SELECT CASE
		WHEN p_rank = 1 THEN 50
		WHEN p_rank = 2 THEN 30
		WHEN p_rank = 3 THEN 20
		WHEN p_rank >= 4 AND p_rank <= ceil(p_ranked / 2.0)::int THEN 12
		WHEN p_rank >= 4 THEN 8
		ELSE 5   -- participation floor (rank 0 / sub-quorum digger)
	END;
$function$;
REVOKE ALL ON FUNCTION public._race_tickles_for_rank(int, int) FROM PUBLIC, anon, authenticated;

-- ── 2. _race_pay_cycle — carried VERBATIM from 20260719; + tickle spoils ──────
CREATE OR REPLACE FUNCTION public._race_pay_cycle(p_cycle text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	landed   int;
	ranked_n int;
	t        record;
	m        record;
	amt      int;
	tix      int;   -- NEW: tickles banked to the tap pool (never tickles_earned)
	pick     text;
	dug      boolean;
	members  jsonb := '{}'::jsonb;
	crews_j  jsonb := '[]'::jsonb;
BEGIN
	-- Idempotence lock: first inserter pays; everyone else no-ops.
	INSERT INTO public.cycle_payouts (cycle_key) VALUES (p_cycle) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed = 0 THEN RETURN false; END IF;

	SELECT count(*) INTO ranked_n FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL;

	FOR t IN SELECT * FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL
		ORDER BY rt.rnk, rt.crew_name
	LOOP
		crews_j := crews_j || jsonb_build_object('crew_id', t.crew_id, 'rank', t.rnk,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds);

		FOR m IN SELECT cm.user_id FROM public.crew_members cm
			WHERE cm.crew_id = t.crew_id ORDER BY cm.user_id
		LOOP
			amt := 0; tix := 0; pick := NULL;
			dug := EXISTS (SELECT 1 FROM public.race_digs d
				WHERE d.cycle_key = p_cycle AND d.user_id = m.user_id AND d.crew_id = t.crew_id);

			IF dug THEN
				amt := public._race_truffles_for_rank(t.rnk, ranked_n);
				BEGIN PERFORM public.mint_truffles(m.user_id, amt, 'race_rank', NULL);
				EXCEPTION WHEN OTHERS THEN NULL; END;

				-- TICKLE spoils — rank-scaled, banked to the SPENDABLE tap pool via
				-- grant_tickles (over-cap-tolerant; touches user_items.item_count
				-- ONLY — never tickles_earned, the season tiebreak).
				tix := public._race_tickles_for_rank(t.rnk, ranked_n);
				BEGIN PERFORM public.grant_tickles(m.user_id, tix);
				EXCEPTION WHEN OTHERS THEN NULL; END;

				-- PODIUM cosmetic (ranks 1-3): queue pop → random unowned catalog
				-- item → owns-everything +2 truffles.
				IF t.rnk <= 3 THEN
					DELETE FROM public.race_podium_queue q
						WHERE q.id = (SELECT id FROM public.race_podium_queue
						              ORDER BY id LIMIT 1)
						RETURNING q.hat_id INTO pick;
					IF pick IS NULL THEN
						SELECT h.id INTO pick FROM public.hats h
						WHERE h.war_exclusive = true
						  AND NOT EXISTS (SELECT 1 FROM public.user_hats uh
							WHERE uh.user_id = m.user_id AND uh.hat_id = h.id)
						ORDER BY random() LIMIT 1;
					END IF;
					IF pick IS NOT NULL THEN
						INSERT INTO public.user_hats (user_id, hat_id)
							VALUES (m.user_id, pick) ON CONFLICT DO NOTHING;
					ELSE
						BEGIN PERFORM public.mint_truffles(m.user_id, 2, 'race_rank', NULL);
						EXCEPTION WHEN OTHERS THEN NULL; END;
						amt := amt + 2;
					END IF;
				END IF;

				BEGIN PERFORM public.try_claim_achievements(m.user_id, 'truffles_dug');
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;

			members := members || jsonb_build_object(m.user_id::text, jsonb_build_object(
				'crew_id', t.crew_id, 'rank', t.rnk, 'of', ranked_n,
				'truffles_paid', amt, 'tickles_paid', tix, 'cosmetic_hat_id', pick));

			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'race_result', 'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
					CASE WHEN amt > 0 THEN ' — ' || amt || ' Golden Truffles and ' || tix ||
						' tickles are yours.'
					     ELSE '.' END,
					jsonb_build_object('cycle_key', p_cycle, 'rank', t.rnk, 'of', ranked_n,
						'truffles', amt, 'tickles', tix, 'hat_id', pick));
			EXCEPTION WHEN OTHERS THEN NULL; END;

			-- Race-end push: every member of each RANKED crew. Sub-quorum crews
			-- get no push (no shame).
			BEGIN
				PERFORM public.send_push_to_user(m.user_id, 'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n || ' — your spoils are in.',
					jsonb_build_object('kind', 'race_end', 'cycle_key', p_cycle, 'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END LOOP;

	-- ── NEW: SUB-QUORUM PARTICIPATION ────────────────────────────────────────
	-- Every crew with ≥1 find but < quorum (rnk IS NULL) still dug — its CURRENT
	-- members who dug bank the participation tickle floor. No truffles, no podium,
	-- and (charter) NO race_end push — but a warm in-app announcement, because a
	-- participation reward is a win, not a shame state. Leavers forfeit: we pay
	-- current crew_members who dug, exactly like the ranked branch above.
	FOR t IN SELECT * FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NULL
		ORDER BY rt.crew_name
	LOOP
		FOR m IN SELECT cm.user_id FROM public.crew_members cm
			WHERE cm.crew_id = t.crew_id ORDER BY cm.user_id
		LOOP
			tix := 0;
			dug := EXISTS (SELECT 1 FROM public.race_digs d
				WHERE d.cycle_key = p_cycle AND d.user_id = m.user_id AND d.crew_id = t.crew_id);

			IF dug THEN
				tix := public._race_tickles_for_rank(0, 0);   -- participation floor
				BEGIN PERFORM public.grant_tickles(m.user_id, tix);
				EXCEPTION WHEN OTHERS THEN NULL; END;

				BEGIN
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					VALUES (m.user_id, 'race_result', 'You dug this week',
						t.crew_name || ' didn''t reach the ranked field, but your digging '
						|| 'counted — ' || tix || ' tickles are yours.',
						jsonb_build_object('cycle_key', p_cycle, 'rank', NULL,
							'truffles', 0, 'tickles', tix));
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;

			members := members || jsonb_build_object(m.user_id::text, jsonb_build_object(
				'crew_id', t.crew_id, 'rank', NULL, 'of', ranked_n,
				'truffles_paid', 0, 'tickles_paid', tix, 'cosmetic_hat_id', NULL));
		END LOOP;
	END LOOP;

	UPDATE public.cycle_payouts
		SET detail = jsonb_build_object('ranked_count', ranked_n,
			'crews', crews_j, 'members', members)
		WHERE cycle_key = p_cycle;
	RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._race_pay_cycle(text) FROM PUBLIC, anon, authenticated;

-- ── 3. race_standings — carried VERBATIM from 20260720; + `prizes` config ────
-- The client reads `prizes` to render the spoils strip with SERVER-AUTHORITATIVE
-- numbers (server-config-over-constants). Amounts are read straight from the two
-- payout helpers so the strip can never drift from what the cycle actually pays.
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
	prizes    jsonb;
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

	-- The weekly spoils ladder — read from the payout helpers so it is exactly
	-- what the cycle pays. `upper`/`field` amounts are ranked_n-independent (the
	-- rank>=4 branch splits top-half vs the rest, both flat), so representative
	-- ranks resolve them: 4-of-100 lands in the top half, 4-of-4 does not.
	prizes := jsonb_build_object(
		'tickles', jsonb_build_object(
			'first',         public._race_tickles_for_rank(1, 3),
			'second',        public._race_tickles_for_rank(2, 3),
			'third',         public._race_tickles_for_rank(3, 3),
			'upper',         public._race_tickles_for_rank(4, 100),
			'field',         public._race_tickles_for_rank(4, 4),
			'participation', public._race_tickles_for_rank(0, 0)),
		'truffles', jsonb_build_object(
			'first',  public._race_truffles_for_rank(1, 3),
			'second', public._race_truffles_for_rank(2, 3),
			'third',  public._race_truffles_for_rank(3, 3),
			'upper',  public._race_truffles_for_rank(4, 100),
			'field',  public._race_truffles_for_rank(4, 4)));

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
		'season', season, 'mine_season', mine_season, 'prizes', prizes);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_standings() TO authenticated;
