-- Barn furnishings as season-pass rewards (Almanac spec, "Economy (server)").
--
-- New reward_type = 'habitat' with reward_value {"item_id": "<habitat_items.id>"}.
-- The claim path grants the catalog item into the player's habitat inventory
-- through the ONE grant helper (grant_habitat_item, 20260910130000) under
-- source 'season_pass', so the journal / "new" mark / collection reconciliation
-- all work exactly as a prestige or milestone gift. Idempotent: an already-owned
-- item still marks the tier claimed and answers the same claim shape with
-- already_owned = true. An unknown item id refuses with a clear reason and
-- writes nothing.
--
-- Carry-latest-def (memory: carry-latest-def footgun):
--   * claim_tier_reward  ← 20260812010000_auto_apply_season_pass_tickles.sql
--     (the latest definition; 20260905174000 only CALLS it). The one change is
--     the `habitat` branch — every other line is verbatim.
--   * sync_pass_exclusive ← 20260706000000_pass_exclusive_all_cosmetics.sql
--     (the latest definition; 20260711000000 only mentions it). The one
--     change: a `habitat` row is skipped. Without it the trigger's item_id
--     coalesce would flag any HAT that shares an id with a furnishing as
--     pass-exclusive — and public.hats already has a `firefly_lantern`.
--   claim_season_tier / claim_ready_tiers (20260905174000) are NOT redefined:
--   both route through claim_tier_reward and pass its jsonb through as a
--   superset, so the habitat payload reaches the client untouched.
--
-- Seed (free track, snout_season_1 — "The Great Hunger"). Read from production
-- 2026-09-16 before editing; the spec pins tiers 5/7/9/10 and "four more
-- across 11–30". Only tickles rows and duplicate Mystery Hat Boxes are LOST;
-- the three unique rewards the pinned tiers displaced move to the nearest
-- tickles tier so no authored content leaves the pass:
--
--   tier  was (prod 2026-09-16)                 now
--   ----  ---------------------------------     ------------------------------------
--    5    title  Slop Savorer                   habitat firefly_lantern      (spec)
--    6    tickles 50                            title  Slop Savorer         (moved from 5)
--    7    hat    slop_bucket_hat                habitat braided_straw_rug   (spec said
--                                                 patchwork_rug — that is a STARTER item
--                                                 every Barn already owns, a dead reward;
--                                                 same slot, for-sale substitute)
--    8    tickles 50                            hat    slop_bucket_hat      (moved from 7)
--    9    title  Truffle Hound                  habitat hay_bale             (spec)
--   10    mystery_box (dup of 4/14/20/25/28)    habitat milk_can_lamp        (spec)
--   12    tickles 75                            title  Truffle Hound        (moved from 9)
--   14    mystery_box (dup)                     habitat pressed_clover_frame (wall)
--   18    tickles 100                           habitat spring_whitewash     (room)
--   23    tickles 150                           habitat windup_pig_toy       (shelf, rare)
--   28    mystery_box (dup)                     habitat bedtime_trunk        (floor, rare)
--
-- All four extras are isForSale catalog items with no prestige_rank; keepsakes
-- and prestige gifts stay prestige-only. Premium track untouched (cosmetics
-- only, 20260792000000). Re-runnable: every seed row is an upsert keyed on the
-- primary key, and both functions are CREATE OR REPLACE.
--
-- Reseed backfill (§4). user_tier_claims is keyed by tier, so a player who
-- claimed one of these tiers BEFORE the reseed would read "Firefly Lantern ·
-- claimed" and never receive it. For every existing claim on a reseeded row the
-- backfill grants the NEW reward through the same paths claim_tier_reward
-- takes — habitat → grant_habitat_item under a `:reseed` receipt (idempotent;
-- left un-presented so the Barn's gift reveal shows it), title → user_titles,
-- hat → user_hats (both ON CONFLICT DO NOTHING). Tickles rows were already
-- paid, so nothing is re-paid. Nothing is double-granted: ownership/receipts
-- gate every write, and a re-run reports zero new grants.

-- ── 1. sync_pass_exclusive — a Barn furnishing never flags a hat ────────────
CREATE OR REPLACE FUNCTION public.sync_pass_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	pinned_id text;
BEGIN
	-- A habitat reward pins a habitat_items id, not a hats id. Skip it or a
	-- furnishing sharing a slug with a hat pulls that hat out of the shop.
	IF lower(NEW.reward_type) = 'habitat' THEN
		RETURN NEW;
	END IF;
	-- Whatever hat this tier would GRANT (any cosmetic reward_type) is a
	-- pass reward, so mark it earn-only. Rewards that pin no hat id
	-- (tickles/title/boost/mystery_box) leave this NULL and are skipped.
	pinned_id := COALESCE(
		NEW.reward_value->>'hat_id',
		NEW.reward_value->>'bg_id',
		NEW.reward_value->>'aura_id',
		NEW.reward_value->>'cape_id',
		NEW.reward_value->>'item_id'
	);
	IF pinned_id IS NOT NULL THEN
		UPDATE public.hats
		SET pass_exclusive = true
		WHERE id = pinned_id;
	END IF;
	RETURN NEW;
END;
$function$;

-- Trigger-only: nothing calls it directly, so nothing may execute it.
REVOKE ALL ON FUNCTION public.sync_pass_exclusive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS season_tiers_sync_pass_exclusive ON public.season_tiers;
CREATE TRIGGER season_tiers_sync_pass_exclusive
	AFTER INSERT OR UPDATE ON public.season_tiers
	FOR EACH ROW EXECUTE FUNCTION public.sync_pass_exclusive();

-- ── 2. claim_tier_reward — the habitat branch ───────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_tier_reward(target_tier int, target_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	season          public.seasons;
	progress        public.user_season_progress;
	reward          public.season_tiers;
	reward_type_lc  text;
	reward_value    jsonb;
	current_tier    int;
	item_id         text;
	title_display   text;
	title_slug      text;
	extra_payload   jsonb := '{}'::jsonb;
	caller_is_vip   boolean := false;
	applied_tickles int := 0;
	reward_tickles  int;
	habitat_ref     text;
	habitat_res     jsonb;
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;
	current_tier := LEAST(
		season.total_tiers,
		GREATEST(1, COALESCE(progress.xp, 0) / season.xp_per_tier + 1)
	);
	IF COALESCE(progress.xp, 0) >= season.total_tiers * season.xp_per_tier THEN
		current_tier := season.total_tiers;
	END IF;

	IF current_tier < target_tier THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'tier_not_reached');
	END IF;

	IF target_track = 'premium'
	   AND NOT COALESCE(progress.premium_unlocked, false)
	   AND NOT caller_is_vip THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'premium_locked');
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.user_tier_claims
		WHERE user_id = caller_id AND season_id = season.id
		  AND tier = target_tier AND track = target_track
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	SELECT * INTO reward FROM public.season_tiers
		WHERE season_id = season.id
		  AND tier = target_tier
		  AND track = target_track;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
	END IF;

	reward_type_lc := lower(reward.reward_type);
	reward_value   := reward.reward_value;

	IF reward_type_lc = 'tickles' THEN
		reward_tickles := COALESCE((reward_value->>'amount')::int, 0);
		IF reward_tickles <= 0 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tickle_data');
		END IF;
		applied_tickles := applied_tickles + reward_tickles;
	END IF;

	IF reward_value ? 'tickles' THEN
		reward_tickles := COALESCE((reward_value->>'tickles')::int, 0);
		IF reward_tickles <= 0 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tickle_data');
		END IF;
		applied_tickles := applied_tickles + reward_tickles;
	END IF;

	IF reward_type_lc IN (
		'hat', 'background', 'aura', 'cape',
		'scarf', 'mask', 'necklace', 'glasses', 'bow', 'held'
	) THEN
		item_id := COALESCE(
			reward_value->>'hat_id',
			reward_value->>'bg_id',
			reward_value->>'aura_id',
			reward_value->>'cape_id',
			reward_value->>'item_id'
		);
		IF item_id IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_item_data');
		END IF;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (caller_id, item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

	ELSIF reward_type_lc = 'title' THEN
		title_display := reward_value->>'title';
		IF title_display IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_title_data');
		END IF;
		title_slug := public.title_id_from_name(title_display);
		IF EXISTS (SELECT 1 FROM public.titles WHERE id = title_slug) THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (caller_id, title_slug)
				ON CONFLICT (user_id, title_id) DO NOTHING;
		END IF;

	ELSIF reward_type_lc = 'mystery_box' THEN
		extra_payload := public.grant_mystery_box(
			caller_id, COALESCE(reward_value->>'box_kind', 'hat')
		);

	ELSIF reward_type_lc = 'habitat' THEN
		-- A Barn furnishing. reward_value {"item_id": "<habitat_items.id>"}.
		item_id := NULLIF(btrim(COALESCE(reward_value->>'item_id', '')), '');
		IF item_id IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_item_data');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM public.habitat_items WHERE id = item_id) THEN
			RETURN jsonb_build_object(
				'ok', false, 'reason', 'unknown_habitat_item', 'item_id', item_id
			);
		END IF;
		-- One receipt per (season, track, tier): a retry of the same claim replays
		-- the receipt instead of granting twice. The lock order (profile row
		-- first, then the habitat advisory lock inside the helper) is the same
		-- order buy_habitat_item takes.
		habitat_ref := 'season_pass:v1:' || season.id || ':' || target_track
			|| ':tier:' || target_tier::text;
		habitat_res := public.grant_habitat_item(
			caller_id, item_id, 'season_pass', habitat_ref
		);
		IF NOT COALESCE((habitat_res->>'ok')::boolean, false) THEN
			RETURN jsonb_build_object(
				'ok', false,
				'reason', 'habitat_grant_failed',
				'detail', habitat_res->>'reason',
				'item_id', item_id
			);
		END IF;
		-- The claim sheet IS the reveal: stamp the acquisition presented so the
		-- Barn's gift reveal doesn't show it a second time. `seen` stays unset,
		-- so the furnishing still wears its "new" mark in the editor.
		INSERT INTO public.habitat_acquisition_states
			(user_id, source, source_ref, presented_at)
		VALUES (caller_id, 'season_pass', habitat_ref, now())
		ON CONFLICT (user_id, source, source_ref) DO UPDATE SET
			presented_at = COALESCE(
				habitat_acquisition_states.presented_at, EXCLUDED.presented_at
			);
		extra_payload := jsonb_build_object(
			'habitat_item_id', item_id,
			'already_owned', NOT COALESCE((habitat_res->>'newlyOwned')::boolean, false),
			'habitat_acquisition_id',
				public._habitat_acquisition_id(caller_id, 'season_pass', habitat_ref)
		);

	ELSE
		-- boost / pig_skin / cap_increase still stubbed.
		NULL;
	END IF;

	-- Auto-apply: deliberately bypass the spendable tickle bank. Updating
	-- tickles_earned also preserves the existing leaderboard, achievement, and
	-- referral triggers attached to applied tickles.
	IF applied_tickles > 0 THEN
		UPDATE public.profiles
		SET tickles_earned = tickles_earned + applied_tickles,
		    counter = counter + applied_tickles
		WHERE id = caller_id;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object(
		'ok', true,
		'reward_type', reward_type_lc,
		'tickles_applied', applied_tickles
	) || extra_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_tier_reward(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

-- ── 3. Seed the live season's free track ────────────────────────────────────
-- Refuse loudly if a seeded furnishing is missing from the catalog (a typo
-- here would otherwise surface as unknown_habitat_item at claim time).
DO $$
DECLARE missing text;
BEGIN
	SELECT string_agg(id, ', ') INTO missing
	FROM unnest(ARRAY[
		'firefly_lantern', 'braided_straw_rug', 'hay_bale', 'milk_can_lamp',
		'pressed_clover_frame', 'spring_whitewash', 'windup_pig_toy', 'bedtime_trunk'
	]) AS want(id)
	WHERE NOT EXISTS (SELECT 1 FROM public.habitat_items h WHERE h.id = want.id AND h.active);
	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'habitat pass seed: not in habitat_items (or inactive): %', missing;
	END IF;
END $$;

INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label)
VALUES
	('snout_season_1',  5, 'free', 'habitat', '{"item_id": "firefly_lantern"}',      'Firefly Lantern'),
	('snout_season_1',  6, 'free', 'title',   '{"title": "Slop Savorer"}',           'Title: Slop Savorer'),
	('snout_season_1',  7, 'free', 'habitat', '{"item_id": "braided_straw_rug"}',    'Braided Straw Rug'),
	('snout_season_1',  8, 'free', 'hat',     '{"hat_id": "slop_bucket_hat"}',       'Slop-Bucket Hat'),
	('snout_season_1',  9, 'free', 'habitat', '{"item_id": "hay_bale"}',             'Hay Bale'),
	('snout_season_1', 10, 'free', 'habitat', '{"item_id": "milk_can_lamp"}',        'Milk-can Lamp'),
	('snout_season_1', 12, 'free', 'title',   '{"title": "Truffle Hound"}',          'Title: Truffle Hound'),
	('snout_season_1', 14, 'free', 'habitat', '{"item_id": "pressed_clover_frame"}', 'Pressed Clover Frame'),
	('snout_season_1', 18, 'free', 'habitat', '{"item_id": "spring_whitewash"}',     'Spring Whitewash'),
	('snout_season_1', 23, 'free', 'habitat', '{"item_id": "windup_pig_toy"}',       'Wind-Up Pig Toy'),
	('snout_season_1', 28, 'free', 'habitat', '{"item_id": "bedtime_trunk"}',        'Bedtime Trunk')
ON CONFLICT (season_id, tier, track) DO UPDATE SET
	reward_type   = EXCLUDED.reward_type,
	reward_value  = EXCLUDED.reward_value,
	display_label = EXCLUDED.display_label;

-- ── 4. Backfill claims made before the reseed ───────────────────────────────
CREATE OR REPLACE FUNCTION public._habitat_pass_reseed_backfill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	rec            record;
	reward_type_lc text;
	item_id        text;
	title_slug     text;
	res            jsonb;
	claims_seen    int := 0;
	habitat_new    int := 0;
	titles_new     int := 0;
	hats_new       int := 0;
	n              int;
BEGIN
	FOR rec IN
		SELECT c.user_id, t.season_id, t.track, t.tier,
		       t.reward_type, t.reward_value
		FROM public.season_tiers t
		JOIN public.user_tier_claims c
		  ON c.season_id = t.season_id AND c.track = t.track AND c.tier = t.tier
		WHERE t.season_id = 'snout_season_1' AND t.track = 'free'
		  AND t.tier IN (5, 6, 7, 8, 9, 10, 12, 14, 18, 23, 28)
		ORDER BY c.user_id, t.tier
	LOOP
		claims_seen := claims_seen + 1;
		reward_type_lc := lower(rec.reward_type);

		IF reward_type_lc = 'habitat' THEN
			item_id := NULLIF(btrim(COALESCE(rec.reward_value->>'item_id', '')), '');
			IF item_id IS NULL THEN CONTINUE; END IF;
			-- Receipt-gated: a re-run finds the `:reseed` receipt and skips the
			-- grant (a replayed receipt would echo its original newlyOwned).
			-- An item the player already owns gets a receipt with
			-- newlyOwned=false and no inventory write.
			IF EXISTS (
				SELECT 1 FROM public.habitat_grant_receipts r
				WHERE r.user_id = rec.user_id AND r.source = 'season_pass'
				  AND r.source_ref = 'season_pass:v1:' || rec.season_id || ':'
					|| rec.track || ':tier:' || rec.tier::text || ':reseed'
			) THEN
				CONTINUE;
			END IF;
			res := public.grant_habitat_item(
				rec.user_id, item_id, 'season_pass',
				'season_pass:v1:' || rec.season_id || ':' || rec.track
					|| ':tier:' || rec.tier::text || ':reseed'
			);
			IF COALESCE((res->>'ok')::boolean, false)
			   AND COALESCE((res->>'newlyOwned')::boolean, false) THEN
				habitat_new := habitat_new + 1;
			END IF;

		ELSIF reward_type_lc = 'title' THEN
			title_slug := public.title_id_from_name(rec.reward_value->>'title');
			IF title_slug IS NOT NULL
			   AND EXISTS (SELECT 1 FROM public.titles WHERE id = title_slug) THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (rec.user_id, title_slug)
					ON CONFLICT (user_id, title_id) DO NOTHING;
				GET DIAGNOSTICS n = ROW_COUNT;
				titles_new := titles_new + n;
			END IF;

		ELSIF reward_type_lc IN (
			'hat', 'background', 'aura', 'cape',
			'scarf', 'mask', 'necklace', 'glasses', 'bow', 'held'
		) THEN
			item_id := COALESCE(
				rec.reward_value->>'hat_id',
				rec.reward_value->>'bg_id',
				rec.reward_value->>'aura_id',
				rec.reward_value->>'cape_id',
				rec.reward_value->>'item_id'
			);
			IF item_id IS NULL THEN CONTINUE; END IF;
			INSERT INTO public.user_hats (user_id, hat_id)
				VALUES (rec.user_id, item_id)
				ON CONFLICT (user_id, hat_id) DO NOTHING;
			GET DIAGNOSTICS n = ROW_COUNT;
			hats_new := hats_new + n;

		ELSE
			-- tickles (already paid when the tier was claimed) / anything else:
			-- nothing to grant.
			NULL;
		END IF;
	END LOOP;

	RETURN jsonb_build_object(
		'claims_seen', claims_seen,
		'habitat_new', habitat_new,
		'titles_new', titles_new,
		'hats_new', hats_new
	);
END;
$function$;
REVOKE ALL ON FUNCTION public._habitat_pass_reseed_backfill() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE res jsonb;
BEGIN
	res := public._habitat_pass_reseed_backfill();
	RAISE NOTICE 'habitat pass reseed backfill: % claims on reseeded tiers → % furnishings, % titles, % hats newly granted',
		res->>'claims_seen', res->>'habitat_new', res->>'titles_new', res->>'hats_new';
END $$;
