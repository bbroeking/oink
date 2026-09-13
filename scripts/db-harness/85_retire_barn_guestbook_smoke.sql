\set ON_ERROR_STOP on

-- The guestbook is gone from the server; the keepsake it awarded is retired
-- but not confiscated. The 73/74 smokes above already minted keepsakes for
-- their owners through the (now dropped) trigger, so those rows are the
-- pre-retirement owners this checks against.
DO $$
DECLARE
  owner uuid;
  newcomer uuid := '00000000-0000-0000-0000-000000082001';
  r jsonb;
BEGIN
  IF to_regclass('public.barn_guestbook_stamps') IS NOT NULL THEN
    RAISE EXCEPTION 'stamps table survived retirement';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'leave_barn_guestbook_stamp', 'my_barn_guestbook',
      'barn_kindness_card_status', 'leave_barn_kindness_card',
      '_grant_habitat_guestbook_keepsake')
  ) THEN
    RAISE EXCEPTION 'a guestbook RPC or trigger function survived retirement';
  END IF;

  -- Retired, not deleted: the catalog row stays so owned rooms keep rendering.
  IF (SELECT active FROM public.habitat_items WHERE id = 'guestbook_keepsake') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'keepsake was not retired';
  END IF;

  -- A pre-retirement owner keeps it, and the keepsake's grant receipts stay.
  SELECT user_id INTO owner FROM public.user_habitat_items WHERE item_id = 'guestbook_keepsake' LIMIT 1;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'expected an earlier smoke to have minted a keepsake owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.habitat_milestones WHERE user_id = owner AND milestone = 'first_guestbook_received:v1') THEN
    RAISE EXCEPTION 'owner lost the milestone receipt';
  END IF;
  PERFORM set_config('smoke.uid', owner::text, true);
  r := public.my_habitat();
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(r->'owned') o WHERE o->>'id' = 'guestbook_keepsake'
  ) THEN
    RAISE EXCEPTION 'owner no longer sees the keepsake: %', r;
  END IF;

  -- Nobody new can be granted or sold it.
  INSERT INTO auth.users(id) VALUES (newcomer) ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles(id, counter) VALUES (newcomer, 500) ON CONFLICT DO NOTHING;
  r := public.grant_habitat_item(newcomer, 'guestbook_keepsake', 'smoke_award', 'retired-1');
  IF r->>'reason' IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'retired keepsake was still grantable: %', r;
  END IF;
  PERFORM set_config('smoke.uid', newcomer::text, true);
  r := public.buy_habitat_item('guestbook_keepsake', '82000000-0000-0000-0000-000000000001');
  IF r->>'reason' IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'retired keepsake was still purchasable: %', r;
  END IF;

  RAISE NOTICE 'chk habitat guestbook retired: table + RPCs dropped, keepsake retired, owners keep it';
END $$;
