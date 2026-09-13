\set ON_ERROR_STOP on

DO $smoke$
DECLARE owner uuid:='00000000-0000-0000-0000-000000073001'; friend uuid:='00000000-0000-0000-0000-000000073002'; stranger uuid:='00000000-0000-0000-0000-000000073003'; failed_owner uuid:='00000000-0000-0000-0000-000000073004';
 r jsonb; s jsonb; rev bigint; bal int; layout jsonb; ev record; failed boolean; paid uuid:='73000000-0000-0000-0000-000000000001'; save1 uuid:='73000000-0000-0000-0000-000000000002'; save2 uuid:='73000000-0000-0000-0000-000000000003';
BEGIN
	IF (SELECT count(*) FROM public.habitat_items)<>18 OR (SELECT sum(snout_cost) FROM public.habitat_items WHERE is_for_sale)<>1125 OR (SELECT count(*) FROM public.habitat_items WHERE is_for_sale)<>11 THEN RAISE EXCEPTION 'catalog roster/tune wrong'; END IF;
	INSERT INTO auth.users(id) VALUES(owner),(friend),(stranger),(failed_owner);
	INSERT INTO public.profiles(id,username,counter) VALUES(owner,'habitat-owner',1000),(friend,'habitat-friend',0),(stranger,'habitat-stranger',0),(failed_owner,'habitat-failed',0);
	INSERT INTO public.friendships(requester_id,receiver_id,status) VALUES(owner,friend,'accepted'),(owner,stranger,'pending');
	PERFORM set_config('smoke.uid',owner::text,true);
	FOR ev IN SELECT * FROM (VALUES ('habitat_opened','habitat'),('habitat_opened','visit'),('habitat_edit_started','habitat'),('habitat_layout_saved','habitat'),('habitat_item_acquired','habitat'),('habitat_item_acquired','shop'),('habitat_shop_opened','habitat'),('habitat_shop_opened','shop'),('habitat_save_conflicted','habitat')) x(event_name,surface) LOOP
		r:=public.record_interaction_event(gen_random_uuid(),ev.event_name,ev.surface); IF NOT COALESCE((r->>'ok')::boolean,false) THEN RAISE EXCEPTION 'analytics vocabulary missing %.%: %',ev.event_name,ev.surface,r; END IF;
	END LOOP;
	UPDATE public.habitat_items SET active=false WHERE id='warm_plank_barn'; PERFORM set_config('smoke.uid',failed_owner::text,true); failed:=false;
	BEGIN PERFORM public.claim_habitat_starter(); EXCEPTION WHEN OTHERS THEN failed:=true; END;
	IF NOT failed OR EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id=failed_owner) OR EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=failed_owner) OR EXISTS(SELECT 1 FROM public.habitat_grant_receipts WHERE user_id=failed_owner) THEN RAISE EXCEPTION 'starter grant failure was not atomic'; END IF;
	UPDATE public.habitat_items SET active=true WHERE id='warm_plank_barn'; PERFORM set_config('smoke.uid',owner::text,true);
	r:=public.claim_habitat_starter(); s:=public.claim_habitat_starter();
	IF NOT (r->>'ok')::boolean OR r->'snapshot'<>s->'snapshot' OR jsonb_array_length(r->'owned')<>4 OR (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id=owner AND source='habitat_starter')<>4 OR (r#>>'{snapshot,revision}')::int<>0 OR r#>>'{snapshot,positions,ceiling}' IS NOT NULL OR r#>>'{snapshot,positions,floor_right}' IS NOT NULL OR r#>>'{snapshot,positions,surface}' IS NOT NULL THEN RAISE EXCEPTION 'starter not stable/partial % %',r,s; END IF;
	r:=public.my_habitat();
	IF jsonb_array_length(r->'catalog')<>18 OR r->>'currentSnouts'<>'1000' OR NOT (r#>'{snapshot,positions}' ?& ARRAY['interior_background','wall','ceiling','floor_left','floor_right','floor_centerpiece','surface']) THEN RAISE EXCEPTION 'owner envelope wrong %',r; END IF;
	PERFORM set_config('smoke.uid',friend::text,true); r:=public.view_habitat(owner);
	IF NOT (r->>'ok')::boolean OR r ? 'owned' OR r::text LIKE '%snoutCost%' THEN RAISE EXCEPTION 'friend snapshot leak %',r; END IF;
	PERFORM set_config('smoke.uid',stranger::text,true); r:=public.view_habitat(owner); IF r->>'reason'<>'not_friends' THEN RAISE EXCEPTION 'stranger read %',r; END IF;
	r:=public.view_habitat('00000000-0000-0000-0000-000000073099'); IF r->>'reason'<>'invalid_owner' THEN RAISE EXCEPTION 'invalid owner %',r; END IF;
	PERFORM set_config('smoke.uid',friend::text,true); PERFORM set_config('smoke.blocked_pair',friend::text||':'||owner::text,true); r:=public.view_habitat(owner); IF r->>'reason'<>'blocked' THEN RAISE EXCEPTION 'blocked read %',r; END IF; PERFORM set_config('smoke.blocked_pair','',true);
	PERFORM set_config('smoke.uid','',true); r:=public.view_habitat(owner); IF r->>'reason'<>'not_authenticated' THEN RAISE EXCEPTION 'anonymous read %',r; END IF;
	PERFORM set_config('smoke.uid',owner::text,true);
	r:=public.buy_habitat_item('dried_herb_garland',paid); s:=public.buy_habitat_item('dried_herb_garland',paid);
	IF NOT (r->>'ok')::boolean OR NOT (s->>'replayed')::boolean OR (SELECT counter FROM public.profiles WHERE id=owner)<>950 OR (s#>>'{receipt,balanceAfterPurchase}')::int<>950 THEN RAISE EXCEPTION 'purchase/replay wrong % %',r,s; END IF;
	UPDATE public.profiles SET counter=counter+7 WHERE id=owner; s:=public.buy_habitat_item('dried_herb_garland',paid);
	IF (s->>'currentSnouts')::int<>957 OR (s#>>'{receipt,balanceAfterPurchase}')::int<>950 THEN RAISE EXCEPTION 'historical/fresh wallet wrong %',s; END IF;
	s:=public.buy_habitat_item('pressed_clover_frame',paid); IF s->>'reason'<>'idempotency_mismatch' OR (SELECT counter FROM public.profiles WHERE id=owner)<>957 THEN RAISE EXCEPTION 'purchase mismatch mutated %',s; END IF;
	s:=public.buy_habitat_item(NULL,paid); IF s->>'reason'<>'idempotency_mismatch' THEN RAISE EXCEPTION 'null purchase replay mismatch %',s; END IF;
	r:=public.buy_habitat_item('dried_herb_garland','73000000-0000-0000-0000-000000000004'); IF r->>'reason'<>'already_owned' THEN RAISE EXCEPTION 'repeat ownership %',r; END IF;
	UPDATE public.profiles SET counter=0 WHERE id=owner; r:=public.buy_habitat_item('tiny_radio','73000000-0000-0000-0000-000000000005'); IF r->>'reason'<>'insufficient_snouts' THEN RAISE EXCEPTION 'affordability %',r; END IF;
	UPDATE public.habitat_items SET active=false WHERE id='pressed_clover_frame'; r:=public.buy_habitat_item('pressed_clover_frame','73000000-0000-0000-0000-000000000010'); IF r->>'reason'<>'inactive' THEN RAISE EXCEPTION 'inactive sale %',r; END IF; UPDATE public.habitat_items SET active=true WHERE id='pressed_clover_frame';
	UPDATE public.habitat_items SET active=false WHERE id='dried_herb_garland';
	layout:=jsonb_build_object('interior_background','warm_plank_barn','wall','rosies_pencil_sketch','ceiling','dried_herb_garland','floor_left',null,'floor_right',null,'floor_centerpiece','patchwork_rug','surface',null);
	UPDATE public.habitat_items SET active=false WHERE id='apple_basket'; failed:=false;
	BEGIN PERFORM public.save_habitat(0,save1,layout); EXCEPTION WHEN OTHERS THEN failed:=true; END;
	IF NOT failed OR EXISTS(SELECT 1 FROM public.habitat_milestones WHERE user_id=owner AND milestone='first_custom_layout:v1') OR (SELECT revision FROM public.user_habitats WHERE user_id=owner)<>0 THEN RAISE EXCEPTION 'failed milestone grant was consumed'; END IF;
	UPDATE public.habitat_items SET active=true WHERE id='apple_basket';
	r:=public.save_habitat(0,save1,layout); s:=public.save_habitat(0,save1,layout);
	IF NOT (r->>'ok')::boolean OR (r->>'replayed')::boolean OR NOT (s->>'replayed')::boolean OR (r#>>'{snapshot,revision}')::int<>1 OR NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=owner AND item_id='apple_basket') THEN RAISE EXCEPTION 'save/replay/milestone % %',r,s; END IF;
	r:=public.save_habitat(0,save2,layout); IF r->>'reason'<>'revision_conflict' OR (r#>>'{snapshot,revision}')::int<>1 THEN RAISE EXCEPTION 'stale save %',r; END IF;
	-- A later starter retry must not restore a starter item the owner removed.
	s:=public.claim_habitat_starter(); IF s#>>'{snapshot,positions,floor_left}' IS NOT NULL THEN RAISE EXCEPTION 'starter retry changed saved layout %',s; END IF;
	r:=public.save_habitat(1,save1,layout); IF r->>'reason'<>'idempotency_mismatch' THEN RAISE EXCEPTION 'save request mismatch %',r; END IF;
	SELECT revision INTO rev FROM public.user_habitats WHERE user_id=owner;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000006',layout||jsonb_build_object('interior_background',null)); IF r->>'reason'<>'null_background' THEN RAISE EXCEPTION 'null bg %',r; END IF;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000007',layout||jsonb_build_object('wall','sunflower_crock')); IF r->>'reason'<>'category_mismatch' THEN RAISE EXCEPTION 'category %',r; END IF;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000008',layout||jsonb_build_object('wall','pressed_clover_frame')); IF r->>'reason'<>'unowned_item' THEN RAISE EXCEPTION 'unowned %',r; END IF;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000009',layout||jsonb_build_object('bogus',null)); IF r->>'reason'<>'invalid_layout' THEN RAISE EXCEPTION 'malformed %',r; END IF;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000011',layout||jsonb_build_object('wall','missing_item')); IF r->>'reason'<>'unknown_item' THEN RAISE EXCEPTION 'unknown %',r; END IF;
	r:=public.save_habitat(rev,'73000000-0000-0000-0000-000000000012',layout||jsonb_build_object('floor_left','sunflower_crock','floor_right','sunflower_crock')); IF r->>'reason'<>'duplicate_item' THEN RAISE EXCEPTION 'duplicate %',r; END IF;
	-- Inactive ownership stays placeable; save 1 above already persisted this item.
	IF NOT EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id=owner AND item_id='dried_herb_garland') THEN RAISE EXCEPTION 'inactive owned placement disappeared'; END IF;
	UPDATE public.habitat_items SET active=true WHERE id='dried_herb_garland';
	r:=public.grant_habitat_item(owner,'tiny_radio','smoke_award','event-1'); s:=public.grant_habitat_item(owner,'tiny_radio','smoke_award','event-1');
	IF r<>s OR NOT (r->>'newlyOwned')::boolean OR EXISTS(SELECT 1 FROM public.user_habitat_slots WHERE user_id=owner AND item_id='tiny_radio') THEN RAISE EXCEPTION 'grant idempotency/placement % %',r,s; END IF;
	s:=public.grant_habitat_item(owner,'apple_basket','smoke_award','event-1'); IF s->>'reason'<>'idempotency_mismatch' THEN RAISE EXCEPTION 'grant mismatch %',s; END IF;
	s:=public.grant_habitat_item(owner,NULL,'smoke_award','event-1'); IF s->>'reason'<>'idempotency_mismatch' THEN RAISE EXCEPTION 'null grant replay mismatch %',s; END IF;
	UPDATE public.habitat_items SET active=false WHERE id='guestbook_keepsake'; failed:=false;
	BEGIN INSERT INTO public.barn_guestbook_stamps(visitor_id,host_id,visit_started_at,stamp_id) VALUES(friend,owner,now()-interval '1 second','sparkle'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
	IF NOT failed OR EXISTS(SELECT 1 FROM public.habitat_milestones WHERE user_id=owner AND milestone='first_guestbook_received:v1') OR EXISTS(SELECT 1 FROM public.barn_guestbook_stamps WHERE host_id=owner) THEN RAISE EXCEPTION 'guestbook grant failure was not atomic'; END IF;
	UPDATE public.habitat_items SET active=true WHERE id='guestbook_keepsake';
	INSERT INTO public.barn_guestbook_stamps(visitor_id,host_id,visit_started_at,stamp_id) VALUES(friend,owner,now(),'hoofprint');
	INSERT INTO public.barn_guestbook_stamps(visitor_id,host_id,visit_started_at,stamp_id) VALUES(stranger,owner,now()+interval '1 second','heart');
	IF (SELECT count(*) FROM public.habitat_milestones WHERE user_id=owner AND milestone='first_guestbook_received:v1')<>1 OR NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=owner AND item_id='guestbook_keepsake') THEN RAISE EXCEPTION 'guestbook milestone wrong'; END IF;
	IF has_table_privilege('authenticated','public.user_habitats','INSERT') OR has_function_privilege('authenticated','public.grant_habitat_item(uuid,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'client mutation/grant privilege leaked'; END IF;
	RAISE NOTICE 'chk habitat: catalog, starter, snapshots, authorization, save, purchase, grants, guestbook, privileges OK';
END $smoke$;
