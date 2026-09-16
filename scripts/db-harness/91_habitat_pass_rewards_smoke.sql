-- Smoke: Barn furnishings as season-pass rewards (20260916100000).
-- Covers: the free-track seed landed on snout_season_1 without flagging the
-- same-slug hat; a fresh habitat claim grants + receipts + presents; a replay is
-- already_claimed; an already-owned furnishing still claims the tier with
-- already_owned=true; an unknown item id refuses and writes nothing; the sweep
-- (claim_ready_tiers) carries a habitat tier and counts the bad row as failed.
\set ON_ERROR_STOP on

-- Seed landed: 8 habitat tiers on the live season's free track, and the trigger
-- skipped the furnishing so hats.firefly_lantern is still shoppable.
DO $chk$
BEGIN
	IF (SELECT count(*) FROM public.season_tiers
	    WHERE season_id = 'snout_season_1' AND track = 'free' AND reward_type = 'habitat') <> 8 THEN
		RAISE EXCEPTION 'habitat seed: expected 8 free-track habitat tiers, got %',
			(SELECT count(*) FROM public.season_tiers WHERE season_id = 'snout_season_1' AND track = 'free' AND reward_type = 'habitat');
	END IF;
	IF (SELECT reward_value->>'item_id' FROM public.season_tiers WHERE season_id='snout_season_1' AND track='free' AND tier=5) <> 'firefly_lantern'
	   OR (SELECT reward_type FROM public.season_tiers WHERE season_id='snout_season_1' AND track='free' AND tier=6) <> 'title'
	   OR (SELECT reward_value->>'hat_id' FROM public.season_tiers WHERE season_id='snout_season_1' AND track='free' AND tier=8) <> 'slop_bucket_hat' THEN
		RAISE EXCEPTION 'habitat seed: pinned/relocated rows wrong';
	END IF;
	IF (SELECT pass_exclusive FROM public.hats WHERE id = 'firefly_lantern') THEN
		RAISE EXCEPTION 'habitat seed: trigger flagged hats.firefly_lantern pass_exclusive';
	END IF;
	IF NOT (SELECT pass_exclusive FROM public.hats WHERE id = 'slop_bucket_hat') THEN
		RAISE EXCEPTION 'habitat seed: trigger must still flag the relocated hat';
	END IF;
	IF EXISTS (SELECT 1 FROM public.season_tiers t
	           WHERE t.season_id='snout_season_1' AND t.reward_type='habitat'
	             AND NOT EXISTS (SELECT 1 FROM public.habitat_items h WHERE h.id = t.reward_value->>'item_id')) THEN
		RAISE EXCEPTION 'habitat seed: a tier points at a missing catalog item';
	END IF;
	RAISE NOTICE 'chk habitat pass seed ok';
END $chk$;

-- Reseed backfill: the 00v player claimed tiers 5/6/8/10 before the reseed.
DO $chk$
DECLARE pig uuid := '00000000-0000-0000-0000-000000091002'; res jsonb;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = pig AND item_id = 'firefly_lantern')
	   OR NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = pig AND item_id = 'milk_can_lamp') THEN
		RAISE EXCEPTION 'reseed backfill: pre-reseed claimant did not receive the furnishings';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts WHERE user_id = pig AND source = 'season_pass'
	               AND source_ref = 'season_pass:v1:snout_season_1:free:tier:5:reseed' AND newly_owned) THEN
		RAISE EXCEPTION 'reseed backfill: missing the :reseed receipt';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = pig AND hat_id = 'slop_bucket_hat') THEN
		RAISE EXCEPTION 'reseed backfill: relocated hat not granted';
	END IF;
	IF (SELECT count(*) FROM public.user_titles WHERE user_id = pig AND title_id = 'slop_savorer') <> 1 THEN
		RAISE EXCEPTION 'reseed backfill: title double-granted or lost';
	END IF;
	-- The backfill leaves the furnishing un-presented so the Barn's gift reveal shows it.
	IF EXISTS (SELECT 1 FROM public.habitat_acquisition_states WHERE user_id = pig AND source = 'season_pass') THEN
		RAISE EXCEPTION 'reseed backfill must not pre-present the gift';
	END IF;
	-- A re-run grants nothing more.
	res := public._habitat_pass_reseed_backfill();
	IF (res->>'claims_seen')::int <> 4 OR (res->>'habitat_new')::int <> 0
	   OR (res->>'titles_new')::int <> 0 OR (res->>'hats_new')::int <> 0 THEN
		RAISE EXCEPTION 'reseed backfill re-run granted again: %', res;
	END IF;
	IF (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = pig AND source = 'season_pass') <> 2
	   OR (SELECT count(*) FROM public.user_hats WHERE user_id = pig) <> 1 THEN
		RAISE EXCEPTION 'reseed backfill re-run wrote extra rows';
	END IF;
	RAISE NOTICE 'chk habitat pass reseed backfill ok';
END $chk$;

INSERT INTO public.seasons (id, name, starts_at, ends_at, total_tiers, xp_per_tier)
VALUES ('habitat_pass_smoke', 'Habitat Pass', now() - interval '1 day', now() + interval '30 days', 10, 100);
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons LANGUAGE sql STABLE AS $$
	SELECT * FROM public.seasons WHERE id = 'habitat_pass_smoke';
$$;
INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
	('habitat_pass_smoke', 1, 'free', 'habitat', '{"item_id": "firefly_lantern"}',   'Firefly Lantern'),
	('habitat_pass_smoke', 2, 'free', 'habitat', '{"item_id": "no_such_furnishing"}', 'Broken row'),
	('habitat_pass_smoke', 3, 'free', 'habitat', '{"item_id": "braided_straw_rug"}', 'Braided Straw Rug'),
	('habitat_pass_smoke', 4, 'free', 'tickles', '{"amount": 25}',                   '25 tickles'),
	('habitat_pass_smoke', 5, 'free', 'habitat', '{"item_id": "hay_bale"}',          'Hay Bale');

DO $smoke$
DECLARE
	pig uuid := '00000000-0000-0000-0000-000000091001';
	r jsonb;
	ref text;
	aid text;
BEGIN
	INSERT INTO auth.users(id) VALUES (pig);
	INSERT INTO public.profiles(id, username, counter, golden_truffles) VALUES (pig, 'habitat-pass-pig', 0, 0);
	INSERT INTO public.user_season_progress(user_id, season_id, xp) VALUES (pig, 'habitat_pass_smoke', 450);
	PERFORM set_config('smoke.uid', pig::text, true);

	-- Fresh grant.
	r := public.claim_season_tier(1, 'free');
	IF (r->>'ok')::boolean IS NOT TRUE OR r->>'reward_type' <> 'habitat'
	   OR r->>'habitat_item_id' <> 'firefly_lantern' OR (r->>'already_owned')::boolean IS NOT FALSE
	   OR (r->>'tickles_applied')::int <> 0 OR (r->>'current_tier')::int <> 5 THEN
		RAISE EXCEPTION 'fresh habitat claim wrong: %', r;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = pig AND item_id = 'firefly_lantern') THEN
		RAISE EXCEPTION 'furnishing not in inventory';
	END IF;
	ref := 'season_pass:v1:habitat_pass_smoke:free:tier:1';
	IF NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	               WHERE user_id = pig AND source = 'season_pass' AND source_ref = ref AND item_id = 'firefly_lantern' AND newly_owned) THEN
		RAISE EXCEPTION 'no season_pass receipt';
	END IF;
	aid := public._habitat_acquisition_id(pig, 'season_pass', ref);
	IF r->>'habitat_acquisition_id' <> aid THEN RAISE EXCEPTION 'acquisition id mismatch: %', r; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.habitat_acquisition_states
	               WHERE user_id = pig AND source = 'season_pass' AND source_ref = ref AND presented_at IS NOT NULL AND seen_at IS NULL) THEN
		RAISE EXCEPTION 'claim must present (not see) the acquisition';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_tier_claims WHERE user_id = pig AND season_id = 'habitat_pass_smoke' AND tier = 1 AND track = 'free') THEN
		RAISE EXCEPTION 'tier 1 not marked claimed';
	END IF;

	-- Replay: already_claimed, nothing granted twice.
	r := public.claim_season_tier(1, 'free');
	IF r->>'reason' <> 'already_claimed' THEN RAISE EXCEPTION 'replay granted: %', r; END IF;
	IF (SELECT count(*) FROM public.habitat_grant_receipts WHERE user_id = pig AND source = 'season_pass') <> 1 THEN
		RAISE EXCEPTION 'replay wrote a second receipt';
	END IF;

	-- Already owned (bought earlier): tier still claims, already_owned = true.
	INSERT INTO public.user_habitat_items(user_id, item_id) VALUES (pig, 'braided_straw_rug');
	r := public.claim_season_tier(3, 'free');
	IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'already_owned')::boolean IS NOT TRUE
	   OR r->>'habitat_item_id' <> 'braided_straw_rug' THEN
		RAISE EXCEPTION 'already-owned claim wrong: %', r;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_tier_claims WHERE user_id = pig AND season_id = 'habitat_pass_smoke' AND tier = 3) THEN
		RAISE EXCEPTION 'already-owned tier not marked claimed';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	               WHERE user_id = pig AND source = 'season_pass' AND item_id = 'braided_straw_rug' AND NOT newly_owned) THEN
		RAISE EXCEPTION 'already-owned claim must still leave a (not newly owned) receipt';
	END IF;

	-- Unknown item: clear refusal, no tier claim, no receipt.
	r := public.claim_season_tier(2, 'free');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'unknown_habitat_item' OR r->>'item_id' <> 'no_such_furnishing' THEN
		RAISE EXCEPTION 'unknown item must refuse clearly: %', r;
	END IF;
	IF EXISTS (SELECT 1 FROM public.user_tier_claims WHERE user_id = pig AND season_id = 'habitat_pass_smoke' AND tier = 2)
	   OR EXISTS (SELECT 1 FROM public.habitat_grant_receipts WHERE user_id = pig AND source_ref LIKE '%:tier:2') THEN
		RAISE EXCEPTION 'unknown item wrote state';
	END IF;

	-- Sweep: tier 4 (tickles) + tier 5 (hay bale) claim; tier 2 counts as failed.
	r := public.claim_ready_tiers('free');
	IF (r->>'claimed_count')::int <> 2 OR (r->>'failed')::int <> 1 OR (r->>'tickles')::int <> 25
	   OR NOT (r->'items' @> '["Hay Bale"]'::jsonb) THEN
		RAISE EXCEPTION 'sweep tally wrong: %', r;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = pig AND item_id = 'hay_bale') THEN
		RAISE EXCEPTION 'sweep did not grant the hay bale';
	END IF;
	r := public.claim_ready_tiers('free');
	IF (r->>'claimed_count')::int <> 0 THEN RAISE EXCEPTION 'replayed sweep granted again: %', r; END IF;

	RAISE NOTICE 'chk habitat pass rewards ok';
END $smoke$;
