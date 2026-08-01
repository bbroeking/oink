-- Functional smoke for 20260776000000_cosmetic_owner_caps.sql.
-- Uses a one-owner fixture so the first redemption succeeds and the second
-- proves both the friendly RPC refusal and the trigger-level hard stop.
\set ON_ERROR_STOP on

INSERT INTO public.redemption_codes (code, label, "grant", max_uses)
VALUES (
	'PIGCAPAAAA',
	'smoke capped cosmetic',
	'{"kind":"hat","id":"ticket_takers_cap"}',
	5
);

UPDATE public.cosmetic_supply
SET max_owners = 1, issued_count = 0
WHERE hat_id = 'ticket_takers_cap';

DO $smoke_supply$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-000000deed01';
	u2 uuid := '00000000-0000-0000-0000-000000deed02';
	res jsonb;
	blocked boolean := false;
BEGIN
	PERFORM set_config('smoke.uid', u1::text, true);
	res := public.redeem_code('PIG-CAP-AAAA');
	IF NOT (res->>'ok')::boolean OR res->>'id' <> 'ticket_takers_cap' THEN
		RAISE EXCEPTION 'first capped grant failed: %', res;
	END IF;

	PERFORM set_config('smoke.uid', u2::text, true);
	res := public.redeem_code('PIG-CAP-AAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'item_sold_out' THEN
		RAISE EXCEPTION 'second capped grant must refuse item_sold_out: %', res;
	END IF;
	IF EXISTS (
		SELECT 1 FROM public.redemption_claims
		WHERE code = 'PIGCAPAAAA' AND user_id = u2
	) THEN
		RAISE EXCEPTION 'sold-out refusal consumed the claim';
	END IF;
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGCAPAAAA') <> 1 THEN
		RAISE EXCEPTION 'sold-out refusal bumped code uses';
	END IF;

	BEGIN
		INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (u2, 'ticket_takers_cap');
	EXCEPTION WHEN SQLSTATE 'P0001' THEN
		blocked := true;
	END;
	IF NOT blocked THEN
		RAISE EXCEPTION 'direct insert bypassed the cosmetic supply trigger';
	END IF;
	IF (SELECT issued_count FROM public.cosmetic_supply
		WHERE hat_id = 'ticket_takers_cap') <> 1 THEN
		RAISE EXCEPTION 'issued_count drifted from one';
	END IF;

	RAISE NOTICE 'cosmetic supply smoke OK';
END $smoke_supply$;

