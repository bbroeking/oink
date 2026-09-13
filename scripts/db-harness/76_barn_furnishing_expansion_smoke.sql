\set ON_ERROR_STOP on
DO $smoke$
DECLARE uid uuid:='00000000-0000-0000-0000-000000076001'; r jsonb; i text;
BEGIN
 IF (SELECT count(*) FROM public.habitat_items)<>118 THEN RAISE EXCEPTION 'catalog count'; END IF;
 IF (SELECT count(*) FROM public.habitat_items WHERE collection_id IS NOT NULL AND is_for_sale)<>80 THEN RAISE EXCEPTION 'paid count'; END IF;
 IF (SELECT count(*) FROM public.habitat_items WHERE reward_threshold IS NOT NULL)<>20 THEN RAISE EXCEPTION 'reward count'; END IF;
 INSERT INTO auth.users(id) VALUES(uid); INSERT INTO public.profiles(id,username,counter) VALUES(uid,'expansion-pig',10000);
 INSERT INTO public.user_habitats(user_id,interior_background_item_id) VALUES(uid,'warm_plank_barn');
 PERFORM set_config('smoke.uid',uid::text,true);
 FOREACH i IN ARRAY ARRAY['apple_crate_stool','pearwood_rocker','cider_jug_lamp'] LOOP r:=public.grant_habitat_item(uid,i,'smoke',i); END LOOP;
 IF EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=uid AND item_id='blossom_bough_mobile') THEN RAISE EXCEPTION 'early own4'; END IF;
 r:=public.grant_habitat_item(uid,'orchard_boot_rack','smoke','orchard_boot_rack');
 IF NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=uid AND item_id='blossom_bough_mobile') THEN RAISE EXCEPTION 'missing own4'; END IF;
 r:=public.grant_habitat_item(uid,'orchard_boot_rack','smoke','orchard_boot_rack');
 IF (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=uid AND item_id='blossom_bough_mobile')<>1 THEN RAISE EXCEPTION 'own4 replay duplicated'; END IF;
 FOREACH i IN ARRAY ARRAY['blossom_branch_print','apple_picking_apron','bluebird_sugar_bowl','tiny_cider_press'] LOOP r:=public.grant_habitat_item(uid,i,'smoke',i); END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=uid AND item_id='orchard_round_rug') THEN RAISE EXCEPTION 'missing own8'; END IF;
 r:=public.my_habitat_collection_progress();
 IF NOT (r->>'ok')::boolean OR (r#>>'{collections,0,ownedPaidCount}')::int<>8 THEN RAISE EXCEPTION 'progress bad %',r; END IF;
 r:=public.habitat_expansion_discovery(); IF NOT (r->>'pending')::boolean OR r->>'version'<>'barn100:v1' THEN RAISE EXCEPTION 'discovery bad %',r; END IF;
 r:=public.acknowledge_habitat_expansion('barn100:v1','00000000-0000-0000-0000-000000076099'); IF (r->>'replayed')::boolean THEN RAISE EXCEPTION 'first ack replay'; END IF;
 r:=public.acknowledge_habitat_expansion('barn100:v1','00000000-0000-0000-0000-000000076099'); IF NOT (r->>'replayed')::boolean THEN RAISE EXCEPTION 'ack not replay'; END IF;
 r:=public.habitat_expansion_discovery(); IF (r->>'pending')::boolean THEN RAISE EXCEPTION 'ack still pending'; END IF;
 IF has_function_privilege('authenticated','public.grant_habitat_item(uuid,text,text,text)','EXECUTE') OR has_table_privilege('authenticated','public.habitat_expansion_acknowledgments','INSERT') THEN RAISE EXCEPTION 'privilege leak'; END IF;
 RAISE NOTICE 'chk barn expansion: 100 catalog, own4/8 rewards, progress, discovery ack, privileges OK';
END $smoke$;
