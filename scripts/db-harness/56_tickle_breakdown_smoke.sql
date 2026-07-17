-- Functional smoke for tickle_breakdown(p_user) (20260753000000, spec 17).
--
-- 00h_tickle_breakdown_prep.sql shapes truffle_digs + the claimed_at columns
-- AHEAD of the migration; this seeds one fully-loaded player and asserts the
-- receipt. Season boundary = the active season's start, so every lane event is
-- stamped now() (well after any active season's start).
--
-- Asserts:
--   1. Per-lane values (visit/dig/pass/trades/lucky/home) match the seed, and
--      the six lanes sum EXACTLY to total.
--   2. Direction: a trade where p_user is the TARGET (not requester) and a visit
--      where p_user is the TARGET (not visitor) are excluded; a pending trade
--      and a non-tickle pass tier are excluded.
--   3. Residual floor: lanes > total → home_taps floors to 0 (never negative).
--   4. Unknown user → all zeros.
--   5. Definer/cross-user: another caller reads p_user's identical receipt.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $smoke_tickle_breakdown$
DECLARE
	u    uuid := '00000000-0000-0000-0000-000000056001'; -- the loaded player
	o    uuid := '00000000-0000-0000-0000-000000056002'; -- other party + observer
	u2   uuid := '00000000-0000-0000-0000-000000056003'; -- floor player
	unk  uuid := '00000000-0000-0000-0000-0000000560ff'; -- never seen
	res  jsonb;
	lanes int;
BEGIN
	-- ── Fixture ────────────────────────────────────────────────────────────────
	INSERT INTO auth.users (id) VALUES (u), (o), (u2) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, tickles_earned) VALUES
		(u,  'BreakdownPig', 207),  -- 2 + 15 + 150 + 16 + 15 + 9(home) = 207
		(o,  'OtherPig',       0),
		(u2, 'FloorPig',       1)   -- 1 total vs 2 visit lane → home floors to 0
	ON CONFLICT (id) DO NOTHING;

	-- Active season → boundary well before the now()-stamped lane events.
	INSERT INTO public.seasons (id, name, starts_at, ends_at) VALUES
		('brk_season', 'Breakdown Season', now() - interval '1 hour', now() + interval '30 days')
	ON CONFLICT (id) DO NOTHING;

	-- visit_taps = 2: two visits BY u. A visit TO u (o→u) must NOT count.
	INSERT INTO public.barn_visits (visitor_id, target_id, created_at) VALUES
		(u, o, now()),
		(u, o, now()),
		(o, u, now());   -- u is the target here — excluded (lane keys on visitor_id)

	-- dig_finds = 3 × 5 = 15.
	INSERT INTO public.truffle_digs (truffle_id, digger_id, amount, dug_at) VALUES
		(560001, u, 3, now()),
		(560002, u, 4, now()),
		(560003, u, 2, now());

	-- pass_tiers = 100 + 50 = 150. The 'hat' tier is excluded (not a tickle reward).
	INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
		('brk_season', 1, 'free', 'tickles', '{"amount":100}'::jsonb, '100 tickles'),
		('brk_season', 2, 'free', 'tickle',  '{"tickles":50}'::jsonb, '50 tickles'),
		('brk_season', 3, 'free', 'hat',     '{"hat_id":"x"}'::jsonb, 'A Hat')
	ON CONFLICT DO NOTHING;
	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track, claimed_at) VALUES
		(u, 'brk_season', 1, 'free', now()),
		(u, 'brk_season', 2, 'free', now()),
		(u, 'brk_season', 3, 'free', now())   -- the hat claim — no tickle sum
	ON CONFLICT DO NOTHING;

	-- trades = (3 + 5) × 2 = 16. A fulfilled trade where u is the TARGET and a
	-- pending trade where u is requester are both excluded.
	INSERT INTO public.tickle_trades (requester_id, target_id, amount, status, fulfilled_at) VALUES
		(u, o, 3, 'fulfilled', now()),
		(u, o, 5, 'fulfilled', now()),
		(o, u, 4, 'fulfilled', now()),   -- u is the target — excluded (lane keys on requester_id)
		(u, o, 2, 'pending',   NULL);    -- not fulfilled — excluded

	-- lucky = 3 × 5 = 15. Distinct claimed_on to satisfy the (user_id, claimed_on) PK.
	INSERT INTO public.daily_lucky_claims (user_id, claimed_on, claimed_at) VALUES
		(u, current_date,     now()),
		(u, current_date - 1, now()),
		(u, current_date - 2, now());

	-- Floor player: one visit lane of 2 vs a total of 1.
	INSERT INTO public.barn_visits (visitor_id, target_id, created_at) VALUES
		(u2, o, now()), (u2, o, now());

	-- ── 1 + 2. u's receipt: per-lane + exact sum + exclusions ───────────────────
	PERFORM set_config('smoke.uid', u::text, true);
	res := public.tickle_breakdown(u);

	IF (res->>'total')::int      <> 207 THEN RAISE EXCEPTION 'total: expected 207, got %', res->>'total'; END IF;
	IF (res->>'visit_taps')::int <> 2   THEN RAISE EXCEPTION 'visit_taps: expected 2, got %',   res->>'visit_taps'; END IF;
	IF (res->>'dig_finds')::int  <> 15  THEN RAISE EXCEPTION 'dig_finds: expected 15, got %',   res->>'dig_finds'; END IF;
	IF (res->>'pass_tiers')::int <> 150 THEN RAISE EXCEPTION 'pass_tiers: expected 150, got %', res->>'pass_tiers'; END IF;
	IF (res->>'trades')::int     <> 16  THEN RAISE EXCEPTION 'trades: expected 16, got %',      res->>'trades'; END IF;
	IF (res->>'lucky')::int      <> 15  THEN RAISE EXCEPTION 'lucky: expected 15, got %',       res->>'lucky'; END IF;
	IF (res->>'home_taps')::int  <> 9   THEN RAISE EXCEPTION 'home_taps: expected 9, got %',    res->>'home_taps'; END IF;

	lanes := (res->>'home_taps')::int + (res->>'visit_taps')::int + (res->>'dig_finds')::int
	       + (res->>'pass_tiers')::int + (res->>'trades')::int + (res->>'lucky')::int;
	IF lanes <> (res->>'total')::int THEN
		RAISE EXCEPTION 'lanes must sum to total: % lanes vs % total', lanes, res->>'total'; END IF;
	IF (res->>'boundary') IS NULL THEN
		RAISE EXCEPTION 'boundary must be the active season start, got NULL'; END IF;

	-- ── 3. Residual floor ───────────────────────────────────────────────────────
	res := public.tickle_breakdown(u2);
	IF (res->>'total')::int <> 1 OR (res->>'visit_taps')::int <> 2 OR (res->>'home_taps')::int <> 0 THEN
		RAISE EXCEPTION 'floor: expected total 1 / visit 2 / home 0, got %', res; END IF;

	-- ── 4. Unknown user → all zeros ─────────────────────────────────────────────
	res := public.tickle_breakdown(unk);
	IF (res->>'total')::int <> 0 OR (res->>'home_taps')::int <> 0
	   OR (res->>'visit_taps')::int <> 0 OR (res->>'dig_finds')::int <> 0
	   OR (res->>'pass_tiers')::int <> 0 OR (res->>'trades')::int <> 0
	   OR (res->>'lucky')::int <> 0 THEN
		RAISE EXCEPTION 'unknown user must be all zeros, got %', res; END IF;

	-- ── 5. Definer/cross-user: o reads u's identical receipt ────────────────────
	PERFORM set_config('smoke.uid', o::text, true);
	res := public.tickle_breakdown(u);
	IF (res->>'total')::int <> 207 OR (res->>'pass_tiers')::int <> 150 THEN
		RAISE EXCEPTION 'cross-user read must match: got total=% pass=%', res->>'total', res->>'pass_tiers'; END IF;

	RAISE NOTICE 'chk tickle_breakdown: lanes 2/15/150/16/15 + home 9 = 207 total, exclusions honored, floor 0, unknown zeros, cross-user OK';
END $smoke_tickle_breakdown$;

-- Cleanup so later appended smokes' bare seeds don't collide.
DELETE FROM public.barn_visits         WHERE visitor_id IN ('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056003')
                                           OR target_id  IN ('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056002');
DELETE FROM public.truffle_digs        WHERE digger_id = '00000000-0000-0000-0000-000000056001';
DELETE FROM public.tickle_trades       WHERE requester_id IN ('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056002')
                                           OR target_id     IN ('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056002');
DELETE FROM public.daily_lucky_claims  WHERE user_id = '00000000-0000-0000-0000-000000056001';
DELETE FROM public.user_tier_claims    WHERE user_id = '00000000-0000-0000-0000-000000056001';
DELETE FROM public.season_tiers        WHERE season_id = 'brk_season';
DELETE FROM public.seasons             WHERE id = 'brk_season';
DELETE FROM public.profiles            WHERE id IN
	('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056002','00000000-0000-0000-0000-000000056003');
DELETE FROM auth.users                 WHERE id IN
	('00000000-0000-0000-0000-000000056001','00000000-0000-0000-0000-000000056002','00000000-0000-0000-0000-000000056003');
