-- Barn completion layer: earned-item journal, wishlist, two saved room
-- checkpoints, and exclusive permanent Wallow keepsakes.

ALTER TABLE public.habitat_items
  DROP CONSTRAINT habitat_items_prestige_rank_unique;

INSERT INTO public.habitat_items
  (id,name,description,category,rarity,asset_key,snout_cost,is_for_sale,display_order,prestige_rank)
VALUES
  ('wallow_keepsake_bronze','Bronze Wallow Keepsake','A warm bronze pig remembers the first brave return to the mud.','surface_decor','uncommon','wallow_keepsake_bronze',0,false,3000,1),
  ('wallow_keepsake_silver','Silver Wallow Keepsake','A bright silver pig marks three journeys through the Wallow.','surface_decor','rare','wallow_keepsake_silver',0,false,3010,3),
  ('wallow_keepsake_gold','Gold Wallow Keepsake','A burnished gold pig celebrates six complete Wallow climbs.','surface_decor','rare','wallow_keepsake_gold',0,false,3020,6),
  ('wallow_keepsake_celestial','Celestial Wallow Keepsake','A starry keepsake glows for a pig who has crossed the Wallow ten times.','surface_decor','rare','wallow_keepsake_celestial',0,false,3030,10);

CREATE TABLE public.habitat_acquisition_states (
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_ref text NOT NULL,
  presented_at timestamptz,
  seen_at timestamptz,
  PRIMARY KEY (user_id,source,source_ref),
  FOREIGN KEY (user_id,source,source_ref)
    REFERENCES public.habitat_grant_receipts(user_id,source,source_ref)
    ON DELETE CASCADE
);

CREATE TABLE public.habitat_wishlist_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.habitat_items(id),
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,item_id)
);

CREATE TABLE public.habitat_presets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1,2)),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40 AND name=btrim(name)),
  positions jsonb NOT NULL CHECK (jsonb_typeof(positions)='object'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,slot)
);

CREATE TABLE public.habitat_preset_save_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  result_preset jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_id)
);

CREATE TABLE public.habitat_preset_activation_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  result_snapshot jsonb NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_id)
);

ALTER TABLE public.user_habitats ADD COLUMN active_preset_slot smallint
  CHECK (active_preset_slot IN (1,2));

CREATE OR REPLACE FUNCTION public._clear_active_habitat_preset_on_room_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
BEGIN
  IF NEW.revision IS DISTINCT FROM OLD.revision THEN NEW.active_preset_slot:=NULL; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clear_active_habitat_preset_on_room_change
  BEFORE UPDATE ON public.user_habitats FOR EACH ROW
  EXECUTE FUNCTION public._clear_active_habitat_preset_on_room_change();
REVOKE ALL ON FUNCTION public._clear_active_habitat_preset_on_room_change()
  FROM PUBLIC,anon,authenticated;

ALTER TABLE public.habitat_acquisition_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_preset_save_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_preset_activation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habitat_acquisition_states,public.habitat_wishlist_items,
  public.habitat_presets,public.habitat_preset_save_receipts,
  public.habitat_preset_activation_receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._habitat_acquisition_id(
  p_user_id uuid,p_source text,p_source_ref text
)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO public AS $$
  SELECT encode(extensions.digest(convert_to(
    p_user_id::text||'|'||p_source||'|'||p_source_ref,'UTF8'),'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION public._habitat_acquisition_id(uuid,text,text)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._habitat_item_json(
  p_item public.habitat_items,p_catalog boolean DEFAULT false
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO public AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id',p_item.id,'name',p_item.name,'description',p_item.description,
    'category',p_item.category,'rarity',p_item.rarity,'assetKey',p_item.asset_key,
    'snoutCost',CASE WHEN p_catalog THEN p_item.snout_cost END,
    'isForSale',CASE WHEN p_catalog THEN p_item.is_for_sale END,
    'active',CASE WHEN p_catalog THEN p_item.active END,
    'displayOrder',CASE WHEN p_catalog THEN p_item.display_order END,
    'collectionId',p_item.collection_id,'rewardThreshold',p_item.reward_threshold,
    'prestigeRank',CASE WHEN p_catalog THEN p_item.prestige_rank END,
    'prestigeKeepsake',CASE WHEN p_catalog AND p_item.id IN (
      'wallow_keepsake_bronze','wallow_keepsake_silver',
      'wallow_keepsake_gold','wallow_keepsake_celestial') THEN true END));
$$;
REVOKE ALL ON FUNCTION public._habitat_item_json(public.habitat_items,boolean)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._habitat_snapshot(p_owner uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT jsonb_build_object('ownerId',h.user_id,'revision',h.revision,
    'wallowRank',GREATEST(0,COALESCE(p.wallow_count,0)),'positions',
    jsonb_build_object(
      'interior_background',public._habitat_item_json(bg,false),
      'wall',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='wall'),
      'ceiling',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='ceiling'),
      'floor_left',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_left'),
      'floor_right',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_right'),
      'floor_centerpiece',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='floor_centerpiece'),
      'surface',(SELECT public._habitat_item_json(i,false) FROM public.user_habitat_slots s JOIN public.habitat_items i ON i.id=s.item_id WHERE s.user_id=h.user_id AND s.position='surface')))
  FROM public.user_habitats h
  JOIN public.habitat_items bg ON bg.id=h.interior_background_item_id
  JOIN public.profiles p ON p.id=h.user_id
  WHERE h.user_id=p_owner;
$$;
REVOKE ALL ON FUNCTION public._habitat_snapshot(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.grant_habitat_item(
  p_user_id uuid,p_item_id text,p_source text,p_source_ref text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE old public.habitat_grant_receipts%ROWTYPE; item public.habitat_items%ROWTYPE;
  fresh_count int; stamped timestamptz:=now(); analytics_session uuid;
BEGIN
  IF p_user_id IS NULL OR p_source IS NULL OR p_source_ref IS NULL
    OR btrim(p_source)='' OR btrim(p_source_ref)='' THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_grant');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||p_user_id::text,0));
  SELECT * INTO old FROM public.habitat_grant_receipts
    WHERE user_id=p_user_id AND source=p_source AND source_ref=p_source_ref;
  IF FOUND THEN
    IF old.item_id IS DISTINCT FROM p_item_id THEN
      RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch');
    END IF;
    RETURN jsonb_build_object('ok',true,'itemId',old.item_id,
      'newlyOwned',old.newly_owned,'grantedAt',old.granted_at);
  END IF;
  SELECT * INTO item FROM public.habitat_items WHERE id=p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item'); END IF;
  IF NOT item.active THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
  INSERT INTO public.user_habitat_items(user_id,item_id) VALUES(p_user_id,p_item_id)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS fresh_count=ROW_COUNT;
  INSERT INTO public.habitat_grant_receipts
    (user_id,source,source_ref,item_id,newly_owned,granted_at)
  VALUES(p_user_id,p_source,p_source_ref,p_item_id,fresh_count=1,stamped);

  IF fresh_count=1 THEN
    analytics_session := (
      substr(md5(p_user_id::text||'|'||p_source||'|'||p_source_ref),1,8)||'-'||
      substr(md5(p_user_id::text||'|'||p_source||'|'||p_source_ref),9,4)||'-'||
      substr(md5(p_user_id::text||'|'||p_source||'|'||p_source_ref),13,4)||'-'||
      substr(md5(p_user_id::text||'|'||p_source||'|'||p_source_ref),17,4)||'-'||
      substr(md5(p_user_id::text||'|'||p_source||'|'||p_source_ref),21,12)
    )::uuid;
    INSERT INTO public.interaction_analytics_events
      (user_id,session_id,event_name,surface,target_kind,result,content_id,properties)
    VALUES(p_user_id,analytics_session,'habitat_item_acquired','habitat','item','succeeded',
      p_item_id,jsonb_build_object('item_kind','habitat','source',p_source));
  END IF;
  IF item.collection_id IS NOT NULL AND item.is_for_sale THEN
    PERFORM public._reconcile_habitat_collection(p_user_id,item.collection_id);
  END IF;
  RETURN jsonb_build_object('ok',true,'itemId',p_item_id,
    'newlyOwned',fresh_count=1,'grantedAt',stamped);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_habitat_item(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._reconcile_habitat_prestige(
  p_user_id uuid,p_wallow_rank int DEFAULT NULL
)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE earned_rank int; reward record; before_count int; after_count int; ref text;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  IF p_wallow_rank IS NULL THEN
    SELECT GREATEST(0,COALESCE(wallow_count,0)) INTO earned_rank
      FROM public.profiles WHERE id=p_user_id;
    IF NOT FOUND THEN RETURN 0; END IF;
  ELSE earned_rank:=GREATEST(0,p_wallow_rank); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||p_user_id::text,0));
  SELECT count(*) INTO before_count FROM public.habitat_grant_receipts
    WHERE user_id=p_user_id AND source='habitat_prestige';
  FOR reward IN SELECT id,prestige_rank FROM public.habitat_items
    WHERE prestige_rank IS NOT NULL AND prestige_rank<=earned_rank
    ORDER BY prestige_rank,display_order
  LOOP
    ref:=CASE WHEN reward.id IN (
      'wallow_keepsake_bronze','wallow_keepsake_silver',
      'wallow_keepsake_gold','wallow_keepsake_celestial')
      THEN 'prestige:v2:rank:'||reward.prestige_rank::text||':item:'||reward.id
      ELSE 'prestige:v1:rank:'||reward.prestige_rank::text END;
    PERFORM public._require_habitat_grant(p_user_id,reward.id,'habitat_prestige',ref);
  END LOOP;
  SELECT count(*) INTO after_count FROM public.habitat_grant_receipts
    WHERE user_id=p_user_id AND source='habitat_prestige';
  RETURN after_count-before_count;
END;
$$;
REVOKE ALL ON FUNCTION public._reconcile_habitat_prestige(uuid,int)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.my_habitat_journal()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); acquisitions jsonb; wishlist jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  PERFORM public._reconcile_habitat_prestige(uid);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',public._habitat_acquisition_id(r.user_id,r.source,r.source_ref),
    'itemId',r.item_id,'source',r.source,'grantedAt',r.granted_at,
    'newlyOwned',r.newly_owned,'seen',s.seen_at IS NOT NULL,
    'presented',s.presented_at IS NOT NULL) ORDER BY r.granted_at,r.source,r.source_ref),'[]')
    INTO acquisitions
    FROM public.habitat_grant_receipts r
    LEFT JOIN public.habitat_acquisition_states s USING(user_id,source,source_ref)
    WHERE r.user_id=uid;
  SELECT COALESCE(jsonb_agg(w.item_id ORDER BY i.display_order),'[]') INTO wishlist
    FROM public.habitat_wishlist_items w JOIN public.habitat_items i ON i.id=w.item_id
    WHERE w.user_id=uid;
  RETURN jsonb_build_object('ok',true,'acquisitions',acquisitions,'wishlist',wishlist);
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_habitat_acquisitions(p_ids text[],p_kind text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); changed int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('presented','seen') OR p_ids IS NULL OR cardinality(p_ids)>100
    OR EXISTS(SELECT 1 FROM unnest(p_ids) id WHERE id IS NULL OR length(id)<>64 OR id!~'^[a-f0-9]{64}$') THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_request');
  END IF;
  INSERT INTO public.habitat_acquisition_states(user_id,source,source_ref,presented_at,seen_at)
  SELECT r.user_id,r.source,r.source_ref,
    CASE WHEN p_kind='presented' THEN now() END,
    CASE WHEN p_kind='seen' THEN now() END
  FROM public.habitat_grant_receipts r
  WHERE r.user_id=uid
    AND public._habitat_acquisition_id(r.user_id,r.source,r.source_ref)=ANY(p_ids)
  ON CONFLICT(user_id,source,source_ref) DO UPDATE SET
    presented_at=CASE WHEN p_kind='presented' THEN COALESCE(habitat_acquisition_states.presented_at,EXCLUDED.presented_at) ELSE habitat_acquisition_states.presented_at END,
    seen_at=CASE WHEN p_kind='seen' THEN COALESCE(habitat_acquisition_states.seen_at,EXCLUDED.seen_at) ELSE habitat_acquisition_states.seen_at END;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'updated',changed);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_habitat_wishlist(p_item_id text,p_saved boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); wishlist jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  IF p_item_id IS NULL OR p_saved IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.habitat_items WHERE id=p_item_id AND active) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_item');
  END IF;
  IF p_saved THEN
    INSERT INTO public.habitat_wishlist_items(user_id,item_id) VALUES(uid,p_item_id)
      ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.habitat_wishlist_items WHERE user_id=uid AND item_id=p_item_id;
  END IF;
  SELECT COALESCE(jsonb_agg(w.item_id ORDER BY i.display_order),'[]') INTO wishlist
    FROM public.habitat_wishlist_items w JOIN public.habitat_items i ON i.id=w.item_id
    WHERE w.user_id=uid;
  RETURN jsonb_build_object('ok',true,'wishlist',wishlist);
END;
$$;

CREATE OR REPLACE FUNCTION public._validate_habitat_preset_positions(p_user uuid,p_positions jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE normalized jsonb; pos text; iid text; cat text; expected_cat text;
BEGIN
  IF jsonb_typeof(p_positions)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_positions))<>7
    OR NOT p_positions ?& ARRAY['interior_background','wall','ceiling','floor_left','floor_right','floor_centerpiece','surface'] THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_layout');
  END IF;
  normalized:=jsonb_build_object('interior_background',p_positions->'interior_background',
    'wall',p_positions->'wall','ceiling',p_positions->'ceiling',
    'floor_left',p_positions->'floor_left','floor_right',p_positions->'floor_right',
    'floor_centerpiece',p_positions->'floor_centerpiece','surface',p_positions->'surface');
  IF normalized->'interior_background'='null'::jsonb
    OR jsonb_typeof(normalized->'interior_background')<>'string' THEN
    RETURN jsonb_build_object('ok',false,'reason','null_background');
  END IF;
  FOR pos IN SELECT unnest(ARRAY['interior_background','wall','ceiling','floor_left','floor_right','floor_centerpiece','surface']) LOOP
    IF normalized->pos<>'null'::jsonb THEN
      IF jsonb_typeof(normalized->pos)<>'string' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_layout'); END IF;
      iid:=normalized->>pos;
      SELECT category INTO cat FROM public.habitat_items WHERE id=iid;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item','position',pos); END IF;
      IF NOT EXISTS(SELECT 1 FROM public.user_habitat_items WHERE user_id=p_user AND item_id=iid) THEN
        RETURN jsonb_build_object('ok',false,'reason','unowned_item','position',pos);
      END IF;
      expected_cat:=CASE pos WHEN 'interior_background' THEN 'interior_background'
        WHEN 'wall' THEN 'wall_decor' WHEN 'ceiling' THEN 'ceiling_decor'
        WHEN 'floor_left' THEN 'floor_decor' WHEN 'floor_right' THEN 'floor_decor'
        WHEN 'floor_centerpiece' THEN 'floor_centerpiece' ELSE 'surface_decor' END;
      IF cat<>expected_cat THEN RETURN jsonb_build_object('ok',false,'reason','category_mismatch','position',pos); END IF;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_each(normalized) WHERE value<>'null'::jsonb GROUP BY value HAVING count(*)>1) THEN
    RETURN jsonb_build_object('ok',false,'reason','duplicate_item');
  END IF;
  RETURN jsonb_build_object('ok',true,'positions',normalized);
END;
$$;
REVOKE ALL ON FUNCTION public._validate_habitat_preset_positions(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._habitat_preset_json(p public.habitat_presets)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO public AS $$
  SELECT jsonb_build_object('slot',p.slot,'name',p.name,'positions',p.positions,'revision',p.revision);
$$;
REVOKE ALL ON FUNCTION public._habitat_preset_json(public.habitat_presets)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.my_habitat_presets()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); presets jsonb; active_slot smallint;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  SELECT COALESCE(jsonb_agg(public._habitat_preset_json(p) ORDER BY p.slot),'[]') INTO presets
    FROM public.habitat_presets p WHERE p.user_id=uid;
  SELECT active_preset_slot INTO active_slot FROM public.user_habitats WHERE user_id=uid;
  RETURN jsonb_build_object('ok',true,'presets',presets,'activeSlot',active_slot);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_habitat_preset(
  p_slot int,p_name text,p_positions jsonb,p_expected_revision bigint,p_request_id uuid
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); validation jsonb; normalized jsonb; phash text;
  receipt public.habitat_preset_save_receipts%ROWTYPE; current public.habitat_presets%ROWTYPE;
  result public.habitat_presets%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  IF p_slot IS NULL OR p_slot NOT IN (1,2) OR p_request_id IS NULL OR p_name IS NULL
    OR length(btrim(p_name)) NOT BETWEEN 1 AND 40 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_request');
  END IF;
  validation:=public._validate_habitat_preset_positions(uid,p_positions);
  IF NOT COALESCE((validation->>'ok')::boolean,false) THEN RETURN validation; END IF;
  normalized:=validation->'positions';
  phash:=encode(extensions.digest(convert_to('habitat-preset-save:v1|'||p_slot||'|'||btrim(p_name)||'|'||COALESCE(p_expected_revision::text,'null')||'|'||normalized::text,'UTF8'),'sha256'),'hex');
  SELECT * INTO receipt FROM public.habitat_preset_save_receipts WHERE user_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF;
    RETURN jsonb_build_object('ok',true,'preset',receipt.result_preset,'replayed',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||uid::text,0));
  SELECT * INTO receipt FROM public.habitat_preset_save_receipts WHERE user_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF;
    RETURN jsonb_build_object('ok',true,'preset',receipt.result_preset,'replayed',true);
  END IF;
  SELECT * INTO current FROM public.habitat_presets WHERE user_id=uid AND slot=p_slot FOR UPDATE;
  IF FOUND THEN
    IF p_expected_revision IS NULL OR current.revision<>p_expected_revision THEN
      RETURN jsonb_build_object('ok',false,'reason','revision_conflict','preset',public._habitat_preset_json(current));
    END IF;
    UPDATE public.habitat_presets SET name=btrim(p_name),positions=normalized,
      revision=revision+1,updated_at=now() WHERE user_id=uid AND slot=p_slot RETURNING * INTO result;
  ELSE
    IF p_expected_revision IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'reason','revision_conflict'); END IF;
    INSERT INTO public.habitat_presets(user_id,slot,name,positions)
      VALUES(uid,p_slot,btrim(p_name),normalized) RETURNING * INTO result;
  END IF;
  IF current.user_id IS NOT NULL AND current.positions IS DISTINCT FROM normalized THEN
    UPDATE public.user_habitats SET active_preset_slot=NULL
      WHERE user_id=uid AND active_preset_slot=p_slot;
  END IF;
  INSERT INTO public.habitat_preset_save_receipts(user_id,request_id,payload_hash,result_preset)
    VALUES(uid,p_request_id,phash,public._habitat_preset_json(result));
  RETURN jsonb_build_object('ok',true,'preset',public._habitat_preset_json(result),'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_habitat_preset(
  p_slot int,p_expected_revision bigint,p_request_id uuid,
  p_expected_preset_revision bigint DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); preset public.habitat_presets%ROWTYPE; phash text;
  receipt public.habitat_preset_activation_receipts%ROWTYPE; saved jsonb; snap jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  IF p_slot IS NULL OR p_slot NOT IN (1,2) OR p_expected_revision IS NULL
    OR p_expected_revision<0 OR p_request_id IS NULL
    OR (p_expected_preset_revision IS NOT NULL AND p_expected_preset_revision<0) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_request');
  END IF;
  phash:=encode(extensions.digest(convert_to('habitat-preset-activate:v1|'||p_slot||'|'||p_expected_revision||'|'||COALESCE(p_expected_preset_revision::text,'null'),'UTF8'),'sha256'),'hex');
  SELECT * INTO receipt FROM public.habitat_preset_activation_receipts WHERE user_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF;
    RETURN jsonb_build_object('ok',true,'snapshot',receipt.result_snapshot,'replayed',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||uid::text,0));
  SELECT * INTO receipt FROM public.habitat_preset_activation_receipts WHERE user_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash IS DISTINCT FROM phash THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF;
    RETURN jsonb_build_object('ok',true,'snapshot',receipt.result_snapshot,'replayed',true);
  END IF;
  SELECT * INTO preset FROM public.habitat_presets WHERE user_id=uid AND slot=p_slot;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  IF p_expected_preset_revision IS NOT NULL AND preset.revision<>p_expected_preset_revision THEN
    RETURN jsonb_build_object('ok',false,'reason','preset_revision_conflict',
      'preset',public._habitat_preset_json(preset));
  END IF;
  saved:=public.save_habitat(p_expected_revision,p_request_id,preset.positions);
  IF NOT COALESCE((saved->>'ok')::boolean,false) THEN RETURN saved; END IF;
  snap:=saved->'snapshot';
  UPDATE public.user_habitats SET active_preset_slot=p_slot WHERE user_id=uid;
  INSERT INTO public.habitat_preset_activation_receipts(user_id,request_id,payload_hash,result_snapshot)
    VALUES(uid,p_request_id,phash,snap);
  RETURN jsonb_build_object('ok',true,'snapshot',snap,'replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.my_habitat_journal() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ack_habitat_acquisitions(text[],text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_habitat_wishlist(text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.my_habitat_presets() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_habitat_preset(int,text,jsonb,bigint,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.activate_habitat_preset(int,bigint,uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_habitat_journal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ack_habitat_acquisitions(text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_habitat_wishlist(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_habitat_presets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_habitat_preset(int,text,jsonb,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_habitat_preset(int,bigint,uuid,bigint) TO authenticated;

-- Catch up existing permanent ranks for the new keepsake rows. Existing six
-- gift receipt keys remain unchanged; new keys include the item id.
DO $$ DECLARE player record; BEGIN
  FOR player IN SELECT id,GREATEST(0,COALESCE(wallow_count,0)) rank
    FROM public.profiles WHERE COALESCE(wallow_count,0)>0
  LOOP PERFORM public._reconcile_habitat_prestige(player.id,player.rank); END LOOP;
END $$;
