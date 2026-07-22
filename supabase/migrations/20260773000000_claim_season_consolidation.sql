-- Season Pass refactor, phase 2: consolidate season claim routing server-side.
--
-- Today the client owns the prestige-vs-normal decision and the claim-all loop:
--   * claim_tier_reward(target_tier, target_track)  — normal pass claims
--   * claim_wallow_tier(target_tier)                — prestige (Wallow) lap claims
--   * "claim all" = a client-side sequential loop over the two above
-- But the server already owns the fact that decides which path applies
-- (user_season_progress.wallow_count) and which track a player is entitled to
-- (premium_unlocked OR is_vip). This migration adds two NEW routing RPCs that
-- move that decision server-side, WITHOUT touching the three shipped functions
-- (claim_tier_reward, claim_wallow_tier, wallow) that older app builds still call.
--
-- ADDITIVE ONLY. Both new functions CALL the existing per-tier claimers rather
-- than duplicating their bodies — the existing functions already signal every
-- business failure as a `{ok:false, reason}` RETURN value (never a RAISE, apart
-- from claim_tier_reward's unauthenticated guard, which we pre-empt), so a
-- routing wrapper can reuse them verbatim and stay correct across future edits
-- to their bodies. This deliberately avoids the "carry a stale copy" footgun
-- (docs/…: build-93 referral-gate deletion) — there is no copy to go stale.
--
-- ── Prestige + track predicates (lifted from the LATEST defs) ────────────────
-- Prestige predicate — the exact fact claim_wallow_tier(20260769) and wallow()
-- use: user_season_progress.wallow_count >= 1 for the active season. (season_state
-- exposes it as `season_wallow_count`; utils/seasonPass.prestigeMode reads > 0.)
-- In prestige mode the Wallow tiers are FREE-track only, so track is forced free
-- and we route to the wallow-aware claimer (which recomputes current_tier from
-- the lap-local visible_xp = xp - wallow_count*cycle_xp).
--
-- Track resolution for a normal claim with a NULL target_track — the same
-- derivation season_state(20260769) uses for `premium_unlocked`:
--   premium if (user_season_progress.premium_unlocked OR profiles.is_vip) else free.
-- (Slop Club members / referral-granted VIPs get premium with no stored pass.)
--
-- ── claim_ready_tiers failure isolation ─────────────────────────────────────
-- The existing claimers surface per-tier failures — including claim_wallow_tier's
-- `truffle_cap` (golden_truffle grant that would breach the 999 cap) — as plain
-- `{ok:false, reason:…}` RETURN values, NOT exceptions, so a failed tier does not
-- by itself poison the surrounding transaction. We nonetheless wrap each per-tier
-- call in a BEGIN/EXCEPTION (savepoint) block: this converts even a genuine RAISE
-- (e.g. a concurrent unique-violation on the claim ledger, or a mint/grant error)
-- into a counted failure while every other ready tier in the same transaction
-- still commits. Both signalling styles fold identically — a false `ok` or a
-- caught exception both increment `failed` and are skipped in the tally. Chosen
-- over pre-checking because pre-checking can't fully model mint_truffles/
-- grant_mystery_box side-effects and would drift from the claimers' own rules.

-- ── 1. claim_season_tier — one-tier routing wrapper ─────────────────────────
-- Return shape is a SUPERSET of the per-tier claim responses (ok, reason,
-- current_tier, mystery-box grant fields), so the client's RawClaim → ClaimResult
-- mapping in hooks/useSeason.ts works unchanged. current_tier is merged in for
-- BOTH paths (claim_tier_reward never echoes it), computed exactly as season_state.
CREATE OR REPLACE FUNCTION public.claim_season_tier(target_tier int, target_track text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	season         public.seasons;
	progress       public.user_season_progress;
	caller_is_vip  boolean := false;
	is_prestige    boolean := false;
	resolved_track text;
	cycle_xp       int;
	visible_xp     int;
	current_tier   int;
	result         jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;

	is_prestige := COALESCE(progress.wallow_count, 0) >= 1;

	-- current_tier — lap-local in prestige, absolute otherwise (mirrors season_state).
	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	IF is_prestige THEN
		visible_xp := GREATEST(0, COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp);
	ELSE
		visible_xp := COALESCE(progress.xp, 0);
	END IF;
	current_tier := LEAST(season.total_tiers, GREATEST(1, visible_xp / season.xp_per_tier + 1));
	IF visible_xp >= cycle_xp THEN current_tier := season.total_tiers; END IF;

	IF is_prestige THEN
		-- Wallow tiers are free-track only; the wallow-aware claimer ignores track.
		result := public.claim_wallow_tier(target_tier);
	ELSE
		resolved_track := COALESCE(
			target_track,
			CASE WHEN (COALESCE(progress.premium_unlocked, false) OR caller_is_vip)
				THEN 'premium' ELSE 'free' END
		);
		result := public.claim_tier_reward(target_tier, resolved_track);
	END IF;

	-- Superset: guarantee current_tier is present. `||` right side wins, but neither
	-- claimer sets current_tier on success and claim_wallow_tier's tier_locked value
	-- equals ours, so this only ever adds/echoes the same number.
	RETURN result || jsonb_build_object('current_tier', current_tier);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_season_tier(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_season_tier(int, text) TO authenticated;

-- ── 2. claim_ready_tiers — one-transaction sweep of every READY tier ────────
-- READY = reached (tier <= current_tier), unclaimed, has a reward, on the resolved
-- track. Same prestige/track resolution as claim_season_tier; a non-premium caller
-- asking for the premium track claims NOTHING (empty tally). Returns the tally the
-- client folds in hooks/useSeason.ts ClaimAllTally — claimed_count / failed /
-- tickles / items[display_label] — plus `mysteries` as an ARRAY of the mystery-box
-- grant payloads (MysteryBoxRevealPayload). The client currently surfaces only the
-- LAST mystery; the array carries all, client picks last.
CREATE OR REPLACE FUNCTION public.claim_ready_tiers(target_track text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	season         public.seasons;
	progress       public.user_season_progress;
	caller_is_vip  boolean := false;
	is_prestige    boolean := false;
	resolved_track text;
	cycle_xp       int;
	visible_xp     int;
	current_tier   int;
	rec            record;
	claim_res      jsonb;
	claimed_count  int := 0;
	failed         int := 0;
	tickles        int := 0;
	items          jsonb := '[]'::jsonb;
	mysteries      jsonb := '[]'::jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;

	is_prestige := COALESCE(progress.wallow_count, 0) >= 1;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	IF is_prestige THEN
		visible_xp := GREATEST(0, COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp);
	ELSE
		visible_xp := COALESCE(progress.xp, 0);
	END IF;
	current_tier := LEAST(season.total_tiers, GREATEST(1, visible_xp / season.xp_per_tier + 1));
	IF visible_xp >= cycle_xp THEN current_tier := season.total_tiers; END IF;

	IF is_prestige THEN
		-- Wallow lap: free-track only, wallow_tiers catalog, current-lap claim ledger.
		resolved_track := 'free';
	ELSE
		resolved_track := COALESCE(
			target_track,
			CASE WHEN (COALESCE(progress.premium_unlocked, false) OR caller_is_vip)
				THEN 'premium' ELSE 'free' END
		);
		-- Premium-under-glass: a non-premium caller asking for premium gets nothing.
		IF resolved_track = 'premium'
		   AND NOT (COALESCE(progress.premium_unlocked, false) OR caller_is_vip) THEN
			RETURN jsonb_build_object(
				'ok', true, 'claimed_count', 0, 'failed', 0,
				'tickles', 0, 'items', '[]'::jsonb, 'mysteries', '[]'::jsonb
			);
		END IF;
	END IF;

	IF is_prestige THEN
		FOR rec IN
			SELECT wt.tier, lower(wt.reward_type) AS reward_type, wt.reward_value, wt.display_label
			FROM public.wallow_tiers wt
			WHERE wt.tier <= season.total_tiers
			  AND wt.tier <= current_tier
			  AND NOT EXISTS (
				SELECT 1 FROM public.user_wallow_tier_claims c
				WHERE c.user_id = caller_id AND c.season_id = season.id
				  AND c.wallow_lap = progress.wallow_count AND c.tier = wt.tier
			  )
			ORDER BY wt.tier
		LOOP
			BEGIN
				claim_res := public.claim_wallow_tier(rec.tier);
			EXCEPTION WHEN OTHERS THEN
				claim_res := jsonb_build_object('ok', false, 'reason', 'error');
			END;

			IF COALESCE((claim_res->>'ok')::boolean, false) THEN
				claimed_count := claimed_count + 1;
				IF rec.reward_type = 'tickles' THEN
					tickles := tickles + COALESCE(
						(rec.reward_value->>'amount')::int, (rec.reward_value->>'count')::int, 0);
				ELSE
					items := items || to_jsonb(rec.display_label);
				END IF;
				IF (claim_res ? 'granted_hat_id') OR (claim_res ? 'fallback_snouts') THEN
					mysteries := mysteries || jsonb_build_array(claim_res);
				END IF;
			ELSE
				failed := failed + 1;
			END IF;
		END LOOP;
	ELSE
		FOR rec IN
			SELECT t.tier, lower(t.reward_type) AS reward_type, t.reward_value, t.display_label
			FROM public.season_tiers t
			WHERE t.season_id = season.id
			  AND t.track = resolved_track
			  AND t.tier <= current_tier
			  AND NOT EXISTS (
				SELECT 1 FROM public.user_tier_claims c
				WHERE c.user_id = caller_id AND c.season_id = season.id
				  AND c.tier = t.tier AND c.track = resolved_track
			  )
			ORDER BY t.tier
		LOOP
			BEGIN
				claim_res := public.claim_tier_reward(rec.tier, resolved_track);
			EXCEPTION WHEN OTHERS THEN
				claim_res := jsonb_build_object('ok', false, 'reason', 'error');
			END;

			IF COALESCE((claim_res->>'ok')::boolean, false) THEN
				claimed_count := claimed_count + 1;
				IF rec.reward_type = 'tickles' THEN
					tickles := tickles + COALESCE(
						(rec.reward_value->>'amount')::int, (rec.reward_value->>'count')::int, 0);
				ELSE
					items := items || to_jsonb(rec.display_label);
				END IF;
				IF (claim_res ? 'granted_hat_id') OR (claim_res ? 'fallback_snouts') THEN
					mysteries := mysteries || jsonb_build_array(claim_res);
				END IF;
			ELSE
				failed := failed + 1;
			END IF;
		END LOOP;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'claimed_count', claimed_count,
		'failed', failed,
		'tickles', tickles,
		'items', items,
		'mysteries', mysteries
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_ready_tiers(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ready_tiers(text) TO authenticated;
