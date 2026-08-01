-- Global cosmetic owner caps.
-- AUTHORED ONLY: do not push without Brian's explicit "go".
--
-- redemption_codes.max_uses caps one campaign/code. It does not cap an item
-- across multiple present or future codes, nor protect against another grant
-- path inserting the same item. cosmetic_supply is the item-level invariant:
-- issued_count is lifetime issuance (it does not fall when an account/user_hat
-- is deleted), and a BEFORE INSERT trigger serializes every ownership grant.
--
-- Founder decision (2026-07-23):
--   release_party_crown  — at most 10 owners
--   ticket_takers_cap    — at most 10 owners

CREATE TABLE public.cosmetic_supply (
	hat_id        text PRIMARY KEY REFERENCES public.hats(id) ON DELETE CASCADE,
	max_owners    int NOT NULL CHECK (max_owners > 0),
	issued_count  int NOT NULL DEFAULT 0 CHECK (issued_count >= 0),
	created_at    timestamptz NOT NULL DEFAULT now(),
	updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cosmetic_supply ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies: supply policy is server-owned. Clients learn
-- "sold out" only through the acquisition RPC's refusal envelope.

-- Seed from ACTUAL current ownership, so deploying after cards have circulated
-- never forgets copies already issued. If either item already has >=10 owners,
-- the cap becomes a no-new-owners freeze; this migration never revokes items.
INSERT INTO public.cosmetic_supply (hat_id, max_owners, issued_count)
SELECT h.id, 10, COUNT(uh.user_id)::int
FROM public.hats h
LEFT JOIN public.user_hats uh ON uh.hat_id = h.id
WHERE h.id IN ('release_party_crown', 'ticket_takers_cap')
GROUP BY h.id
ON CONFLICT (hat_id) DO UPDATE
SET max_owners = EXCLUDED.max_owners,
	issued_count = GREATEST(
		public.cosmetic_supply.issued_count,
		EXCLUDED.issued_count
	),
	updated_at = now();

-- Keep the two existing shared QR campaigns aligned with the item cap as a
-- second guard. A code whose uses already exceed 10 simply becomes exhausted;
-- existing ownership is preserved.
UPDATE public.redemption_codes
SET max_uses = LEAST(max_uses, 10)
WHERE "grant" IN (
	'{"kind":"hat","id":"release_party_crown"}'::jsonb,
	'{"kind":"hat","id":"ticket_takers_cap"}'::jsonb
);

CREATE OR REPLACE FUNCTION public.enforce_cosmetic_supply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	supply public.cosmetic_supply%ROWTYPE;
BEGIN
	-- Row lock is the concurrency seam: every grant of a capped item queues
	-- here, so two simultaneous claims cannot both take the tenth copy.
	SELECT * INTO supply
	FROM public.cosmetic_supply
	WHERE hat_id = NEW.hat_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RETURN NEW; -- uncapped item
	END IF;

	-- Preserve INSERT ... ON CONFLICT semantics for an existing owner without
	-- consuming another lifetime issuance.
	IF EXISTS (
		SELECT 1 FROM public.user_hats
		WHERE user_id = NEW.user_id AND hat_id = NEW.hat_id
	) THEN
		RETURN NEW;
	END IF;

	IF supply.issued_count >= supply.max_owners THEN
		RAISE EXCEPTION 'cosmetic_owner_cap_reached'
			USING ERRCODE = 'P0001';
	END IF;

	UPDATE public.cosmetic_supply
	SET issued_count = issued_count + 1,
		updated_at = now()
	WHERE hat_id = NEW.hat_id;

	RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_cosmetic_supply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_hats_enforce_cosmetic_supply ON public.user_hats;
CREATE TRIGGER user_hats_enforce_cosmetic_supply
	BEFORE INSERT ON public.user_hats
	FOR EACH ROW EXECUTE FUNCTION public.enforce_cosmetic_supply();

-- Carry the sole redeem_code definition from 20260732, adding only:
--   1. a pre-claim, row-locked item-supply check for a friendly sold-out result;
--   2. the unchanged insert then passes through the trigger above, which is the
--      final invariant for redemption and every other present/future grant path.
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller     uuid := auth.uid();
	norm       text;
	rec        public.redemption_codes%ROWTYPE;
	g_kind     text;
	g_id       text;
	g_amount   int;
	hat_name   text;
	hat_rarity text;
	hat_cap    int;
	hat_issued int;
	rows_ins   int;
	actual     int;
BEGIN
	IF caller IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
	END IF;

	norm := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));

	SELECT * INTO rec FROM public.redemption_codes
		WHERE code = norm FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown');
	END IF;

	IF rec.expires_at IS NOT NULL AND rec.expires_at < now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'expired');
	END IF;
	IF rec.uses >= rec.max_uses THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'exhausted');
	END IF;

	g_kind   := rec."grant"->>'kind';
	g_id     := rec."grant"->>'id';
	g_amount := (rec."grant"->>'amount')::int;

	IF g_kind = 'hat' THEN
		SELECT name, rarity INTO hat_name, hat_rarity
		FROM public.hats WHERE id = g_id;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
		END IF;

		-- Lock the item supply before consuming redemption_claims. Existing
		-- owners keep the historical already_owned behavior and don't consume
		-- another issuance; new owners get a friendly pre-write refusal at cap.
		SELECT max_owners, issued_count INTO hat_cap, hat_issued
		FROM public.cosmetic_supply
		WHERE hat_id = g_id
		FOR UPDATE;
		IF FOUND
			AND hat_issued >= hat_cap
			AND NOT EXISTS (
				SELECT 1 FROM public.user_hats
				WHERE user_id = caller AND hat_id = g_id
			)
		THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'item_sold_out');
		END IF;

	ELSIF g_kind IN ('truffles', 'snouts') THEN
		IF g_amount IS NULL OR g_amount < 1 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
		END IF;

		IF g_kind = 'truffles' THEN
			SELECT COALESCE(golden_truffles, 0) INTO actual
				FROM public.profiles WHERE id = caller;
			IF actual >= 999 THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'pouch_full');
			END IF;
		END IF;
	ELSE
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
	END IF;

	INSERT INTO public.redemption_claims (code, user_id)
		VALUES (norm, caller)
		ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS rows_ins = ROW_COUNT;
	IF rows_ins = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
	END IF;

	IF g_kind = 'hat' THEN
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (caller, g_id)
			ON CONFLICT DO NOTHING;
		GET DIAGNOSTICS rows_ins = ROW_COUNT;
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'hat', 'id', g_id, 'name', hat_name,
			'rarity', hat_rarity, 'already_owned', (rows_ins = 0)
		);

	ELSIF g_kind = 'truffles' THEN
		actual := public.mint_truffles(caller, g_amount, 'redemption:' || norm, NULL);
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'truffles', 'granted_amount', actual
		);

	ELSE
		UPDATE public.profiles SET counter = counter + g_amount WHERE id = caller;
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'snouts', 'amount', g_amount
		);
	END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;

