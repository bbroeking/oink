-- Permanent Barn furnishing gifts for lifetime Wallow prestige ranks.
-- Paid catalog availability remains unchanged: players may buy these designs
-- early, then receive an idempotent prestige receipt when reaching the rank.

ALTER TABLE public.habitat_items
  ADD COLUMN prestige_rank int,
  ADD CONSTRAINT habitat_items_prestige_rank_positive
    CHECK (prestige_rank IS NULL OR prestige_rank > 0),
  ADD CONSTRAINT habitat_items_prestige_rank_unique UNIQUE (prestige_rank);

UPDATE public.habitat_items
SET prestige_rank = CASE id
  WHEN 'dried_herb_garland' THEN 1
  WHEN 'barn_bunting' THEN 2
  WHEN 'muddy_paw_rug' THEN 3
  WHEN 'reading_chair' THEN 4
  WHEN 'tiny_radio' THEN 5
  WHEN 'midnight_rafters' THEN 6
END
WHERE id IN (
  'dried_herb_garland', 'barn_bunting', 'muddy_paw_rug',
  'reading_chair', 'tiny_radio', 'midnight_rafters'
);

CREATE OR REPLACE FUNCTION public._habitat_item_json(
  p_item public.habitat_items,
  p_catalog boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id', p_item.id,
    'name', p_item.name,
    'description', p_item.description,
    'category', p_item.category,
    'rarity', p_item.rarity,
    'assetKey', p_item.asset_key,
    'snoutCost', CASE WHEN p_catalog THEN p_item.snout_cost END,
    'isForSale', CASE WHEN p_catalog THEN p_item.is_for_sale END,
    'active', CASE WHEN p_catalog THEN p_item.active END,
    'displayOrder', CASE WHEN p_catalog THEN p_item.display_order END,
    'collectionId', p_item.collection_id,
    'rewardThreshold', p_item.reward_threshold,
    'prestigeRank', CASE WHEN p_catalog THEN p_item.prestige_rank END
  ));
$$;
REVOKE ALL ON FUNCTION public._habitat_item_json(public.habitat_items, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._reconcile_habitat_prestige(
  p_user_id uuid,
  p_wallow_rank int DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  earned_rank int;
  reward record;
  before_count int;
  after_count int;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;

  IF p_wallow_rank IS NULL THEN
    SELECT GREATEST(0, COALESCE(p.wallow_count, 0))
      INTO earned_rank
      FROM public.profiles p
      WHERE p.id = p_user_id;
    IF NOT FOUND THEN RETURN 0; END IF;
  ELSE
    earned_rank := GREATEST(0, p_wallow_rank);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('habitat:' || p_user_id::text, 0));
  SELECT count(*) INTO before_count
    FROM public.habitat_grant_receipts
    WHERE user_id = p_user_id AND source = 'habitat_prestige';

  FOR reward IN
    SELECT id, prestige_rank
    FROM public.habitat_items
    WHERE prestige_rank IS NOT NULL AND prestige_rank <= earned_rank
    ORDER BY prestige_rank
  LOOP
    PERFORM public._require_habitat_grant(
      p_user_id,
      reward.id,
      'habitat_prestige',
      'prestige:v1:rank:' || reward.prestige_rank::text
    );
  END LOOP;

  SELECT count(*) INTO after_count
    FROM public.habitat_grant_receipts
    WHERE user_id = p_user_id AND source = 'habitat_prestige';
  RETURN after_count - before_count;
END;
$$;
REVOKE ALL ON FUNCTION public._reconcile_habitat_prestige(uuid, int)
  FROM PUBLIC, anon, authenticated;

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
REVOKE ALL ON FUNCTION public._ensure_habitat_starter(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_habitat_starter()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE uid uuid := auth.uid(); snap jsonb; owned jsonb; catalog jsonb; bal bigint; wallow_rank int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM public._ensure_habitat_starter(uid);
  SELECT public._habitat_snapshot(uid) INTO snap;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO owned FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id = o.item_id
    WHERE o.user_id = uid;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO catalog FROM public.habitat_items i;
  SELECT counter, GREATEST(0, COALESCE(wallow_count, 0)) INTO bal, wallow_rank
    FROM public.profiles WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'snapshot', snap, 'owned', owned, 'catalog', catalog,
    'currentSnouts', COALESCE(bal, 0), 'wallowRank', COALESCE(wallow_rank, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.my_habitat()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE uid uuid := auth.uid(); snap jsonb; owned jsonb; catalog jsonb; bal bigint; wallow_rank int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_habitats WHERE user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  PERFORM public._reconcile_habitat_prestige(uid);
  SELECT public._habitat_snapshot(uid) INTO snap;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO owned FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id = o.item_id
    WHERE o.user_id = uid;
  SELECT COALESCE(jsonb_agg(public._habitat_item_json(i, true) ORDER BY i.display_order), '[]')
    INTO catalog FROM public.habitat_items i;
  SELECT counter, GREATEST(0, COALESCE(wallow_count, 0)) INTO bal, wallow_rank
    FROM public.profiles WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'snapshot', snap, 'owned', owned, 'catalog', catalog,
    'currentSnouts', COALESCE(bal, 0), 'wallowRank', COALESCE(wallow_rank, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_habitat_starter() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_habitat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_habitat_starter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_habitat() TO authenticated;

-- One-time catch-up for existing profiles. The helper's receipt keys make
-- reapplication and later lazy reconciliation harmless.
DO $$
DECLARE player record;
BEGIN
  FOR player IN
    SELECT id, GREATEST(0, COALESCE(wallow_count, 0)) AS wallow_rank
    FROM public.profiles
    WHERE COALESCE(wallow_count, 0) > 0
  LOOP
    PERFORM public._reconcile_habitat_prestige(player.id, player.wallow_rank);
  END LOOP;
END;
$$;
