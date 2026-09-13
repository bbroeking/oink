\set ON_ERROR_STOP on

DO $smoke$
DECLARE
  rank int; uid uuid; expected int; r jsonb; before_receipts int;
  rank6 uuid := '00000000-0000-0000-0000-000000079006';
  rank0 uuid := '00000000-0000-0000-0000-000000079000';
  layout jsonb;
BEGIN
  -- The migration backfills every existing lifetime rank, caps the current
  -- reward set at six, and preserves rooms and wallets.
  FOR rank IN 0..7 LOOP
    uid := ('00000000-0000-0000-0000-' || lpad((79000 + rank)::text, 12, '0'))::uuid;
    expected := LEAST(rank, 6);
    IF (SELECT count(*) FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id
        WHERE o.user_id=uid AND i.prestige_rank IS NOT NULL) <> expected
      OR (SELECT count(*) FROM public.habitat_grant_receipts
          WHERE user_id=uid AND source='habitat_prestige') <> expected
      OR (SELECT counter FROM public.profiles WHERE id=uid) <> 600 + rank THEN
      RAISE EXCEPTION 'rank % backfill mismatch', rank;
    END IF;
  END LOOP;
  IF (SELECT revision FROM public.user_habitats WHERE user_id=rank6) <> 4
    OR (SELECT newly_owned FROM public.habitat_grant_receipts
        WHERE user_id=rank6 AND source='habitat_prestige' AND source_ref='prestige:v1:rank:1') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'backfill changed layout revision or mishandled prior purchase';
  END IF;

  -- Original prices and sale flags stay intact, while catalog JSON advertises
  -- each rank and snapshots omit catalog-only prestige metadata.
  IF EXISTS(
    SELECT 1 FROM (VALUES
      ('dried_herb_garland',1,50),('barn_bunting',2,100),('muddy_paw_rug',3,100),
      ('reading_chair',4,100),('tiny_radio',5,175),('midnight_rafters',6,175)
    ) AS want(id,rank,cost)
    LEFT JOIN public.habitat_items i ON i.id=want.id
    WHERE i.prestige_rank IS DISTINCT FROM want.rank OR i.snout_cost IS DISTINCT FROM want.cost
      OR i.is_for_sale IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'prestige catalog mapping changed sale terms'; END IF;
  IF public._habitat_item_json((SELECT i FROM public.habitat_items i WHERE id='tiny_radio'),true)->>'prestigeRank' <> '5'
    OR public._habitat_item_json((SELECT i FROM public.habitat_items i WHERE id='tiny_radio'),false) ? 'prestigeRank'
    OR public._habitat_item_json((SELECT i FROM public.habitat_items i WHERE id='warm_plank_barn'),true) ? 'prestigeRank' THEN
    RAISE EXCEPTION 'prestigeRank JSON visibility mismatch';
  END IF;

  -- Startup claim reports rank, remains replay-safe, and a later rank increase
  -- is caught up by the owner read without altering wallet or room revision.
  PERFORM set_config('smoke.uid', rank0::text, true);
  r := public.claim_habitat_starter();
  IF (r->>'ok')::boolean IS DISTINCT FROM true OR r->>'wallowRank' <> '0' THEN
    RAISE EXCEPTION 'rank-zero starter payload mismatch: %', r;
  END IF;
  UPDATE public.profiles SET wallow_count=2 WHERE id=rank0;
  SELECT count(*) INTO before_receipts FROM public.habitat_grant_receipts
    WHERE user_id=rank0 AND source='habitat_prestige';
  r := public.my_habitat();
  IF r->>'wallowRank' <> '2'
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=rank0 AND source='habitat_prestige') <> before_receipts + 2
    OR (SELECT counter FROM public.profiles WHERE id=rank0) <> 600
    OR (SELECT revision FROM public.user_habitats WHERE user_id=rank0) <> 0 THEN
    RAISE EXCEPTION 'lazy rank catch-up mismatch: %', r;
  END IF;
  before_receipts := (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=rank0 AND source='habitat_prestige');
  r := public.my_habitat();
  IF (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=rank0 AND source='habitat_prestige') <> before_receipts
    OR (SELECT revision FROM public.user_habitats WHERE user_id=rank0) <> 0 THEN
    RAISE EXCEPTION 'repeated prestige reconciliation was not idempotent';
  END IF;

  -- An earned paid design is normal owned inventory and can be saved.
  PERFORM set_config('smoke.uid', rank6::text, true);
  r := public.my_habitat();
  IF r->>'wallowRank' <> '6' THEN RAISE EXCEPTION 'my_habitat rank payload mismatch: %', r; END IF;
  layout := jsonb_build_object(
    'interior_background','warm_plank_barn','wall','rosies_pencil_sketch',
    'ceiling','dried_herb_garland','floor_left','sunflower_crock','floor_right',null,
    'floor_centerpiece','patchwork_rug','surface',null);
  r := public.save_habitat(4,'79000000-0000-0000-0000-000000000001',layout);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR r#>>'{snapshot,positions,ceiling,id}' <> 'dried_herb_garland'
    OR (SELECT counter FROM public.profiles WHERE id=rank6) <> 606 THEN
    RAISE EXCEPTION 'earned prestige gift could not be saved: %', r;
  END IF;

  -- Public callers cannot forge grants or invoke reconciliation helpers.
  IF has_function_privilege('authenticated','public._reconcile_habitat_prestige(uuid,int)','EXECUTE')
    OR has_function_privilege('anon','public._reconcile_habitat_prestige(uuid,int)','EXECUTE')
    OR has_function_privilege('authenticated','public.grant_habitat_item(uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public._require_habitat_grant(uuid,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'prestige grant internals are callable by clients';
  END IF;
  PERFORM set_config('smoke.uid','',true);
  IF public.claim_habitat_starter()->>'reason' <> 'not_authenticated'
    OR public.my_habitat()->>'reason' <> 'not_authenticated' THEN
    RAISE EXCEPTION 'anonymous habitat owner RPC authorization failed';
  END IF;
  RAISE NOTICE 'chk habitat prestige rewards: ranks 0..7, backfill, catch-up, replay, purchase, save, metadata, privacy, and mutation bounds OK';
END;
$smoke$;
