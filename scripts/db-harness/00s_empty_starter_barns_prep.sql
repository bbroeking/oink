-- Seed legacy rooms before the empty-start migration, including choices that
-- look like a starter but must not be reset.
DO $$
DECLARE n int; uid uuid; starter jsonb;
BEGIN
  starter := jsonb_build_object('interior_background', 'warm_plank_barn',
    'wall', 'rosies_pencil_sketch', 'ceiling', null,
    'floor_left', 'sunflower_crock', 'floor_right', null,
    'floor_centerpiece', 'patchwork_rug', 'surface', null);
  FOR n IN 1..5 LOOP
    uid := ('00000000-0000-0000-0000-' || lpad((81000 + n)::text, 12, '0'))::uuid;
    INSERT INTO auth.users(id) VALUES(uid);
    INSERT INTO public.profiles(id, username, counter)
      VALUES(uid, 'empty-barn-legacy-' || n, 81);
    PERFORM set_config('smoke.uid', uid::text, true);
    PERFORM public.claim_habitat_starter();
  END LOOP;

  -- 001 is an untouched legacy starter. 002 explicitly saved that same look.
  PERFORM set_config('smoke.uid', '00000000-0000-0000-0000-000000081002', true);
  PERFORM public.save_habitat(0, '81000000-0000-0000-0000-000000000001', starter);
  -- Even unusual revision-zero rooms are preserved when their layout differs.
  DELETE FROM public.user_habitat_slots
    WHERE user_id = '00000000-0000-0000-0000-000000081003' AND position = 'wall';
  DELETE FROM public.user_habitat_slots
    WHERE user_id = '00000000-0000-0000-0000-000000081004';
  PERFORM public._require_habitat_grant('00000000-0000-0000-0000-000000081005',
    'spring_whitewash', 'smoke_award', 'empty-barn-theme');
  UPDATE public.user_habitats SET interior_background_item_id = 'spring_whitewash'
    WHERE user_id = '00000000-0000-0000-0000-000000081005';
END;
$$;
