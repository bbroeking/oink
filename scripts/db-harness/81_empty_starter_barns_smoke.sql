\set ON_ERROR_STOP on

DO $$
DECLARE
  host uuid := '00000000-0000-0000-0000-000000081010';
  friend uuid := '00000000-0000-0000-0000-000000081011';
  stranger uuid := '00000000-0000-0000-0000-000000081012';
  discovered uuid := '00000000-0000-0000-0000-000000081013';
  empty_room jsonb := jsonb_build_object('interior_background', 'warm_plank_barn',
    'wall', null, 'ceiling', null, 'floor_left', null, 'floor_right', null,
    'floor_centerpiece', null, 'surface', null);
  r jsonb; s jsonb; first_save jsonb; legacy uuid;
BEGIN
  legacy := '00000000-0000-0000-0000-000000081001';
  IF (SELECT revision FROM public.user_habitats WHERE user_id = legacy) <> 1
    OR EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id = legacy)
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = legacy) <> 4
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = legacy) <> 4
    OR EXISTS(SELECT 1 FROM public.habitat_milestones WHERE user_id = legacy)
    OR (SELECT counter FROM public.profiles WHERE id = legacy) <> 81 THEN
    RAISE EXCEPTION 'untouched starter conversion lost inventory, granted a reward, or failed to clear';
  END IF;
  PERFORM set_config('smoke.uid', legacy::text, true);
  r := public.save_habitat(0, '81000000-0000-0000-0000-000000000002', empty_room);
  IF r->>'reason' IS DISTINCT FROM 'revision_conflict' THEN
    RAISE EXCEPTION 'migration did not invalidate stale room draft: %', r;
  END IF;
  r := public.claim_habitat_starter();
  IF EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id = legacy)
    OR (r#>>'{snapshot,revision}')::bigint <> 1 THEN
    RAISE EXCEPTION 'starter retry refurnished converted room: %', r;
  END IF;

  IF (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = '00000000-0000-0000-0000-000000081002') <> 3
    OR (SELECT revision FROM public.user_habitats WHERE user_id = '00000000-0000-0000-0000-000000081002') <> 1
    OR (SELECT count(*) FROM public.habitat_save_receipts WHERE user_id = '00000000-0000-0000-0000-000000081002') <> 1
    OR (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = '00000000-0000-0000-0000-000000081003') <> 2
    OR (SELECT revision FROM public.user_habitats WHERE user_id = '00000000-0000-0000-0000-000000081004') <> 0
    OR (SELECT interior_background_item_id FROM public.user_habitats WHERE user_id = '00000000-0000-0000-0000-000000081005') <> 'spring_whitewash'
    OR (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = '00000000-0000-0000-0000-000000081005') <> 3 THEN
    RAISE EXCEPTION 'empty-start migration changed a saved or non-starter room';
  END IF;

  INSERT INTO auth.users(id) VALUES(host), (friend), (stranger), (discovered);
  INSERT INTO public.profiles(id, username, counter)
    VALUES(host, 'empty-host', 41), (friend, 'empty-friend', 52),
      (stranger, 'empty-stranger', 63), (discovered, 'empty-discovery', 74);
  INSERT INTO public.friendships(requester_id, receiver_id, status)
    VALUES(host, friend, 'accepted');
  PERFORM set_config('smoke.uid', stranger::text, true);
  r := public.view_habitat(host);
  IF r->>'reason' IS DISTINCT FROM 'not_friends'
    OR EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = host) THEN
    RAISE EXCEPTION 'denied inspection created an empty room: %', r;
  END IF;
  PERFORM set_config('smoke.uid', friend::text, true);
  r := public.view_habitat(host);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR r#>>'{snapshot,positions,interior_background,id}' IS DISTINCT FROM 'warm_plank_barn'
    OR EXISTS(SELECT 1 FROM jsonb_each(r#>'{snapshot,positions}') p
      WHERE p.key <> 'interior_background' AND p.value <> 'null'::jsonb)
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = host) <> 4
    OR (SELECT counter FROM public.profiles WHERE id = host) <> 41 THEN
    RAISE EXCEPTION 'friend arrival did not provision an empty, owned starter room: %', r;
  END IF;
  -- The full harness includes the visit system; the focused housing harness does not.
  IF to_regclass('public.barn_visits') IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.barn_visits WHERE visitor_id = friend OR target_id = host) THEN
      RAISE EXCEPTION 'friend inspection incorrectly credited a visit';
    END IF;
  END IF;

  PERFORM set_config('smoke.uid', host::text, true);
  r := public.claim_habitat_starter(); s := public.claim_habitat_starter();
  IF r->'snapshot' IS DISTINCT FROM s->'snapshot'
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = host) <> 4 THEN
    RAISE EXCEPTION 'empty starter claims are not repeat-safe: %, %', r, s;
  END IF;
  r := public.save_habitat(0, '81000000-0000-0000-0000-000000000003', empty_room);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR EXISTS(SELECT 1 FROM public.habitat_milestones WHERE user_id = host)
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = host) <> 4 THEN
    RAISE EXCEPTION 'saving the empty default awarded customization: %', r;
  END IF;
  first_save := public.save_habitat(1, '81000000-0000-0000-0000-000000000004',
    empty_room || jsonb_build_object('wall', 'rosies_pencil_sketch'));
  IF (first_save->>'ok')::boolean IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id = host AND item_id = 'apple_basket')
    OR (SELECT count(*) FROM public.habitat_milestones WHERE user_id = host AND milestone = 'first_custom_layout:v1') <> 1 THEN
    RAISE EXCEPTION 'placing a starter gift did not count as first decoration: %', first_save;
  END IF;
  r := public.claim_habitat_starter();
  s := public.save_habitat(1, '81000000-0000-0000-0000-000000000004',
    empty_room || jsonb_build_object('wall', 'rosies_pencil_sketch'));
  IF r#>>'{snapshot,positions,wall,id}' IS DISTINCT FROM 'rosies_pencil_sketch'
    OR NOT (s->>'replayed')::boolean
    OR s->'snapshot' IS DISTINCT FROM first_save->'snapshot' THEN
    RAISE EXCEPTION 'starter retry or replay lost the player decoration: %, %', r, s;
  END IF;

  PERFORM set_config('smoke.uid', discovered::text, true);
  PERFORM set_config('smoke.allow_habitat_discovery', '1', true);
  r := public.habitat_expansion_discovery();
  IF NOT EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = discovered)
    OR EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id = discovered)
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = discovered) <> 4 THEN
    RAISE EXCEPTION 'discovery did not create an empty starter: %', r;
  END IF;

  IF has_function_privilege('authenticated', 'public._ensure_habitat_starter(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public._ensure_habitat_starter(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.save_habitat(bigint,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.save_habitat(bigint,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'empty starter migration changed RPC privileges';
  END IF;
  RAISE NOTICE 'chk empty starter barns: initialization, legacy conversion, inventory, custom saves, retries, discovery, authorization OK';
END;
$$;
