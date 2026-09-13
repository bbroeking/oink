-- Pre-migration fixtures for the prestige furnishing backfill smoke.
DO $$
DECLARE rank int; uid uuid;
BEGIN
  FOR rank IN 0..7 LOOP
    uid := ('00000000-0000-0000-0000-' || lpad((79000 + rank)::text, 12, '0'))::uuid;
    INSERT INTO auth.users(id) VALUES(uid);
    INSERT INTO public.profiles(id, username, counter, wallow_count)
    VALUES(uid, 'habitat-prestige-' || rank, 600 + rank, rank);
  END LOOP;

  -- Rank 6 already owns the rank-1 design (as an earlier purchase) and has a
  -- committed room. Backfill must record the gift without touching the room.
  uid := '00000000-0000-0000-0000-000000079006';
  INSERT INTO public.user_habitats(user_id, interior_background_item_id, revision, starter_claimed_at)
  VALUES(uid, 'warm_plank_barn', 4, now());
  INSERT INTO public.user_habitat_items(user_id, item_id)
  VALUES
    (uid, 'warm_plank_barn'),
    (uid, 'rosies_pencil_sketch'),
    (uid, 'sunflower_crock'),
    (uid, 'patchwork_rug'),
    (uid, 'dried_herb_garland');
  INSERT INTO public.user_habitat_slots(user_id, position, item_id)
  VALUES
    (uid, 'wall', 'rosies_pencil_sketch'),
    (uid, 'floor_left', 'sunflower_crock'),
    (uid, 'floor_centerpiece', 'patchwork_rug');
END;
$$;
