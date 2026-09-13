\set ON_ERROR_STOP on

DO $smoke$
DECLARE
  host uuid := '00000000-0000-0000-0000-000000078001';
  friend uuid := '00000000-0000-0000-0000-000000078002';
  stranger uuid := '00000000-0000-0000-0000-000000078003';
  blocked_host uuid := '00000000-0000-0000-0000-000000078004';
  anonymous_host uuid := '00000000-0000-0000-0000-000000078005';
  r jsonb; saved jsonb; wallet bigint; stamps bigint;
BEGIN
  INSERT INTO auth.users(id) VALUES(host), (friend), (stranger), (blocked_host), (anonymous_host);
  INSERT INTO public.profiles(id, username, counter)
  VALUES
    (host, 'starter-host', 41), (friend, 'starter-friend', 52), (stranger, 'starter-stranger', 63),
    (blocked_host, 'starter-blocked', 74), (anonymous_host, 'starter-anonymous', 85);
  INSERT INTO public.friendships(requester_id, receiver_id, status)
  VALUES(host, friend, 'accepted'), (blocked_host, friend, 'accepted');

  -- An unauthorized read never creates the host's room or changes its wallet.
  PERFORM set_config('smoke.uid', stranger::text, true);
  r := public.view_habitat(host);
  IF r->>'reason' <> 'not_friends'
    OR EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = host)
    OR (SELECT counter FROM public.profiles WHERE id = host) <> 41 THEN
    RAISE EXCEPTION 'unauthorized view provisioned or mutated host: %', r;
  END IF;

  -- A blocked accepted friend and an anonymous caller cannot provision fresh rooms.
  PERFORM set_config('smoke.uid', friend::text, true);
  PERFORM set_config('smoke.blocked_pair', friend::text || ':' || blocked_host::text, true);
  r := public.view_habitat(blocked_host);
  IF r->>'reason' IS DISTINCT FROM 'blocked'
    OR EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = blocked_host)
    OR (SELECT counter FROM public.profiles WHERE id = blocked_host) IS DISTINCT FROM 74 THEN
    RAISE EXCEPTION 'blocked friend provisioned or mutated host: %', r;
  END IF;
  PERFORM set_config('smoke.blocked_pair', '', true);
  PERFORM set_config('smoke.uid', '', true);
  r := public.view_habitat(anonymous_host);
  IF r->>'reason' IS DISTINCT FROM 'not_authenticated'
    OR EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = anonymous_host)
    OR (SELECT counter FROM public.profiles WHERE id = anonymous_host) IS DISTINCT FROM 85 THEN
    RAISE EXCEPTION 'anonymous view provisioned or mutated host: %', r;
  END IF;

  -- An authorized friend gets the furnished starter snapshot, without a Visit or wallet write.
  SELECT count(*) INTO stamps FROM public.barn_guestbook_stamps;
  PERFORM set_config('smoke.uid', friend::text, true);
  r := public.view_habitat(host);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = host) <> 4
    OR (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = host) <> 3
    OR r#>>'{snapshot,positions,wall,id}' IS DISTINCT FROM 'rosies_pencil_sketch'
    OR r#>>'{snapshot,positions,floor_left,id}' IS DISTINCT FROM 'sunflower_crock'
    OR r#>>'{snapshot,positions,floor_centerpiece,id}' IS DISTINCT FROM 'patchwork_rug'
    OR r ? 'owned' OR r ? 'catalog'
    OR (SELECT counter FROM public.profiles WHERE id = host) IS DISTINCT FROM 41
    OR (SELECT count(*) FROM public.barn_guestbook_stamps) <> stamps THEN
    RAISE EXCEPTION 'authorized friend did not receive stable starter room: %', r;
  END IF;

  -- Repeated initialization preserves an owner-edited room and the four grants.
  saved := jsonb_build_object('interior_background', 'warm_plank_barn', 'wall', null, 'ceiling', null, 'floor_left', 'sunflower_crock', 'floor_right', null, 'floor_centerpiece', 'patchwork_rug', 'surface', null);
  PERFORM set_config('smoke.uid', host::text, true);
  r := public.save_habitat(0, '78000000-0000-0000-0000-000000000001', saved);
  IF (r->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'setup save failed: %', r; END IF;
  SELECT counter INTO wallet FROM public.profiles WHERE id = host;
  r := public.claim_habitat_starter();
  IF r#>>'{snapshot,positions,wall}' IS NOT NULL
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = host AND source = 'habitat_starter') <> 4
    OR (SELECT counter FROM public.profiles WHERE id = host) IS DISTINCT FROM wallet THEN
    RAISE EXCEPTION 'repeated starter claim replaced saved room: %', r;
  END IF;

  -- Both public provisioning paths preserve the committed edit and revision.
  PERFORM set_config('smoke.uid', friend::text, true);
  r := public.view_habitat(host);
  IF (r->>'ok')::boolean IS DISTINCT FROM true
    OR r#>>'{snapshot,revision}' IS DISTINCT FROM '1'
    OR r#>>'{snapshot,positions,wall}' IS NOT NULL
    OR r ? 'owned' OR r ? 'catalog' THEN
    RAISE EXCEPTION 'repeat friend view changed or leaked host room: %', r;
  END IF;
  PERFORM set_config('smoke.uid', host::text, true);
  r := public.habitat_expansion_discovery();
  IF (r->>'available')::boolean IS DISTINCT FROM true
    OR (SELECT revision FROM public.user_habitats WHERE user_id = host) IS DISTINCT FROM 1
    OR EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id = host AND position = 'wall') THEN
    RAISE EXCEPTION 'discovery changed saved host room: %', r;
  END IF;

  -- The enabled discovery path also provisions its caller with the same starter state.
  PERFORM set_config('smoke.uid', friend::text, true);
  r := public.habitat_expansion_discovery();
  IF (r->>'available')::boolean IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = friend)
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = friend) <> 4
    OR (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = friend) <> 3
    OR (SELECT counter FROM public.profiles WHERE id = friend) IS DISTINCT FROM 52 THEN
    RAISE EXCEPTION 'discovery did not provision caller safely: %', r;
  END IF;
  IF has_function_privilege('authenticated', 'public._ensure_habitat_starter(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public._ensure_habitat_starter(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.claim_habitat_starter()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.view_habitat(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.habitat_expansion_discovery()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_habitat_starter()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.view_habitat(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.habitat_expansion_discovery()', 'EXECUTE') THEN
    RAISE EXCEPTION 'starter helper or public RPC privileges wrong';
  END IF;
  RAISE NOTICE 'chk habitat starter provisioning: denied callers, authorized friend view, repeat-safe starter, discovery, and privileges OK';
END;
$smoke$;

-- The private helper serializes the overlapping authorized view and owner claim.
INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000078010'),
  ('00000000-0000-0000-0000-000000078011');
INSERT INTO public.profiles(id, username, counter) VALUES
  ('00000000-0000-0000-0000-000000078010', 'starter-race-host', 9),
  ('00000000-0000-0000-0000-000000078011', 'starter-race-friend', 8);
INSERT INTO public.friendships(requester_id, receiver_id, status) VALUES
  ('00000000-0000-0000-0000-000000078010', '00000000-0000-0000-0000-000000078011', 'accepted');
DO $concurrent$
DECLARE
  conn text := 'host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
  host uuid := '00000000-0000-0000-0000-000000078010';
  friend uuid := '00000000-0000-0000-0000-000000078011';
  a jsonb; b jsonb;
BEGIN
  PERFORM dblink_connect('starter_view_a', conn); PERFORM dblink_connect('starter_view_b', conn);
  PERFORM dblink_exec('starter_view_a', 'SET ROLE authenticated'); PERFORM dblink_exec('starter_view_b', 'SET ROLE authenticated');
  PERFORM dblink_exec('starter_view_a', 'SET smoke.uid=''' || friend || '''');
  PERFORM dblink_exec('starter_view_b', 'SET smoke.uid=''' || host || '''');
  PERFORM dblink_send_query('starter_view_a', 'SELECT public.view_habitat(''' || host || ''')');
  PERFORM dblink_send_query('starter_view_b', 'SELECT public.claim_habitat_starter()');
  SELECT data INTO a FROM dblink_get_result('starter_view_a') x(data jsonb); PERFORM data FROM dblink_get_result('starter_view_a') x(data jsonb);
  SELECT data INTO b FROM dblink_get_result('starter_view_b') x(data jsonb); PERFORM data FROM dblink_get_result('starter_view_b') x(data jsonb);
  IF (a->>'ok')::boolean IS DISTINCT FROM true OR (b->>'ok')::boolean IS DISTINCT FROM true
    OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id = host) <> 4
    OR (SELECT count(*) FROM public.user_habitat_slots WHERE user_id = host) <> 3
    OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = host AND source = 'habitat_starter') <> 4 THEN
    RAISE EXCEPTION 'concurrent view/claim starter provisioning failed: %, %', a, b;
  END IF;
  PERFORM dblink_disconnect('starter_view_a'); PERFORM dblink_disconnect('starter_view_b');
  RAISE NOTICE 'chk habitat starter provisioning concurrency: authorized view and claim serialize OK';
END;
$concurrent$;
