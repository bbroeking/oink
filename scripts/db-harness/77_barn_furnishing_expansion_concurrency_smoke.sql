\set ON_ERROR_STOP on
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000077001');
INSERT INTO public.profiles(id,username,counter) VALUES('00000000-0000-0000-0000-000000077001','expansion-racer',1000);
INSERT INTO public.user_habitats(user_id,interior_background_item_id) VALUES('00000000-0000-0000-0000-000000077001','warm_plank_barn');
SELECT public.grant_habitat_item('00000000-0000-0000-0000-000000077001','apple_crate_stool','race-prep','one');
SELECT public.grant_habitat_item('00000000-0000-0000-0000-000000077001','pearwood_rocker','race-prep','two');
DO $concurrent$
DECLARE conn text:='host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000'; uid uuid:='00000000-0000-0000-0000-000000077001'; a jsonb; b jsonb; replay_count int;
BEGIN
 PERFORM dblink_connect('exp_a',conn); PERFORM dblink_connect('exp_b',conn);
 PERFORM dblink_exec('exp_a','SET smoke.uid='''||uid||''''); PERFORM dblink_exec('exp_b','SET smoke.uid='''||uid||'''');
 PERFORM dblink_send_query('exp_a','SELECT public.grant_habitat_item('''||uid||''',''cider_jug_lamp'',''race'',''three'') FROM (SELECT pg_sleep(0.1)) wait');
 PERFORM dblink_send_query('exp_b','SELECT public.grant_habitat_item('''||uid||''',''orchard_boot_rack'',''race'',''four'')');
 SELECT data INTO b FROM dblink_get_result('exp_b') x(data jsonb); PERFORM data FROM dblink_get_result('exp_b') x(data jsonb);
 SELECT data INTO a FROM dblink_get_result('exp_a') x(data jsonb); PERFORM data FROM dblink_get_result('exp_a') x(data jsonb);
 IF NOT (a->>'ok')::boolean OR NOT (b->>'ok')::boolean THEN RAISE EXCEPTION 'concurrent grants failed % %',a,b; END IF;
 IF (SELECT count(*) FROM public.habitat_milestones WHERE user_id=uid AND milestone='collection:orchard_morning:own4:v1')<>1 OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=uid AND item_id='blossom_bough_mobile')<>1 THEN RAISE EXCEPTION 'threshold granted more/less than once'; END IF;
 PERFORM dblink_exec('exp_a','SET ROLE authenticated'); PERFORM dblink_exec('exp_b','SET ROLE authenticated');
 PERFORM dblink_send_query('exp_a','SELECT public.acknowledge_habitat_expansion(''barn100:v1'',''77000000-0000-0000-0000-000000000001'') FROM (SELECT pg_sleep(0.1)) wait');
 PERFORM dblink_send_query('exp_b','SELECT public.acknowledge_habitat_expansion(''barn100:v1'',''77000000-0000-0000-0000-000000000002'')');
 SELECT data INTO b FROM dblink_get_result('exp_b') x(data jsonb); PERFORM data FROM dblink_get_result('exp_b') x(data jsonb);
 SELECT data INTO a FROM dblink_get_result('exp_a') x(data jsonb); PERFORM data FROM dblink_get_result('exp_a') x(data jsonb);
 replay_count:=(CASE WHEN (a->>'replayed')::boolean THEN 1 ELSE 0 END)+(CASE WHEN (b->>'replayed')::boolean THEN 1 ELSE 0 END);
 IF replay_count<>1 OR (SELECT count(*) FROM public.habitat_expansion_acknowledgments WHERE user_id=uid)<>1 THEN RAISE EXCEPTION 'concurrent ack wrong % %',a,b; END IF;
 PERFORM dblink_disconnect('exp_a'); PERFORM dblink_disconnect('exp_b');
 RAISE NOTICE 'chk barn expansion concurrency: threshold and discovery acknowledgment exactly once';
END $concurrent$;
