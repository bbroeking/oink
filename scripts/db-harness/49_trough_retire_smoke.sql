-- Functional smoke for the Trough tickle retirement (20260751000000, spec 15).
--
-- 00g_trough_retire_prep.sql builds item_drive_donations / the item_drives
-- reward columns AND seeds the claw-back fixture AHEAD of the migration ($@);
-- the migration then retires the payout + runs the one-shot claw-back. This
-- smoke asserts the aftermath and exercises both retired RPCs live.
--
-- Asserts:
--   1. Claw-back: D1 (post-boundary 5+3) → counter/tickles_earned 100→92.
--   2. Floor: D2 (post-boundary 10 vs balances 2/1) → GREATEST floors both to 0.
--   3. Pre-boundary claimed reward (50) is UNTOUCHED — season 0 is settled.
--   4. Pending (unclaimed) reward is zeroed — nothing left to claim.
--   5. donate_to_drive → reward 0, records tickle_reward 0, no leaderboard/bank
--      credit; funded-donor note drops the "Claim" CTA.
--   6. claim_drive_reward → {ok:false, reason:'retired'}, credits + stamps nothing.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $smoke_trough_retire$
DECLARE
	d1   uuid := '00000000-0000-0000-0000-000000049001'; -- normal claw-back donor
	d2   uuid := '00000000-0000-0000-0000-000000049002'; -- floor claw-back donor
	op   uuid := '00000000-0000-0000-0000-000000049010'; -- functional opener
	dn   uuid := '00000000-0000-0000-0000-000000049011'; -- functional donor
	drv  uuid;
	don  uuid;
	res  jsonb;
	n    int;
	cnt  int;
	tks  int;
BEGIN
	-- ── 1. Claw-back subtracts post-boundary claimed rewards (5 + 3 = 8) ─────────
	SELECT counter, tickles_earned INTO cnt, tks FROM public.profiles WHERE id = d1;
	IF cnt <> 92 OR tks <> 92 THEN
		RAISE EXCEPTION 'D1 claw-back: expected 92/92, got counter=% tickles_earned=%', cnt, tks; END IF;

	-- ── 2. GREATEST floors D2 (balances 2/1 vs claw-back 10) to 0/0 ─────────────
	SELECT counter, tickles_earned INTO cnt, tks FROM public.profiles WHERE id = d2;
	IF cnt <> 0 OR tks <> 0 THEN
		RAISE EXCEPTION 'D2 floor: expected 0/0, got counter=% tickles_earned=%', cnt, tks; END IF;

	-- ── 3. Pre-boundary claimed reward (50) untouched ───────────────────────────
	SELECT count(*) INTO n FROM public.item_drive_donations
		WHERE donor_user_id = d1 AND snouts = 500 AND tickle_reward = 50
		  AND reward_claimed_at IS NOT NULL;
	IF n <> 1 THEN
		RAISE EXCEPTION 'pre-boundary reward should stay 50 (settled season 0), got % matching rows', n; END IF;

	-- ── 4. Pending (unclaimed) reward zeroed ────────────────────────────────────
	SELECT count(*) INTO n FROM public.item_drive_donations
		WHERE donor_user_id = d1 AND reward_claimed_at IS NULL AND tickle_reward <> 0;
	IF n <> 0 THEN
		RAISE EXCEPTION 'pending reward should be zeroed, got % non-zero unclaimed rows', n; END IF;

	-- ── 5. donate_to_drive: reward retired to 0, no credit, no claim CTA ─────────
	INSERT INTO auth.users (id) VALUES (op), (dn) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter, tickles_earned) VALUES
		(op, 'RetireOpener', 0, 0), (dn, 'RetireDonor', 100, 0) ON CONFLICT DO NOTHING;
	INSERT INTO public.hats (id, name) VALUES ('cowboy', 'Cowboy Hat')
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
	INSERT INTO public.item_drives (opener_user_id, item_id, status, closes_at, target_snouts, raised_snouts)
		VALUES (op, 'cowboy', 'open', now() + interval '7 days', 20, 0)
		RETURNING id INTO drv;

	PERFORM set_config('smoke.uid', dn::text, true);
	res := public.donate_to_drive(drv, 20);  -- exactly funds the drive
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'donate_to_drive failed: %', res; END IF;
	IF (res->>'reward')::int <> 0 THEN
		RAISE EXCEPTION 'donate reward must be 0 (retired), got %', res->>'reward'; END IF;
	IF NOT (res->>'funded')::boolean THEN
		RAISE EXCEPTION 'donate should have funded the drive, got %', res; END IF;

	-- The recorded donation carries tickle_reward 0.
	SELECT id, tickle_reward INTO don, n FROM public.item_drive_donations
		WHERE donor_user_id = dn AND drive_id = drv;
	IF n <> 0 THEN
		RAISE EXCEPTION 'recorded donation tickle_reward must be 0, got %', n; END IF;

	-- Donor paid the 20 snouts but got NO tickle credit to bank or leaderboard.
	SELECT counter, tickles_earned INTO cnt, tks FROM public.profiles WHERE id = dn;
	IF cnt <> 80 OR tks <> 0 THEN
		RAISE EXCEPTION 'donor should be 80/0 after chipping 20 (no tickle credit), got %/%', cnt, tks; END IF;

	-- The funded-donor note celebrates the item — no "Claim" CTA.
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE user_id = dn AND kind = 'trough_funded' AND body ILIKE '%claim%';
	IF n <> 0 THEN
		RAISE EXCEPTION 'funded-donor note must not mention Claim, got % matching', n; END IF;

	-- ── 6. claim_drive_reward: retired refusal, nothing credited or stamped ──────
	res := public.claim_drive_reward(don);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'retired' THEN
		RAISE EXCEPTION 'claim_drive_reward must return {ok:false, reason:retired}, got %', res; END IF;
	SELECT counter, tickles_earned INTO cnt, tks FROM public.profiles WHERE id = dn;
	IF cnt <> 80 OR tks <> 0 THEN
		RAISE EXCEPTION 'retired claim must not credit: donor changed to %/%', cnt, tks; END IF;
	IF EXISTS (SELECT 1 FROM public.item_drive_donations WHERE id = don AND reward_claimed_at IS NOT NULL) THEN
		RAISE EXCEPTION 'retired claim must not stamp reward_claimed_at'; END IF;

	RAISE NOTICE 'chk trough_retire: claw-back 92/92 + floor 0/0 + pre-boundary intact + pending zeroed + donate reward 0 + claim retired OK';
END $smoke_trough_retire$;

-- Cleanup so later appended smokes' bare auth.users seeds don't collide.
DELETE FROM public.system_announcements WHERE user_id IN
	('00000000-0000-0000-0000-000000049010','00000000-0000-0000-0000-000000049011');
DELETE FROM public.item_drive_donations WHERE donor_user_id IN
	('00000000-0000-0000-0000-000000049001','00000000-0000-0000-0000-000000049002',
	 '00000000-0000-0000-0000-000000049011');
DELETE FROM public.item_drives WHERE opener_user_id = '00000000-0000-0000-0000-000000049010';
DELETE FROM public.user_hats WHERE user_id = '00000000-0000-0000-0000-000000049010';
DELETE FROM public.profiles WHERE id IN
	('00000000-0000-0000-0000-000000049001','00000000-0000-0000-0000-000000049002',
	 '00000000-0000-0000-0000-000000049010','00000000-0000-0000-0000-000000049011');
DELETE FROM auth.users WHERE id IN
	('00000000-0000-0000-0000-000000049001','00000000-0000-0000-0000-000000049002',
	 '00000000-0000-0000-0000-000000049010','00000000-0000-0000-0000-000000049011');
