-- ════════════════════════════════════════════════════════════════════════
-- Founder bug (2026-07-20): a BRAND-NEW signup immediately gets the
-- "Judgement Day" Season-0 finale ceremony — Schism Survivor title + snouts +
-- the "Season 1 begins — alignment reset to Neutral" reveal. The finale is
-- the verdict on the PAST season (the greedy/generous era = SEASON 0, ended
-- 2026-07-11 8pm ET). It must be RESERVED for accounts that existed BEFORE
-- this season started. Accounts created during the CURRENT season (Season 1,
-- The Great Hunger) must NOT receive a Season-0 finale/verdict.
--
-- WHY IT HAPPENS: finalize_season('season_0') (run by the annual judgement-day
-- cron, and re-runnable by hand) grants a season_finales row to EVERY profile
-- with a username, keyed only by (user_id, season_key) — no account-age gate.
-- Alignment is still live in Season 1, so a newcomer accrues a nonzero
-- alignment_score; any RE-RUN of finalize_season('season_0') then classifies
-- them as a 'participant' (Schism Survivor) + pays snouts + (via the tail
-- UPDATE) wipes their alignment. The row makes my_finale_result() return
-- pending:true and the client shows JudgementDayModal.
--
-- ── BOUNDARY SIGNAL CHOSEN ──────────────────────────────────────────────
-- profiles has NO created_at; account creation lives on auth.users.created_at
-- (profiles.id = auth.users.id). A SECURITY DEFINER fn may read it — precedent:
-- redeem_referral in 20260644000000 reads auth.users.created_at the same way.
--
-- Season boundary = the Season-0 finalize moment = SEASON 1 START =
--   2026-07-12 00:00:00+00  (00:00 UTC Jul 12 == 8:00 PM ET Jul 11, 2026).
-- This is an EXPLICIT, documented, fixed timestamp — not a guess:
--   • server cron 'judgement-day-season-0' fires '0 0 12 7 *' (20260737000000)
--   • client utils/season.ts SEASON_0_END = "2026-07-11" (= 00:00 UTC Jul 12)
-- It is preferred over MIN(season_finales.finalized_at) because a re-run of
-- finalize_season stamps NEWCOMER rows with a LATER finalized_at, so the row's
-- own finalized_at cannot distinguish a real participant from a newcomer — a
-- fixed boundary can. A "pre-season player" = auth.users.created_at < boundary.
--
-- Boundary is resolved per season_key via CASE so this stays correct if
-- finalize_season is ever run for another key:
--   'season_0' → 2026-07-12 00:00:00+00 (above)
--   any other  → 'infinity'  (⇒ created_at < 'infinity' is always true ⇒ NO
--                gate, behavior byte-identical to today). ⚠️ FOUNDER ACTION:
--                before a FUTURE season's finale is re-run, add that season's
--                boundary to BOTH CASE blocks below, or the same newcomer leak
--                returns for that key.
--
-- ── THREE MOVES ─────────────────────────────────────────────────────────
-- A. finalize_season — carried VERBATIM from 20260708300000_leaderboard_
--    tiebreak_most_tickles.sql (the alphabetically-latest def; carry-latest-def
--    footgun heeded). ONLY change: the grant SELECT now JOINs auth.users and
--    filters `u.created_at < season_boundary`. Stops FUTURE re-runs from
--    granting to newcomers. Every other guard/behavior is identical — including
--    the tail `alignment_score = 0` reset (see OPEN QUESTIONS: that reset still
--    wipes current-season alignment for everyone on a re-run; left unchanged
--    per "keep every other behavior identical").
--
-- B. my_finale_result — carried VERBATIM from 20260526000000_finale.sql. ONLY
--    change: after loading finale row `f`, return {pending:false} when the
--    caller's auth.users.created_at >= the boundary for f.season_key. Belt-and-
--    suspenders read guard: suppresses the ceremony for a post-boundary account
--    even if a bad row still exists (e.g. a claimed row, or a row inserted
--    before this migration lands). Signature unchanged.
--
-- C. CLEANUP of already-mis-granted rows (production has them). For accounts
--    with auth.users.created_at >= boundary that hold an UNSEEN (seen_at IS
--    NULL, i.e. never claimed/shown) 'season_0' finale row, this:
--      • DELETEs the season_finales row,
--      • removes the user_titles grant recorded on that row (its title_id —
--        Schism Survivor / Calm in the Storm; the ONLY source of these season
--        titles for a post-boundary account is this bug),
--      • reverses the snouts recorded on that row from profiles.counter,
--        CLAMPED at 0 (GREATEST(0, …)) so a partial spend can't go negative.
--    Done as one data-modifying CTE so all three touch the SAME row set, and
--    idempotent: the DELETE removes the rows, so a re-apply matches nothing and
--    subtracts no snouts twice. CLAIMED rows (seen_at NOT NULL) are LEFT
--    UNTOUCHED — we never claw back a reward the player already saw.
--
-- ⚠️ SNOUT-REVERSAL TRADEOFF (founder review): we CAN cleanly separate claimed
--    from unclaimed (seen_at), so this reverses snouts for unclaimed rows. The
--    residual risk: the snouts were added to profiles.counter at grant time and
--    aren't separately tracked, so if a newcomer already SPENT some, the clamp
--    yields a smaller-than-full clawback (never negative). If you'd rather not
--    touch balances at all, the read guard (B) alone already hides the ceremony
--    — delete the UPDATE-counter arm of the CTE and keep only the row+title
--    delete. Chosen default: reverse (clamped), because leaving free snouts in
--    every newcomer's balance is an economy leak the founder asked to reverse.
--
-- Signatures unchanged → CREATE OR REPLACE, no DROP. Author-only migration;
-- DO NOT db push — wait for explicit founder "go" (CLAUDE.md DB rule).
-- ════════════════════════════════════════════════════════════════════════

-- ── A. finalize_season — carried VERBATIM from 20260708300000; grant SELECT
--    gains the auth.users JOIN + created_at < season_boundary gate. ───────────
CREATE OR REPLACE FUNCTION public.finalize_season(season_key text DEFAULT 'season_1')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r               record;
	bracket         text;
	title_id        text;
	snouts          int;
	granted         int := 0;
	season_boundary timestamptz;
BEGIN
	-- Pre-season boundary for this key (see header). Accounts created on/after
	-- the boundary did NOT play the season and must not receive its finale.
	season_boundary := CASE season_key
		WHEN 'season_0' THEN timestamptz '2026-07-12 00:00:00+00'
		ELSE 'infinity'::timestamptz  -- ⚠️ add future season boundaries here
	END;

	FOR r IN
		SELECT
			p.id,
			p.alignment_score AS score,
			CASE
				WHEN p.alignment_score >  0 THEN 'generous'
				WHEN p.alignment_score <  0 THEN 'greedy'
				ELSE 'neutral'
			END AS side,
			CASE
				WHEN p.alignment_score > 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score > 0)
						ORDER BY p.alignment_score DESC, p.tickles_earned DESC, p.id)
				WHEN p.alignment_score < 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score < 0)
						ORDER BY p.alignment_score ASC, p.tickles_earned DESC, p.id)
				ELSE NULL
			END AS side_rank
		FROM public.profiles p
		JOIN auth.users u ON u.id = p.id
		WHERE p.username IS NOT NULL AND p.username <> ''
		  AND u.created_at < season_boundary   -- ← pre-season gate (new)
	LOOP
		IF r.side = 'neutral' THEN
			bracket := 'neutral'; title_id := 'calm_in_the_storm'; snouts := 100;
		ELSIF r.side_rank <= 3 THEN
			bracket := 'top3';
			title_id := CASE r.side WHEN 'generous' THEN 'halo_bearer_2026'
			                        ELSE 'goblin_king_2026' END;
			snouts := 500;
		ELSIF r.side_rank <= 10 THEN
			bracket := 'top10'; title_id := 'gilded_2026'; snouts := 250;
		ELSE
			bracket := 'participant'; title_id := 'schism_survivor'; snouts := 100;
		END IF;

		INSERT INTO public.season_finales
			(user_id, season_key, final_score, side, side_rank, bracket, title_id, snouts)
			VALUES (r.id, season_key, r.score, r.side, r.side_rank, bracket, title_id, snouts)
			ON CONFLICT ON CONSTRAINT season_finales_pkey DO NOTHING;

		IF FOUND THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (r.id, title_id) ON CONFLICT DO NOTHING;
			UPDATE public.profiles SET counter = counter + snouts WHERE id = r.id;
			granted := granted + 1;
		END IF;
	END LOOP;

	UPDATE public.profiles
		SET alignment_score = 0, alignment_updated_at = now()
		WHERE alignment_score <> 0;

	RETURN jsonb_build_object('ok', true, 'granted', granted, 'season_key', season_key);
END;
$function$;
-- NOT granted to authenticated — service role / SQL console / cron only.

-- ── B. my_finale_result — carried VERBATIM from 20260526000000; read guard
--    suppresses the ceremony for post-boundary accounts. ──────────────────────
CREATE OR REPLACE FUNCTION public.my_finale_result()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	f               record;
	t_name          text;
	caller_created  timestamptz;
	season_boundary timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT * INTO f FROM public.season_finales
		WHERE user_id = caller_id AND seen_at IS NULL
		ORDER BY finalized_at DESC LIMIT 1;
	IF f IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	-- Pre-season read guard: an account created on/after the season boundary
	-- never participated in that season, so it gets no verdict — even if a bad
	-- row exists (mirrors the write gate in finalize_season above).
	season_boundary := CASE f.season_key
		WHEN 'season_0' THEN timestamptz '2026-07-12 00:00:00+00'
		ELSE 'infinity'::timestamptz  -- ⚠️ add future season boundaries here
	END;
	SELECT created_at INTO caller_created FROM auth.users WHERE id = caller_id;
	IF caller_created IS NULL OR caller_created >= season_boundary THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT name INTO t_name FROM public.titles WHERE id = f.title_id;

	RETURN jsonb_build_object(
		'pending',     true,
		'season_key',  f.season_key,
		'final_score', f.final_score,
		'side',        f.side,
		'side_rank',   f.side_rank,
		'bracket',     f.bracket,
		'title_id',    f.title_id,
		'title_name',  t_name,
		'snouts',      f.snouts
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_finale_result() TO authenticated;

-- ── C. CLEANUP — remove already-mis-granted, UNSEEN, post-boundary season_0
--    finales; strip the row's title; reverse its snouts (clamped at 0).
--    One CTE ⇒ all three arms operate on the identical row set. Data-modifying
--    CTEs each run exactly once even if unreferenced, so `untitled` fires. ─────
WITH removed AS (
	DELETE FROM public.season_finales sf
	USING auth.users u
	WHERE sf.user_id = u.id
	  AND sf.season_key = 'season_0'
	  AND sf.seen_at IS NULL                                   -- unclaimed only
	  AND u.created_at >= timestamptz '2026-07-12 00:00:00+00' -- post-boundary
	RETURNING sf.user_id, sf.title_id, sf.snouts
),
untitled AS (
	DELETE FROM public.user_titles ut
	USING removed r
	WHERE ut.user_id = r.user_id
	  AND ut.title_id = r.title_id
	RETURNING ut.user_id
)
UPDATE public.profiles p
	SET counter = GREATEST(0, p.counter - r.snouts)
	FROM removed r
	WHERE p.id = r.user_id;
