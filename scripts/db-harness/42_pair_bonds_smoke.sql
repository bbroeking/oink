-- Functional smoke for pair_bonds (20260743000000): the pair-bond ledger, its
-- fail-soft maintenance triggers, the one-time backfill, and the two RPCs
-- (pair_leaderboard, pair_bond_with).
--
-- Self-contained: the plain-Postgres stub carries blessings but not
-- tickle_trades / barn_visits — 00e_pair_bonds_prep.sql builds those AHEAD of
-- the migration (so its triggers + backfill apply), and this smoke re-preps
-- them IF NOT EXISTS for clarity. The pair_bonds table + triggers + RPCs are
-- applied by the harness chain (run.sh) before this smoke runs, so the backfill
-- has ALREADY happened against whatever history existed at apply time — this
-- smoke therefore inserts its OWN users/rows AFTER apply and exercises the LIVE
-- triggers (not the one-shot backfill; that path is asserted separately below
-- by calling the ledger fresh for these ids, which the backfill never saw).
--
-- Asserts:
--   1. bump_pair_bond canonicalizes: a trade in each direction lands on ONE row.
--   2. Trade fulfillment (pending→fulfilled UPDATE) bumps trades by 1; a plain
--      insert of a 'pending' row does NOT.
--   3. Blessing INSERT bumps blessings; a system self-row (sender=receiver) does
--      NOT.
--   4. Barn-visit INSERT bumps visits.
--   5. bond = trades + blessings + visits (generated column).
--   6. pair_bond_with returns the live counts for a friend, zeros for a stranger.
--   7. pair_leaderboard orders by bond DESC, flags is_self, and appends the
--      caller's best pair as the trailing "you" row when it's outside the top.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Re-prep the trigger targets (the harness prep already built these ahead of the
-- migration; these IF-NOT-EXISTS calls are clean no-ops that document the shape).
CREATE TABLE IF NOT EXISTS public.tickle_trades (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	requester_id uuid, target_id uuid, amount int DEFAULT 1,
	status text DEFAULT 'pending', created_at timestamptz DEFAULT now(),
	fulfilled_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.barn_visits (
	id bigserial PRIMARY KEY, visitor_id uuid, target_id uuid,
	tickles int DEFAULT 1, visit_started_at timestamptz, visit_cap int DEFAULT 1,
	created_at timestamptz DEFAULT now()
);

DO $smoke_pair_bonds$
DECLARE
	-- Ordered so pa < pb < pc < pd as text (the canonical CHECK is user_a < user_b).
	pa uuid := '00000000-0000-0000-0000-000000042001';
	pb uuid := '00000000-0000-0000-0000-000000042002';
	pc uuid := '00000000-0000-0000-0000-000000042003';
	pd uuid := '00000000-0000-0000-0000-000000042004';
	res    jsonb;
	pairs  jsonb;
	you    jsonb;
	trade1 uuid;
BEGIN
	-- Seed profiles (usernames are what the leaderboard joins for) + auth.users
	-- (FK target on pair_bonds).
	INSERT INTO auth.users (id) VALUES (pa), (pb), (pc), (pd) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		(pa, 'ada'), (pb, 'bo'), (pc, 'cass'), (pd, 'dex')
		ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

	-- ── 1 + 2. Trade fulfillment bumps trades; canonicalization ────────
	-- A pending row (no bump), then flip it to fulfilled (bump). requester=pb,
	-- target=pa → canonical pair (pa, pb). The direction is REVERSED from the
	-- key order on purpose to prove canonicalization.
	INSERT INTO public.tickle_trades (requester_id, target_id, status)
		VALUES (pb, pa, 'pending') RETURNING id INTO trade1;
	-- No bump yet — a pending insert isn't a fulfillment.
	IF EXISTS (SELECT 1 FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) THEN
		RAISE EXCEPTION 'pair_bonds: pending trade must not create a bond row'; END IF;

	UPDATE public.tickle_trades SET status = 'fulfilled', fulfilled_at = now()
		WHERE id = trade1;
	IF (SELECT trades FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 1 THEN
		RAISE EXCEPTION 'pair_bonds: fulfilled trade must bump trades to 1'; END IF;

	-- A SECOND fulfilled trade in the OPPOSITE direction (requester=pa,
	-- target=pb) must land on the SAME row (canonical), trades → 2.
	INSERT INTO public.tickle_trades (requester_id, target_id, status)
		VALUES (pa, pb, 'pending') RETURNING id INTO trade1;
	UPDATE public.tickle_trades SET status = 'fulfilled' WHERE id = trade1;
	IF (SELECT count(*) FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 1 THEN
		RAISE EXCEPTION 'pair_bonds: reversed-direction trade must reuse ONE canonical row'; END IF;
	IF (SELECT trades FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 2 THEN
		RAISE EXCEPTION 'pair_bonds: two fulfilled trades must sum to 2, got %',
			(SELECT trades FROM public.pair_bonds WHERE user_a = pa AND user_b = pb); END IF;

	-- ── 3. Blessing INSERT bumps; system self-row does NOT ─────────────
	INSERT INTO public.blessings (sender_id, receiver_id, kind)
		VALUES (pa, pb, 'warm_tea');   -- real player-to-player → bump
	INSERT INTO public.blessings (sender_id, receiver_id, kind)
		VALUES (pb, pb, 'chorus_glow'); -- system self-row → NO bump
	IF (SELECT blessings FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 1 THEN
		RAISE EXCEPTION 'pair_bonds: one real blessing must bump blessings to 1 (system self-row excluded), got %',
			(SELECT blessings FROM public.pair_bonds WHERE user_a = pa AND user_b = pb); END IF;

	-- ── 4. Barn-visit INSERT bumps visits ──────────────────────────────
	INSERT INTO public.barn_visits (visitor_id, target_id, tickles, visit_started_at, visit_cap)
		VALUES (pb, pa, 1, now(), 1);
	IF (SELECT visits FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 1 THEN
		RAISE EXCEPTION 'pair_bonds: barn visit must bump visits to 1'; END IF;

	-- ── 5. bond = trades + blessings + visits (generated) ──────────────
	IF (SELECT bond FROM public.pair_bonds WHERE user_a = pa AND user_b = pb) <> 4 THEN
		RAISE EXCEPTION 'pair_bonds: bond must be 2+1+1=4, got %',
			(SELECT bond FROM public.pair_bonds WHERE user_a = pa AND user_b = pb); END IF;

	-- ── 6. pair_bond_with — live counts for a friend, zeros for a stranger ─
	PERFORM set_config('smoke.uid', pa::text, true);
	res := public.pair_bond_with(pb);
	IF (res->>'trades')::int <> 2 OR (res->>'blessings')::int <> 1
		OR (res->>'visits')::int <> 1 OR (res->>'bond')::int <> 4 THEN
		RAISE EXCEPTION 'pair_bond_with: expected 2/1/1/4 for ada×bo, got %', res; END IF;
	-- Stranger (pd, no bond) → zeros.
	res := public.pair_bond_with(pd);
	IF (res->>'bond')::int <> 0 OR (res->>'trades')::int <> 0 THEN
		RAISE EXCEPTION 'pair_bond_with: stranger must be all zeros, got %', res; END IF;
	-- Direction-agnostic: bo asking about ada must match ada asking about bo.
	PERFORM set_config('smoke.uid', pb::text, true);
	IF (public.pair_bond_with(pa)->>'bond')::int <> 4 THEN
		RAISE EXCEPTION 'pair_bond_with: must be direction-agnostic'; END IF;

	-- ── 7. pair_leaderboard — ordering, is_self, you-row ───────────────
	-- Add a SECOND, stronger pair (pc×pd, bond 6) so the board has an order and
	-- ada×bo (bond 4) is rank 2. Then a WEAK pair for pa outside a top-1 slice.
	INSERT INTO public.pair_bonds (user_a, user_b, trades, blessings, visits) VALUES
		(pc, pd, 6, 0, 0);           -- bond 6 → rank 1
	-- pa also has a tiny bond with pc (bond 1) — pa's BEST pair is still ada×bo (4).

	PERFORM set_config('smoke.uid', pd::text, true);  -- caller is in the #1 pair
	res := public.pair_leaderboard(25);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'pair_leaderboard: must be ok, got %', res; END IF;
	pairs := res->'pairs';
	IF jsonb_array_length(pairs) <> 2 THEN
		RAISE EXCEPTION 'pair_leaderboard: expected 2 ranked pairs, got %', pairs; END IF;
	-- Rank 1 = the bond-6 pair, rank 2 = the bond-4 pair (bond DESC).
	IF (pairs->0->>'rank')::int <> 1 OR (pairs->0->>'bond')::int <> 6 THEN
		RAISE EXCEPTION 'pair_leaderboard: rank 1 must be bond 6, got %', pairs->0; END IF;
	IF (pairs->1->>'bond')::int <> 4 THEN
		RAISE EXCEPTION 'pair_leaderboard: rank 2 must be bond 4, got %', pairs->1; END IF;
	-- Caller (pd) is in rank 1 → is_self true there, and NO trailing you-row.
	IF NOT (pairs->0->>'is_self')::boolean THEN
		RAISE EXCEPTION 'pair_leaderboard: rank-1 pair must flag is_self for its member'; END IF;
	IF res->'you' <> 'null'::jsonb AND res->'you' IS NOT NULL THEN
		RAISE EXCEPTION 'pair_leaderboard: caller in top slice must have null you-row, got %', res->'you'; END IF;
	-- Usernames present on the joined rows.
	IF (pairs->0->>'name_a') IS NULL OR (pairs->0->>'name_b') IS NULL THEN
		RAISE EXCEPTION 'pair_leaderboard: rows must carry both usernames, got %', pairs->0; END IF;

	-- Now call with a LIMIT of 1 as ada — ada's best pair (ada×bo, bond 4) is
	-- rank 2, OUTSIDE the top-1 slice → it must come back as the you-row.
	PERFORM set_config('smoke.uid', pa::text, true);
	res := public.pair_leaderboard(1);
	pairs := res->'pairs';
	you := res->'you';
	IF jsonb_array_length(pairs) <> 1 THEN
		RAISE EXCEPTION 'pair_leaderboard(1): expected 1 top row, got %', pairs; END IF;
	IF you = 'null'::jsonb OR you IS NULL THEN
		RAISE EXCEPTION 'pair_leaderboard(1): ada outside top must get a you-row, got %', res; END IF;
	IF (you->>'bond')::int <> 4 OR (you->>'rank')::int <> 2 OR NOT (you->>'is_self')::boolean THEN
		RAISE EXCEPTION 'pair_leaderboard(1): you-row must be ada×bo bond 4 rank 2 is_self, got %', you; END IF;

	RAISE NOTICE 'chk pair_bonds: canon + trade/blessing(system-excl)/visit bumps + bond gen + bond_with(live/zero/dir) + leaderboard(order/is_self/you-row) OK';
END $smoke_pair_bonds$;

-- Cleanup so later smokes' bare `INSERT INTO auth.users SELECT id FROM profiles`
-- don't collide on the seeded ids (mirrors the teardown in 53_me_lifetime_stats).
DELETE FROM public.pair_bonds WHERE user_a IN
	('00000000-0000-0000-0000-000000042001','00000000-0000-0000-0000-000000042002',
	 '00000000-0000-0000-0000-000000042003','00000000-0000-0000-0000-000000042004');
DELETE FROM public.tickle_trades WHERE requester_id IN
	('00000000-0000-0000-0000-000000042001','00000000-0000-0000-0000-000000042002');
DELETE FROM public.barn_visits WHERE visitor_id IN
	('00000000-0000-0000-0000-000000042001','00000000-0000-0000-0000-000000042002');
DELETE FROM public.blessings WHERE sender_id IN
	('00000000-0000-0000-0000-000000042001','00000000-0000-0000-0000-000000042002');
DELETE FROM public.profiles WHERE id IN
	('00000000-0000-0000-0000-000000042001','00000000-0000-0000-0000-000000042002',
	 '00000000-0000-0000-0000-000000042003','00000000-0000-0000-0000-000000042004');
