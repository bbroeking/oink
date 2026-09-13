-- Start every new Barn with the room shell and no placed decorations.
-- Keep the four starter ownership grants, prestige gifts, authorization, and
-- idempotency unchanged. Only the default placement and customization baseline
-- change; existing player-saved layouts are preserved.

CREATE OR REPLACE FUNCTION public._ensure_habitat_starter(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE created_count int; wallow_rank int;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  -- Read the rank before taking the habitat lock. Prestige writes never need
  -- the habitat lock, which preserves the established habitat -> profile order.
  SELECT GREATEST(0, COALESCE(wallow_count, 0)) INTO wallow_rank
    FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:' || p_user_id::text, 0));
  INSERT INTO public.user_habitats(user_id, interior_background_item_id, starter_claimed_at)
  VALUES(p_user_id, 'warm_plank_barn', now())
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS created_count = ROW_COUNT;

  PERFORM public._require_habitat_grant(p_user_id, 'warm_plank_barn', 'habitat_starter', 'starter:v1:interior_background:warm_plank_barn');
  PERFORM public._require_habitat_grant(p_user_id, 'rosies_pencil_sketch', 'habitat_starter', 'starter:v1:wall:rosies_pencil_sketch');
  PERFORM public._require_habitat_grant(p_user_id, 'sunflower_crock', 'habitat_starter', 'starter:v1:floor_left:sunflower_crock');
  PERFORM public._require_habitat_grant(p_user_id, 'patchwork_rug', 'habitat_starter', 'starter:v1:floor_centerpiece:patchwork_rug');
  PERFORM public._reconcile_habitat_prestige(p_user_id, wallow_rank);

  -- Ownership is a gift; decorating is an explicit player choice.
  RETURN created_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public._ensure_habitat_starter(uuid)
  FROM PUBLIC, anon, authenticated;

-- The save contract is unchanged except that an empty default room is no
-- longer a custom arrangement. Placing even one starter design now qualifies.
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
	custom:=normalized<>jsonb_build_object('interior_background','warm_plank_barn','wall',null,'ceiling',null,'floor_left',null,'floor_right',null,'floor_centerpiece',null,'surface',null);
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

REVOKE ALL ON FUNCTION public.save_habitat(bigint, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_habitat(bigint, uuid, jsonb) TO authenticated;

-- Convert only the exact automatically placed starter arrangement. A saved
-- room (even one that matches the old starter) is the player's choice.
-- Serialize with saves/provisioning and recheck after acquiring each lock.
-- Bumping the revision makes an already-open draft conflict instead of silently
-- putting the old starter decorations back. Inventory and receipts are retained.
DO $$
DECLARE barn record;
BEGIN
  FOR barn IN
    SELECT user_id FROM public.user_habitats
    WHERE revision = 0 AND interior_background_item_id = 'warm_plank_barn'
    ORDER BY user_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('habitat:' || barn.user_id::text, 0));
    IF EXISTS (
      SELECT 1 FROM public.user_habitats h
      WHERE h.user_id = barn.user_id
        AND h.revision = 0
        AND h.interior_background_item_id = 'warm_plank_barn'
        AND NOT EXISTS (
          SELECT 1 FROM public.habitat_save_receipts r WHERE r.user_id = h.user_id
        )
        AND (
          SELECT jsonb_object_agg(s.position, s.item_id)
          FROM public.user_habitat_slots s WHERE s.user_id = h.user_id
        ) = '{"wall":"rosies_pencil_sketch","floor_left":"sunflower_crock","floor_centerpiece":"patchwork_rug"}'::jsonb
    ) THEN
      DELETE FROM public.user_habitat_slots WHERE user_id = barn.user_id;
      UPDATE public.user_habitats SET revision = revision + 1, updated_at = now()
        WHERE user_id = barn.user_id;
    END IF;
  END LOOP;
END;
$$;
