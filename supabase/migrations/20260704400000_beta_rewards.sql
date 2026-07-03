-- ⚠️ HELD FOR REVIEW — push only on Brian's explicit go.
--
-- Beta participation rewards + the season-end reveal (Season 1 → launch).
-- Design: docs/wiki/outputs/memos/beta-rewards-season-end-2026-07.md
--
-- WHAT THIS SEEDS (all invisible to live clients until granted/flag-flipped):
--   • 4 titles (source='season', for_sale=false — never purchasable, render
--     nowhere until owned; the shop Titles tab was removed in 20260677).
--   • 1 cosmetic: beta_founder_ribbon at cost=0 — hidden from Browse
--     (shop.tsx:633 keeps cost<=0 unless owned), never in daily_shop()
--     (cost>0 filter, latest def 20260688), unbuyable (buy_hat rejects
--     cost<=0). ⚠️ ART GATE: HAT_IMAGES + placement art must land BEFORE
--     grant-time or owners see the orphan-cosmetic fallback bug (20260685).
--   • app_config 'season1_finale' = FALSE — gates the SeasonEndModal reveal.
--   • beta_reward_grants table + grant_beta_rewards() + my_beta_reward().
--
-- WHAT THIS DOES NOT DO: nothing fires automatically. grant_beta_rewards()
-- is SECURITY DEFINER and NOT granted to authenticated. Two firing options
-- (founder decision — see the memo):
--   A) Couple to Judgement Day: carry finalize_season (LATEST DEF =
--      20260526000000_finale.sql — carry-latest-def footgun) and add
--      `PERFORM public.grant_beta_rewards();` before the alignment wipe.
--      Note the live cron fires at 01:00 UTC Jul 12 (20260658).
--   B) RECOMMENDED — fire by hand at season end:
--        SELECT public.grant_beta_rewards();
--        UPDATE public.app_config SET enabled = true, updated_at = now()
--          WHERE key = 'season1_finale';
--
-- Idempotent throughout: reruns are safe no-ops (ON CONFLICT DO NOTHING +
-- IF FOUND guards, same shape as finalize_season).

-- ── 1. Titles ────────────────────────────────────────────────────────────
-- titles_source_check latest def (20260647) already allows 'season'.
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('beta_snoutfather',   'Snoutfather',         'pre',  'The very top of the founding herd.', 'season', false, 405),
	('beta_bog_royalty',   'Bog Royalty',         'pre',  'Top three of the founding herd.',    'season', false, 406),
	('beta_trough_table',  'Of the Trough Table', 'post', 'Top ten of the founding herd.',      'season', false, 407),
	('beta_founding_herd', 'Founding Herd',       'post', 'Played before the gates opened.',    'season', false, 408)
ON CONFLICT (id) DO NOTHING;

-- ── 2. The founder cosmetic (hidden: cost = 0) ───────────────────────────
INSERT INTO public.hats (id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('beta_founder_ribbon', 'Founder''s Mud Ribbon', '🎀', 0, 460, 'necklace', 'legendary',
	 'A mud-dipped ribbon worn by the pigs who were here first.')
ON CONFLICT (id) DO NOTHING;

-- ── 3. The reveal flag (dark until the moment) ───────────────────────────
INSERT INTO public.app_config (key, enabled, description)
VALUES ('season1_finale', false,
        'Season-1 end: reveals the SeasonEndModal / beta founder rewards recap.')
ON CONFLICT (key) DO NOTHING;

-- ── 4. Grant ledger ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.beta_reward_grants (
	user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	season_key text        NOT NULL DEFAULT 'beta_2026',
	rank       int,                          -- NULL for non-ranked participants
	tier       text        NOT NULL,         -- 'snoutfather' | 'bog_royalty' | 'trough_table' | 'founding_herd'
	title_id   text        REFERENCES public.titles(id) ON DELETE SET NULL, -- the tier title (rank tiers) or founding_herd
	snouts     int         NOT NULL DEFAULT 0,
	granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_reward_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own beta grant" ON public.beta_reward_grants;
CREATE POLICY "View own beta grant"
	ON public.beta_reward_grants FOR SELECT
	USING (auth.uid() = user_id);

-- ── 5. The grant engine ──────────────────────────────────────────────────
-- Qualifier: named profile + any lifetime play + not a hidden demo/junk
-- account. Ranked tiers additionally exclude is_test (the admin flag —
-- the owner account is already leaderboard-hidden, 20260604) so a podium
-- title can never land on an admin-flagged account.
CREATE OR REPLACE FUNCTION public.grant_beta_rewards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r         record;
	v_tier    text;
	v_title   text;
	v_snouts  int;
	granted   int := 0;
BEGIN
	FOR r IN
		SELECT
			p.id,
			CASE
				WHEN p.is_test OR p.hide_from_leaderboard THEN NULL
				ELSE ROW_NUMBER() OVER (
					ORDER BY (CASE WHEN p.is_test OR p.hide_from_leaderboard THEN 1 ELSE 0 END),
					         p.tickles_earned DESC, p.id)
			END AS rank
		FROM public.profiles p
		WHERE p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.tickles_earned, 0) > 0
		  AND NOT p.hide_from_leaderboard
	LOOP
		IF r.rank = 1 THEN
			v_tier := 'snoutfather';   v_title := 'beta_snoutfather';  v_snouts := 1000;
		ELSIF r.rank <= 3 THEN
			v_tier := 'bog_royalty';   v_title := 'beta_bog_royalty';  v_snouts := 750;
		ELSIF r.rank <= 10 THEN
			v_tier := 'trough_table';  v_title := 'beta_trough_table'; v_snouts := 500;
		ELSE
			v_tier := 'founding_herd'; v_title := 'beta_founding_herd'; v_snouts := 250;
		END IF;

		INSERT INTO public.beta_reward_grants (user_id, rank, tier, title_id, snouts)
			VALUES (r.id, r.rank, v_tier, v_title, v_snouts)
			ON CONFLICT (user_id) DO NOTHING;

		IF FOUND THEN
			-- Everyone gets the Founding Herd title + the ribbon; podium/top
			-- tiers get their rank title on top.
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (r.id, 'beta_founding_herd') ON CONFLICT DO NOTHING;
			IF v_title <> 'beta_founding_herd' THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (r.id, v_title) ON CONFLICT DO NOTHING;
			END IF;
			INSERT INTO public.user_hats (user_id, hat_id)
				VALUES (r.id, 'beta_founder_ribbon') ON CONFLICT DO NOTHING;
			UPDATE public.profiles SET counter = counter + v_snouts WHERE id = r.id;

			-- INLINE announcement — never send_system_announcement() (it is
			-- admin-gated and would silently roll back for non-admin lanes).
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				r.id,
				'season',
				'Thank you, Founding Herd',
				CASE v_tier
					WHEN 'snoutfather'  THEN 'The season has settled — and no snout dug deeper than yours. Snoutfather, Founding Herd, a ribbon, and 1000 snouts are yours.'
					WHEN 'bog_royalty'  THEN 'The season has settled — you finished among the top three. Bog Royalty, Founding Herd, a ribbon, and 750 snouts are yours.'
					WHEN 'trough_table' THEN 'The season has settled — you earned a seat at the trough table. A title, a ribbon, and 500 snouts are yours.'
					ELSE 'The season has settled. You were here before the gates opened — Founding Herd, a ribbon, and 250 snouts are yours.'
				END,
				jsonb_build_object('screen', 'season', 'tier', v_tier)
			);

			granted := granted + 1;
		END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'granted', granted);
END;
$function$;

-- SQL console / service role only — mirrors finalize_season's gating.
REVOKE ALL ON FUNCTION public.grant_beta_rewards() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_beta_rewards() FROM anon, authenticated;

-- ── 6. The client read ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_beta_reward()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	g         record;
	t_name    text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT * INTO g FROM public.beta_reward_grants WHERE user_id = caller_id;
	IF g IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT name INTO t_name FROM public.titles WHERE id = g.title_id;

	RETURN jsonb_build_object(
		'pending',    true,
		'season_key', g.season_key,
		'rank',       g.rank,
		'tier',       g.tier,
		'title_id',   g.title_id,
		'title_name', t_name,
		'snouts',     g.snouts
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.my_beta_reward() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_beta_reward() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_beta_reward() TO authenticated;
