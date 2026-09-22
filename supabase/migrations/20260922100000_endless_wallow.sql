-- THE ENDLESS WALLOW — ranks past W6 keep paying (SKILL.md decision log,
-- 2026-09-22; spec: docs/prestige-wallow-spec.md, rewritten the same day).
--
-- Three rulings land here, server-side:
--   (1) The Marsh Crown becomes the Marsh WREATH and moves to the Neck slot.
--       Its id and art key are untouched; only the player-facing name and the
--       catalog category change, so already-granted pigs keep the item.
--   (2) The six purchasable Barn DESIGNS stop being rank grants. They stay for
--       sale; pigs already granted one keep it through habitat_grant_receipts,
--       which this migration does not touch. Only the four Wallow keepsakes
--       (1/3/6/10) remain prestige grants.
--   (3) Ranks 7 and up each grant exactly one rank prize by a rule over the
--       rank NUMBER (no finite table): keepsake frame / aura stage / two Golden
--       Truffles + one Mote. Receipted by (pig, rank) so it is granted once,
--       and back-paid for every pig already past W6.
--
-- Functions are carried forward from their CURRENT definitions, never
-- stale-copied: wallow() is renamed once and delegated to.

-- ── 1. Marsh Crown → Marsh Wreath (neck) ─────────────────────────────────────
-- The DB's neck category is 'necklace', not 'neck' — see 20260663000000
-- §(3), where prize_sash shipped as 'neck' and routed to no slot at all.
UPDATE public.hats
SET name = 'Marsh Wreath',
    category = 'necklace',
    description = 'Reeds, mud, and three bright truffles woven into a wreath.'
WHERE id = 'wallow_marsh_crown';

-- equip_cosmetic (20260774000000) reads the slot from the CATALOG row, so a
-- pig wearing the old crown in active_hat_id would be stranded: the head slot
-- would hold an item the slot map no longer routes there. Re-slot it the way
-- 20260596000000 moved every neck item out of the shared head column — but
-- never clobber a neck item the pig is already wearing; that pig is simply
-- unequipped and can re-wear the Wreath from the rank sheet.
UPDATE public.profiles
SET active_neck_id = 'wallow_marsh_crown', active_hat_id = NULL
WHERE active_hat_id = 'wallow_marsh_crown' AND active_neck_id IS NULL;

UPDATE public.profiles
SET active_hat_id = NULL
WHERE active_hat_id = 'wallow_marsh_crown';

-- ── 2. Barn decor stops being a rank grant ───────────────────────────────────
-- _reconcile_habitat_prestige (20260910120000, carried by 20260910130000)
-- grants every habitat_items row whose prestige_rank <= the pig's rank, so
-- nulling the column IS the whole change: no function edit is needed and no
-- receipt is revoked. The prestige_rank UNIQUE constraint was already dropped
-- by 20260910130000 (the keepsakes share ranks 1/3/6 with the old decor), so
-- nothing here can collide.
UPDATE public.habitat_items
SET prestige_rank = NULL
WHERE id IN (
  'dried_herb_garland', 'barn_bunting', 'muddy_paw_rug',
  'reading_chair', 'tiny_radio', 'midnight_rafters'
);

-- ── 3. Rank prizes for W7 and up ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallow_rank_prizes (
	user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	rank int NOT NULL CHECK (rank >= 7),
	prize text NOT NULL CHECK (prize IN ('keepsake', 'aura', 'truffles')),
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, rank)
);
COMMENT ON TABLE public.wallow_rank_prizes IS
	'One receipt per (pig, Wallow rank >= 7). The receipt IS the idempotency gate for _grant_wallow_rank_prize.';

ALTER TABLE public.wallow_rank_prizes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
	CREATE POLICY "View own Wallow rank prizes" ON public.wallow_rank_prizes
		FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.wallow_rank_prizes TO authenticated;

-- The rule, not a table: every rank past six resolves to exactly one prize.
--   1. keepsake — rank >= 10 and rank % 5 = 0, IF a keepsake frame is drawn for
--      that exact rank (habitat_items.prestige_rank). _reconcile_habitat_prestige
--      does the granting on the next Barn read; this only records the receipt.
--      An undrawn keepsake rank falls through to the checks below.
--   2. aura    — rank >= 8 and (rank - 5) % 3 = 0. The aura stage is derived
--      from the rank on both client and server, so there is nothing to grant;
--      the receipt records that this rank's prize was the new stage.
--   3. truffles — everything else: two Golden Truffles through the audited
--      mint path plus one Mote credited exactly as claim_wallow_tier credits a
--      'motes' tier (20260905174000), under the same profiles lock so the
--      mote_wallet_revision triggers from 20260906010000 bump cleanly.
CREATE OR REPLACE FUNCTION public._grant_wallow_rank_prize(p_user uuid, p_rank int)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_prize text;
	v_existing text;
	v_inserted int;
BEGIN
	IF p_user IS NULL OR p_rank IS NULL OR p_rank < 7 THEN RETURN NULL; END IF;

	-- profiles first, every time — the lock order Mote claims and the machine
	-- spend already use. mint_truffles takes the same row lock beneath us.
	PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;
	IF NOT FOUND THEN RETURN NULL; END IF;

	SELECT prize INTO v_existing FROM public.wallow_rank_prizes
	WHERE user_id = p_user AND rank = p_rank;
	IF FOUND THEN RETURN v_existing; END IF;

	IF p_rank >= 10 AND p_rank % 5 = 0
		AND EXISTS (SELECT 1 FROM public.habitat_items WHERE prestige_rank = p_rank)
	THEN
		v_prize := 'keepsake';
	ELSIF p_rank >= 8 AND (p_rank - 5) % 3 = 0 THEN
		v_prize := 'aura';
	ELSE
		v_prize := 'truffles';
	END IF;

	-- The receipt is the gate: a lost race grants nothing and reports the prize
	-- the winner recorded.
	INSERT INTO public.wallow_rank_prizes (user_id, rank, prize)
	VALUES (p_user, p_rank, v_prize)
	ON CONFLICT (user_id, rank) DO NOTHING;
	GET DIAGNOSTICS v_inserted = ROW_COUNT;
	IF v_inserted = 0 THEN
		SELECT prize INTO v_existing FROM public.wallow_rank_prizes
		WHERE user_id = p_user AND rank = p_rank;
		RETURN v_existing;
	END IF;

	IF v_prize = 'truffles' THEN
		PERFORM public.mint_truffles(p_user, 2, 'wallow_rank', NULL);
		UPDATE public.profiles SET mote_balance = mote_balance + 1 WHERE id = p_user;
	END IF;

	RETURN v_prize;
END;
$function$;
REVOKE ALL ON FUNCTION public._grant_wallow_rank_prize(uuid, int)
	FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public._grant_wallow_rank_prize(uuid, int) IS
	'Applies the W7+ rank-prize rule once per (pig, rank). Returns the prize text, or NULL below rank 7.';

-- Carry the CURRENT wallow() (20260779000000 — the rank-regalia + tuning
-- wrapper; 20260905174000 only replaced the inner _wallow_before_tuning) and
-- put the rank-prize rule behind it. Rename once, delegate, add fields.
ALTER FUNCTION public.wallow()
	RENAME TO _wallow_before_endless;
REVOKE ALL ON FUNCTION public._wallow_before_endless() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wallow()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	result jsonb := public._wallow_before_endless();
	earned_rank int;
	prize text;
BEGIN
	IF NOT COALESCE((result->>'ok')::boolean, false) THEN RETURN result; END IF;
	earned_rank := COALESCE((result->>'wallow_count')::int, 0);

	IF earned_rank >= 7 THEN
		prize := public._grant_wallow_rank_prize(auth.uid(), earned_rank);
	END IF;

	RETURN result || jsonb_build_object('rank_prize', prize);
END;
$function$;
REVOKE ALL ON FUNCTION public.wallow() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallow() TO authenticated;

-- ── 4. Back-pay the pigs already past W6 ─────────────────────────────────────
-- Production sits at W7/W9/W11 today, so this mints a handful of truffles and
-- Motes. The receipt gate makes a re-run a no-op.
DO $$
DECLARE player record; r int;
BEGIN
	FOR player IN
		SELECT id, COALESCE(wallow_count, 0) AS rank
		FROM public.profiles
		WHERE COALESCE(wallow_count, 0) >= 7
	LOOP
		FOR r IN 7..player.rank LOOP
			PERFORM public._grant_wallow_rank_prize(player.id, r);
		END LOOP;
	END LOOP;
END;
$$;
