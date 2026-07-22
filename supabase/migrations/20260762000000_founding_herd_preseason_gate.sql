-- ════════════════════════════════════════════════════════════════════════
-- Founder bug (2026-07-20): the "Founding Herd" beta-reward reveal
-- (SeasonEndModal — a season-end gift thanking the beta's Founding Herd; tiers
-- founding_herd / trough_table / bog_royalty / snoutfather) is appearing for
-- BRAND-NEW signups. It must ONLY reach players who existed BEFORE the current
-- season started. Accounts created DURING the current season (Season 1, The
-- Great Hunger) must NOT get a beta reward / Founding Herd designation.
--
-- This is the SAME pattern — and the SAME boundary — as the Season-0 finale
-- gate in 20260759000000_finale_preseason_gate.sql. Read that migration
-- first; this one mirrors its A/B/C structure for the beta-reward system so the
-- two gates stay consistent.
--
-- WHY IT HAPPENS: grant_beta_rewards() (20260704400000) grants a
-- beta_reward_grants row to EVERY profile that has a username, any lifetime
-- play (tickles_earned > 0), and is not leaderboard-hidden — keyed only by
-- (user_id) via ON CONFLICT DO NOTHING, with NO account-age gate. It is
-- re-runnable and is PERFORM'd by the judgement-day cron (carried through
-- 20260704500000 → 20260709000000 → 20260726000000 → 20260736000000 →
-- 20260737000000). So any newcomer who plays during Season 1 accrues
-- tickles_earned > 0, gets swept up on the next (re-)run — grant row + the
-- Founding Herd title (+ rank title on podium tiers) + the founder ribbon +
-- snouts + a "Thank you, Founding Herd" announcement — and my_beta_reward()
-- then returns pending:true, so the client shows SeasonEndModal. Identical
-- sweep mechanism to finalize_season's newcomer leak.
--
-- ── BOUNDARY SIGNAL CHOSEN ──────────────────────────────────────────────
-- profiles has NO created_at; account creation lives on auth.users.created_at
-- (profiles.id = auth.users.id). A SECURITY DEFINER fn may read it — same
-- precedent the finale gate uses (redeem_referral in 20260644000000).
--
-- Season boundary = SEASON 1 START = 2026-07-12 00:00:00+00
--   (00:00 UTC Jul 12 == 8:00 PM ET Jul 11, 2026) — the EXACT constant the
--   finale gate uses. Fixed, documented, corroborated by:
--   • server cron 'judgement-day-season-0' fires '0 0 12 7 *' (20260737000000)
--   • client utils/season.ts SEASON_0_END = "2026-07-11" (= 00:00 UTC Jul 12)
--   • 20260759000000_finale_preseason_gate.sql (same boundary, same reason).
-- A "pre-season / Founding Herd player" = auth.users.created_at < boundary.
--
-- Beta grants ARE season-keyed (beta_reward_grants.season_key, default
-- 'beta_2026'). The boundary is resolved per season_key via CASE in BOTH
-- functions so a future beta/season reward only needs its boundary added in
-- one obvious place per function:
--   'beta_2026' → 2026-07-12 00:00:00+00 (above)
--   any other   → 'infinity'  (⇒ created_at < 'infinity' always true ⇒ NO
--                 gate, behavior byte-identical to today). ⚠️ FOUNDER ACTION:
--                 before a FUTURE beta/season reward is granted under a new
--                 season_key, add that key's boundary to BOTH CASE blocks
--                 below, or the same newcomer leak returns for that key.
--
-- ── THREE MOVES ─────────────────────────────────────────────────────────
-- A. grant_beta_rewards — carried VERBATIM from 20260704400000_beta_rewards.sql
--    (the alphabetically-latest AND only def; every later migration only
--    PERFORMs it, none redefines it — carry-latest-def footgun heeded). ONLY
--    change: the qualifier SELECT now JOINs auth.users and filters
--    `u.created_at < season_boundary`. Stops FUTURE (re-)runs from granting to
--    newcomers, and — because the gate sits in WHERE, before the ranking window
--    — ranks are computed over pre-season accounts only, so a newcomer can
--    never displace a founder's podium rank. Every other guard/announcement/
--    payout is identical.
--
-- B. my_beta_reward — carried VERBATIM from 20260704400000. ONLY change: after
--    loading the caller's grant row `g`, return {pending:false} when the
--    caller's auth.users.created_at >= the boundary for g.season_key. Belt-and-
--    suspenders READ GUARD: suppresses the reveal for a post-boundary account
--    even if a bad row still exists. Signature unchanged.
--
-- C. CLEANUP of already-mis-granted rows (production has them — that's the live
--    bug). Scope = accounts with auth.users.created_at >= boundary holding a
--    'beta_2026' beta_reward_grants row. One data-modifying CTE, all arms keyed
--    on the same `removed` set, idempotent (the DELETE removes the rows, so a
--    re-apply matches nothing and reverses no snouts twice):
--      • DELETE the beta_reward_grants row (this is what drives the reveal),
--      • DELETE every beta title on that user (all four beta_* title ids —
--        founding_herd is always granted, plus the rank title on podium tiers),
--      • DELETE the beta_founder_ribbon user_hats row,
--      • DELETE the "Thank you, Founding Herd" system_announcements row (that
--        exact title is minted ONLY by grant_beta_rewards — the other season
--        announcement, 20260739100000, uses a different title, so this is
--        tightly scoped),
--      • reverse the row's snouts from profiles.counter, CLAMPED at 0.
--
-- ⚠️ CLAIMED-vs-UNCLAIMED SIGNAL (founder review — DIFFERS from the finale):
--    beta_reward_grants has NO seen/claimed column. "Seen" lives ONLY in the
--    client (AsyncStorage 'beta_reward_seen_v1' in hooks/useSeasonEnd.ts) and
--    is NOT queryable server-side — so, unlike season_finales.seen_at, the DB
--    cannot tell a shown-and-dismissed grant from an unshown one. That's SAFE
--    here because the created_at >= boundary scope INTRINSICALLY isolates only
--    illegitimate grants: a post-boundary account did not play the beta, so the
--    ONLY source of ANY beta grant/title/ribbon on it is this bug. There is no
--    legitimate claimed row inside the cleanup scope to protect, so every
--    matched row is deleted (no seen filter needed — and none is available).
--    RESIDUAL RISK (mirror of the finale's snout-clawback caveat): a newcomer
--    may already have SEEN the modal and even SPENT the snouts. The clawback is
--    clamped at 0 (never negative), so a partial spend yields a smaller-than-
--    full reversal; and the one thing we cannot undo is that they saw the
--    reveal once. If you'd rather not touch balances at all, the read guard (B)
--    already hides the reveal — drop the profiles UPDATE arm and keep the row/
--    title/ribbon/announcement deletes. Chosen default: reverse (clamped),
--    because leaving free founder snouts in every newcomer's balance is an
--    economy leak, consistent with the finale gate's choice.
--
-- Signatures unchanged → CREATE OR REPLACE, no DROP. Author-only migration;
-- DO NOT db push — wait for explicit founder "go" (CLAUDE.md DB rule).
-- ════════════════════════════════════════════════════════════════════════

-- ── A. grant_beta_rewards — carried VERBATIM from 20260704400000; qualifier
--    SELECT gains the auth.users JOIN + created_at < season_boundary gate. ──────
CREATE OR REPLACE FUNCTION public.grant_beta_rewards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r               record;
	v_tier          text;
	v_title         text;
	v_snouts        int;
	granted         int := 0;
	season_boundary timestamptz;
BEGIN
	-- Pre-season boundary for the key this function writes (table default
	-- 'beta_2026'). Accounts created on/after the boundary did NOT play the
	-- beta and must not receive its reward (see header).
	season_boundary := CASE 'beta_2026'
		WHEN 'beta_2026' THEN timestamptz '2026-07-12 00:00:00+00'
		ELSE 'infinity'::timestamptz  -- ⚠️ add future beta/season boundaries here
	END;

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
		JOIN auth.users u ON u.id = p.id
		WHERE p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.tickles_earned, 0) > 0
		  AND NOT p.hide_from_leaderboard
		  AND u.created_at < season_boundary   -- ← pre-season gate (new)
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

-- ── B. my_beta_reward — carried VERBATIM from 20260704400000; read guard
--    suppresses the reveal for post-boundary accounts. ─────────────────────────
CREATE OR REPLACE FUNCTION public.my_beta_reward()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	g               record;
	t_name          text;
	caller_created  timestamptz;
	season_boundary timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT * INTO g FROM public.beta_reward_grants WHERE user_id = caller_id;
	IF g IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	-- Pre-season read guard: an account created on/after the season boundary
	-- never played the beta, so it gets no Founding Herd reveal — even if a bad
	-- row exists (mirrors the write gate in grant_beta_rewards above).
	season_boundary := CASE g.season_key
		WHEN 'beta_2026' THEN timestamptz '2026-07-12 00:00:00+00'
		ELSE 'infinity'::timestamptz  -- ⚠️ add future beta/season boundaries here
	END;
	SELECT created_at INTO caller_created FROM auth.users WHERE id = caller_id;
	IF caller_created IS NULL OR caller_created >= season_boundary THEN
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

-- ── C. CLEANUP — remove already-mis-granted, post-boundary beta grants and
--    everything the grant handed out (see header for the claimed-signal note).
--    One CTE ⇒ all arms operate on the identical `removed` row set. Data-
--    modifying CTEs each run exactly once even if unreferenced, so every DELETE
--    arm fires. Idempotent: the grant-row DELETE clears the scope. ─────────────
WITH removed AS (
	DELETE FROM public.beta_reward_grants g
	USING auth.users u
	WHERE g.user_id = u.id
	  AND g.season_key = 'beta_2026'
	  AND u.created_at >= timestamptz '2026-07-12 00:00:00+00'  -- post-boundary newcomer
	RETURNING g.user_id, g.snouts
),
untitled AS (
	-- Every beta title is bug-sourced on a post-boundary account (the base
	-- Founding Herd title plus any podium/top rank title).
	DELETE FROM public.user_titles ut
	USING removed r
	WHERE ut.user_id = r.user_id
	  AND ut.title_id IN ('beta_snoutfather', 'beta_bog_royalty',
	                       'beta_trough_table', 'beta_founding_herd')
	RETURNING ut.user_id
),
unribboned AS (
	DELETE FROM public.user_hats uh
	USING removed r
	WHERE uh.user_id = r.user_id
	  AND uh.hat_id = 'beta_founder_ribbon'
	RETURNING uh.user_id
),
unannounced AS (
	-- That exact title is minted ONLY by grant_beta_rewards.
	DELETE FROM public.system_announcements sa
	USING removed r
	WHERE sa.user_id = r.user_id
	  AND sa.title = 'Thank you, Founding Herd'
	RETURNING sa.user_id
)
UPDATE public.profiles p
	SET counter = GREATEST(0, p.counter - r.snouts)
	FROM removed r
	WHERE p.id = r.user_id;
