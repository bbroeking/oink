-- Battle-pass exclusivity audit fix (task-11).
--
-- 20260675 made pass rewards STRUCTURALLY shop-excluded via the pass_exclusive
-- flag + a sync trigger — but the trigger only fired for reward_type = 'hat'.
-- Every OTHER cosmetic reward_type a season grants (background, aura, held,
-- necklace, …) slipped through, falling back to the old per-item cost = 0
-- convention that 20260675 was written to replace.
--
-- AUDIT FINDING — that gap is a live leak. Season 1's free/premium tracks grant
-- these cosmetics (reward_type 'background'/'aura', NOT 'hat'), and every one of
-- them still carries a shop price from the 20260547 economy rescale, so they are
-- BOTH battle-pass rewards AND buyable in the daily shop:
--   pink_glow(400) sparkle_aura(489) rainbow_aura(2000) gold_aura(800)
--   holy_aura(966) sunset_farm(444) snowy_farm(489) beach_island(578)
--   forest_grove(400) jungle(511) underwater(667) desert_dunes(467)
--   mountain_top(556)
-- Pass rewards must be earned, never sold (SKILL.md · Collect). This closes it
-- for S1 and for every future season, including the S2 seed that follows.
--
-- The fix aligns the flag with the GRANT path: claim_tier_reward pins the item
-- via COALESCE(hat_id, bg_id, aura_id, cape_id, item_id) (latest def 20260686),
-- so "any tier that grants this hat marks it pass_exclusive" is exactly right —
-- reward_type no longer matters. Non-cosmetic rewards (tickles/title/boost/
-- mystery_box/pig_skin) pin no such id and are untouched.

-- ── 1. Broaden the sync trigger. Carried from 20260675, reward_type gate
--       replaced by the same COALESCE the grant path uses. ──────────────────
CREATE OR REPLACE FUNCTION public.sync_pass_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	pinned_id text;
BEGIN
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

DROP TRIGGER IF EXISTS season_tiers_sync_pass_exclusive ON public.season_tiers;
CREATE TRIGGER season_tiers_sync_pass_exclusive
	AFTER INSERT OR UPDATE ON public.season_tiers
	FOR EACH ROW EXECUTE FUNCTION public.sync_pass_exclusive();

-- ── 2. Re-backfill with the broadened rule (mirrors the grant COALESCE), so
--       the leaked S1 cosmetics above are flagged retroactively. ────────────
UPDATE public.hats h
SET pass_exclusive = true
WHERE NOT h.pass_exclusive
	AND EXISTS (
		SELECT 1 FROM public.season_tiers t
		WHERE COALESCE(
			t.reward_value->>'hat_id',
			t.reward_value->>'bg_id',
			t.reward_value->>'aura_id',
			t.reward_value->>'cape_id',
			t.reward_value->>'item_id'
		) = h.id
	);
