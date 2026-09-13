-- Weekly Dig-Off tickle spoils should land as completed tickles, matching the
-- season-pass auto-apply rule from 20260812010000. They must not refill or
-- overfill user_items.item_count.
--
-- One-time repair: tegdirb and briguy have already received weekly spoils in
-- their ordinary tickle banks. Settle each bank first so its displayed balance
-- is materialized, apply the whole ordinary balance, then empty it. Sponsored
-- ad tickles live in sponsor_tickle_count and are deliberately untouched.

DO $repair_banked_tickles$
DECLARE
	player_name text;
	player_ids uuid[];
	player_id uuid;
	banked int;
BEGIN
	FOREACH player_name IN ARRAY ARRAY['tegdirb', 'briguy']
	LOOP
		SELECT array_agg(p.id ORDER BY p.id)
		INTO player_ids
		FROM public.profiles p
		WHERE lower(p.username) = player_name;

		IF COALESCE(cardinality(player_ids), 0) <> 1 THEN
			RAISE EXCEPTION 'Expected exactly one profile named %, found %',
				player_name, COALESCE(cardinality(player_ids), 0);
		END IF;

		player_id := player_ids[1];
		banked := public.settle_tickles(player_id);

		IF banked > 0 THEN
			UPDATE public.profiles
			SET tickles_earned = COALESCE(tickles_earned, 0) + banked,
			    counter = COALESCE(counter, 0) + banked
			WHERE id = player_id;

			UPDATE public.user_items
			SET item_count = 0
			WHERE user_id = player_id;
		END IF;
	END LOOP;
END
$repair_banked_tickles$;

-- Carry-latest-def: _race_pay_cycle from
-- 20260778000000_overall_digoff_plain_spoils.sql. The only payout behavior
-- change is grant_tickles(user, amount) -> a direct profiles counter update.
-- The existing tickles_paid receipt key stays stable for shipped clients.
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
					UPDATE public.profiles
					SET tickles_earned = COALESCE(tickles_earned, 0) + tix,
					    counter = COALESCE(counter, 0) + tix
					WHERE id = m.user_id;
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

REVOKE ALL ON FUNCTION public._race_pay_cycle(text)
	FROM PUBLIC, anon, authenticated;
