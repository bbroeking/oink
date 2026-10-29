-- Apply after 00_stub.sql + 20261014180000_seasonal_card_item_unlocks.sql.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

DO $privileges$
BEGIN
	IF has_function_privilege('anon', 'public.open_seasonal_card_pack(uuid)', 'EXECUTE')
		OR has_function_privilege('anon', 'public.seasonal_card_snapshot()', 'EXECUTE')
		OR has_function_privilege('anon', 'public.grant_seasonal_card_pack(uuid,text,text,text,jsonb)', 'EXECUTE')
		OR has_function_privilege('authenticated', 'public.grant_seasonal_card_pack(uuid,text,text,text,jsonb)', 'EXECUTE') THEN
		RAISE EXCEPTION 'client role has excess seasonal-card routine privileges';
	END IF;
	IF NOT has_function_privilege('authenticated', 'public.open_seasonal_card_pack(uuid)', 'EXECUTE')
		OR NOT has_function_privilege('authenticated', 'public.seasonal_card_snapshot()', 'EXECUTE')
		OR NOT has_function_privilege('service_role', 'public.grant_seasonal_card_pack(uuid,text,text,text,jsonb)', 'EXECUTE') THEN
		RAISE EXCEPTION 'seasonal-card routine role grant is missing';
	END IF;
END
$privileges$;

DO $smoke$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-000000000731';
	u2 uuid := '00000000-0000-0000-0000-000000000732';
	g uuid;
	r jsonb;
BEGIN
	INSERT INTO auth.users(id) VALUES (u1), (u2);
	INSERT INTO public.hats(id) VALUES ('seasonal_test_hat');
	UPDATE public.seasonal_card_sets SET active = true WHERE set_key = 'halloween_2026_v1';
	INSERT INTO public.seasonal_card_catalog(set_key, card_id, display_name, item_id)
	VALUES ('halloween_2026_v1', 'test_hat_card', 'Test Hat', 'seasonal_test_hat');
	BEGIN
		PERFORM public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'null_cards', NULL);
		RAISE EXCEPTION 'null cards accepted';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'null cards accepted' THEN RAISE; END IF;
	END;
	BEGIN
		PERFORM public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'empty_cards', '[]'::jsonb);
		RAISE EXCEPTION 'empty cards accepted';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'empty cards accepted' THEN RAISE; END IF;
	END;
	IF EXISTS (
		SELECT 1 FROM public.seasonal_card_pack_grants
		WHERE user_id = u1 AND source_ref IN ('null_cards', 'empty_cards')
	) THEN RAISE EXCEPTION 'invalid card payload persisted a grant'; END IF;

	r := public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'earned_1',
		'[{"card_id":"test_hat_card"},{"card_id":"test_hat_card","finish":"foil"}]'::jsonb);
	g := (r->>'grantId')::uuid;
	IF r->>'replayed' <> 'false' THEN RAISE EXCEPTION 'initial grant marked replay'; END IF;
	r := public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'earned_1',
		'[{"card_id":"test_hat_card"},{"card_id":"test_hat_card","finish":"foil"}]'::jsonb);
	IF r->>'replayed' <> 'true' OR (r->>'grantId')::uuid <> g THEN RAISE EXCEPTION 'grant replay changed identity'; END IF;
	UPDATE public.seasonal_card_catalog SET display_name = 'Corrected Test Hat'
	WHERE set_key = 'halloween_2026_v1' AND card_id = 'test_hat_card';
	BEGIN
		UPDATE public.seasonal_card_catalog SET item_id = NULL
		WHERE set_key = 'halloween_2026_v1' AND card_id = 'test_hat_card';
		RAISE EXCEPTION 'granted reward mapping was mutable';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'granted reward mapping was mutable' THEN RAISE; END IF;
	END;
	BEGIN
		PERFORM public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'earned_1',
			'[{"card_id":"test_hat_card"}]'::jsonb);
		RAISE EXCEPTION 'source conflict accepted';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'source conflict accepted' THEN RAISE; END IF;
	END;
	BEGIN
		PERFORM public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'unknown',
			'[{"card_id":"missing"}]'::jsonb);
		RAISE EXCEPTION 'unknown card accepted';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'unknown card accepted' THEN RAISE; END IF;
	END;

	-- Exercise the client-callable routine under its actual database role.
	EXECUTE 'SET LOCAL ROLE authenticated';
	PERFORM set_config('request.jwt.claim.sub', u2::text, true);
	BEGIN
		PERFORM public.open_seasonal_card_pack(g);
		RAISE EXCEPTION 'other owner opened grant';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'other owner opened grant' THEN RAISE; END IF;
	END;
	PERFORM set_config('request.jwt.claim.sub', u1::text, true);
	r := public.open_seasonal_card_pack(g);
	IF r->>'replayed' <> 'false' THEN RAISE EXCEPTION 'initial opening marked replay'; END IF;
	IF (SELECT quantity FROM public.user_seasonal_cards WHERE user_id = u1 AND card_id = 'test_hat_card') <> 2 THEN
		RAISE EXCEPTION 'authenticated owner cannot read card inventory';
	END IF;
	IF (SELECT count(*) FROM public.seasonal_card_item_grants WHERE user_id = u1 AND item_id = 'seasonal_test_hat') <> 1 THEN
		RAISE EXCEPTION 'authenticated owner cannot read item receipt';
	END IF;
	EXECUTE 'RESET ROLE';
	IF (SELECT quantity FROM public.user_seasonal_cards WHERE user_id = u1 AND card_id = 'test_hat_card') <> 2 THEN
		RAISE EXCEPTION 'duplicate card quantity incorrect';
	END IF;
	IF (SELECT count(*) FROM public.user_hats WHERE user_id = u1 AND hat_id = 'seasonal_test_hat') <> 1 THEN
		RAISE EXCEPTION 'item was not granted exactly once';
	END IF;
	IF (SELECT count(*) FROM public.seasonal_card_item_grants WHERE user_id = u1 AND item_id = 'seasonal_test_hat') <> 1 THEN
		RAISE EXCEPTION 'item grant receipt was not unique';
	END IF;
	EXECUTE 'SET LOCAL ROLE authenticated';
	r := public.open_seasonal_card_pack(g);
	IF r->>'replayed' <> 'true' THEN RAISE EXCEPTION 'opening replay not detected'; END IF;

	EXECUTE 'RESET ROLE';
	UPDATE public.seasonal_card_sets SET active = false WHERE set_key = 'halloween_2026_v1';
	-- Settled receipts remain replayable after the event is switched off.
	EXECUTE 'SET LOCAL ROLE authenticated';
	r := public.open_seasonal_card_pack(g);
	IF r->>'replayed' <> 'true' THEN RAISE EXCEPTION 'settled opening unavailable after deactivation'; END IF;
	EXECUTE 'RESET ROLE';
	BEGIN
		PERFORM public.grant_seasonal_card_pack(u1, 'halloween_2026_v1', 'harness', 'inactive',
			'[{"card_id":"test_hat_card"}]'::jsonb);
		RAISE EXCEPTION 'inactive catalog granted cards';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'inactive catalog granted cards' THEN RAISE; END IF;
	END;
END
$smoke$;

-- Account deletion removes grants, inventory, openings, cards, and item receipts.
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000731';
DO $cleanup$
BEGIN
	IF EXISTS (SELECT 1 FROM public.seasonal_card_pack_grants WHERE user_id = '00000000-0000-0000-0000-000000000731')
		OR EXISTS (SELECT 1 FROM public.seasonal_card_pack_openings WHERE user_id = '00000000-0000-0000-0000-000000000731')
		OR EXISTS (SELECT 1 FROM public.user_seasonal_cards WHERE user_id = '00000000-0000-0000-0000-000000000731')
		OR EXISTS (SELECT 1 FROM public.seasonal_card_item_grants WHERE user_id = '00000000-0000-0000-0000-000000000731') THEN
		RAISE EXCEPTION 'account deletion left seasonal card rows';
	END IF;
END
$cleanup$;
