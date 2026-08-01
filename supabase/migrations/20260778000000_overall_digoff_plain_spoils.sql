-- DIG-OFF: MOST FINDS WINS + PLAIN-CURRENCY SPOILS
--
-- Product decisions #46/#50:
--   * weekly rank is dense-ranked by total_finds, not finds per snout;
--   * every non-bot Sounder with at least one find ranks (no quorum);
--   * podium pays Golden Truffles + spendable tickles only. The rotating
--     cosmetic queue, fallback wearable, and owns-everything compensation retire.
--
-- CARRY-LATEST-DEF:
--   * _race_table is carried from 20260719000000 with only ranking/quorum edits.
--   * _race_pay_cycle is carried from 20260767000000 with the cosmetic and
--     now-unreachable sub-quorum branches removed.
-- race_standings(), race_history(), and race_crew_detail() all consume
-- _race_table, so the live board, archive, and payout agree automatically.

CREATE OR REPLACE FUNCTION public._race_table(p_cycle text)
RETURNS TABLE (crew_id uuid, crew_name text, avg numeric, diggers int,
               total_finds int, roster_size int, rnk int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH per_crew AS (
		SELECT d.crew_id,
		       round(sum(d.finds)::numeric / count(DISTINCT d.user_id), 1) AS avg,
		       count(DISTINCT d.user_id)::int AS diggers,
		       COALESCE(sum(d.finds), 0)::int AS total_finds
		FROM public.race_digs d
		JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
		WHERE d.cycle_key = p_cycle
		GROUP BY d.crew_id
		HAVING COALESCE(sum(d.finds), 0) >= 1
	),
	ranked AS (
		SELECT pc.crew_id,
		       (DENSE_RANK() OVER (ORDER BY pc.total_finds DESC))::int AS rnk
		FROM per_crew pc
	)
	SELECT pc.crew_id, c.name, pc.avg, pc.diggers, pc.total_finds,
	       (SELECT count(*)::int FROM public.crew_members cm
	        WHERE cm.crew_id = pc.crew_id),
	       r.rnk
	FROM per_crew pc
	JOIN public.crews c ON c.id = pc.crew_id
	JOIN ranked r ON r.crew_id = pc.crew_id;
$function$;
REVOKE ALL ON FUNCTION public._race_table(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._race_pay_cycle(p_cycle text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	landed   int;
	ranked_n int;
	t        record;
	m        record;
	amt      int;
	tix      int;
	dug      boolean;
	members  jsonb := '{}'::jsonb;
	crews_j  jsonb := '[]'::jsonb;
BEGIN
	INSERT INTO public.cycle_payouts (cycle_key)
		VALUES (p_cycle) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed = 0 THEN RETURN false; END IF;

	SELECT count(*) INTO ranked_n
		FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL;

	FOR t IN
		SELECT * FROM public._race_table(p_cycle) rt
		WHERE rt.rnk IS NOT NULL
		ORDER BY rt.rnk, rt.crew_name
	LOOP
		crews_j := crews_j || jsonb_build_object(
			'crew_id', t.crew_id, 'rank', t.rnk, 'avg', t.avg,
			'diggers', t.diggers, 'total_finds', t.total_finds);

		FOR m IN
			SELECT cm.user_id FROM public.crew_members cm
			WHERE cm.crew_id = t.crew_id ORDER BY cm.user_id
		LOOP
			amt := 0;
			tix := 0;
			dug := EXISTS (
				SELECT 1 FROM public.race_digs d
				WHERE d.cycle_key = p_cycle
				  AND d.user_id = m.user_id
				  AND d.crew_id = t.crew_id
			);

			IF dug THEN
				amt := public._race_truffles_for_rank(t.rnk, ranked_n);
				BEGIN
					PERFORM public.mint_truffles(m.user_id, amt, 'race_rank', NULL);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;

				tix := public._race_tickles_for_rank(t.rnk, ranked_n);
				BEGIN
					PERFORM public.grant_tickles(m.user_id, tix);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;

				BEGIN
					PERFORM public.try_claim_achievements(m.user_id, 'truffles_dug');
				EXCEPTION WHEN OTHERS THEN NULL;
				END;
			END IF;

			members := members || jsonb_build_object(
				m.user_id::text,
				jsonb_build_object(
					'crew_id', t.crew_id,
					'rank', t.rnk,
					'of', ranked_n,
					'truffles_paid', amt,
					'tickles_paid', tix,
					'cosmetic_hat_id', NULL
				)
			);

			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (
					m.user_id,
					'race_result',
					'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
						CASE WHEN amt > 0
							THEN ' — ' || amt || ' Golden Truffles and ' || tix ||
								' tickles are yours.'
							ELSE '.'
						END,
					jsonb_build_object(
						'cycle_key', p_cycle,
						'rank', t.rnk,
						'of', ranked_n,
						'truffles', amt,
						'tickles', tix,
						'hat_id', NULL
					)
				);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;

			BEGIN
				PERFORM public.send_push_to_user(
					m.user_id,
					'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
						' — your spoils are in.',
					jsonb_build_object(
						'kind', 'race_end',
						'cycle_key', p_cycle,
						'screen', 'season'
					)
				);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;
		END LOOP;
	END LOOP;

	UPDATE public.cycle_payouts
	SET detail = jsonb_build_object(
		'ranked_count', ranked_n,
		'crews', crews_j,
		'members', members
	)
	WHERE cycle_key = p_cycle;

	RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._race_pay_cycle(text) FROM PUBLIC, anon, authenticated;

