\set ON_ERROR_STOP on

-- The production migration defaults Wager off. Only this throwaway database
-- enables it, then drives deterministic outcome branches by temporarily
-- replacing the private random-bucket helper.
UPDATE public.app_settings SET value='true'::jsonb WHERE key='mote_wager_enabled';

DO $secure_random$
DECLARE i int; n int;
BEGIN
  FOR i IN 1..100 LOOP
    n:=public._mote_secure_bucket(10000);
    IF n<0 OR n>=10000 THEN RAISE EXCEPTION 'secure bucket out of range: %',n; END IF;
  END LOOP;
  RAISE NOTICE 'chk mote wagering v2: pgcrypto rejection-sampling bucket range OK';
END $secure_random$;

CREATE OR REPLACE FUNCTION public._mote_smoke_force(p_outcome text, p_loss int DEFAULT 0)
RETURNS void LANGUAGE plpgsql AS $function$
DECLARE bucket int := CASE p_outcome WHEN 'big' THEN 100 WHEN 'jackpot' THEN 650 WHEN 'loss' THEN 2000
  WHEN 'returned_stake' THEN 6000 WHEN 'small' THEN 9000
  WHEN 'reveal_big' THEN 100 WHEN 'reveal_jackpot' THEN 1700
  WHEN 'reveal_legacy' THEN 3000 WHEN 'reveal_small' THEN 8500 ELSE 0 END;
BEGIN
  EXECUTE format('CREATE OR REPLACE FUNCTION public._mote_secure_bucket(p_size int) RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $b$ BEGIN RETURN CASE WHEN p_size=4 THEN %s ELSE %s END; END $b$',p_loss,bucket);
END;
$function$;

DO $smoke$
DECLARE pig uuid:='00000000-0000-0000-0000-000000072001'; other uuid:='00000000-0000-0000-0000-000000072002';
  r jsonb; s jsonb; before_rev bigint; i int; expected_outcome text; expected_return int; expected_acorns int;
BEGIN
  INSERT INTO auth.users(id) VALUES(pig),(other);
  INSERT INTO public.profiles(id,username,mote_balance) VALUES(pig,'wager-v2',100),(other,'wager-other',10);
  INSERT INTO public.user_items(user_id,item_count) VALUES(pig,0),(other,0);
  PERFORM set_config('smoke.uid',pig::text,true);

  r:=public.mote_game_state();
  IF NOT (r->>'wager_enabled')::boolean OR r#>>'{rules_versions,wager}'<>'wager-v1'
    OR (r#>>'{wallet,motes}')::int<>100 THEN RAISE EXCEPTION 'bad game state %',r; END IF;

  FOR i IN 1..5 LOOP
    expected_outcome:=CASE i WHEN 1 THEN 'loss' WHEN 2 THEN 'returned_stake' WHEN 3 THEN 'small' WHEN 4 THEN 'big' ELSE 'jackpot' END;
    expected_return:=CASE i WHEN 1 THEN 0 WHEN 2 THEN 3 WHEN 3 THEN 6 WHEN 4 THEN 9 ELSE 30 END;
    expected_acorns:=CASE i WHEN 4 THEN 3 WHEN 5 THEN 15 ELSE 0 END;
    PERFORM public._mote_smoke_force(expected_outcome,i%4);
    r:=public.play_mote_game('wager-exact-'||i,'wager',3,'wager-v1');
    IF NOT (r->>'ok')::boolean OR r#>>'{receipt,outcome}'<>expected_outcome
      OR (r#>>'{receipt,motes_returned}')::int<>expected_return
      OR (r#>>'{receipt,net_motes}')::int<>expected_return-3
      OR (r#>>'{receipt,resource_amount}')::int<>expected_acorns
      OR (r#>>'{receipt,stake_motes}')::int<>3 THEN RAISE EXCEPTION 'exact outcome % wrong: %',expected_outcome,r; END IF;
  END LOOP;

  -- Replay returns immutable facts but a current wallet after intervening spend.
  r:=public.play_mote_game('wager-exact-5','wager',3,'wager-v1');
  IF NOT (r->>'replayed')::boolean THEN RAISE EXCEPTION 'replay not marked %',r; END IF;
  s:=public.play_mote_game('wager-exact-5','wager',1,'wager-v1');
  IF s->>'reason'<>'request_conflict' THEN RAISE EXCEPTION 'changed replay accepted %',s; END IF;
  UPDATE public.profiles SET mote_balance=mote_balance-1 WHERE id=pig;
  s:=public.play_mote_game('wager-exact-5','wager',3,'wager-v1');
  IF (s#>>'{wallet,motes}')::int=(s#>>'{receipt,motes_remaining}')::int THEN RAISE EXCEPTION 'replay overwrote current wallet %',s; END IF;

  -- Lookup/history are owner scoped; cursor page is bounded and usable.
  r:=public.mote_play_receipt('wager-exact-1');
  IF r#>>'{receipt,request_id}'<>'wager-exact-1' THEN RAISE EXCEPTION 'lookup failed %',r; END IF;
  r:=public.mote_play_history(NULL,2);
  IF jsonb_array_length(r->'plays')<>2 OR r->>'next_cursor' IS NULL THEN RAISE EXCEPTION 'history page failed %',r; END IF;
  s:=public.mote_play_history(r->>'next_cursor',2);
  IF jsonb_array_length(s->'plays')<>2 THEN RAISE EXCEPTION 'history cursor failed %',s; END IF;
  PERFORM set_config('smoke.uid',other::text,true);
  r:=public.mote_play_receipt('wager-exact-1');
  IF r->'receipt'<>'null'::jsonb THEN RAISE EXCEPTION 'cross-owner receipt leak %',r; END IF;

  -- Validation and feature flag refuse before any wallet update.
  PERFORM set_config('smoke.uid',pig::text,true);
  SELECT mote_wallet_revision INTO before_rev FROM public.profiles WHERE id=pig;
  r:=public.play_mote_game('wager-stale-01','wager',1,'wager-v0');
  IF r->>'reason'<>'rules_changed' THEN RAISE EXCEPTION 'stale rules accepted %',r; END IF;
  r:=public.play_mote_game('wager-stake-00','wager',2,'wager-v1');
  IF r->>'reason'<>'bad_stake' THEN RAISE EXCEPTION 'bad stake accepted %',r; END IF;
  UPDATE public.app_settings SET value='false'::jsonb WHERE key='mote_wager_enabled';
  r:=public.play_mote_game('wager-flagoff1','wager',1,'wager-v1');
  IF r->>'reason'<>'wager_disabled' THEN RAISE EXCEPTION 'flag off accepted %',r; END IF;
  IF (SELECT mote_wallet_revision FROM public.profiles WHERE id=pig)<>before_rev THEN RAISE EXCEPTION 'refusal mutated wallet'; END IF;
  UPDATE public.app_settings SET value='true'::jsonb WHERE key='mote_wager_enabled';

  -- Reveal v2 remains guaranteed; legacy Reveal still spends once and grants.
  PERFORM public._mote_smoke_force('big');
  r:=public.play_mote_game('reveal-v2-one','reveal',1,'reveal-v1');
  IF (r#>>'{receipt,resource_amount}')::int<>3 OR r#>>'{receipt,reel_value}'<>'10' THEN RAISE EXCEPTION 'v2 reveal changed %',r; END IF;
  r:=public.spin_mote_machine('legacy-reveal-one');
  IF (r->>'resource_amount')::int NOT IN (1,2,3,5) THEN RAISE EXCEPTION 'legacy reveal changed %',r; END IF;
  s:=public.spin_mote_machine('legacy-reveal-one');
  IF NOT (s->>'replayed')::boolean THEN RAISE EXCEPTION 'legacy replay failed %',s; END IF;

  -- Central revision fires for real Shimmer and prestige wallet writers too.
  SELECT mote_wallet_revision INTO before_rev FROM public.profiles WHERE id=pig;
  UPDATE public.profiles SET mote_balance=mote_balance+1 WHERE id=pig;
  IF (SELECT mote_wallet_revision FROM public.profiles WHERE id=pig)<>before_rev+1 THEN RAISE EXCEPTION 'central revision missed grant'; END IF;

  RAISE NOTICE 'chk mote wagering v2: exact outcomes/stakes, v1+v2 Reveal, owner recovery/history, flag, revisions OK';
END $smoke$;

DO $all_exact$
DECLARE pig uuid:='00000000-0000-0000-0000-000000072001'; stake int; outcome text; r jsonb;
  multiplier int; acorn_multiplier int; reveal_case text; expected_acorns int;
BEGIN
  PERFORM set_config('smoke.uid',pig::text,true);
  FOR stake IN SELECT unnest(ARRAY[1,3,5]) LOOP
    FOREACH outcome IN ARRAY ARRAY['loss','returned_stake','small','big','jackpot'] LOOP
      multiplier:=CASE outcome WHEN 'loss' THEN 0 WHEN 'returned_stake' THEN 1 WHEN 'small' THEN 2 WHEN 'big' THEN 3 ELSE 10 END;
      acorn_multiplier:=CASE outcome WHEN 'big' THEN 1 WHEN 'jackpot' THEN 5 ELSE 0 END;
      PERFORM public._mote_smoke_force(outcome);
      r:=public.play_mote_game('all-'||stake||'-'||outcome,'wager',stake,'wager-v1');
      IF r#>>'{receipt,outcome}'<>outcome
        OR (r#>>'{receipt,motes_returned}')::int<>stake*multiplier
        OR (r#>>'{receipt,net_motes}')::int<>stake*(multiplier-1)
        OR (r#>>'{receipt,resource_amount}')::int<>stake*acorn_multiplier
      THEN RAISE EXCEPTION 'stake/outcome exactness failed %, %: %',stake,outcome,r; END IF;
    END LOOP;
  END LOOP;
  FOR expected_acorns IN 1..4 LOOP
    reveal_case:=CASE expected_acorns WHEN 1 THEN 'reveal_legacy' WHEN 2 THEN 'reveal_small' WHEN 3 THEN 'reveal_big' ELSE 'reveal_jackpot' END;
    PERFORM public._mote_smoke_force(reveal_case);
    r:=public.play_mote_game('reveal-all-'||expected_acorns,'reveal',1,'reveal-v1');
    IF (r#>>'{receipt,resource_amount}')::int<>(CASE expected_acorns WHEN 4 THEN 5 ELSE expected_acorns END)
      OR r#>>'{receipt,outcome}'<>'legacy_resource'
      OR (r#>>'{receipt,reel_value}')::int<>(CASE expected_acorns WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 ELSE 25 END)
      OR r#>'{receipt,reel_stops}'<>jsonb_build_array(
        CASE expected_acorns WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 ELSE 25 END,
        CASE expected_acorns WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 ELSE 25 END,
        CASE expected_acorns WHEN 1 THEN 3 WHEN 2 THEN 5 WHEN 3 THEN 10 ELSE 25 END)
    THEN RAISE EXCEPTION 'Reveal reward exactness failed %: %',expected_acorns,r; END IF;
  END LOOP;
  RAISE NOTICE 'chk mote wagering v2: all 5 outcomes x stakes 1/3/5 + all Reveal rewards exact';
END $all_exact$;

-- Adapt a pre-Contraption Tickle receipt without inventing unknown resource or
-- revision facts, then prove lookup/history mix both protocols owner-only.
INSERT INTO public.mote_machine_spins(user_id,request_id,reward_tickles,motes_remaining,tickles_balance,spun_at)
VALUES('00000000-0000-0000-0000-000000072001','legacy-tickle-history',3,7,12,'2026-01-01T00:00:00Z');
INSERT INTO public.mote_machine_spins(user_id,request_id,reward_tickles,motes_remaining,tickles_balance,spun_at)
SELECT '00000000-0000-0000-0000-000000072001','legacy-equal-time',5,6,17,created_at
FROM public.mote_game_plays WHERE user_id='00000000-0000-0000-0000-000000072001' AND request_id='all-1-loss';
DO $legacy_adapter$
DECLARE pig uuid:='00000000-0000-0000-0000-000000072001'; r jsonb; cursor_value text:=NULL; ids text[]:=ARRAY[]::text[]; row jsonb; turns int:=0;
BEGIN
  PERFORM set_config('smoke.uid',pig::text,true);
  r:=public.mote_play_receipt('legacy-tickle-history');
  IF (r#>>'{receipt,protocol_version}')::int<>1 OR r#>>'{receipt,outcome}'<>'legacy_resource'
    OR (r#>>'{receipt,reward_tickles}')::int<>3 OR (r#>>'{receipt,tickles_balance}')::int<>12
    OR r#>'{receipt,wallet_revision}'<>'null'::jsonb OR r#>'{receipt,resource_amount}'<>'null'::jsonb
    OR r#>'{receipt,reel_stops}'<>'null'::jsonb
  THEN RAISE EXCEPTION 'legacy Tickle adapter wrong: %',r; END IF;
  r:=public.mote_play_receipt('legacy-reveal-one');
  IF (r#>>'{receipt,protocol_version}')::int<>1 OR r#>>'{receipt,contraption_id}'<>'auto_tickler'
    OR (r#>>'{receipt,resource_amount}')::int NOT IN (1,2,3,5)
  THEN RAISE EXCEPTION 'legacy Contraption adapter wrong: %',r; END IF;
  r:=public.mote_play_history(NULL,50);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'plays') x
      WHERE x->>'request_id'='legacy-tickle-history' AND (x->>'protocol_version')::int=1)
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'plays') x
      WHERE x->>'request_id'='all-1-loss' AND (x->>'protocol_version')::int=2)
  THEN RAISE EXCEPTION 'mixed protocol history missing rows: %',r; END IF;
  LOOP
    r:=public.mote_play_history(cursor_value,2); turns:=turns+1;
    FOR row IN SELECT value FROM jsonb_array_elements(r->'plays') LOOP ids:=array_append(ids,row->>'request_id'); END LOOP;
    cursor_value:=r->>'next_cursor'; EXIT WHEN cursor_value IS NULL OR turns>100;
  END LOOP;
  IF NOT ('legacy-equal-time'=ANY(ids)) OR NOT ('all-1-loss'=ANY(ids))
    OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x)
  THEN RAISE EXCEPTION 'mixed cursor duplicate/omission: %',ids; END IF;
  RAISE NOTICE 'chk mote wagering v2: owner lookup + mixed v1/v2 history adapter OK';
END $legacy_adapter$;

-- A forced receipt failure must roll back wallet and inventory as one unit.
CREATE FUNCTION public._mote_smoke_reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.request_id='rollback-v2-one' THEN RAISE EXCEPTION 'forced receipt failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER mote_smoke_reject_receipt BEFORE INSERT ON public.mote_game_plays
  FOR EACH ROW EXECUTE FUNCTION public._mote_smoke_reject_receipt();
DO $rollback$
DECLARE pig uuid:='00000000-0000-0000-0000-000000072001'; wallet int; acorns int; failed boolean:=false;
BEGIN
  PERFORM set_config('smoke.uid',pig::text,true);
  SELECT mote_balance INTO wallet FROM public.profiles WHERE id=pig;
  SELECT resource_balance INTO acorns FROM public.user_contraptions WHERE user_id=pig AND contraption_id='auto_tickler';
  PERFORM public._mote_smoke_force('jackpot');
  BEGIN PERFORM public.play_mote_game('rollback-v2-one','wager',5,'wager-v1'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed OR (SELECT mote_balance FROM public.profiles WHERE id=pig)<>wallet
    OR (SELECT resource_balance FROM public.user_contraptions WHERE user_id=pig AND contraption_id='auto_tickler')<>acorns
    OR EXISTS(SELECT 1 FROM public.mote_game_plays WHERE user_id=pig AND request_id='rollback-v2-one')
  THEN RAISE EXCEPTION 'failed settlement did not roll back'; END IF;
  RAISE NOTICE 'chk mote wagering v2: forced receipt failure rolls back wallet + inventory';
END $rollback$;
DROP TRIGGER mote_smoke_reject_receipt ON public.mote_game_plays;
DROP FUNCTION public._mote_smoke_reject_receipt();

-- Real connections prove duplicate and distinct concurrent commands serialize
-- on the profile. With five Motes and two stake-three losses, exactly one wins.
UPDATE public.profiles SET mote_balance=5 WHERE id='00000000-0000-0000-0000-000000072002';
SELECT public._mote_smoke_force('loss');
DO $concurrent$
DECLARE conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  pig uuid:='00000000-0000-0000-0000-000000072002'; a jsonb; b jsonb; successes int;
BEGIN
  PERFORM dblink_connect('wager_a',conn); PERFORM dblink_connect('wager_b',conn);
  PERFORM dblink_exec('wager_a','SET ROLE authenticated'); PERFORM dblink_exec('wager_b','SET ROLE authenticated');
  PERFORM dblink_exec('wager_a','SET smoke.uid = '''||pig||''''); PERFORM dblink_exec('wager_b','SET smoke.uid = '''||pig||'''');
  PERFORM dblink_send_query('wager_a','SELECT public.play_mote_game(''concurrent-a1'',''wager'',3,''wager-v1'')');
  PERFORM dblink_send_query('wager_b','SELECT public.play_mote_game(''concurrent-b1'',''wager'',3,''wager-v1'')');
  SELECT data INTO a FROM dblink_get_result('wager_a') AS x(data jsonb); PERFORM data FROM dblink_get_result('wager_a') AS x(data jsonb);
  SELECT data INTO b FROM dblink_get_result('wager_b') AS x(data jsonb); PERFORM data FROM dblink_get_result('wager_b') AS x(data jsonb);
  successes:=(CASE WHEN (a->>'ok')::boolean THEN 1 ELSE 0 END)
    +(CASE WHEN (b->>'ok')::boolean THEN 1 ELSE 0 END);
  IF successes<>1 OR (SELECT mote_balance FROM public.profiles WHERE id=pig)<>2
    OR (SELECT count(*) FROM public.mote_game_plays WHERE user_id=pig AND request_id IN ('concurrent-a1','concurrent-b1'))<>1
  THEN RAISE EXCEPTION 'distinct concurrency wrong: %, %',a,b; END IF;
  PERFORM dblink_exec('wager_a','RESET ROLE');
  PERFORM dblink_exec('wager_a','UPDATE public.profiles SET mote_balance=3 WHERE id='''||pig||'''');
  PERFORM dblink_exec('wager_a','SET ROLE authenticated');
  PERFORM dblink_send_query('wager_a','SELECT public.play_mote_game(''concurrent-same'',''wager'',3,''wager-v1'')');
  PERFORM dblink_send_query('wager_b','SELECT public.play_mote_game(''concurrent-same'',''wager'',3,''wager-v1'')');
  SELECT data INTO a FROM dblink_get_result('wager_a') AS x(data jsonb); PERFORM data FROM dblink_get_result('wager_a') AS x(data jsonb);
  SELECT data INTO b FROM dblink_get_result('wager_b') AS x(data jsonb); PERFORM data FROM dblink_get_result('wager_b') AS x(data jsonb);
  IF NOT (a->>'ok')::boolean OR NOT (b->>'ok')::boolean OR a->'receipt'<>b->'receipt'
    OR (SELECT count(*) FROM public.mote_game_plays WHERE user_id=pig AND request_id='concurrent-same')<>1
  THEN RAISE EXCEPTION 'duplicate concurrency wrong: %, %',a,b; END IF;
  PERFORM dblink_disconnect('wager_a'); PERFORM dblink_disconnect('wager_b');
  RAISE NOTICE 'chk mote wagering v2: concurrent distinct affordability + duplicate idempotency OK';
END $concurrent$;

-- The authenticated role cannot bypass RPC settlement or forge revisions.
DO $privileges$
BEGIN
  IF has_column_privilege('authenticated','public.profiles','mote_balance','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','mote_wallet_revision','UPDATE')
    OR has_table_privilege('authenticated','public.mote_game_plays','INSERT')
    OR has_table_privilege('authenticated','public.mote_game_plays','UPDATE')
  THEN RAISE EXCEPTION 'authenticated role retained a direct Mote mutation path'; END IF;
  RAISE NOTICE 'chk mote wagering v2: direct wallet/revision/receipt mutation denied';
END $privileges$;

-- V2 settlement shares the real profile lock with a real prestige claim.
UPDATE public.profiles SET mote_balance=1 WHERE id='00000000-0000-0000-0000-000000071011';
DO $prestige_concurrent$
DECLARE conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  pig uuid:='00000000-0000-0000-0000-000000071011'; a jsonb; b jsonb;
BEGIN
  PERFORM dblink_connect('v2_prestige_a',conn); PERFORM dblink_connect('v2_prestige_b',conn);
  PERFORM dblink_exec('v2_prestige_a','SET ROLE authenticated'); PERFORM dblink_exec('v2_prestige_b','SET ROLE authenticated');
  PERFORM dblink_exec('v2_prestige_a','SET smoke.uid = '''||pig||''''); PERFORM dblink_exec('v2_prestige_b','SET smoke.uid = '''||pig||'''');
  PERFORM dblink_send_query('v2_prestige_a','SELECT public.play_mote_game(''v2-prestige-race'',''wager'',1,''wager-v1'')');
  PERFORM dblink_send_query('v2_prestige_b','SELECT public.claim_wallow_tier(13)');
  SELECT data INTO a FROM dblink_get_result('v2_prestige_a') x(data jsonb); PERFORM data FROM dblink_get_result('v2_prestige_a') x(data jsonb);
  SELECT data INTO b FROM dblink_get_result('v2_prestige_b') x(data jsonb); PERFORM data FROM dblink_get_result('v2_prestige_b') x(data jsonb);
  IF NOT (a->>'ok')::boolean OR NOT (b->>'ok')::boolean OR (SELECT mote_balance FROM public.profiles WHERE id=pig)<>1
  THEN RAISE EXCEPTION 'v2/prestige concurrency lost update: %, %',a,b; END IF;
  PERFORM dblink_disconnect('v2_prestige_a'); PERFORM dblink_disconnect('v2_prestige_b');
  RAISE NOTICE 'chk mote wagering v2: concurrent real prestige grant + v2 spend OK';
END $prestige_concurrent$;

-- And with the real submitted-Shimmer trigger.
UPDATE public.profiles SET mote_balance=1 WHERE id='00000000-0000-0000-0000-000000063002';
INSERT INTO public.war_rootings(user_id,crew_id,window_index,seed,dig_day,opened_at)
SELECT '00000000-0000-0000-0000-000000063002',crew_id,67202,9,current_date,now()
FROM public.war_rootings WHERE user_id='00000000-0000-0000-0000-000000063002' LIMIT 1;
DO $shimmer_concurrent$
DECLARE conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  pig uuid:='00000000-0000-0000-0000-000000063002'; a jsonb;
BEGIN
  PERFORM dblink_connect('v2_shimmer_a',conn); PERFORM dblink_connect('v2_shimmer_b',conn);
  PERFORM dblink_exec('v2_shimmer_b','SET ROLE authenticated');
  PERFORM dblink_exec('v2_shimmer_b','SET smoke.uid = '''||pig||'''');
  PERFORM dblink_send_query('v2_shimmer_a','WITH u AS (UPDATE public.war_rootings SET submitted_at=now(),finds=ARRAY[''shimmer''],credited_finds=1 WHERE user_id='''||pig||''' AND window_index=67202 RETURNING 1) SELECT count(*)::int FROM u');
  PERFORM dblink_send_query('v2_shimmer_b','SELECT public.play_mote_game(''v2-shimmer-race'',''wager'',1,''wager-v1'')');
  PERFORM changed FROM dblink_get_result('v2_shimmer_a') x(changed int); PERFORM changed FROM dblink_get_result('v2_shimmer_a') x(changed int);
  SELECT data INTO a FROM dblink_get_result('v2_shimmer_b') x(data jsonb); PERFORM data FROM dblink_get_result('v2_shimmer_b') x(data jsonb);
  IF NOT (a->>'ok')::boolean OR (SELECT mote_balance FROM public.profiles WHERE id=pig)<>1
  THEN RAISE EXCEPTION 'v2/Shimmer concurrency lost update: %',a; END IF;
  PERFORM dblink_disconnect('v2_shimmer_a'); PERFORM dblink_disconnect('v2_shimmer_b');
  RAISE NOTICE 'chk mote wagering v2: concurrent real Shimmer grant + v2 spend OK';
END $shimmer_concurrent$;

-- Export contract vectors from the real SQL adapters for client parser tests.
-- Volatile ids/timestamps are intentionally retained: this is evidence of the
-- actual database JSON, not a hand-authored approximation.
SELECT 'MOTE_CLIENT_FIXTURES_BEGIN';
WITH picked AS (
  SELECT g AS play,CASE g.request_id
    WHEN 'reveal-all-1' THEN 1 WHEN 'reveal-all-2' THEN 2 WHEN 'reveal-all-3' THEN 3 WHEN 'reveal-all-4' THEN 4
    WHEN 'all-1-loss' THEN 5 WHEN 'all-1-returned_stake' THEN 6 WHEN 'all-1-small' THEN 7 WHEN 'all-1-big' THEN 8 WHEN 'all-1-jackpot' THEN 9 END ord
  FROM public.mote_game_plays g
  WHERE g.user_id='00000000-0000-0000-0000-000000072001'
    AND g.request_id IN ('reveal-all-1','reveal-all-2','reveal-all-3','reveal-all-4',
      'all-1-loss','all-1-returned_stake','all-1-small','all-1-big','all-1-jackpot')
)
SELECT jsonb_pretty(jsonb_build_object(
  'source','throwaway-postgres-actual-rpc-shape',
  'receipts',jsonb_agg(jsonb_build_object('ok',true,'receipt',public._mote_v2_receipt(p.play),
    'wallet',jsonb_build_object('motes',(p.play).motes_remaining,'revision',(p.play).wallet_revision),'replayed',false) ORDER BY ord)
  ,'legacy_receipts',(SELECT jsonb_agg(public._mote_v1_receipt(s) ORDER BY s.spun_at,s.id)
    FROM public.mote_machine_spins s WHERE s.user_id='00000000-0000-0000-0000-000000072001'
      AND s.request_id IN ('legacy-tickle-history','legacy-reveal-one'))
)) FROM picked p;
SELECT 'MOTE_CLIENT_FIXTURES_END';

-- Restore the real secure helper definition by re-reading the migration is not
-- needed: this database is destroyed when the harness exits.
