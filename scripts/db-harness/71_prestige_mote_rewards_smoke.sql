-- Exercise the actual production pass/Contraption RPCs on the throwaway DB.
\set ON_ERROR_STOP on
INSERT INTO public.seasons (id, name, starts_at, ends_at, total_tiers, xp_per_tier)
VALUES ('mote_prestige_smoke', 'Mote Prestige', now() - interval '1 day', now() + interval '30 days', 25, 100);
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons LANGUAGE sql STABLE AS $$
  SELECT * FROM public.seasons WHERE id = 'mote_prestige_smoke';
$$;
INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label)
VALUES ('mote_prestige_smoke', 1, 'free', 'tickles', '{"amount":25}', '25 tickles');

DO $smoke$
DECLARE
  pig uuid;
  test_rank int;
  r jsonb;
  s jsonb;
  wallet int;
  counter_before int;
  acorns int;
BEGIN
  FOR test_rank IN 0..6 LOOP
    pig := ('00000000-0000-0000-0000-' || lpad((71000 + test_rank)::text, 12, '0'))::uuid;
    INSERT INTO auth.users(id) VALUES (pig);
    INSERT INTO public.profiles(id, username, wallow_count, mote_balance, counter, golden_truffles)
      VALUES (pig, 'mote-test_rank-' || test_rank, test_rank, 0, 0, 999);
    INSERT INTO public.user_items(user_id, item_count) VALUES (pig, 10);
    INSERT INTO public.user_season_progress(user_id, season_id, xp, wallow_count)
      VALUES (pig, 'mote_prestige_smoke', CASE WHEN test_rank = 0 THEN 2500 ELSE 5000 END,
        CASE WHEN test_rank = 0 THEN 0 ELSE 1 END);
    PERFORM set_config('smoke.uid', pig::text, true);
    s := public.season_state();
    IF (s->>'motes')::int <> 0
      OR jsonb_array_length(s->'wallow_tiers') <> (CASE WHEN test_rank < 3 THEN 5 ELSE 10 END) THEN
      RAISE EXCEPTION 'test_rank % catalog/wallet mismatch: %', test_rank, s;
    END IF;
    -- Original rewards already collected: only the new tiers should be ready.
    IF test_rank > 0 THEN
      INSERT INTO public.user_wallow_tier_claims(user_id, season_id, wallow_lap, tier)
        SELECT pig, 'mote_prestige_smoke', 1, tier FROM public.wallow_tiers WHERE reward_type <> 'motes';
    END IF;
    r := public.claim_wallow_tier(3);
    IF test_rank < 3 THEN
      IF r->>'reason' <> (CASE WHEN test_rank = 0 THEN 'not_in_wallow' ELSE 'no_reward' END) THEN
        RAISE EXCEPTION 'test_rank % must not get Motes: %', test_rank, r;
      END IF;
    ELSE
      IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'motes_granted')::int <> 1
        OR (r->>'motes_balance')::int <> 1 THEN
        RAISE EXCEPTION 'existing eligible test_rank % cannot claim reached tier: %', test_rank, r;
      END IF;
      r := public.claim_season_tier(3, 'premium');
      IF r->>'reason' <> 'already_claimed' THEN RAISE EXCEPTION 'duplicate granted: %', r; END IF;
    END IF;
    r := public.claim_ready_tiers('free');
    IF (r->>'failed')::int <> 0 OR COALESCE((r->>'motes')::int, 0) <> (CASE WHEN test_rank >= 3 THEN 4 ELSE 0 END) THEN
      RAISE EXCEPTION 'test_rank % claim-all wrong: %', test_rank, r;
    END IF;
    IF test_rank >= 3 AND NOT (r->'items' @> '["4 Motes"]'::jsonb) THEN
      RAISE EXCEPTION 'legacy summary must show Motes: %', r;
    END IF;
    r := public.claim_ready_tiers('free');
    IF (r->>'claimed_count')::int <> 0 OR (r->>'motes')::int <> 0 THEN
      RAISE EXCEPTION 'replayed sweep granted again: %', r;
    END IF;
    SELECT mote_balance INTO wallet FROM public.profiles WHERE id = pig;
    IF wallet <> (CASE WHEN test_rank >= 3 THEN 5 ELSE 0 END) THEN RAISE EXCEPTION 'test_rank % wallet %', test_rank, wallet; END IF;
    r := public.wallow();
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'wallow_count')::int <> test_rank + 1 THEN
      RAISE EXCEPTION 'test_rank % rollover blocked by hidden/already-claimed reward: %', test_rank, r;
    END IF;
    IF test_rank < 6 AND NOT EXISTS (SELECT 1 FROM public.user_hats uh
      JOIN public.wallow_rank_rewards wr ON wr.hat_id = uh.hat_id
      WHERE uh.user_id = pig AND wr.rank = test_rank + 1) THEN
      RAISE EXCEPTION 'test_rank hat lost for test_rank %', test_rank;
    END IF;
    r := public.claim_wallow_tier(3);
    IF test_rank >= 2 AND r->>'reason' <> 'tier_locked' THEN
      RAISE EXCEPTION 'new lap must earn fresh XP: %', r;
    END IF;
    -- Rollover never retroactively grants anything from the just-finished lap.
    IF (SELECT mote_balance FROM public.profiles WHERE id = pig) <> wallet THEN
      RAISE EXCEPTION 'rollover changed Mote wallet';
    END IF;
  END LOOP;

  -- Rank 6 in a fresh season still starts on the normal pass, then becomes
  -- eligible immediately after completing it. Single-tier router owns the path.
  pig := '00000000-0000-0000-0000-000000071006';
  PERFORM set_config('smoke.uid', pig::text, true);
  DELETE FROM public.user_wallow_tier_claims WHERE user_id = pig;
  UPDATE public.user_season_progress SET wallow_count = 0, xp = 2500 WHERE user_id = pig;
  r := public.claim_season_tier(3, 'free');
  IF r->>'reason' <> 'no_reward' THEN RAISE EXCEPTION 'base pass leaked Motes: %', r; END IF;
  r := public.claim_ready_tiers('free');
  IF (r->>'tickles')::int <> 25 OR (r->>'motes')::int <> 0 THEN
    RAISE EXCEPTION 'base rewards changed: %', r;
  END IF;
  r := public.wallow();
  IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'base pass rollover failed: %', r; END IF;
  UPDATE public.user_season_progress SET xp = 5000 WHERE user_id = pig;
  r := public.wallow();
  IF r->>'reason' <> 'claim_rewards_first' OR (r->>'unclaimed')::int <> 10 THEN
    RAISE EXCEPTION 'eligible rewards omitted from rollover gate: %', r;
  END IF;
  SELECT counter INTO counter_before FROM public.profiles WHERE id = pig;
  r := public.claim_ready_tiers('premium'); -- prestige always resolves free
  IF (r->>'claimed_count')::int <> 10 OR (r->>'motes')::int <> 5
    OR (r->>'failed')::int <> 0 OR jsonb_array_length(r->'mysteries') <> 1
    OR (SELECT amount FROM public.golden_truffle_overflow WHERE user_id = pig) <> 4
    OR (SELECT counter FROM public.profiles WHERE id = pig) <> counter_before + 375 + 50 THEN
    RAISE EXCEPTION 'original five rewards/overflow/mystery or new Motes changed: %', r;
  END IF;
  -- Claim -> machine -> durable Acorns -> inventory. Only the spend changes
  -- the Mote wallet. Spin replay cannot create a second receipt or reward.
  SELECT mote_balance INTO wallet FROM public.profiles WHERE id = pig;
  r := public.spin_mote_machine('prestige-earned-mote');
  IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'motes_remaining')::int <> wallet - 1
    OR (r->>'resource_amount')::int NOT IN (1, 2, 3, 5) THEN
    RAISE EXCEPTION 'earned Mote did not reach Contraption inventory: %', r;
  END IF;
  s := public.spin_mote_machine('prestige-earned-mote');
  IF (s->>'replayed')::boolean IS NOT TRUE OR s->>'spin_id' <> r->>'spin_id'
    OR (SELECT mote_balance FROM public.profiles WHERE id = pig) <> wallet - 1 THEN
    RAISE EXCEPTION 'receipt replay changed wallet: %', s;
  END IF;
  acorns := (r->>'resource_amount')::int;
  s := public.contraption_inventory();
  IF (s->>'ok')::boolean IS NOT TRUE
    OR s->'items'->0->>'contraption_id' IS DISTINCT FROM 'auto_tickler'
    OR (s->'items'->0->>'resource_balance')::int IS DISTINCT FROM acorns THEN
    RAISE EXCEPTION 'inventory does not match the earned-Mote receipt: %', s;
  END IF;
  s := public.activate_contraption('auto_tickler', 'day');
  IF (s->>'ok')::boolean IS NOT TRUE
    OR (s->>'cost')::int IS DISTINCT FROM 1
    OR (s->>'resource_balance')::int IS DISTINCT FROM acorns - 1
    OR (SELECT active_until FROM public.user_contraptions
      WHERE user_id = pig AND contraption_id = 'auto_tickler') IS DISTINCT FROM now() + interval '1 day'
    OR (SELECT mote_balance FROM public.profiles WHERE id = pig) IS DISTINCT FROM wallet - 1 THEN
    RAISE EXCEPTION 'earned Mote cannot wind the Auto-Tickler exactly once: %', s;
  END IF;

  -- A delayed request must not consume next-lap rewards even with enough
  -- overflow XP to reach them immediately after rollover.
  r := public.wallow();
  IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'rollover before stale retry: %', r; END IF;
  UPDATE public.user_season_progress SET xp = 7500 WHERE user_id = pig;
  SELECT mote_balance INTO wallet FROM public.profiles WHERE id = pig;
  r := public.claim_season_tier(3, 'free', 'mote_prestige_smoke', 1);
  s := public.claim_ready_tiers('free', 'mote_prestige_smoke', 1);
  IF r->>'reason' IS DISTINCT FROM 'pass_changed' OR s->>'reason' IS DISTINCT FROM 'pass_changed'
    OR (SELECT mote_balance FROM public.profiles WHERE id = pig) <> wallet THEN
    RAISE EXCEPTION 'old-lap retries claimed from the next lap: %, %', r, s;
  END IF;
  r := public.claim_season_tier(3, 'free', 'previous_season', 2);
  IF r->>'reason' IS DISTINCT FROM 'pass_changed' THEN RAISE EXCEPTION 'old-season retry accepted: %', r; END IF;
  r := public.claim_season_tier(3, 'free', 'mote_prestige_smoke', 2);
  IF (r->>'motes_granted')::int IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'fresh-lap request rejected: %', r; END IF;

  PERFORM set_config('smoke.uid', '', true);
  r := public.claim_wallow_tier(3);
  IF r->>'reason' <> 'unauthenticated' THEN RAISE EXCEPTION 'anonymous grant: %', r; END IF;
  IF has_function_privilege('authenticated', 'public._eligible_wallow_tiers()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public._claim_wallow_tier_before_motes(int)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public._claim_season_tier_before_mote_context(int,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public._claim_ready_tiers_before_mote_context(text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_wallow_tier(int)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_season_tier(int,text,text,int)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_ready_tiers(text,text,int)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.wallow_tiers', 'UPDATE') THEN
    RAISE EXCEPTION 'internal catalog/claimer permission leak';
  END IF;
  RAISE NOTICE 'chk prestige Motes: ranks, current-lap catch-up, retries, all claims, rollover, original rewards, fresh season and machine receipt OK';
END;
$smoke$;

-- Real concurrent connections, authenticated RPC calls, and bounded waits.
-- One transaction holds the profile lock while the other starts its operation.
CREATE EXTENSION IF NOT EXISTS dblink;
INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000071010'), ('00000000-0000-0000-0000-000000071011');
INSERT INTO public.profiles(id, username, wallow_count, mote_balance) VALUES
  ('00000000-0000-0000-0000-000000071010', 'mote-concurrent-claims', 3, 1),
  ('00000000-0000-0000-0000-000000071011', 'mote-concurrent-spend', 3, 1);
INSERT INTO public.user_season_progress(user_id, season_id, xp, wallow_count) VALUES
  ('00000000-0000-0000-0000-000000071010', 'mote_prestige_smoke', 5000, 1),
  ('00000000-0000-0000-0000-000000071011', 'mote_prestige_smoke', 5000, 1);
INSERT INTO public.user_items(user_id, item_count) VALUES
  ('00000000-0000-0000-0000-000000071010', 10), ('00000000-0000-0000-0000-000000071011', 10);
DO $concurrent$
DECLARE
  conn text := 'host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  r jsonb;
  s jsonb;
  direction int;
BEGIN
  PERFORM dblink_connect('mote_a', conn);
  PERFORM dblink_connect('mote_b', conn);
  PERFORM dblink_exec('mote_a', 'SET ROLE authenticated');
  PERFORM dblink_exec('mote_b', 'SET ROLE authenticated');
  PERFORM dblink_exec('mote_a', 'SET smoke.uid = ''00000000-0000-0000-0000-000000071010''');
  PERFORM dblink_exec('mote_b', 'SET smoke.uid = ''00000000-0000-0000-0000-000000071010''');
  PERFORM dblink_exec('mote_a', 'BEGIN');
  SELECT data INTO r FROM dblink('mote_a', 'SELECT public.claim_season_tier(3, ''free'')') AS result(data jsonb);
  PERFORM dblink_send_query('mote_b', 'SELECT public.claim_ready_tiers(''free'')');
  PERFORM dblink_exec('mote_a', 'COMMIT');
  SELECT data INTO s FROM dblink_get_result('mote_b') AS result(data jsonb);
  PERFORM data FROM dblink_get_result('mote_b') AS result(data jsonb);
  IF (r->>'motes_granted')::int <> 1 OR (s->>'motes')::int <> 4
    OR (s->>'failed')::int <> 0
    OR (SELECT mote_balance FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000071010') <> 6 THEN
    RAISE EXCEPTION 'concurrent single + claim-all duplicated/lost a grant: %, %', r, s;
  END IF;

  PERFORM dblink_exec('mote_a', 'SET smoke.uid = ''00000000-0000-0000-0000-000000071011''');
  PERFORM dblink_exec('mote_b', 'SET smoke.uid = ''00000000-0000-0000-0000-000000071011''');
  -- Exercise both lock acquisition orders: spend then grant; grant then spend.
  FOR direction IN 0..1 LOOP
    PERFORM dblink_exec('mote_a', 'BEGIN');
    IF direction = 0 THEN
      SELECT data INTO r FROM dblink('mote_a', 'SELECT public.spin_mote_machine(''prestige-concurrent-1'')') AS result(data jsonb);
      PERFORM dblink_send_query('mote_b', 'SELECT public.claim_wallow_tier(3)');
    ELSE
      SELECT data INTO r FROM dblink('mote_a', 'SELECT public.claim_wallow_tier(8)') AS result(data jsonb);
      PERFORM dblink_send_query('mote_b', 'SELECT public.spin_mote_machine(''prestige-concurrent-2'')');
    END IF;
    PERFORM dblink_exec('mote_a', 'COMMIT');
    SELECT data INTO s FROM dblink_get_result('mote_b') AS result(data jsonb);
    PERFORM data FROM dblink_get_result('mote_b') AS result(data jsonb);
    IF (r->>'ok')::boolean IS NOT TRUE OR (s->>'ok')::boolean IS NOT TRUE
      OR (SELECT mote_balance FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000071011') <> 1 THEN
      RAISE EXCEPTION 'concurrent spend/claim order % lost a wallet update: %, %', direction, r, s;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.mote_machine_spins WHERE user_id = '00000000-0000-0000-0000-000000071011') <> 2 THEN
    RAISE EXCEPTION 'concurrent spend receipt count mismatch';
  END IF;
  PERFORM dblink_disconnect('mote_a');
  PERFORM dblink_disconnect('mote_b');
  RAISE NOTICE 'chk prestige Motes: authenticated concurrent single/all claims and both spend/grant orders OK';
END;
$concurrent$;
