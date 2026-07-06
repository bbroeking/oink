# Mud Wars — Founder Decisions (2026-07)

**Purpose:** the Mud Scuffle / Mud Wars Season-2 work is blocked on a handful of decisions only Brian can make. This doc gathers each one — options, tradeoffs, what it gates, and the **verified current code reality** — so they can be resolved in one pass. Everything is grounded against `main` + open PRs **#22** and **#23** as of 2026-07-07; code claims cite `file:line`.

> How to use: for each **OPEN** decision, pick an option (or amend). **SETTLED** ones are shown only so they aren't re-litigated. Nothing here changes code — deciding unblocks the build.

---

## TL;DR — what actually needs a decision

| # | Decision | Status | The ask |
|---|----------|--------|---------|
| 1 | **Payout model** — raw snouts vs war-token | 🟡 **OPEN** | Confirm `resolve_war` should mint `golden_truffles` (war-token) instead of tickles. |
| 2 | Crew permanence | ✅ Settled (permanent) | — |
| 3 | War cadence | ✅ Settled (7-day: 2 Tend + 5 Hold) | — |
| 4 | **v1 co-op mechanic** — Fort / Heap / Truffle / none | 🟡 **OPEN** | Rhythm war is v1 (locked). Pick which co-op layer (if any) ships with the flip. |
| 5 | **Finale moment + flip timing** | 🟡 **OPEN** | Define the S2 "last feast" trigger; pick the `mud_wars` flip date/gate. |

**Three real decisions:** #1 (payout), #4 (co-op choice), #5 (finale + flip timing). #2 and #3 are already locked in code.

### Flip preconditions — updated status
The four original blockers on flipping `mud_wars` to a cohort:

1. ~~Sounder→Drove/Friends naming~~ — ✅ **done in PR #22** (`20260706900000`).
2. **Economy isolation (payout)** — 🟡 still open → **Decision #1**.
3. ~~Population flip-trigger metric~~ — ✅ **done in PR #22** (`war_population_ready()`, `20260706700000`).
4. **Launch coupling / finale** — 🟡 still open → **Decision #5**.

Plus the former UI gap (leader redeploy picker) is ✅ **done in PR #22**. So **preconditions 2 and 4 are the only code-blockers left, and both are founder decisions, not build work.**

---

## 1. Payout model — raw snouts vs war-token 🟡 OPEN

**Options**
- **A — Raw snouts (status quo):** `resolve_war` keeps minting tickles into the core balance. Fastest, but leaves an uncapped faucet feeding the main leaderboard.
- **B — War-token (`golden_truffles`) — recommended:** `resolve_war` mints `golden_truffles` (war-only, redeemable at the Truffle Exchange) instead of tickles. Closes the economy wall; ties payout to the visible Exchange (the **Collect** pillar).

**Tradeoff:** A = one less migration but the war economy leaks into the core economy; B = one migration to swap the mint + gate house-bot wins to cosmetic/title-only, but the war economy is cleanly isolated.

**Gates:** the entire war-token redemption loop; flip precondition #2. This is the **highest-leverage** decision — the reward spec forks on it.

**Memo recommendation:** war-token from the flip — *"profiles.golden_truffles / war_truffles that resolve_war mints instead of raw snouts; keep any core snout payout capped/contribution-gated; gate house-bot wins to cosmetic/title only."* (`mudwar-whats-next-2026-07`)

**Current code reality:**
- Infra is **built and dark:** `profiles.golden_truffles` (cap 999) + `war_truffles` ledger + `mint_truffles()` helper (`20260704100000`), and the Truffle Exchange (`exchange_week_stock()` / `redeem_war_cosmetic()`, `20260704300000`).
- **But** the latest `resolve_war` (`20260706400000`) still mints **tickles** (`grant_tickles` + `tickles_earned`), *not* `mint_truffles()`. Bot wins grant flat tickles.
- **So:** the wall is built but not wired in. Choosing B = swap the mint call in `resolve_war` (a `CREATE OR REPLACE` carrying the latest body — the scoring math itself doesn't change, so low-risk, but **Brian should review** since it edits `resolve_war`).

---

## 2. Crew permanence — permanent vs per-war ✅ SETTLED (permanent)

**Decision:** permanent crews. *Recommended by the plan; founder language ("invite your friends to form a clan") reads permanent; per-war would break Phase-2 set-completion + Heirloom evolution.*

**Current code reality — matches:** `crew_members` has a unique index on `(user_id)` (one crew per user, `20260647:51`), `crews` rows persist across wars (no resolve-time teardown), and the crew-admin verbs (kick / transfer / disband / rename) + `one_sounder_invariant` (`20260706600000`) all assume a durable roster. **No action needed** — noted so it isn't reopened.

---

## 3. War cadence — 3 vs 5 vs 7 days ✅ SETTLED (7-day)

**Decision (de facto, by shipped code):** a **7-day clock** = 2-day Tend (build) + 5-day Hold. The June-plan "5→3 swap" was never implemented.

**Current code reality:** `constants/mudFights.ts` — `WAR_LENGTH_DAYS = 5`, `WAR_LENGTH_DAYS_FRONTS = 7`; `challenge_house` / `accept_challenge` inline `interval '7 days'` at war creation (`20260668`). Changing to 3 days would mean editing those three sites + re-testing.

**The only residual ask:** if Brian still wants the 3-day cadence from the June plans, it's a small but explicit change. Otherwise **7-day stands** — treat as settled unless he says otherwise.

---

## 4. v1 war-mode + co-op choice 🟡 OPEN (rhythm locked; co-op layer undecided)

**Locked:** the **rhythm war is v1** (shipped, dark: `submit_run()`, `grant_war_access()`, rhythm fold in `score_mud_war_days()`, `RhythmDefense.tsx`; gated on `mud_rhythm_on()` + the `mud_wars` flag). The direction logged 2026-07-03 is a **hybrid: Option A's structure (rhythm duel, 7-day) narrated as Option C's story** (race the Hungerer, everyone-keeps-something), with Golden Truffles as the economy. So the A/B/C "which mode" question is effectively resolved to **A-shaped**.

**Still open — which co-op layer (if any) ships with the flip:**
- **Mud Fort (scope A) — lightest:** a derived cosmetic stage rendered off existing per-capita war metrics (`FORT_TIERS`). No new tables/RPCs; ~client + art only.
- **Truffle Hunt:** re-points the existing truffle/dig stack at a buried war-truffle needing N distinct diggers; kept artifact = permanent title. Small server addition.
- **Mud Heap / Slop Bucket:** larger, net-new (tables + RPC + component). Designed-only.
- **None for v1:** flip with the rhythm war alone; add a co-op layer post-launch.

**Tradeoff:** Fort = cheapest visible "we built something together" beat; Truffle Hunt = leans on the already-built dig economy; Heap/Slop = most novel but most build; None = fastest flip.

**Gates:** Phase-1 ship scope. Whatever's chosen is the only remaining *mechanic* work before flip; everything else Phase-1 is done.

**Current code reality:** Truffle **Dig** (the Golden-Truffle heartbeat minigame) is **built** (`20260704100000` + in-app UI). Mud Fort / Heap / Slop / Truffle Hunt are **not in code** (designed-only). Bog Weather modifiers are **stored but display-only** (no gameplay effect yet).

**Recommendation (from memos):** ship **Fort** (or **none**) for the flip; keep the heavier co-ops as post-launch live-ops.

---

## 5. Finale moment + flip timing 🟡 OPEN

**Two coupled questions:** (a) what is the Season-2 finale *moment*, and (b) when/how does `mud_wars` flip on.

**Settled parts:**
- **Season 1 keeps Judgement Day** — cron scheduled Jul 13 00:00 UTC (`20260704500000`), fires `finalize_season('season_1')`. Live.
- **Season 2 has no Judgement Day** (decided 2026-07-03, `SKILL.md`). Its clock is the Great Hungerer's energy meter.

**Correction to prior notes:** the **Great Hunger meter is built**, not designed-only — `hunger_meter()` (`20260704200000`) derives a season-wide gorged→famished drain (6 stages) from all war contribution, read-only, dark behind a new `world_boss` app-config flag; `GreatHungerIntroModal` + `HungerStageChip` exist. What's **missing** is the **finale trigger** — there's no cron/event for "the last feast" when the meter bottoms out or the season ends.

**Open decisions:**
- **Finale shape:** does "the last feast" fire on a **date** (like JD), on the **meter hitting famished**, or a **manual** call? (No trigger coded yet.)
- **Flip timing/gate:** the `mud_wars` flip is currently a **manual server toggle, deliberately decoupled** from the JD cron (`20260706500000` killed the auto-flip; `snout_season_2` end is a placeholder). Gate the flip on the **population metric** (`war_population_ready()` now exists — PR #22) and/or on S1's JD finishing (Jul 13)?

**Tradeoff:** date-based finale = tight narrative + countdown tension; meter-based = collective, no fail state, but timing is emergent. Flip-at-population-gate = data-driven, safe; flip-on-a-date = clean marketing moment.

**Gates:** the season calendar, the finale message, and precondition #4 (launch coupling).

**Recommendation:** flip is **manual, gated on `war_population_ready()` returning `ready` after S1's JD (Jul 13)**; finale = meter-driven "last feast" with a manual trigger for control. Needs Brian's confirm + a finale-trigger migration once shaped.

---

## What unblocks the flip after these decisions

With #2/#3 settled and preconditions 1 & 3 + the redeploy UI already done (PRs #22/#23), the remaining path is:

1. **Decision #1** → if war-token: swap `resolve_war`'s mint (1 migration, Brian-reviewed).
2. **Decision #4** → build the chosen co-op layer (Fort = client+art; None = zero).
3. **Decision #5** → finale-trigger migration + set the flip gate/date.
4. Then flip `mud_wars` from Brian-only → bounded cohort → global.

Memo estimate to cohort flip: **~12–16 solo dev-days**, most of which is Decision #1 + #4 + #5 execution.

---

## Sources
- Memos: `mudwar-whats-next-2026-07`, `mudwar-consolidated-brief-2026-07`, `mudwar-rewards-spec-2026-07`, `mudwar-scope-{a,b,c}`, `team-clan-mud-wars-plan`, `mudwar-challenge-options-2026-07`.
- Code (main + PRs #22/#23): migrations through `20260707100000`; `constants/mudFights.ts`; `SKILL.md` decision log (2026-07-03).
