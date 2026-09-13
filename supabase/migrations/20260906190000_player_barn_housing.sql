-- Personal Barn housing: dedicated catalog, durable ownership/layouts, and
-- replay-safe starter, save, purchase, and deterministic grant contracts.
-- Authored for local verification; do not push without explicit user approval.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.app_config(key, enabled)
VALUES ('habitat', false)
ON CONFLICT (key) DO NOTHING;

DO $analytics$
DECLARE definition text; marker text:='(''oinkogram_shared'', ''share'')'; expanded text;
BEGIN
	IF to_regprocedure('public.record_interaction_event(uuid,text,text,text,uuid,text,text,text,jsonb)') IS NULL THEN RAISE EXCEPTION 'record_interaction_event canonical function is missing'; END IF;
	SELECT pg_get_functiondef('public.record_interaction_event(uuid,text,text,text,uuid,text,text,text,jsonb)'::regprocedure) INTO definition;
	expanded:=marker||',
      (''habitat_opened'', ''habitat''), (''habitat_opened'', ''visit''),
      (''habitat_edit_started'', ''habitat''), (''habitat_layout_saved'', ''habitat''),
      (''habitat_item_acquired'', ''habitat''), (''habitat_item_acquired'', ''shop''),
      (''habitat_shop_opened'', ''habitat''), (''habitat_shop_opened'', ''shop''),
      (''habitat_save_conflicted'', ''habitat'')';
	IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'record_interaction_event vocabulary marker changed'; END IF;
	EXECUTE replace(definition,marker,expanded);
END $analytics$;

CREATE TABLE public.habitat_items (
	id text PRIMARY KEY,
	name text NOT NULL,
	description text NOT NULL,
	category text NOT NULL CHECK (category IN (
		'interior_background','wall_decor','ceiling_decor','floor_decor',
		'floor_centerpiece','surface_decor'
	)),
	rarity text NOT NULL CHECK (rarity IN ('common','uncommon','rare')),
	asset_key text NOT NULL UNIQUE,
	snout_cost int NOT NULL DEFAULT 0 CHECK (snout_cost >= 0),
	is_for_sale boolean NOT NULL DEFAULT false,
	display_order int NOT NULL UNIQUE,
	active boolean NOT NULL DEFAULT true,
	CHECK (NOT is_for_sale OR snout_cost > 0)
);

INSERT INTO public.habitat_items
	(id,name,description,category,rarity,asset_key,snout_cost,is_for_sale,display_order)
VALUES
	('warm_plank_barn','Warm Plank Barn','Honeyed timber, soft daylight, and a room that already feels like home.','interior_background','common','warm_plank_barn',0,false,10),
	('spring_whitewash','Spring Whitewash','Airy whitewashed boards brightened by spring green trim.','interior_background','uncommon','spring_whitewash',100,true,20),
	('midnight_rafters','Midnight Rafters','Deep blue rafters glowing with a calm evening warmth.','interior_background','rare','midnight_rafters',175,true,30),
	('rosies_pencil_sketch','Rosie''s Pencil Sketch','A fond little portrait drawn with a very serious pencil.','wall_decor','common','rosies_pencil_sketch',0,false,40),
	('pressed_clover_frame','Pressed Clover Frame','A lucky clover saved between glass and worn wood.','wall_decor','common','pressed_clover_frame',50,true,50),
	('barn_bunting','Barn Bunting','Cheerful fabric flags stitched for barn-sized celebrations.','wall_decor','uncommon','barn_bunting',100,true,60),
	('firefly_lantern','Firefly Lantern','A gentle lantern earned by making every corner feel lived in.','ceiling_decor','rare','firefly_lantern',0,false,70),
	('dried_herb_garland','Dried Herb Garland','Fragrant garden herbs tied along a rustic cord.','ceiling_decor','common','dried_herb_garland',50,true,80),
	('sunflower_crock','Sunflower Crock','A sturdy crock packed with sunny barnyard blooms.','floor_decor','common','sunflower_crock',0,false,90),
	('reading_chair','Reading Chair','A cozy chair made for stories and afternoon snoozes.','floor_decor','uncommon','reading_chair',100,true,100),
	('hay_bale','Hay Bale','A tidy golden bale with just enough rustic charm.','floor_decor','common','hay_bale',50,true,110),
	('milk_can_lamp','Milk-can Lamp','A polished old milk can turned into a warm standing lamp.','floor_decor','rare','milk_can_lamp',175,true,120),
	('patchwork_rug','Patchwork Rug','A soft hand-sewn rug with a square for every good memory.','floor_centerpiece','common','patchwork_rug',0,false,130),
	('braided_straw_rug','Braided Straw Rug','A neat spiral woven from sun-dried straw.','floor_centerpiece','common','braided_straw_rug',50,true,140),
	('muddy_paw_rug','Muddy Paw Rug','A handsome rug that has already met one muddy hoof.','floor_centerpiece','uncommon','muddy_paw_rug',100,true,150),
	('apple_basket','Apple Basket','A brimming basket earned by making the Barn your own.','surface_decor','uncommon','apple_basket',0,false,160),
	('guestbook_keepsake','Guestbook Keepsake','A small keepsake celebrating the first friend who left their mark.','surface_decor','rare','guestbook_keepsake',0,false,170),
	('tiny_radio','Tiny Radio','A pocket-sized radio tuned to warm barn melodies.','surface_decor','rare','tiny_radio',175,true,180);

CREATE TABLE public.user_habitat_items (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	item_id text NOT NULL REFERENCES public.habitat_items(id),
	acquired_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,item_id)
);
CREATE TABLE public.user_habitats (
	user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	interior_background_item_id text NOT NULL REFERENCES public.habitat_items(id),
	revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
	starter_claimed_at timestamptz,
	updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_habitat_slots (
	user_id uuid NOT NULL REFERENCES public.user_habitats(user_id) ON DELETE CASCADE,
	position text NOT NULL CHECK (position IN ('wall','ceiling','floor_left','floor_right','floor_centerpiece','surface')),
	item_id text NOT NULL REFERENCES public.habitat_items(id),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,position),
	UNIQUE (user_id,item_id)
);
CREATE TABLE public.habitat_grant_receipts (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	source text NOT NULL CHECK (length(source) BETWEEN 1 AND 80),
	source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 200),
	item_id text NOT NULL REFERENCES public.habitat_items(id),
	newly_owned boolean NOT NULL,
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,source,source_ref)
);
CREATE TABLE public.habitat_milestones (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	milestone text NOT NULL,
	event_ref text,
	item_id text NOT NULL REFERENCES public.habitat_items(id),
	completed_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,milestone)
);
CREATE TABLE public.habitat_save_receipts (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	request_id uuid NOT NULL,
	payload_hash text NOT NULL,
	resulting_revision bigint NOT NULL,
	result_snapshot jsonb NOT NULL,
	saved_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,request_id)
);
CREATE TABLE public.habitat_purchase_receipts (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	request_id uuid NOT NULL,
	item_id text NOT NULL REFERENCES public.habitat_items(id),
	snout_cost int NOT NULL CHECK (snout_cost >= 0),
	balance_after_purchase bigint NOT NULL CHECK (balance_after_purchase >= 0),
	purchased_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id,request_id)
);

ALTER TABLE public.habitat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_habitat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_habitats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_habitat_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_grant_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_save_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_purchase_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY habitat_catalog_authenticated_read ON public.habitat_items FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.habitat_items,public.user_habitat_items,public.user_habitats,public.user_habitat_slots,public.habitat_grant_receipts,public.habitat_milestones,public.habitat_save_receipts,public.habitat_purchase_receipts FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.habitat_items,public.user_habitat_items,public.user_habitats,public.user_habitat_slots,public.habitat_grant_receipts,public.habitat_milestones,public.habitat_save_receipts,public.habitat_purchase_receipts FROM authenticated;
GRANT SELECT ON public.habitat_items TO authenticated;

CREATE OR REPLACE FUNCTION public._habitat_item_json(p_item public.habitat_items, p_catalog boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO public AS $$
	SELECT jsonb_strip_nulls(jsonb_build_object(
		'id',p_item.id,'name',p_item.name,'description',p_item.description,
		'category',p_item.category,'rarity',p_item.rarity,'assetKey',p_item.asset_key,
		'snoutCost',CASE WHEN p_catalog THEN p_item.snout_cost END,
		'isForSale',CASE WHEN p_catalog THEN p_item.is_for_sale END,
		'active',CASE WHEN p_catalog THEN p_item.active END,
		'displayOrder',CASE WHEN p_catalog THEN p_item.display_order END));
$$;

CREATE OR REPLACE FUNCTION public._habitat_snapshot(p_owner uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
	SELECT jsonb_build_object('ownerId',h.user_id,'revision',h.revision,'positions',
		jsonb_build_object(
			'interior_background',public._habitat_item_json(bg,false),
			'wall',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='wall'),
			'ceiling',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='ceiling'),
			'floor_left',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_left'),
			'floor_right',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_right'),
			'floor_centerpiece',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_centerpiece'),
			'surface',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='surface')))
	FROM public.user_habitats h JOIN public.habitat_items bg ON bg.id=h.interior_background_item_id WHERE h.user_id=p_owner;
$$;

CREATE OR REPLACE FUNCTION public.grant_habitat_item(p_user_id uuid,p_item_id text,p_source text,p_source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE old public.habitat_grant_receipts%ROWTYPE; item public.habitat_items%ROWTYPE; fresh_count int; stamped timestamptz:=now();
BEGIN
	IF p_user_id IS NULL OR p_source IS NULL OR p_source_ref IS NULL OR btrim(p_source)='' OR btrim(p_source_ref)='' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_grant'); END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||p_user_id::text,0));
	SELECT * INTO old FROM public.habitat_grant_receipts WHERE user_id=p_user_id AND source=p_source AND source_ref=p_source_ref;
	IF FOUND THEN
		IF old.item_id IS DISTINCT FROM p_item_id THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF;
		RETURN jsonb_build_object('ok',true,'itemId',old.item_id,'newlyOwned',old.newly_owned,'grantedAt',old.granted_at);
	END IF;
	SELECT * INTO item FROM public.habitat_items WHERE id=p_item_id;
	IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item'); END IF;
	IF NOT item.active THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
	INSERT INTO public.user_habitat_items(user_id,item_id) VALUES(p_user_id,p_item_id) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS fresh_count=ROW_COUNT;
	INSERT INTO public.habitat_grant_receipts(user_id,source,source_ref,item_id,newly_owned,granted_at) VALUES(p_user_id,p_source,p_source_ref,p_item_id,fresh_count=1,stamped);
	RETURN jsonb_build_object('ok',true,'itemId',p_item_id,'newlyOwned',fresh_count=1,'grantedAt',stamped);
END $$;
REVOKE ALL ON FUNCTION public.grant_habitat_item(uuid,text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._require_habitat_grant(p_user_id uuid,p_item_id text,p_source text,p_source_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE result jsonb;
BEGIN
	result:=public.grant_habitat_item(p_user_id,p_item_id,p_source,p_source_ref);
	IF NOT COALESCE((result->>'ok')::boolean,false) THEN RAISE EXCEPTION 'habitat grant failed: %',result USING ERRCODE='P0001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._require_habitat_grant(uuid,text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_habitat_starter()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); snap jsonb; owned jsonb; catalog jsonb; bal bigint; created_count int;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||uid::text,0));
	INSERT INTO public.user_habitats(user_id,interior_background_item_id,starter_claimed_at) VALUES(uid,'warm_plank_barn',now()) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS created_count=ROW_COUNT;
	PERFORM public._require_habitat_grant(uid,'warm_plank_barn','habitat_starter','starter:v1:interior_background:warm_plank_barn');
	PERFORM public._require_habitat_grant(uid,'rosies_pencil_sketch','habitat_starter','starter:v1:wall:rosies_pencil_sketch');
	PERFORM public._require_habitat_grant(uid,'sunflower_crock','habitat_starter','starter:v1:floor_left:sunflower_crock');
	PERFORM public._require_habitat_grant(uid,'patchwork_rug','habitat_starter','starter:v1:floor_centerpiece:patchwork_rug');
	IF created_count=1 THEN
		INSERT INTO public.user_habitat_slots(user_id,position,item_id) VALUES(uid,'wall','rosies_pencil_sketch'),(uid,'floor_left','sunflower_crock'),(uid,'floor_centerpiece','patchwork_rug');
	END IF;
	SELECT public._habitat_snapshot(uid) INTO snap;
	SELECT COALESCE(jsonb_agg(public._habitat_item_json(i,true) ORDER BY i.display_order),'[]') INTO owned FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id WHERE o.user_id=uid;
	SELECT COALESCE(jsonb_agg(public._habitat_item_json(i,true) ORDER BY i.display_order),'[]') INTO catalog FROM public.habitat_items i;
	SELECT counter INTO bal FROM public.profiles WHERE id=uid;
	RETURN jsonb_build_object('ok',true,'snapshot',snap,'owned',owned,'catalog',catalog,'currentSnouts',COALESCE(bal,0));
END $$;

CREATE OR REPLACE FUNCTION public.my_habitat()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); snap jsonb; owned jsonb; catalog jsonb; bal bigint;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
	SELECT public._habitat_snapshot(uid) INTO snap;
	IF snap IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
	SELECT COALESCE(jsonb_agg(public._habitat_item_json(i,true) ORDER BY i.display_order),'[]') INTO owned FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id WHERE o.user_id=uid;
	SELECT COALESCE(jsonb_agg(public._habitat_item_json(i,true) ORDER BY i.display_order),'[]') INTO catalog FROM public.habitat_items i;
	SELECT counter INTO bal FROM public.profiles WHERE id=uid;
	RETURN jsonb_build_object('ok',true,'snapshot',snap,'owned',owned,'catalog',catalog,'currentSnouts',COALESCE(bal,0));
END $$;

CREATE OR REPLACE FUNCTION public.view_habitat(p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); snap jsonb;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
	IF p_owner IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_owner) THEN RETURN jsonb_build_object('ok',false,'reason','invalid_owner'); END IF;
	IF uid<>p_owner THEN
		IF public.are_blocked(uid,p_owner) THEN RETURN jsonb_build_object('ok',false,'reason','blocked'); END IF;
		IF NOT EXISTS(SELECT 1 FROM public.friendships f WHERE f.status='accepted' AND ((f.requester_id=uid AND f.receiver_id=p_owner) OR (f.requester_id=p_owner AND f.receiver_id=uid))) THEN RETURN jsonb_build_object('ok',false,'reason','not_friends'); END IF;
	END IF;
	SELECT public._habitat_snapshot(p_owner) INTO snap;
	IF snap IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
	RETURN jsonb_build_object('ok',true,'snapshot',snap);
END $$;

CREATE OR REPLACE FUNCTION public.save_habitat(p_expected_revision bigint,p_request_id uuid,p_positions jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); rec public.habitat_save_receipts%ROWTYPE; h public.user_habitats%ROWTYPE; normalized jsonb; phash text; pos text; iid text; cat text; expected_cat text; snap jsonb; custom boolean; full_layout boolean; ins int;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
	IF p_request_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request_id'); END IF;
	IF jsonb_typeof(p_positions)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_positions))<>7 OR NOT p_positions ?& ARRAY['interior_background','wall','ceiling','floor_left','floor_right','floor_centerpiece','surface'] THEN RETURN jsonb_build_object('ok',false,'reason','invalid_layout'); END IF;
	normalized:=jsonb_build_object('interior_background',p_positions->'interior_background','wall',p_positions->'wall','ceiling',p_positions->'ceiling','floor_left',p_positions->'floor_left','floor_right',p_positions->'floor_right','floor_centerpiece',p_positions->'floor_centerpiece','surface',p_positions->'surface');
	phash:=encode(extensions.digest(convert_to('habitat-save:v1|'||COALESCE(p_expected_revision::text,'null')||'|'||normalized::text,'UTF8'),'sha256'),'hex');
	SELECT * INTO rec FROM public.habitat_save_receipts WHERE user_id=uid AND request_id=p_request_id;
	IF FOUND THEN IF rec.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF; RETURN jsonb_build_object('ok',true,'snapshot',rec.result_snapshot,'replayed',true); END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||uid::text,0));
	SELECT * INTO rec FROM public.habitat_save_receipts WHERE user_id=uid AND request_id=p_request_id;
	IF FOUND THEN IF rec.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF; RETURN jsonb_build_object('ok',true,'snapshot',rec.result_snapshot,'replayed',true); END IF;
	SELECT * INTO h FROM public.user_habitats WHERE user_id=uid FOR UPDATE;
	IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
	IF p_expected_revision IS NULL OR h.revision<>p_expected_revision THEN RETURN jsonb_build_object('ok',false,'reason','revision_conflict','snapshot',public._habitat_snapshot(uid)); END IF;
	IF p_positions->'interior_background'='null'::jsonb OR jsonb_typeof(p_positions->'interior_background')<>'string' THEN RETURN jsonb_build_object('ok',false,'reason','null_background'); END IF;
	FOR pos IN SELECT unnest(ARRAY['interior_background','wall','ceiling','floor_left','floor_right','floor_centerpiece','surface']) LOOP
		IF p_positions->pos<>'null'::jsonb THEN
			IF jsonb_typeof(p_positions->pos)<>'string' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_layout'); END IF;
			iid:=p_positions->>pos;
			SELECT category INTO cat FROM public.habitat_items WHERE id=iid;
			IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item','position',pos); END IF;
			IF NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=uid AND item_id=iid) THEN RETURN jsonb_build_object('ok',false,'reason','unowned_item','position',pos); END IF;
			expected_cat:=CASE pos WHEN 'interior_background' THEN 'interior_background' WHEN 'wall' THEN 'wall_decor' WHEN 'ceiling' THEN 'ceiling_decor' WHEN 'floor_left' THEN 'floor_decor' WHEN 'floor_right' THEN 'floor_decor' WHEN 'floor_centerpiece' THEN 'floor_centerpiece' ELSE 'surface_decor' END;
			IF cat<>expected_cat THEN RETURN jsonb_build_object('ok',false,'reason','category_mismatch','position',pos); END IF;
		END IF;
	END LOOP;
	IF EXISTS(SELECT 1 FROM jsonb_each(p_positions) WHERE value<>'null'::jsonb GROUP BY value HAVING count(*)>1) THEN RETURN jsonb_build_object('ok',false,'reason','duplicate_item'); END IF;
	custom:=normalized<>jsonb_build_object('interior_background','warm_plank_barn','wall','rosies_pencil_sketch','ceiling',null,'floor_left','sunflower_crock','floor_right',null,'floor_centerpiece','patchwork_rug','surface',null);
	full_layout:=NOT EXISTS(SELECT 1 FROM unnest(ARRAY['wall','ceiling','floor_left','floor_right','floor_centerpiece','surface']) p WHERE p_positions->p='null'::jsonb);
	IF custom THEN INSERT INTO public.habitat_milestones(user_id,milestone,item_id) VALUES(uid,'first_custom_layout:v1','apple_basket') ON CONFLICT DO NOTHING; GET DIAGNOSTICS ins=ROW_COUNT; IF ins=1 THEN PERFORM public._require_habitat_grant(uid,'apple_basket','habitat_milestone','first_custom_layout:v1'); END IF; END IF;
	IF full_layout THEN INSERT INTO public.habitat_milestones(user_id,milestone,item_id) VALUES(uid,'first_full_layout:v1','firefly_lantern') ON CONFLICT DO NOTHING; GET DIAGNOSTICS ins=ROW_COUNT; IF ins=1 THEN PERFORM public._require_habitat_grant(uid,'firefly_lantern','habitat_milestone','first_full_layout:v1'); END IF; END IF;
	UPDATE public.user_habitats SET interior_background_item_id=p_positions->>'interior_background',revision=revision+1,updated_at=now() WHERE user_id=uid;
	DELETE FROM public.user_habitat_slots WHERE user_id=uid;
	INSERT INTO public.user_habitat_slots(user_id,position,item_id) SELECT uid,key,value #>> '{}' FROM jsonb_each(p_positions) WHERE key<>'interior_background' AND value<>'null'::jsonb;
	SELECT public._habitat_snapshot(uid) INTO snap;
	INSERT INTO public.habitat_save_receipts(user_id,request_id,payload_hash,resulting_revision,result_snapshot) VALUES(uid,p_request_id,phash,(snap->>'revision')::bigint,snap);
	RETURN jsonb_build_object('ok',true,'snapshot',snap,'replayed',false);
END $$;

CREATE OR REPLACE FUNCTION public.buy_habitat_item(p_item_id text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); rec public.habitat_purchase_receipts%ROWTYPE; item public.habitat_items%ROWTYPE; bal bigint; grant_result jsonb;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
	IF p_request_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request_id'); END IF;
	SELECT * INTO rec FROM public.habitat_purchase_receipts WHERE user_id=uid AND request_id=p_request_id;
	IF FOUND THEN IF rec.item_id IS DISTINCT FROM p_item_id THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF; SELECT counter INTO bal FROM public.profiles WHERE id=uid; SELECT * INTO item FROM public.habitat_items WHERE id=rec.item_id; RETURN jsonb_build_object('ok',true,'item',public._habitat_item_json(item,true),'receipt',jsonb_build_object('snoutCost',rec.snout_cost,'balanceAfterPurchase',rec.balance_after_purchase),'currentSnouts',bal,'newlyOwned',true,'replayed',true); END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id=uid FOR UPDATE;
	IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||uid::text,0));
	SELECT * INTO rec FROM public.habitat_purchase_receipts WHERE user_id=uid AND request_id=p_request_id;
	IF FOUND THEN IF rec.item_id IS DISTINCT FROM p_item_id THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF; SELECT counter INTO bal FROM public.profiles WHERE id=uid; SELECT * INTO item FROM public.habitat_items WHERE id=rec.item_id; RETURN jsonb_build_object('ok',true,'item',public._habitat_item_json(item,true),'receipt',jsonb_build_object('snoutCost',rec.snout_cost,'balanceAfterPurchase',rec.balance_after_purchase),'currentSnouts',bal,'newlyOwned',true,'replayed',true); END IF;
	SELECT * INTO item FROM public.habitat_items WHERE id=p_item_id;
	IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item'); END IF;
	IF NOT item.active THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
	IF NOT item.is_for_sale THEN RETURN jsonb_build_object('ok',false,'reason','not_for_sale'); END IF;
	IF EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=uid AND item_id=p_item_id) THEN RETURN jsonb_build_object('ok',false,'reason','already_owned'); END IF;
	IF bal<item.snout_cost THEN RETURN jsonb_build_object('ok',false,'reason','insufficient_snouts','currentSnouts',bal); END IF;
	UPDATE public.profiles SET counter=counter-item.snout_cost WHERE id=uid RETURNING counter INTO bal;
	grant_result:=public.grant_habitat_item(uid,p_item_id,'habitat_purchase',p_request_id::text);
	IF NOT COALESCE((grant_result->>'ok')::boolean,false) THEN RAISE EXCEPTION 'habitat grant failed: %',grant_result; END IF;
	INSERT INTO public.habitat_purchase_receipts(user_id,request_id,item_id,snout_cost,balance_after_purchase) VALUES(uid,p_request_id,p_item_id,item.snout_cost,bal);
	RETURN jsonb_build_object('ok',true,'item',public._habitat_item_json(item,true),'receipt',jsonb_build_object('snoutCost',item.snout_cost,'balanceAfterPurchase',bal),'currentSnouts',bal,'newlyOwned',COALESCE((grant_result->>'newlyOwned')::boolean,false),'replayed',false);
END $$;

-- A post-launch stamp awards its host exactly one keepsake. The trigger runs in
-- the stamp transaction, after the social RPC has established eligibility.
CREATE OR REPLACE FUNCTION public._grant_habitat_guestbook_keepsake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE ins int;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||NEW.host_id::text,0));
	INSERT INTO public.habitat_milestones(user_id,milestone,event_ref,item_id) VALUES(NEW.host_id,'first_guestbook_received:v1',NEW.id::text,'guestbook_keepsake') ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS ins=ROW_COUNT;
	IF ins=1 THEN PERFORM public._require_habitat_grant(NEW.host_id,'guestbook_keepsake','habitat_milestone','first_guestbook_received:v1'); END IF;
	RETURN NEW;
END $$;
CREATE TRIGGER grant_habitat_guestbook_keepsake AFTER INSERT ON public.barn_guestbook_stamps FOR EACH ROW EXECUTE FUNCTION public._grant_habitat_guestbook_keepsake();

REVOKE ALL ON FUNCTION public._habitat_item_json(public.habitat_items,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._habitat_snapshot(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._grant_habitat_guestbook_keepsake() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_habitat_starter() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.my_habitat() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.view_habitat(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_habitat(bigint,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.buy_habitat_item(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_habitat_starter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_habitat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.view_habitat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_habitat(bigint,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_habitat_item(text,uuid) TO authenticated;
