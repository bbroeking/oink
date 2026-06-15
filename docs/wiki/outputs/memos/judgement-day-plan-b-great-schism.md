---
title: "Judgement Day Plan B — The Great Schism"
type: plan
date: 2026-06-14
tags: [strategy, season, judgement-day, plan, competitive, social]
status: draft
last_compiled: 2026-06-14
---

# Judgement Day Plan B — The Great Schism

> Judgement Day stops being a private verdict and becomes a village-wide reckoning: Generous vs Greedy, one *side* crowned by the sounder's collective alignment — a cozy take on the Helldivers community-meta-goal climax. The personal verdict stays intact; a **collective layer** is added on top of it.

**Thesis (one testable sentence):** adding a village-side layer to the existing per-player finale measurably raises last-week alignment activity and verdict-card shares versus the per-player-only finale — *if and only if* the sounder is large enough that "58% to 42%" reads as a crowd, not a dozen people. → therefore **ship for Season 2, post-App-Store-launch**, never retrofit Season 1.

**Win condition for the feature itself** (see Success metrics): a measurable last-week alignment-action lift + a non-trivial verdict-card share rate, with zero idempotency/economy regressions on re-fire.

## The arc / rollout — the experience in phases

1. **Build-up (final week, ~July 8–15 of a season).** A live **faction meta-bar** appears on the season surface: *"The village is 60% Generous — 5 days left."* It reads the running collective tally and turns the last week into a scramble. The existing two-sided `alignment_leaderboard(per_side int)` (`supabase/migrations/20260525000000_alignment_leaderboard.sql`) is reused as a **side leaderboard** — each side's roster and the contested margin — so a Greedy player watching their side trail has a concrete reason to cast one more curse before noon UTC.
2. **The moment (noon UTC, finale day).** The pg_cron job fires `finalize_season(<season_key>)` (`supabase/migrations/20260579000000_judgement_day_cron.sql`). In addition to ranking *individuals* (which it already does), it now **tallies the winning side** and writes one collective result. A push lands for everyone: *"⚖ Judgement Day! The Generous side carried the village this season."*
3. **The reveal.** On next foreground, `JudgementDayModal` (`components/JudgementDayModal.tsx`) shows **both** layers: the personal verdict (unchanged — side, rank, bracket, title, snouts) *and* the village outcome ("Generous carried it, 58% to 42% — your side prevailed / your side fell"), plus the **winning-side bonus** if you were on it. (Surfacing note below: the modal reads the *extended* `my_finale_result()`, not a separate announcement card — see "Two surfaces, one moment.")
4. **What's next / next season.** The reset is unchanged (`alignment_score = 0`), but the **winning side's banner flies over the village** through the next season as a persistent reminder and grudge hook — *"The Greedy lost last season. Rematch."*
5. **Share.** The [[virality-and-growth-loops|Verdict Card]] gains a faction flex: *"My side carried the village"* — a templated, comparable, calendar-moment artifact (everyone judged the same noon → FOMO), the exact shareable-identity shape the viral research prizes.

## Already built ✅

- **Per-player finale, fully built.** `finalize_season(season_key default 'season_1')` ranks every named profile by `profiles.alignment_score`, buckets to `generous`/`greedy`/`neutral`, assigns `side_rank`, grants `top3`/`top10`/`participant`/`neutral` titles + 500/250/100/100 snouts to `profiles.counter`, writes `season_finales (user_id, season_key, …)`, then wipes alignment to 0. Idempotent per `season_key` via `ON CONFLICT (user_id, season_key) DO NOTHING` + `IF FOUND`. `SECURITY DEFINER`, **not** granted to `authenticated`. (`supabase/migrations/20260526000000_finale.sql`.)
- **The cron.** `cron.schedule('judgement-day-season-1', '0 12 15 7 *', $$SELECT public.finalize_season('season_1')$$)` — live, jobid 2 (`supabase/migrations/20260579000000_judgement_day_cron.sql`). Header is `-- ⚠️ REVIEW BEFORE PUSHING`; the migration deliberately does **not** re-run `CREATE EXTENSION pg_cron` (Supabase after-create hook errors 2BP01).
- **Reveal client + plumbing.** `my_finale_result()` / `mark_finale_seen(target_season_key)` (granted to authenticated). `JudgementDayModal.tsx` reads the verdict (`FinaleResult` interface, line 30); `app/_layout.tsx` polls `my_finale_result` on focus + AppState `active` (lines 196–216) and mounts the modal via a popup-queue slot (`usePopupSlot("finale", …)`, line 122).
- **The side board.** `alignment_leaderboard(per_side int DEFAULT 20)` returns the two ranked sides with within-side ranks — granted to authenticated, neutrals **omitted by design** ("the board is about conviction", file comment). Already consumed by `components/Leaderboard.tsx` under the `"alignment"` scope (`Scope = "global" | "friends" | "alignment"`, line 26; calls the RPC with `per_side: 25`, line 303).
- **Finale titles.** 5 `source='season'` titles seeded (`halo_bearer_2026`, `goblin_king_2026`, `gilded_2026`, `schism_survivor`, `calm_in_the_storm`); the `titles_source_check` already allows `'season'` (`20260526000000_finale.sql:11–25`).
- **Announcement plumbing.** `system_announcements (id, user_id, kind, title, body, data, dispatched_at, seen_at)` (`supabase/migrations/20260556000000_system_announcements.sql:25`). **`kind` is plain `text NOT NULL` — no CHECK constraint** (verified), so a new `kind='judgement_day'` needs no enum/constraint migration. Surfaces via `my_unseen_announcements()` → `WhileAwayModal`, dismissed by `mark_announcement_seen(bigint)`. Inline INSERT precedent: `20260595000000_barn_visit_mutual.sql:58`.

## What's needed 🔨

### New storage: the collective side result
A table keyed by season (not by user), so the village outcome is queryable independent of any one player's row:

```sql
CREATE TABLE IF NOT EXISTS public.season_side_results (
  season_key      text PRIMARY KEY,
  winning_side    text NOT NULL,          -- 'generous' | 'greedy' | 'tie'
  generous_count  int  NOT NULL,
  greedy_count    int  NOT NULL,
  generous_conv   bigint NOT NULL,        -- SUM(alignment_score) WHERE score > 0
  greedy_conv     bigint NOT NULL,        -- SUM(abs(alignment_score)) WHERE score < 0
  margin_pct      int,                    -- winning side's share of the decided metric, e.g. 58
  decided_at      timestamptz NOT NULL DEFAULT now()
);
-- RLS: enable, SELECT to authenticated (it's a public village fact —
-- contrast season_finales, which is per-user-private). Reads still go
-- through the SECURITY DEFINER read RPC below for the live/frozen merge.
```
Add a nullable `won_side boolean` column to `season_finales` so each player's row records whether *their* side won — drives the winning-side bonus + the modal copy without a re-join. (Verified: `won_side` / `side_won` / `season_side_results` / `season_side_standings` do **not** exist yet — clean adds.)

### The migration (respect the footguns)
**Carry-latest-def.** `finalize_season` and `my_finale_result` must be re-authored with `CREATE OR REPLACE` **from the current live definitions** in `20260526000000_finale.sql` — never from a stale base — or the idempotent insert / `IF FOUND` reward gate / alignment-wipe silently regress (the build-93 referral-gate lesson, `project_carry_latest_def_footgun`). The migration file must be timestamped **alphabetically after** `20260649000000` (the latest applied) to avoid a `schema_migrations.version` PK collision (CLAUDE.md DB rule).

Extend `finalize_season` to, **after** the per-player loop and **before** the alignment wipe (alignment is read by both the loop and the tally, so the wipe must stay last):
1. Aggregate the sides over `profiles` using the **same** `username IS NOT NULL AND username <> ''` predicate the loop and `alignment_leaderboard` use, so the tally and the board agree: `COUNT(*) FILTER (WHERE alignment_score > 0)`, `SUM(alignment_score) FILTER (WHERE alignment_score > 0)`, the mirror for `< 0`.
2. Decide `winning_side` by the **chosen tally metric** (see Decisions — recommended: **conviction-sum**, with the tie rule below).
3. `INSERT INTO public.season_side_results (...) ON CONFLICT (season_key) DO NOTHING` and capture `IF FOUND` into a local `side_first_run boolean` — this is the **single idempotency gate** for everything collective.
4. Inside `IF side_first_run`: `UPDATE public.season_finales SET won_side = (side = winning_side AND winning_side <> 'tie') WHERE season_key = <key>`; then for each winning-side player add the **winning-side bonus** to `profiles.counter` (server-authoritative, gated by `side_first_run` so a re-fire never double-pays — the visit cash-faucet lesson); then fan out the inlined announcement (below). All four are inside the same gate → a re-run is a complete no-op.

**Inline the announcement.** The "your side won/lost" push is fanned out as direct `INSERT INTO public.system_announcements (user_id, kind, title, body, data)` rows inside `finalize_season` — **never** via `send_system_announcement()`, which raises `admin_only` and silently rolls back for non-admins (`project_admin_gated_announcement_footgun`). Use `kind='judgement_day'` (no CHECK to extend); `data` carries `{winning_side, margin_pct, won_side}`.

**Two surfaces, one moment (surfacing collision — must decide).** A generic `system_announcements` row surfaces in the **`WhileAwayModal`** (via `my_unseen_announcements()`), *not* in `JudgementDayModal`. The personal verdict surfaces in `JudgementDayModal` (via `my_finale_result()`). If we both extend `my_finale_result()` *and* inline an announcement, the user sees the village result **twice** (once in each modal). Two clean resolutions:
- **(A, recommended) Rich reveal in `JudgementDayModal`.** The inlined `system_announcements` row exists for the **push + the untokened / never-foreground backstop only**; the in-app village block renders inside `JudgementDayModal` off the extended `my_finale_result()`. To kill the double-card, `mark_finale_seen` also stamps `seen_at` on that season's `judgement_day` announcement for the caller (one extra UPDATE in the existing RPC, scoped to `kind='judgement_day' AND data->>'season_key' = <key>`). Net: push reaches everyone; the rich reveal lives in one modal; no duplicate WhileAway card. Costs one modal change but is the dramatic, designed surface.
- **(B, cheaper) Village result rides the WhileAway card only.** Don't extend `my_finale_result()`; let the inlined announcement render in `WhileAwayModal` as its own card. Zero `JudgementDayModal` change, but the personal verdict and the village result appear in **two different modals on the same foreground** — a weaker beat. Pick A unless modal time is the constraint.

### New read RPC for the build-up + reveal
```sql
season_side_standings(season_key text default 'season_1') RETURNS jsonb
-- granted to authenticated; STABLE SECURITY DEFINER; SET search_path TO 'public'.
-- If a season_side_results row exists → return the FROZEN row (post-finalize).
-- Else → compute the LIVE tally (counts + conviction + margin_pct) for the meta-bar.
-- Single source of truth for the meta-bar AND the side-board header, before and after.
```
`my_finale_result()` gains `won_side` + `side_bonus` (the bonus amount, 0 if not on the winning side) in its returned jsonb so the modal renders the village layer without a second call. Re-author it **carry-latest-def** from the live body (line 128).

### Client changes
- **Meta-bar** — `components/FactionMetaBar.tsx` on the season surface, reading `season_side_standings`: two-color fill bar, percentage, countdown to noon UTC finale day. Poll on focus + AppState `active`, mirroring the `my_finale_result` poll in `app/_layout.tsx` (lines 196–216).
- **Side leaderboard** — extend the **existing** `"alignment"` scope in **`components/Leaderboard.tsx`** (not `leaderboard.tsx`; that file does not exist) with a side-vs-side header showing the contested margin from `season_side_standings`. The scope and RPC call already exist (lines 26, 303); this is header-only.
- **`JudgementDayModal`** — add a village-outcome block under the personal verdict: side-result line, your-side-won/-lost state, the bonus row. The `FinaleResult` interface (line 30) gains `won_side: boolean` + `side_bonus: number`.
- **Verdict Card** ([[virality-and-growth-loops]]) — add the "my side carried the village" faction line + banner art. Couples to the bet-4 share work; **do not** ship a bare in-app Share button (the research: ~99.8% ignored).

## Decisions — recommendations, not open questions

The first build of this is decision-ready; only the starred items are genuine product judgment to confirm.

- **Tally metric → recommend conviction-sum (with the tension named).** Win by `SUM(|alignment_score|)` per side, not headcount. Rationale: the [[alignment]] teeth already reward conviction (linear regen to ±10%, specialist bless/curse); conviction-sum reads off the same axis players already feel, and stops a passive +1 majority from silently outvoting an engaged minority. **Tension:** the "village *vote*" copy framing ("60% Generous") implies one-person-one-vote (headcount), so conviction-sum can make the displayed % disagree with a naive headcount — a player can be on the larger headcount and still lose. Surface this in copy ("the village leaned Generous by conviction") and *store **both** count and conviction* in `season_side_results` so `margin_pct` can be re-derived either way **without a migration**. ★ confirm — this is the one genuine product call.
- **Neutrals → recommend exclude from the denominator.** Bar and `margin_pct` are Generous-vs-Greedy only (matches `alignment_leaderboard`, which omits neutrals "because the board is about conviction"). "60% Generous" then means 60% *of the decided vote*, which is honest and consistent with the existing board. Neutrals still get their `calm_in_the_storm` title + 100 snouts (unchanged) and a *"the village split 58/42 — you kept the balance"* modal line.
- **Tie → recommend `winning_side='tie'`** when the decided metric is within a small epsilon (e.g. < 2% margin, plausible at ~27 users): no banner, no side-bonus, modal shows an honest draw. Cleaner than a coin-flip; avoids minting a bonus off noise.
- **Winning-side bonus → recommend flat +150 snouts, one-shot, conviction-gated by `side_first_run`.** Below the top10 reward (250) so it never eclipses individual achievement; modest faucet. Model against the no-sink problem in [[snouts-economy]] (every payout is a faucet; the `20260648` visitor fix needed a cap + anti-collusion gate — here the gate is structural: one season-keyed insert, paid once, to a bounded set).
- **New title → recommend NO new title for v1; banner-only flex.** Cheapest, and the `victors_of_2026`-style cosmetic can be added later (the `'season'` source is already allowed). Avoids a new seed in the load-bearing migration.
- **Banner persistence → recommend `season_side_results` as the single source of truth.** App start (or the season surface) reads `season_side_standings` for the *most recent finalized* season and flies that banner. No separate config row to drift.

## Effort + sequencing (each step has an exit/DoD)

**MED–HIGH overall. POST-LAUNCH, Season 2 — hard-gated.** A side-war is dramatic only with population; at ~27 beta users a "58% to 42%" split is ~9 vs ~6 *engaged* (neutrals excluded) and the meta-bar reads thin. Gate behind the App Store launch + the retention work in [[virality-and-growth-loops]].

0. **(GATE)** Do not start until: App Store listing live, and retention bets 1–3 in [[virality-and-growth-loops]] shipped. *Exit: sounder ≥ ~100 named profiles, or an explicit user override.*

   **De-risk the gate without breaking it — the backend-only dry run.** Steps 1–3 are pure server work and can land **before** the population gate, *dark*: ship the migrations + read RPC, but leave the client meta-bar/modal block behind a flag (the codebase already uses dark flags like `SOUNDER_VISIBLE` and `20260575000000_leaderboard_flag.sql`). At the *next* season finale, the cron then writes a real `season_side_results` row and pays bonuses to the 27 betas — a true production dry-run of the load-bearing step-2 idempotency + economy logic, observed in prod, with **no player-facing drama** to fall flat at thin N. Only flip the client on once the gate's population condition is met. This separates "is the migration correct" (testable now) from "is the drama big enough" (needs N), so the risky code is battle-tested before it ever has an audience.
1. **(LOW)** Migration A: `season_side_results` table (+ RLS) + `season_finales.won_side` column. Pure additive. *DoD: migrates clean on a copy of prod; `season_side_standings` (stub) returns a live tally; timestamp > `20260649000000`.*
2. **(MED, load-bearing — review hardest here)** Migration B: extend `finalize_season` (carry-latest-def from the live `20260526` body) with the tally + `side_first_run`-gated side-result insert + winning-side bonus + inlined `judgement_day` announcements; extend `my_finale_result` (carry-latest) with `won_side` + `side_bonus`; extend `mark_finale_seen` to also mark the season's `judgement_day` announcement seen. *DoD (run on a seeded copy, NOT prod): (a) first call writes one `season_side_results` row, pays each winner once, fans out N announcements, wipes alignment; (b) **second call is a total no-op** — 0 new side rows, 0 new snouts, 0 new announcements, `won_side` unchanged (the critical idempotency test); (c) a tie season pays no bonus and flies no banner.*
3. **(LOW)** Finalize `season_side_standings` read RPC. Grant to authenticated. *DoD: returns the live tally pre-finalize and the frozen row post-finalize, identical shape.*
4. **(MED)** Client: `FactionMetaBar`, side-leaderboard header (`components/Leaderboard.tsx`), `JudgementDayModal` village block, no duplicate WhileAway card. *DoD: meta-bar + countdown render off `season_side_standings`; modal shows the village block exactly once.*
5. **(MED)** Verdict Card faction flex + next-season banner — couples to the [[virality-and-growth-loops]] share work. *DoD: card renders the faction line; banner reads from `season_side_standings`.*
6. **(LOW, before any real next-season finale)** Schedule `finalize_season('season_2')` as its **own** cron job/key and confirm the season-1 job is unscheduled or accepted as a permanent no-op (see Risks).

## Success metrics (how we know the schism landed)

Measured Season-2-with-schism vs the Season-1 per-player-only baseline (or A/A-style against the prior season's curve). *Instrumentation note: there is no analytics RPC today; the cheapest source is `profiles.alignment_updated_at` (bumped on every `shift_alignment`) for the action-lift signal, plus a lightweight client event or a per-RPC hit counter for the meta-bar/share signals — spec the counter in step 4 if analytics aren't otherwise wired.*
- **Last-week alignment-action lift.** Count alignment-changing actions (trade fulfils, bless/curse) in the final 7 days vs the preceding 7 days, e.g. via `alignment_updated_at` movement or ritual-log rows. *Target: a visible final-week spike vs the flat per-player baseline.* This is the core "does the meta-bar create a scramble" signal.
- **Meta-bar engagement.** Distinct users opening the season surface / side-board in the final week (client analytics or an RPC hit count). *Target: > the season's median weekly leaderboard opens.*
- **Verdict-card share rate.** Share-sheet invocations off the finale card / total finalized users. *Target: any non-trivial rate — the research baseline for un-prompted shares is near-zero, so even low single digits is signal.*
- **Guardrail: zero economy/idempotency regression.** Post-finale, exactly one `season_side_results` row per season; total winning-side bonus minted = `150 × winners` and no more; no user's `counter` moved twice. Auditable by a single query after the cron fires.
- **Guardrail: cozy sentiment.** No spike in "this feels mean / trash-talky" beta feedback (the schadenfreude tripwire below).

## Risks / open questions

- **Population is the whole risk.** Drama scales with N. Shipping to a thin sounder makes Judgement Day feel *smaller*. *Mitigation:* the step-0 hard gate (sounder ≥ ~100 or explicit override).
- **Conviction-tally × the teeth.** With conviction-sum, the [[alignment]] teeth (Greedy = better curser, Greedy redemption +3) become side-war strategy. *Mitigation:* the existing `curse_cap` (`20260634000000_curse_cap_three.sql`) + one-ritual-per-day cap (`20260534000000`) already bound last-day curse-spam; re-confirm those caps hold under side-war incentives before launch. If a degenerate meta still appears, fall back to headcount (both metrics are stored, so this needs no migration).
- **The cron hardcodes `'season_1'`.** Next July it re-fires `finalize_season('season_1')` — idempotent no-op for finalized users, so it will **not** finalize a real Season 2 *and will not write a `season_2` side result.* *Mitigation:* step 6 — schedule a distinct `finalize_season('season_2')` job/key; do not rely on the season_1 job. Already flagged in [[seasons-and-judgement-day]].
- **Idempotency across two writes.** The per-player loop and the new collective writes must *both* no-op on a re-fire. *Mitigation:* the `side_first_run` gate (the `ON CONFLICT (season_key) DO NOTHING` + `IF FOUND` on the single side-result insert) wraps the bonus, the `won_side` backfill, and the announcement fan-out — one gate, tested explicitly in step-2 DoD (b).
- **Two-surface double-card.** Without the auto-mark-seen, the village result shows in both `JudgementDayModal` and `WhileAwayModal`. *Mitigation:* `mark_finale_seen` also stamps the season's `judgement_day` announcement seen (above). Verify in step-4 DoD.
- **Live-tally cost.** `season_side_standings` does a full-table aggregate per call. *Mitigation:* fine at 27–100 users; the predicate hits an indexable `alignment_score <> 0`. If it ever bites, memoize the live tally for ~60s (it changes slowly) or back it with a tiny materialized counter updated in `shift_alignment` — defer until N warrants it.
- **Cozy guardrail.** "War" framing can tip into the schadenfreude the cozy promise forbids ([[virality-and-growth-loops]]: the vector is a *warm* identity artifact, not trash-talk). *Mitigation:* copy reads as village pageant ("carried the village", "kept the balance"), never "you lost / they're losers"; losing side gets a dignified line, not a taunt. Tracked as a success-metric guardrail.
- **Destructive once-a-year RPC, no human in the loop.** The cron wipes alignment with no review. *Mitigation:* test step-2 on a **seeded copy, never prod**; the `SELECT cron.unschedule('judgement-day-season-1')` escape hatch stays documented; DB push waits for explicit user "go" (CLAUDE.md).

## Connects to

- [[seasons-and-judgement-day]] — the finale system this extends; the per-player half stays intact.
- [[alignment]] — the score both the per-player ranks and the new collective tally read; resets to 0 after.
- [[virality-and-growth-loops]] — the Verdict Card faction flex + the Helldivers community-meta-goal pattern; the retention-before-virality gate this plan obeys.
- [[snouts-economy]] — the winning-side bonus is a new faucet to model against the no-sink risk.
- [[achievements-and-titles]] — finale titles + an optional later `victors_of_2026` side title.
- [[sounder-mud-fights]] — the existing *competitive* community surface; this is its cozy seasonal cousin.
- [[identity-model]] — "which side am I, did my side win" deepens the player's self-concept.
- [[notifications]] — the noon-UTC village-outcome push (inlined `system_announcements`, never `send_system_announcement`).
- [[judgement-day-plan-a-quiet-reckoning]] — the cozy/inward sibling (personal reckoning, no side war).
- [[judgement-day-plan-c-living-almanac]] — the persistent-history sibling (the almanac that would record each season's side result).
