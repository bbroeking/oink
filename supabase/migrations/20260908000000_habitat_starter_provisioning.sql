-- Give every authenticated Barn path the same starter room.  The helper is
-- private and idempotent: a repeat only repairs ownership receipts; it never
-- replaces a committed layout.

CREATE OR REPLACE FUNCTION public._ensure_habitat_starter(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE created_count int;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:' || p_user_id::text, 0));
  INSERT INTO public.user_habitats(user_id, interior_background_item_id, starter_claimed_at)
  VALUES(p_user_id, 'warm_plank_barn', now())
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS created_count = ROW_COUNT;

  PERFORM public._require_habitat_grant(p_user_id, 'warm_plank_barn', 'habitat_starter', 'starter:v1:interior_background:warm_plank_barn');
  PERFORM public._require_habitat_grant(p_user_id, 'rosies_pencil_sketch', 'habitat_starter', 'starter:v1:wall:rosies_pencil_sketch');
  PERFORM public._require_habitat_grant(p_user_id, 'sunflower_crock', 'habitat_starter', 'starter:v1:floor_left:sunflower_crock');
  PERFORM public._require_habitat_grant(p_user_id, 'patchwork_rug', 'habitat_starter', 'starter:v1:floor_centerpiece:patchwork_rug');

  IF created_count = 1 THEN
    INSERT INTO public.user_habitat_slots(user_id, position, item_id)
    VALUES
      (p_user_id, 'wall', 'rosies_pencil_sketch'),
      (p_user_id, 'floor_left', 'sunflower_crock'),
      (p_user_id, 'floor_centerpiece', 'patchwork_rug');
  END IF;
  RETURN created_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public._ensure_habitat_starter(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_habitat_starter()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE uid uuid := auth.uid(); snap jsonb; owned jsonb; catalog jsonb; bal bigint;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM public._ensure_habitat_starter(uid);
  SELECT public._habitat_snapshot(uid) INTO snap;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO owned
    FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id = o.item_id
    WHERE o.user_id = uid;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO catalog FROM public.habitat_items i;
  SELECT counter INTO bal FROM public.profiles WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'snapshot', snap, 'owned', owned, 'catalog', catalog, 'currentSnouts', COALESCE(bal, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.view_habitat(p_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE uid uuid := auth.uid(); snap jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF p_owner IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_owner) THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_owner'); END IF;
  IF uid <> p_owner THEN
    IF public.are_blocked(uid, p_owner) THEN RETURN jsonb_build_object('ok', false, 'reason', 'blocked'); END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.requester_id = uid AND f.receiver_id = p_owner) OR (f.requester_id = p_owner AND f.receiver_id = uid))
    ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_friends'); END IF;
  END IF;

  -- Authorization precedes this write, so a stranger cannot provision a room.
  PERFORM public._ensure_habitat_starter(p_owner);
  SELECT public._habitat_snapshot(p_owner) INTO snap;
  RETURN jsonb_build_object('ok', true, 'snapshot', snap);
END;
$$;

CREATE OR REPLACE FUNCTION public.habitat_expansion_discovery()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE uid uuid := auth.uid(); available boolean;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT count(*) = 100 INTO available FROM public.habitat_items WHERE collection_id IS NOT NULL;
  IF available THEN PERFORM public._ensure_habitat_starter(uid); END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'available', available,
    'pending', available AND NOT EXISTS(
      SELECT 1 FROM public.habitat_expansion_acknowledgments
      WHERE user_id = uid AND version = 'barn100:v1'
    ),
    'version', 'barn100:v1'
  );
END;
$$;
