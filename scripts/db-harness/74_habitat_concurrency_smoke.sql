\set ON_ERROR_STOP on
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000074001');
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000074002');
INSERT INTO public.profiles(id,username,counter) VALUES('00000000-0000-0000-0000-000000074001','habitat-racer',300),('00000000-0000-0000-0000-000000074002','habitat-visitor',0);
DO $concurrent$
DECLARE conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000'; pig uuid:='00000000-0000-0000-0000-000000074001'; a jsonb; b jsonb; successes int; layout jsonb;
BEGIN
	PERFORM dblink_connect('hab_a',conn); PERFORM dblink_connect('hab_b',conn); PERFORM dblink_connect('hab_c',conn); PERFORM dblink_connect('hab_d',conn);
	PERFORM dblink_exec('hab_a','SET ROLE authenticated'); PERFORM dblink_exec('hab_b','SET ROLE authenticated');
	PERFORM dblink_exec('hab_d','SET ROLE authenticated');
	PERFORM dblink_exec('hab_a','SET smoke.uid='''||pig||''''); PERFORM dblink_exec('hab_b','SET smoke.uid='''||pig||'''');
	PERFORM dblink_exec('hab_c','SET smoke.uid='''||pig||''''); PERFORM dblink_exec('hab_d','SET smoke.uid='''||pig||'''');
	PERFORM dblink_send_query('hab_a','SELECT public.claim_habitat_starter()'); PERFORM dblink_send_query('hab_b','SELECT public.claim_habitat_starter()');
	SELECT data INTO a FROM dblink_get_result('hab_a') x(data jsonb); PERFORM data FROM dblink_get_result('hab_a') x(data jsonb);
	SELECT data INTO b FROM dblink_get_result('hab_b') x(data jsonb); PERFORM data FROM dblink_get_result('hab_b') x(data jsonb);
	IF a->'snapshot'<>b->'snapshot' OR (SELECT count(*) FROM public.user_habitat_items WHERE user_id=pig)<>4 THEN RAISE EXCEPTION 'concurrent starter wrong % %',a,b; END IF;
	PERFORM dblink_send_query('hab_a','SELECT public.buy_habitat_item(''dried_herb_garland'',''74000000-0000-0000-0000-000000000001'')');
	SELECT data INTO a FROM dblink_get_result('hab_a') x(data jsonb); PERFORM data FROM dblink_get_result('hab_a') x(data jsonb);
	layout:=jsonb_build_object('interior_background','warm_plank_barn','wall','rosies_pencil_sketch','ceiling','dried_herb_garland','floor_left','sunflower_crock','floor_right',null,'floor_centerpiece','patchwork_rug','surface',null);
	PERFORM dblink_send_query('hab_a','SELECT public.save_habitat(0,''74000000-0000-0000-0000-000000000002'','''||layout::text||'''::jsonb)');
	PERFORM dblink_send_query('hab_b','SELECT public.save_habitat(0,''74000000-0000-0000-0000-000000000003'','''||layout::text||'''::jsonb)');
	SELECT data INTO a FROM dblink_get_result('hab_a') x(data jsonb); PERFORM data FROM dblink_get_result('hab_a') x(data jsonb);
	SELECT data INTO b FROM dblink_get_result('hab_b') x(data jsonb); PERFORM data FROM dblink_get_result('hab_b') x(data jsonb);
	successes:=(CASE WHEN COALESCE((a->>'ok')::boolean,false) THEN 1 ELSE 0 END)+(CASE WHEN COALESCE((b->>'ok')::boolean,false) THEN 1 ELSE 0 END);
	IF successes<>1 OR NOT ('revision_conflict'=ANY(ARRAY[a->>'reason',b->>'reason'])) OR (SELECT revision FROM public.user_habitats WHERE user_id=pig)<>1 THEN RAISE EXCEPTION 'concurrent saves wrong % %',a,b; END IF;
	-- Same purchase request on two connections charges exactly once.
	PERFORM dblink_send_query('hab_a','SELECT public.buy_habitat_item(''hay_bale'',''74000000-0000-0000-0000-000000000004'')');
	PERFORM dblink_send_query('hab_b','SELECT public.buy_habitat_item(''hay_bale'',''74000000-0000-0000-0000-000000000004'')');
	SELECT data INTO a FROM dblink_get_result('hab_a') x(data jsonb); PERFORM data FROM dblink_get_result('hab_a') x(data jsonb);
	SELECT data INTO b FROM dblink_get_result('hab_b') x(data jsonb); PERFORM data FROM dblink_get_result('hab_b') x(data jsonb);
	IF NOT (a->>'ok')::boolean OR NOT (b->>'ok')::boolean OR (SELECT count(*) FROM public.habitat_purchase_receipts WHERE user_id=pig AND request_id='74000000-0000-0000-0000-000000000004')<>1 OR (SELECT counter FROM public.profiles WHERE id=pig)<>200 THEN RAISE EXCEPTION 'same purchase concurrency wrong % %',a,b; END IF;
	-- Save, distinct purchase, starter retry, and guestbook award contend on the
	-- same habitat lock and all independently valid effects survive.
	PERFORM dblink_send_query('hab_a','SELECT public.save_habitat(1,''74000000-0000-0000-0000-000000000005'','''||layout::text||'''::jsonb)');
	PERFORM dblink_send_query('hab_b','SELECT public.buy_habitat_item(''pressed_clover_frame'',''74000000-0000-0000-0000-000000000006'')');
	PERFORM dblink_send_query('hab_c','WITH s AS (INSERT INTO public.barn_guestbook_stamps(visitor_id,host_id,visit_started_at,stamp_id) VALUES(''00000000-0000-0000-0000-000000074002'','''||pig||''',now(),''hoofprint'') RETURNING id) SELECT jsonb_build_object(''ok'',true,''id'',id) FROM s');
	PERFORM dblink_send_query('hab_d','SELECT public.claim_habitat_starter()');
	SELECT data INTO a FROM dblink_get_result('hab_a') x(data jsonb); PERFORM data FROM dblink_get_result('hab_a') x(data jsonb);
	SELECT data INTO b FROM dblink_get_result('hab_b') x(data jsonb); PERFORM data FROM dblink_get_result('hab_b') x(data jsonb);
	PERFORM data FROM dblink_get_result('hab_c') x(data jsonb); PERFORM data FROM dblink_get_result('hab_c') x(data jsonb);
	PERFORM data FROM dblink_get_result('hab_d') x(data jsonb); PERFORM data FROM dblink_get_result('hab_d') x(data jsonb);
	IF NOT (a->>'ok')::boolean OR NOT (b->>'ok')::boolean OR (SELECT revision FROM public.user_habitats WHERE user_id=pig)<>2 OR NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=pig AND item_id='guestbook_keepsake') OR NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=pig AND item_id='pressed_clover_frame') THEN RAISE EXCEPTION 'mixed concurrency lost effect % %',a,b; END IF;
	PERFORM dblink_disconnect('hab_a'); PERFORM dblink_disconnect('hab_b'); PERFORM dblink_disconnect('hab_c'); PERFORM dblink_disconnect('hab_d');
	RAISE NOTICE 'chk habitat concurrency: starter, saves, purchases, and guestbook serialize without loss';
END $concurrent$;
