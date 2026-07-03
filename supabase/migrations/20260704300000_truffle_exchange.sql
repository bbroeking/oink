-- ⚠️ HELD FOR REVIEW — push only on Brian's explicit "go" (never autonomously).
--
-- The Truffle Exchange (Season 2, Phase 4 — rewards spec
-- docs/wiki/outputs/memos/mudwar-rewards-spec-2026-07.md §4a):
--   • hats.token_cost — Golden-Truffle prices on the 25 war-exclusive items
--     (Muddy 25 / Caked 60 / Prize 120 / Champion 250 / Heirloom 500, per the
--     spec §5 tier mapping).
--   • exchange_rotation() — deterministic 4-slot weekly stock keyed on the ISO
--     week (same "the bog turns over on Monday" clock as Bog Weather): one
--     Muddy, one Caked, one Prize, and a marquee slot alternating
--     Champion (even ISO weeks) / Heirloom (odd).
--   • redeem_war_cosmetic() — buy_hat's shape (20260688 conventions),
--     denominated ONLY in golden_truffles; debit = negative war_truffles
--     ledger row + balance update in one tx. Heirloom redemptions rest
--     28 days per player. No snout path exists anywhere in this file.
--   • In-week milestone mints (spec §1: cross 10 mud → 5 truffles, 25 → 10,
--     50 → 15; ≤30/war) via an AFTER trigger on mud_slings — deliberately a
--     trigger, NOT carries of throw_mud/submit_run/submit_rooting: one path
--     covers every mud source (incl. future ones) with zero function-body
--     duplication, so this migration takes ownership of no one else's defs
--     (carry-latest-def footgun avoided by construction).
--
-- WHAT A LIVE APP-STORE CLIENT CAN OBSERVE AFTER THIS PUSH: nothing.
--   • No new hats rows; only a new column (token_cost) on rows that are
--     already invisible: the live Browse filter is
--     `(r.cost > 0 && !r.pass_exclusive) || owned` (app/(tabs)/shop.tsx:633)
--     and all 25 rows are cost=0; daily_shop() excludes war_exclusive
--     server-side (20260673/20260675); buy_hat rejects cost<=0
--     ("not_for_sale", 20260688). The live client selects explicit column
--     lists, so an ADDED column is never even fetched.
--   • New RPCs are additive — no live code path calls them.
--   • The milestone trigger fires only on mud_slings writes, which only
--     happen inside flag-dark Mud Wars.
--
-- Sequencing: applies after 20260704100000 (war_truffles / mint_truffles /
-- profiles.golden_truffles) and 20260704200000. Any migration after this one
-- must be ≥ 20260704300001.

-- ── 1. Ledger: allow spend entries ───────────────────────────────────────────
-- 20260704100000 created war_truffles with CHECK (amount > 0) — mint-only.
-- Redemptions write NEGATIVE rows (the audit trail for every spend), so the
-- constraint widens to "non-zero". mint_truffles itself still refuses <= 0.
ALTER TABLE public.war_truffles DROP CONSTRAINT IF EXISTS war_truffles_amount_check;
ALTER TABLE public.war_truffles
	ADD CONSTRAINT war_truffles_amount_check CHECK (amount <> 0);

-- ── 2. token_cost — truffle prices on the already-hidden war items ───────────
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS token_cost int;

-- Tier mapping per the rewards spec §5 (MUST-MATCH: constants/mudFights.ts
-- EXCHANGE_TIERS / EXCHANGE_PRICES).
UPDATE public.hats SET token_cost = 25  WHERE id IN
	('muddy_cap','slop_bucket','mud_shovel','mud_splatter_aura','mud_pit_bg');
UPDATE public.hats SET token_cost = 60  WHERE id IN
	('slop_bucket_hat','reed_hat','mud_pie','swamp_bubble_aura','reed_marsh_bg');
UPDATE public.hats SET token_cost = 120 WHERE id IN
	('bog_helmet','golden_truffle','crew_pennant','firefly_aura','mud_derby_bg','rosette_cap','prize_sash');
UPDATE public.hats SET token_cost = 250 WHERE id IN
	('swamp_crown','golden_bog_aura','bog_dusk_bg','festival_pennant','confetti_aura');
UPDATE public.hats SET token_cost = 500 WHERE id IN
	('heirloom_mire_aura','golden_mire_bg','festival_night_bg');

-- ── 3. exchange_week_stock — the deterministic pick (internal) ───────────────
-- One item per tier bucket from fixed arrays (the §5 mapping, alphabetic
-- within tier so the arrays are stable), indexed off hashtext of the ISO week.
-- MUST-MATCH: utils/truffleExchange.ts pickRotation() (display mirror + tests).
CREATE OR REPLACE FUNCTION public.exchange_week_stock(p_week text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE
	muddy    text[] := ARRAY['mud_pit_bg','mud_shovel','mud_splatter_aura','muddy_cap','slop_bucket'];
	caked    text[] := ARRAY['mud_pie','reed_hat','reed_marsh_bg','slop_bucket_hat','swamp_bubble_aura'];
	prize    text[] := ARRAY['bog_helmet','crew_pennant','firefly_aura','golden_truffle','mud_derby_bg','prize_sash','rosette_cap'];
	champ    text[] := ARRAY['bog_dusk_bg','confetti_aura','festival_pennant','golden_bog_aura','swamp_crown'];
	heirloom text[] := ARRAY['festival_night_bg','golden_mire_bg','heirloom_mire_aura'];
	-- ::bigint BEFORE abs(): abs(INT_MIN) overflows int4.
	seed     bigint := abs(hashtext('exchange:' || p_week)::bigint);
	weeknum  int    := COALESCE(NULLIF(split_part(p_week, '-', 2), ''), '1')::int;
	marquee  text;
BEGIN
	IF weeknum % 2 = 0 THEN
		marquee := champ[1 + ((seed / 343) % 5)::int];
	ELSE
		marquee := heirloom[1 + ((seed / 343) % 3)::int];
	END IF;
	RETURN ARRAY[
		muddy[1 + (seed % 5)::int],
		caked[1 + ((seed / 7) % 5)::int],
		prize[1 + ((seed / 49) % 7)::int],
		marquee
	];
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.exchange_week_stock(text) FROM PUBLIC, anon, authenticated;

-- ── 4. exchange_rotation — this week's shelf, for the client ─────────────────
CREATE OR REPLACE FUNCTION public.exchange_rotation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	wk        text := to_char(now() AT TIME ZONE 'utc', 'IYYY-IW');
	stock     text[];
	bal       int  := 0;
	rested    timestamptz;
	items     jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	stock := public.exchange_week_stock(wk);
	SELECT golden_truffles INTO bal FROM public.profiles WHERE id = caller_id;

	-- Heirloom rest: latest heirloom redemption inside 28 days.
	SELECT max(created_at) + interval '28 days' INTO rested
	FROM public.war_truffles
	WHERE user_id = caller_id
	  AND reason LIKE 'redeem_heirloom:%'
	  AND created_at > now() - interval '28 days';

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'id', h.id,
		'name', h.name,
		'price', h.token_cost,
		'rarity', h.rarity,
		'owned', EXISTS (
			SELECT 1 FROM public.user_hats uh
			WHERE uh.user_id = caller_id AND uh.hat_id = h.id
		)
	) ORDER BY h.token_cost), '[]'::jsonb) INTO items
	FROM public.hats h
	WHERE h.id = ANY(stock) AND h.war_exclusive = true AND h.token_cost IS NOT NULL;

	RETURN jsonb_build_object(
		'ok', true,
		'week', wk,
		'restock_at', date_trunc('week', now() AT TIME ZONE 'utc') + interval '7 days',
		'balance', COALESCE(bal, 0),
		'heirloom_rested_until', rested,
		'items', items
	);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.exchange_rotation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exchange_rotation() TO authenticated;

-- ── 5. redeem_war_cosmetic — the only sink ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_war_cosmetic(target_hat_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	wk        text := to_char(now() AT TIME ZONE 'utc', 'IYYY-IW');
	price     int;
	is_war    boolean;
	tier_h    boolean;
	bal       int;
	rows_ins  int;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT token_cost, war_exclusive, (token_cost = 500)
		INTO price, is_war, tier_h
	FROM public.hats WHERE id = target_hat_id;
	IF price IS NULL OR NOT is_war THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
	END IF;
	IF NOT (target_hat_id = ANY(public.exchange_week_stock(wk))) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_stock');
	END IF;
	-- Heirlooms rest 28 days per player (apex pacing, spec §4a).
	IF tier_h AND EXISTS (
		SELECT 1 FROM public.war_truffles
		WHERE user_id = caller_id
		  AND reason LIKE 'redeem_heirloom:%'
		  AND created_at > now() - interval '28 days'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'heirloom_rested');
	END IF;

	SELECT golden_truffles INTO bal FROM public.profiles
		WHERE id = caller_id FOR UPDATE;
	IF bal IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
	END IF;
	IF bal < price THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', price);
	END IF;

	-- Grant before debit: an ON CONFLICT no-op means "already owned" and
	-- nothing has been charged yet.
	INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (caller_id, target_hat_id)
		ON CONFLICT (user_id, hat_id) DO NOTHING;
	GET DIAGNOSTICS rows_ins = ROW_COUNT;
	IF rows_ins = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
	END IF;

	UPDATE public.profiles SET golden_truffles = golden_truffles - price
		WHERE id = caller_id;
	INSERT INTO public.war_truffles (user_id, amount, reason, war_id)
		VALUES (
			caller_id, -price,
			(CASE WHEN tier_h THEN 'redeem_heirloom:' ELSE 'redeem:' END) || target_hat_id,
			NULL
		);

	-- Gift-framed receipt — inline INSERT (never the admin-gated wrapper),
	-- guarded so an announce failure can't undo the trade. No emoji.
	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			caller_id, 'truffle_exchange', 'The Exchange thanks you',
			'You traded ' || price || ' golden truffles for a war-exclusive keepsake.',
			jsonb_build_object('hat_id', target_hat_id, 'price', price)
		);
	EXCEPTION WHEN OTHERS THEN NULL;
	END;

	RETURN jsonb_build_object('ok', true, 'remaining', bal - price, 'hat_id', target_hat_id);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.redeem_war_cosmetic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_war_cosmetic(text) TO authenticated;

-- ── 6. In-week milestone mints (spec §1) — trigger on mud_slings ─────────────
-- Cross 10 personal war mud → 5 truffles, 25 → 10, 50 → 15 (≤30/war total).
-- Idempotent per (user, war, threshold) via the ledger reason string; the
-- house bot has no profiles row, so mint_truffles() no-ops for it.
CREATE OR REPLACE FUNCTION public.mint_mud_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	total int;
	t     record;
BEGIN
	-- Only on an actual increase (upsert-counters rewrite rows on every bank).
	IF TG_OP = 'UPDATE' AND NEW.slings <= COALESCE(OLD.slings, 0) THEN
		RETURN NEW;
	END IF;
	SELECT COALESCE(SUM(slings), 0) INTO total
	FROM public.mud_slings
	WHERE war_id = NEW.war_id AND user_id = NEW.user_id;

	FOR t IN
		SELECT * FROM (VALUES (10, 5), (25, 10), (50, 15)) AS m(threshold, prize)
	LOOP
		IF total >= t.threshold AND NOT EXISTS (
			SELECT 1 FROM public.war_truffles
			WHERE user_id = NEW.user_id
			  AND war_id = NEW.war_id
			  AND reason = 'milestone_' || t.threshold
		) THEN
			PERFORM public.mint_truffles(
				NEW.user_id, t.prize, 'milestone_' || t.threshold, NEW.war_id
			);
		END IF;
	END LOOP;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mint_mud_milestones ON public.mud_slings;
CREATE TRIGGER trg_mint_mud_milestones
	AFTER INSERT OR UPDATE OF slings ON public.mud_slings
	FOR EACH ROW
	EXECUTE FUNCTION public.mint_mud_milestones();
