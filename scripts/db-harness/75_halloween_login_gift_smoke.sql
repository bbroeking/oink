DO $privileges$
BEGIN
	IF has_function_privilege('anon', 'public.claim_halloween_login_gift(integer,integer)', 'EXECUTE')
		OR has_function_privilege('anon', 'public.acknowledge_halloween_login_gift(uuid)', 'EXECUTE')
		OR NOT has_function_privilege('authenticated', 'public.claim_halloween_login_gift(integer,integer)', 'EXECUTE')
		OR NOT has_function_privilege('authenticated', 'public.acknowledge_halloween_login_gift(uuid)', 'EXECUTE') THEN
		RAISE EXCEPTION 'Halloween login gift RPC privileges are incorrect';
	END IF;
	IF has_table_privilege('authenticated', 'public.login_gift_campaigns', 'SELECT,INSERT,UPDATE,DELETE')
		OR has_table_privilege('authenticated', 'public.login_gift_campaign_pool', 'SELECT,INSERT,UPDATE,DELETE')
		OR has_table_privilege('authenticated', 'public.costume_catalog', 'SELECT,INSERT,UPDATE,DELETE')
		OR has_table_privilege('authenticated', 'public.login_gift_receipts', 'INSERT,UPDATE,DELETE')
		OR has_table_privilege('authenticated', 'public.owned_costume_instances', 'INSERT,UPDATE,DELETE') THEN
		RAISE EXCEPTION 'Halloween login gift tables expose client writes/config';
	END IF;
END
$privileges$;

DO $smoke$
DECLARE
	u uuid := '00000000-0000-0000-0000-000000000751';
	u2 uuid := '00000000-0000-0000-0000-000000000752';
	r jsonb;
	receipt_id uuid;
	ack_at timestamptz;
BEGIN
	INSERT INTO auth.users(id) VALUES (u), (u2);
	PERFORM set_config('ttp.fake_now', '2026-10-20 12:00:00+00', true);
	PERFORM set_config('request.jwt.claim.sub', u::text, true);

	-- Applying the migration never activates or grants the campaign.
	r := public.claim_halloween_login_gift(1, 1);
	IF r->>'status' <> 'inactive' OR EXISTS (SELECT 1 FROM public.login_gift_receipts WHERE user_id = u) THEN
		RAISE EXCEPTION 'inactive campaign granted a gift';
	END IF;

	UPDATE public.login_gift_campaigns SET active = true
	WHERE campaign_key = 'halloween_2026_login_gift_v1';
	-- Campaign activation alone is insufficient: every fitted costume must be
	-- explicitly accepted in the server catalog before the first grant.
	r := public.claim_halloween_login_gift(1, 1);
	IF r->>'status' <> 'inactive' OR r->>'reason' <> 'costume_catalog'
		OR EXISTS (SELECT 1 FROM public.login_gift_receipts WHERE user_id = u) THEN
		RAISE EXCEPTION 'campaign granted before costume fit acceptance';
	END IF;
	UPDATE public.costume_catalog SET active = true
	WHERE id IN (
		'halloween_2026_linen_lurker_costume', 'halloween_2026_starspell_costume',
		'halloween_2026_bat_nap_costume', 'halloween_2026_little_imp_costume',
		'halloween_2026_marshmallow_boo_costume'
	);
	r := public.claim_halloween_login_gift(0, 1);
	IF r->>'status' <> 'inactive' OR r->>'reason' <> 'client_build' THEN RAISE EXCEPTION 'client build gate failed'; END IF;
	r := public.claim_halloween_login_gift(1, 2);
	IF r->>'status' <> 'inactive' OR r->>'reason' <> 'fit_policy' THEN RAISE EXCEPTION 'fit policy gate failed'; END IF;

	r := public.claim_halloween_login_gift(1, 1);
	IF r->>'status' <> 'new' THEN RAISE EXCEPTION 'first eligible login was not new'; END IF;
	receipt_id := (r->'receipt'->>'receiptId')::uuid;
	IF (SELECT count(*) FROM public.login_gift_receipts WHERE user_id = u) <> 1
		OR (SELECT count(*) FROM public.owned_costume_instances WHERE user_id = u) <> 1
		OR (SELECT count(*) FROM public.user_seasonal_cards WHERE user_id = u AND quantity = 1) <> 1
		OR EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u) THEN
		RAISE EXCEPTION 'gift transaction did not create exactly one costume/card without a hat';
	END IF;

	-- Deactivation, reinstall, and changed client metadata cannot hide or reroll a receipt.
	UPDATE public.login_gift_campaigns SET active = false WHERE campaign_key = 'halloween_2026_login_gift_v1';
	r := public.claim_halloween_login_gift(NULL, NULL);
	IF r->>'status' <> 'replay' OR (r->'receipt'->>'receiptId')::uuid <> receipt_id THEN
		RAISE EXCEPTION 'settled gift did not replay after deactivation';
	END IF;
	BEGIN
		UPDATE public.login_gift_campaign_pool SET position = position + 10
		WHERE campaign_key = 'halloween_2026_login_gift_v1';
		RAISE EXCEPTION 'claimed pool remained mutable';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'claimed pool remained mutable' THEN RAISE; END IF;
		IF SQLERRM <> 'claimed login gift pool is frozen; create a new versioned campaign' THEN RAISE; END IF;
	END;

	-- A fresh version can be assembled before it grants anything.
	INSERT INTO public.login_gift_campaigns(
		campaign_key, grant_key, display_name, active, opens_at, closes_at,
		minimum_client_build, fit_policy_version
	) VALUES (
		'halloween_2026_login_gift_test_v2', 'halloween_2026_login_gift_test',
		'Harness unclaimed gift', false, '-infinity'::timestamptz,
		'infinity'::timestamptz, 1, 1
	);
	INSERT INTO public.login_gift_campaign_pool(campaign_key, position, costume_id, set_key, card_id)
	VALUES (
		'halloween_2026_login_gift_test_v2', 1,
		'halloween_2026_linen_lurker_costume', 'halloween_2026_v1',
		'halloween_2026_card_linen_lurker_costume'
	);
	DELETE FROM public.login_gift_campaign_pool
	WHERE campaign_key = 'halloween_2026_login_gift_test_v2';

	-- Moving a row out of a claimed pool checks OLD as well as NEW.
	BEGIN
		UPDATE public.login_gift_campaign_pool
		SET campaign_key = 'halloween_2026_login_gift_test_v2'
		WHERE campaign_key = 'halloween_2026_login_gift_v1' AND position = 1;
		RAISE EXCEPTION 'claimed pool row moved to an unclaimed campaign';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'claimed pool row moved to an unclaimed campaign' THEN RAISE; END IF;
		IF SQLERRM <> 'claimed login gift pool is frozen; create a new versioned campaign' THEN RAISE; END IF;
	END;
	-- New rows cannot be appended after the first receipt either.
	BEGIN
		INSERT INTO public.login_gift_campaign_pool(campaign_key, position, costume_id, set_key, card_id)
		VALUES (
			'halloween_2026_login_gift_v1', 6,
			'halloween_2026_linen_lurker_costume', 'halloween_2026_v1',
			'halloween_2026_card_linen_lurker_costume'
		);
		RAISE EXCEPTION 'row appended to a claimed pool';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'row appended to a claimed pool' THEN RAISE; END IF;
		IF SQLERRM <> 'claimed login gift pool is frozen; create a new versioned campaign' THEN RAISE; END IF;
	END;

	-- Receipt id is not authority: a different authenticated account cannot ack it.
	PERFORM set_config('request.jwt.claim.sub', u2::text, true);
	r := public.acknowledge_halloween_login_gift(receipt_id);
	IF r->>'status' <> 'inactive'
		OR (SELECT acknowledged_at FROM public.login_gift_receipts WHERE id = receipt_id) IS NOT NULL THEN
		RAISE EXCEPTION 'another account acknowledged the gift receipt';
	END IF;
	PERFORM set_config('request.jwt.claim.sub', u::text, true);
	r := public.acknowledge_halloween_login_gift(receipt_id);
	ack_at := (r->'receipt'->>'acknowledgedAt')::timestamptz;
	IF ack_at IS NULL THEN RAISE EXCEPTION 'gift acknowledgement was not persisted'; END IF;
	r := public.acknowledge_halloween_login_gift(receipt_id);
	IF (r->'receipt'->>'acknowledgedAt')::timestamptz <> ack_at THEN RAISE EXCEPTION 'acknowledgement was not idempotent'; END IF;
END
$smoke$;

-- No caller identity means no claim.
SELECT set_config('request.jwt.claim.sub', '', false);
DO $unauth$
BEGIN
	BEGIN
		PERFORM public.claim_halloween_login_gift(1, 1);
		RAISE EXCEPTION 'unauthenticated gift claim succeeded';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM = 'unauthenticated gift claim succeeded' THEN RAISE; END IF;
	END;
END
$unauth$;

DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000751';
DO $cleanup$
BEGIN
	IF EXISTS (SELECT 1 FROM public.login_gift_receipts WHERE user_id = '00000000-0000-0000-0000-000000000751')
		OR EXISTS (SELECT 1 FROM public.owned_costume_instances WHERE user_id = '00000000-0000-0000-0000-000000000751')
		OR EXISTS (SELECT 1 FROM public.user_seasonal_cards WHERE user_id = '00000000-0000-0000-0000-000000000751') THEN
		RAISE EXCEPTION 'account deletion left Halloween gift rows';
	END IF;
END
$cleanup$;
