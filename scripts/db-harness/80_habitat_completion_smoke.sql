\set ON_ERROR_STOP on

DO $smoke$
DECLARE
  rank0 uuid:='00000000-0000-0000-0000-000000079000';
  rank6 uuid:='00000000-0000-0000-0000-000000079006';
  rank7 uuid:='00000000-0000-0000-0000-000000079007';
  rank10 uuid:='00000000-0000-0000-0000-000000079010';
  r jsonb; journal jsonb; aid text; base_positions jsonb; alt_positions jsonb;
  event_count int; room_revision bigint;
BEGIN
  -- Four exclusive, free shelf keepsakes may share prestige ranks with the
  -- original buy-early gifts. Rank 10 receives all four by migration backfill.
  IF (SELECT count(*) FROM public.habitat_items WHERE id LIKE 'wallow_keepsake_%'
      AND NOT is_for_sale AND snout_cost=0 AND category='surface_decor'
      AND prestige_rank IN (1,3,6,10))<>4
    OR (SELECT count(DISTINCT prestige_rank) FROM public.habitat_items WHERE prestige_rank IS NOT NULL)<>7
    OR (SELECT public._habitat_item_json(i,true)->>'prestigeKeepsake'
        FROM public.habitat_items i WHERE id='wallow_keepsake_gold')<>'true'
    OR public._habitat_item_json((SELECT i FROM public.habitat_items i WHERE id='tiny_radio'),true) ? 'prestigeKeepsake' THEN
    RAISE EXCEPTION 'keepsake catalog metadata or shared ranks mismatch';
  END IF;
  IF (SELECT count(*) FROM public.user_habitat_items WHERE user_id=rank10 AND item_id LIKE 'wallow_keepsake_%')<>4
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=rank10
        AND source='habitat_prestige' AND source_ref LIKE 'prestige:v2:%:item:%')<>4
    OR EXISTS(SELECT 1 FROM public.habitat_grant_receipts WHERE user_id=rank6
        AND source='habitat_prestige' AND item_id NOT LIKE 'wallow_keepsake_%'
        AND source_ref LIKE 'prestige:v2:%') THEN
    RAISE EXCEPTION 'keepsake catch-up or original receipt preservation mismatch';
  END IF;

  -- Server acquisition analytics are emitted once only for newly-owned grants.
  SELECT count(*) INTO event_count FROM public.interaction_analytics_events
    WHERE user_id=rank10 AND event_name='habitat_item_acquired';
  PERFORM public._reconcile_habitat_prestige(rank10,10);
  IF (SELECT count(*) FROM public.interaction_analytics_events
      WHERE user_id=rank10 AND event_name='habitat_item_acquired')<>event_count
    OR event_count<>10 THEN
    RAISE EXCEPTION 'authoritative acquisition analytics were not receipt-deduped: %',event_count;
  END IF;
  IF EXISTS(SELECT 1 FROM public.interaction_analytics_events WHERE user_id=rank10
    AND event_name='habitat_item_acquired' AND (properties->>'source') IS DISTINCT FROM 'habitat_prestige') THEN
    RAISE EXCEPTION 'acquisition analytics lost source distinction';
  END IF;

  -- Journal returns all receipt sources; presented and seen remain independent.
  PERFORM set_config('smoke.uid',rank0::text,true);
  journal:=public.my_habitat_journal();
  IF (journal->>'ok')::boolean IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(journal->'acquisitions') a WHERE a->>'source'='habitat_starter')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(journal->'acquisitions') a WHERE a->>'source'='habitat_prestige') THEN
    RAISE EXCEPTION 'journal did not return complete grant metadata: %',journal;
  END IF;
  SELECT a->>'id' INTO aid FROM jsonb_array_elements(journal->'acquisitions') a
    WHERE a->>'source'='habitat_prestige' AND (a->>'newlyOwned')::boolean ORDER BY a->>'grantedAt' LIMIT 1;
  r:=public.ack_habitat_acquisitions(ARRAY[aid],'presented');
  journal:=public.my_habitat_journal();
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(journal->'acquisitions') a
      WHERE a->>'id'=aid AND (a->>'presented')::boolean AND NOT (a->>'seen')::boolean) THEN
    RAISE EXCEPTION 'presented ack cleared or failed New state: %, %',r,journal;
  END IF;
  r:=public.ack_habitat_acquisitions(ARRAY[aid],'seen');
  r:=public.ack_habitat_acquisitions(ARRAY[aid],'seen');
  journal:=public.my_habitat_journal();
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(journal->'acquisitions') a
    WHERE a->>'id'=aid AND (a->>'presented')::boolean AND (a->>'seen')::boolean) THEN
    RAISE EXCEPTION 'seen ack was not durable/idempotent: %',journal;
  END IF;
  IF public.ack_habitat_acquisitions(ARRAY['bad'],'seen')->>'reason'<>'invalid_request'
    OR public.ack_habitat_acquisitions(ARRAY[aid],'bad')->>'reason'<>'invalid_request' THEN
    RAISE EXCEPTION 'invalid acquisition acknowledgments accepted';
  END IF;

  -- Rank 7 has no celestial keepsake until lazy journal reconciliation sees 10.
  PERFORM set_config('smoke.uid',rank7::text,true);
  IF EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=rank7 AND item_id='wallow_keepsake_celestial') THEN
    RAISE EXCEPTION 'rank 7 received rank 10 keepsake';
  END IF;
  UPDATE public.profiles SET wallow_count=10 WHERE id=rank7;
  journal:=public.my_habitat_journal();
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(journal->'acquisitions') a
    WHERE a->>'itemId'='wallow_keepsake_celestial' AND NOT (a->>'presented')::boolean) THEN
    RAISE EXCEPTION 'journal did not lazily reconcile future rank: %',journal;
  END IF;

  -- Wishlist is owner-scoped, validates catalog items, and returns stable order.
  r:=public.set_habitat_wishlist('tiny_radio',true);
  r:=public.set_habitat_wishlist('tiny_radio',true);
  IF r->'wishlist'<>jsonb_build_array('tiny_radio')
    OR public.set_habitat_wishlist('missing',true)->>'reason'<>'invalid_item' THEN
    RAISE EXCEPTION 'wishlist save/replay/validation mismatch: %',r;
  END IF;
  PERFORM set_config('smoke.uid',rank0::text,true);
  IF public.my_habitat_journal()->'wishlist'<>jsonb_build_array() THEN
    RAISE EXCEPTION 'wishlist leaked across owners';
  END IF;
  PERFORM set_config('smoke.uid',rank7::text,true);
  IF public.set_habitat_wishlist('tiny_radio',false)->'wishlist'<>jsonb_build_array() THEN
    RAISE EXCEPTION 'wishlist removal failed';
  END IF;

  -- Public snapshot carries permanent rank for dynamic keepsake captions.
  r:=public.my_habitat();
  IF r#>>'{snapshot,wallowRank}'<>'10' THEN RAISE EXCEPTION 'snapshot wallowRank missing: %',r; END IF;

  -- Preset checkpoints do not alter the live room until explicit activation.
  PERFORM set_config('smoke.uid',rank0::text,true);
  SELECT revision INTO room_revision FROM public.user_habitats WHERE user_id=rank0;
  SELECT jsonb_build_object('interior_background',h.interior_background_item_id,
    'wall',(SELECT item_id FROM public.user_habitat_slots WHERE user_id=rank0 AND position='wall'),
    'ceiling',NULL,'floor_left',(SELECT item_id FROM public.user_habitat_slots WHERE user_id=rank0 AND position='floor_left'),
    'floor_right',NULL,'floor_centerpiece',(SELECT item_id FROM public.user_habitat_slots WHERE user_id=rank0 AND position='floor_centerpiece'),
    'surface',NULL) INTO base_positions FROM public.user_habitats h WHERE h.user_id=rank0;
  alt_positions:=base_positions||jsonb_build_object('ceiling','dried_herb_garland');
  r:=public.save_habitat_preset(1,'Cozy',alt_positions,NULL,'80000000-0000-0000-0000-000000000001');
  IF (r->>'ok')::boolean IS DISTINCT FROM true OR r#>>'{preset,revision}'<>'0'
    OR (SELECT revision FROM public.user_habitats WHERE user_id=rank0)<>room_revision
    OR (SELECT active_preset_slot FROM public.user_habitats WHERE user_id=rank0) IS NOT NULL THEN
    RAISE EXCEPTION 'preset save changed live room: %',r;
  END IF;
  IF (public.save_habitat_preset(1,'Cozy',alt_positions,NULL,'80000000-0000-0000-0000-000000000001')->>'replayed')::boolean IS DISTINCT FROM true
    OR public.save_habitat_preset(1,'Changed',alt_positions,NULL,'80000000-0000-0000-0000-000000000001')->>'reason'<>'idempotency_mismatch' THEN
    RAISE EXCEPTION 'preset save replay contract failed';
  END IF;
  r:=public.activate_habitat_preset(1,room_revision,'80000000-0000-0000-0000-000000000002',0);
  IF (r->>'ok')::boolean IS DISTINCT FROM true OR r#>>'{snapshot,positions,ceiling,id}'<>'dried_herb_garland'
    OR (SELECT active_preset_slot FROM public.user_habitats WHERE user_id=rank0)<>1 THEN
    RAISE EXCEPTION 'preset activation failed: %',r;
  END IF;
  IF (public.activate_habitat_preset(1,room_revision,'80000000-0000-0000-0000-000000000002',0)->>'replayed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'preset activation replay failed';
  END IF;
  r:=public.save_habitat_preset(1,'Cozy renamed',alt_positions,0,'80000000-0000-0000-0000-000000000003');
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR (SELECT active_preset_slot FROM public.user_habitats WHERE user_id=rank0)<>1 THEN
    RAISE EXCEPTION 'name-only preset edit cleared active marker: %',r;
  END IF;
  r:=public.save_habitat_preset(1,'Cozy 2',base_positions,1,'80000000-0000-0000-0000-000000000010');
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR (SELECT active_preset_slot FROM public.user_habitats WHERE user_id=rank0) IS NOT NULL
    OR public.activate_habitat_preset(1,room_revision+1,'80000000-0000-0000-0000-000000000004',0)->>'reason'<>'preset_revision_conflict' THEN
    RAISE EXCEPTION 'preset edit active marker or revision conflict guard failed: %',r;
  END IF;
  r:=public.save_habitat(room_revision+1,'80000000-0000-0000-0000-000000000005',base_positions);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR (SELECT active_preset_slot FROM public.user_habitats WHERE user_id=rank0) IS NOT NULL THEN
    RAISE EXCEPTION 'ordinary room edit did not clear active preset: %',r;
  END IF;
  IF public.save_habitat_preset(2,'Bad',base_positions,9,'80000000-0000-0000-0000-000000000006')->>'reason'<>'revision_conflict'
    OR public.save_habitat_preset(2,'Bad',base_positions||jsonb_build_object('surface','tiny_radio'),NULL,'80000000-0000-0000-0000-000000000007')->>'reason'<>'unowned_item' THEN
    RAISE EXCEPTION 'preset create conflict or ownership validation failed';
  END IF;

  -- RPC-only tables and helpers are private; anonymous RPCs fail closed.
  IF has_table_privilege('authenticated','public.habitat_presets','SELECT')
    OR has_table_privilege('authenticated','public.habitat_wishlist_items','INSERT')
    OR has_function_privilege('authenticated','public._validate_habitat_preset_positions(uuid,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.my_habitat_journal()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.ack_habitat_acquisitions(text[],text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.set_habitat_wishlist(text,boolean)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.my_habitat_presets()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.save_habitat_preset(int,text,jsonb,bigint,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.activate_habitat_preset(int,bigint,uuid,bigint)','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_class WHERE oid IN (
      'public.habitat_acquisition_states'::regclass,'public.habitat_wishlist_items'::regclass,
      'public.habitat_presets'::regclass,'public.habitat_preset_save_receipts'::regclass,
      'public.habitat_preset_activation_receipts'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'completion internals exposed to clients';
  END IF;
  PERFORM set_config('smoke.uid',rank7::text,true);
  IF (public.my_habitat_presets()->'presets')<>jsonb_build_array() THEN
    RAISE EXCEPTION 'presets leaked across owners';
  END IF;
  PERFORM set_config('smoke.uid','',true);
  IF public.my_habitat_journal()->>'reason'<>'not_authenticated'
    OR public.my_habitat_presets()->>'reason'<>'not_authenticated'
    OR public.set_habitat_wishlist('tiny_radio',true)->>'reason'<>'not_authenticated'
    OR public.save_habitat_preset(1,'x',base_positions,NULL,'80000000-0000-0000-0000-000000000008')->>'reason'<>'not_authenticated'
    OR public.activate_habitat_preset(1,0,'80000000-0000-0000-0000-000000000009')->>'reason'<>'not_authenticated' THEN
    RAISE EXCEPTION 'anonymous completion RPC authorization failed';
  END IF;
  RAISE NOTICE 'chk habitat completion: keepsakes, journal, ack states, wishlist, presets, analytics, auth, and conflicts OK';
END;
$smoke$;

DO $concurrent_activation$
DECLARE
  conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  uid uuid:='00000000-0000-0000-0000-000000079000';
  req uuid:='80000000-0000-0000-0000-000000000011';
  room_revision bigint;
  preset_revision bigint;
  a jsonb;
  b jsonb;
BEGIN
  SELECT revision INTO room_revision FROM public.user_habitats WHERE user_id=uid;
  SELECT revision INTO preset_revision FROM public.habitat_presets WHERE user_id=uid AND slot=1;
  PERFORM dblink_connect('completion_a',conn);
  PERFORM dblink_connect('completion_b',conn);
  PERFORM dblink_exec('completion_a','SET ROLE authenticated');
  PERFORM dblink_exec('completion_b','SET ROLE authenticated');
  PERFORM dblink_exec('completion_a','SET smoke.uid='''||uid||'''');
  PERFORM dblink_exec('completion_b','SET smoke.uid='''||uid||'''');
  PERFORM dblink_send_query('completion_a','SELECT public.activate_habitat_preset(1,'||room_revision||','''||req||''','||preset_revision||')');
  PERFORM dblink_send_query('completion_b','SELECT public.activate_habitat_preset(1,'||room_revision||','''||req||''','||preset_revision||')');
  SELECT data INTO a FROM dblink_get_result('completion_a') x(data jsonb);
  PERFORM data FROM dblink_get_result('completion_a') x(data jsonb);
  SELECT data INTO b FROM dblink_get_result('completion_b') x(data jsonb);
  PERFORM data FROM dblink_get_result('completion_b') x(data jsonb);
  IF NOT COALESCE((a->>'ok')::boolean,false) OR NOT COALESCE((b->>'ok')::boolean,false)
    OR (COALESCE((a->>'replayed')::boolean,false)::int + COALESCE((b->>'replayed')::boolean,false)::int)<>1
    OR (SELECT count(*) FROM public.habitat_preset_activation_receipts WHERE user_id=uid AND request_id=req)<>1 THEN
    RAISE EXCEPTION 'concurrent preset activation replay failed: % %',a,b;
  END IF;
  PERFORM dblink_disconnect('completion_a');
  PERFORM dblink_disconnect('completion_b');
  RAISE NOTICE 'chk habitat completion concurrency: identical preset activation applies once and replays once';
END;
$concurrent_activation$;
