-- Smoke: the phase-2 season claim routers (claim_season_tier, claim_ready_tiers)
-- resolve prestige-vs-normal + track server-side and reuse the shipped per-tier
-- claimers. Covers normal / premium-gated / premium-success / already-claimed /
-- tier-locked single claims, and multi-tier tally / empty no-op / premium-glass /
-- per-tier failure isolation for the sweep.
--
-- Self-standing: seeds its own `claim_cons_season` (active via the harness's
-- active_season stub, keyed on this id) + tiers + users. Assumes the two real
-- claimers (claim_tier_reward 20260686, claim_wallow_tier 20260769) and the two
-- new routers (20260772) are already applied ahead of it.
\set ON_ERROR_STOP on

-- The harness stub's season scaffolding predates the pass columns these routers
-- read; add them additively (IF NOT EXISTS keeps this a no-op against prod shape).
ALTER TABLE public.user_season_progress ADD COLUMN IF NOT EXISTS premium_unlocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_season_progress ADD COLUMN IF NOT EXISTS premium_plus_unlocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- A dedicated active season for this smoke. active_season() in the harness prep
-- returns this row by id, so real now() can't drift the active pick.
INSERT INTO public.seasons (id, name, starts_at, ends_at, total_tiers, xp_per_tier)
VALUES ('claim_cons_season', 'Claim Consolidation', '2026-01-01', '2027-12-31', 10, 100)
ON CONFLICT (id) DO UPDATE SET total_tiers = EXCLUDED.total_tiers, xp_per_tier = EXCLUDED.xp_per_tier;

INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
	('claim_cons_season', 1, 'free',    'tickles',     '{"amount":25}',            'T1 25 tickles'),
	('claim_cons_season', 2, 'free',    'tickles',     '{"amount":50}',            'T2 50 tickles'),
	('claim_cons_season', 2, 'premium', 'hat',         '{"hat_id":"reed_hat"}',    'Reed Hat'),
	('claim_cons_season', 3, 'free',    'mystery_box', '{"box_kind":"hat"}',       'Mystery Hat Box'),
	('claim_cons_season', 5, 'free',    'tickles',     '{"amount":100}',           'T5 100 tickles')
ON CONFLICT (season_id, tier, track) DO NOTHING;

-- Wallow tiers 5/10 (seeded by 20260769) are free-track only; tier 10 pays a
-- golden_truffle bundle, which the failure-isolation case caps out.

DO $claim_cons$
DECLARE
	normal_pig    uuid := '00000000-0000-0000-0000-000000058001';
	premium_pig   uuid := '00000000-0000-0000-0000-000000058002';
	prestige_pig  uuid := '00000000-0000-0000-0000-000000058003';
	ready_pig     uuid := '00000000-0000-0000-0000-000000058004';
	cap_pig       uuid := '00000000-0000-0000-0000-000000058005';
	r             jsonb;
	snouts        int;
BEGIN
	INSERT INTO auth.users (id) VALUES
		(normal_pig), (premium_pig), (prestige_pig), (ready_pig), (cap_pig);
	INSERT INTO public.profiles (id, username, counter, is_vip) VALUES
		(normal_pig, 'normalpig', 0, false),
		(premium_pig, 'premiumpig', 0, false),
		(prestige_pig, 'prestigepig', 0, false),
		(ready_pig, 'readypig', 0, false),
		(cap_pig, 'cappig', 0, false);
	-- cap_pig sits at the golden-truffle ceiling so its tier-10 wallow claim caps out.
	UPDATE public.profiles SET golden_truffles = 999 WHERE id = cap_pig;

	INSERT INTO public.user_season_progress (user_id, season_id, xp, premium_unlocked, wallow_count) VALUES
		(normal_pig,   'claim_cons_season', 250,  false, 0),   -- current_tier 3
		(premium_pig,  'claim_cons_season', 550,  true,  0),   -- current_tier 6, premium
		(prestige_pig, 'claim_cons_season', 1550, false, 1),   -- lap1, visible 550 → tier 6
		(ready_pig,    'claim_cons_season', 550,  false, 0),   -- current_tier 6, free sweep
		(cap_pig,      'claim_cons_season', 2000, false, 1);   -- lap1, visible 1000 → tier 10

	-- ── claim_season_tier ────────────────────────────────────────────────────

	-- 1. Normal, NULL track → resolves free (no premium/vip), claims tier1 tickles.
	PERFORM set_config('smoke.uid', normal_pig::text, true);
	r := public.claim_season_tier(1, NULL);
	IF (r->>'ok')::boolean IS NOT TRUE OR r->>'reward_type' <> 'tickles' THEN
		RAISE EXCEPTION 'claim_season_tier normal free failed: %', r;
	END IF;
	IF (r->>'current_tier')::int <> 3 THEN
		RAISE EXCEPTION 'claim_season_tier did not merge current_tier: %', r;
	END IF;
	SELECT counter INTO snouts FROM public.profiles WHERE id = normal_pig;
	IF snouts <> 25 THEN RAISE EXCEPTION 'tier1 tickles not credited: %', snouts; END IF;

	-- 2. Premium-gated: non-premium caller explicitly asking premium → premium_locked.
	r := public.claim_season_tier(2, 'premium');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'premium_locked' THEN
		RAISE EXCEPTION 'expected premium_locked, got: %', r;
	END IF;

	-- 3. Already-claimed: re-claim tier1 → already_claimed (not a fresh grant).
	r := public.claim_season_tier(1, NULL);
	IF r->>'reason' <> 'already_claimed' THEN
		RAISE EXCEPTION 'expected already_claimed, got: %', r;
	END IF;

	-- 4. Tier-locked: tier5 not reached (current_tier 3) → tier_not_reached + tier.
	r := public.claim_season_tier(5, 'free');
	IF r->>'reason' <> 'tier_not_reached' OR (r->>'current_tier')::int <> 3 THEN
		RAISE EXCEPTION 'expected tier_not_reached@3, got: %', r;
	END IF;

	-- 5. Premium success: premium caller, NULL track → resolves premium, claims hat.
	PERFORM set_config('smoke.uid', premium_pig::text, true);
	r := public.claim_season_tier(2, NULL);
	IF (r->>'ok')::boolean IS NOT TRUE OR r->>'reward_type' <> 'hat' THEN
		RAISE EXCEPTION 'premium hat claim failed: %', r;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = premium_pig AND hat_id = 'reed_hat') THEN
		RAISE EXCEPTION 'premium hat not granted';
	END IF;

	-- 6. Prestige: server detects wallow_count>=1 and routes to the wallow claimer,
	--    forcing free track. Tier5 wallow reward = 125 snouts.
	PERFORM set_config('smoke.uid', prestige_pig::text, true);
	r := public.claim_season_tier(5, NULL);
	IF (r->>'ok')::boolean IS NOT TRUE OR r->>'reward_type' <> 'snouts' THEN
		RAISE EXCEPTION 'prestige tier5 claim failed: %', r;
	END IF;
	SELECT counter INTO snouts FROM public.profiles WHERE id = prestige_pig;
	IF snouts <> 125 THEN RAISE EXCEPTION 'prestige snouts not credited: %', snouts; END IF;
	-- Prestige tier10 not reached (visible current_tier 6) → tier_locked w/ current_tier.
	r := public.claim_season_tier(10, NULL);
	IF r->>'reason' <> 'tier_locked' OR (r->>'current_tier')::int <> 6 THEN
		RAISE EXCEPTION 'expected prestige tier_locked@6, got: %', r;
	END IF;

	-- ── claim_ready_tiers ──────────────────────────────────────────────────────

	-- A. Multi-tier tally: ready_pig at tier 6 sweeps free tiers 1/2/3/5.
	--    tickles = 25+50+100 = 175; tier3 mystery_box → items + one mysteries entry.
	PERFORM set_config('smoke.uid', ready_pig::text, true);
	r := public.claim_ready_tiers('free');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'sweep not ok: %', r; END IF;
	IF (r->>'claimed_count')::int <> 4 OR (r->>'failed')::int <> 0 THEN
		RAISE EXCEPTION 'sweep count wrong: %', r;
	END IF;
	IF (r->>'tickles')::int <> 175 THEN
		RAISE EXCEPTION 'sweep tickles wrong (want 175): %', r;
	END IF;
	IF jsonb_array_length(r->'mysteries') <> 1 THEN
		RAISE EXCEPTION 'sweep should carry exactly one mystery payload: %', r;
	END IF;
	IF NOT (r->'items' @> '["Mystery Hat Box"]'::jsonb) THEN
		RAISE EXCEPTION 'sweep items missing the mystery display_label: %', r;
	END IF;

	-- B. Empty-ready no-op: everything now claimed → clean zero tally.
	r := public.claim_ready_tiers('free');
	IF (r->>'ok')::boolean IS NOT TRUE
	   OR (r->>'claimed_count')::int <> 0 OR (r->>'failed')::int <> 0
	   OR jsonb_array_length(r->'items') <> 0 THEN
		RAISE EXCEPTION 'empty sweep should be a clean no-op: %', r;
	END IF;

	-- C. Premium-under-glass: normal_pig (not premium) sweeps premium → nothing,
	--    and no premium claim leaks into the ledger.
	PERFORM set_config('smoke.uid', normal_pig::text, true);
	r := public.claim_ready_tiers('premium');
	IF (r->>'claimed_count')::int <> 0 THEN
		RAISE EXCEPTION 'premium-glass should claim nothing: %', r;
	END IF;
	IF EXISTS (SELECT 1 FROM public.user_tier_claims
		WHERE user_id = normal_pig AND season_id = 'claim_cons_season' AND track = 'premium') THEN
		RAISE EXCEPTION 'premium-glass leaked a premium claim';
	END IF;

	-- D. Per-tier failure isolation: cap_pig (lap1, tier 10) sweeps wallow tiers.
	--    tier5 snouts succeeds; tier10 golden_truffle caps out (truffle_cap RETURN);
	--    the sweep commits tier5 anyway.
	PERFORM set_config('smoke.uid', cap_pig::text, true);
	r := public.claim_ready_tiers(NULL);   -- prestige forces free internally
	IF (r->>'claimed_count')::int <> 1 OR (r->>'failed')::int <> 1 THEN
		RAISE EXCEPTION 'failure isolation tally wrong (want 1 claimed / 1 failed): %', r;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_wallow_tier_claims
		WHERE user_id = cap_pig AND season_id = 'claim_cons_season' AND wallow_lap = 1 AND tier = 5) THEN
		RAISE EXCEPTION 'the successful tier5 claim was rolled back by the failed tier10';
	END IF;
	IF EXISTS (SELECT 1 FROM public.user_wallow_tier_claims
		WHERE user_id = cap_pig AND season_id = 'claim_cons_season' AND wallow_lap = 1 AND tier = 10) THEN
		RAISE EXCEPTION 'the capped tier10 claim was recorded despite failing';
	END IF;
	SELECT counter INTO snouts FROM public.profiles WHERE id = cap_pig;
	IF snouts <> 125 THEN RAISE EXCEPTION 'cap_pig tier5 snouts not credited: %', snouts; END IF;

	RAISE NOTICE 'chk claim consolidation: single-claim routing (normal/premium/prestige/locked/dup) + sweep (tally/no-op/premium-glass/failure-isolation) OK';
END;
$claim_cons$;
