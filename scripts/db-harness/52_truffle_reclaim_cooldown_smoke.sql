-- Smoke: 20260738400000_truffle_reclaim_cooldown — reclaim starts a 12h
-- re-bury cooldown; friends digging the pot dry does NOT.
--
-- Self-contained (like 51_*): builds the truffle tables + a grant_season_xp
-- stub the 00_stub lacks, rewires auth.uid() to the smoke.uid GUC, then
-- exercises bury → reclaim → bury(blocked) → backdate → bury(ok) and the
-- dug-dry-by-friend → immediate re-bury path.
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

CREATE TABLE IF NOT EXISTS public.truffles (
	id           bigserial PRIMARY KEY,
	host_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reward       int  NOT NULL,
	remaining    int  NOT NULL,
	dug_by       uuid,
	dug_at       timestamptz,
	created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS truffles_one_active
	ON public.truffles (host_id) WHERE dug_at IS NULL;
CREATE TABLE IF NOT EXISTS public.truffle_digs (
	truffle_id bigint NOT NULL,
	digger_id  uuid   NOT NULL,
	amount     int    NOT NULL,
	dug_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.xp_ledger (user_id uuid, amount int);
DROP FUNCTION IF EXISTS public.grant_season_xp(uuid, integer);
CREATE FUNCTION public.grant_season_xp(p_user uuid, p_amount int)
RETURNS void LANGUAGE sql AS
$$ INSERT INTO public.xp_ledger VALUES (p_user, p_amount) $$;

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-00000000aaaa'),
	('00000000-0000-0000-0000-00000000bbbb');
INSERT INTO public.profiles (id, counter)
	VALUES ('00000000-0000-0000-0000-00000000aaaa', 500),
	       ('00000000-0000-0000-0000-00000000bbbb', 0)
	ON CONFLICT (id) DO UPDATE SET counter = EXCLUDED.counter;

\i supabase/migrations/20260738400000_truffle_reclaim_cooldown.sql

SET smoke.uid = '00000000-0000-0000-0000-00000000aaaa';

-- 1. bury 50 → ok, 5 XP, balance 450
DO $$
DECLARE r jsonb;
BEGIN
	r := public.bury_truffle(50);
	IF NOT (r->>'ok')::boolean OR (r->>'xp')::int <> 5 OR (r->>'balance')::int <> 450 THEN
		RAISE EXCEPTION 'bury #1 wrong: %', r;
	END IF;
END $$;

-- 2. reclaim → ok, full refund, next_bury_at surfaced
DO $$
DECLARE r jsonb;
BEGIN
	r := public.reclaim_truffle();
	IF NOT (r->>'ok')::boolean OR (r->>'refunded')::int <> 50
	   OR (r->>'balance')::int <> 500 OR r->>'next_bury_at' IS NULL THEN
		RAISE EXCEPTION 'reclaim wrong: %', r;
	END IF;
END $$;

-- 3. immediate re-bury → reclaim_cooldown with next_at
DO $$
DECLARE r jsonb;
BEGIN
	r := public.bury_truffle(50);
	IF (r->>'ok')::boolean OR r->>'error' <> 'reclaim_cooldown' OR r->>'next_at' IS NULL THEN
		RAISE EXCEPTION 'cooldown not enforced: %', r;
	END IF;
END $$;

-- 4. 13h later (backdated) → bury ok again
UPDATE public.truffles SET reclaimed_at = now() - interval '13 hours'
	WHERE host_id = '00000000-0000-0000-0000-00000000aaaa';
DO $$
DECLARE r jsonb;
BEGIN
	r := public.bury_truffle(10);
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'post-cooldown bury blocked: %', r;
	END IF;
END $$;

-- 5. friend digs it DRY (dug_at set, reclaimed_at untouched) → immediate
--    re-bury stays allowed (the designed social loop).
UPDATE public.truffles
	SET remaining = 0, dug_at = now(), dug_by = '00000000-0000-0000-0000-00000000bbbb'
	WHERE host_id = '00000000-0000-0000-0000-00000000aaaa' AND dug_at IS NULL;
DO $$
DECLARE r jsonb;
BEGIN
	r := public.bury_truffle(10);
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'dug-dry re-bury wrongly blocked: %', r;
	END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk truffle reclaim cooldown: bury/reclaim/cooldown/expiry/dug-dry OK'; END $$;
ROLLBACK;
