-- Smoke: 20260738900000_beginners_snout — claim_beginners_snout() mints one
-- Golden Truffle exactly once per account, refuses a second claim, and refuses
-- an unauthenticated caller.
--
-- The migration is applied by run.sh's CHAIN (it can't self-\i — the suite is
-- piped into psql, so relative \i paths don't resolve on the container). This
-- smoke rewires auth.uid() to the smoke.uid GUC, leans on 00_stub's profiles +
-- mint_truffles, and exercises claim → claim(again) → unauth.
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000005a1');
INSERT INTO public.profiles (id, golden_truffles)
	VALUES ('00000000-0000-0000-0000-0000000005a1', 0)
	ON CONFLICT (id) DO UPDATE SET golden_truffles = EXCLUDED.golden_truffles;

SET smoke.uid = '00000000-0000-0000-0000-0000000005a1';

-- 1. first claim → ok, granted 1, balance 1
DO $$
DECLARE r jsonb;
BEGIN
	r := public.claim_beginners_snout();
	IF NOT (r->>'ok')::boolean OR (r->>'granted')::int <> 1 OR (r->>'balance')::int <> 1 THEN
		RAISE EXCEPTION 'first claim wrong: %', r;
	END IF;
	IF (SELECT golden_truffles FROM public.profiles WHERE id = auth.uid()) <> 1 THEN
		RAISE EXCEPTION 'pouch not +1 after claim';
	END IF;
	IF (SELECT beginners_snout_at FROM public.profiles WHERE id = auth.uid()) IS NULL THEN
		RAISE EXCEPTION 'beginners_snout_at not stamped';
	END IF;
END $$;

-- 2. second claim → already_claimed, no further mint
DO $$
DECLARE r jsonb;
BEGIN
	r := public.claim_beginners_snout();
	IF (r->>'ok')::boolean OR r->>'reason' <> 'already_claimed' THEN
		RAISE EXCEPTION 'second claim not blocked: %', r;
	END IF;
	IF (SELECT golden_truffles FROM public.profiles WHERE id = auth.uid()) <> 1 THEN
		RAISE EXCEPTION 'pouch double-minted on second claim';
	END IF;
END $$;

-- 3. unauthenticated → not_authed
SET smoke.uid = '';
DO $$
DECLARE r jsonb;
BEGIN
	r := public.claim_beginners_snout();
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_authed' THEN
		RAISE EXCEPTION 'unauth not refused: %', r;
	END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk beginners snout: claim +1 / already_claimed / not_authed OK'; END $$;
ROLLBACK;
