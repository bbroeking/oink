# Mud Wars — clan layer design

> Living design doc. Driven by a self-paced `/loop`: each iteration appends to the
> **Iteration log** at the bottom and rewrites the **Next prompt**. The success
> test is the user's three pillars (below) — we keep iterating until the design
> makes all three true, then spec it, then build it end-to-end behind the existing
> `MUD_FIGHTS_VISIBLE` flag.

## The three pillars (the rubric)

A clan war feels good iff:

1. **Strategy-predominant meta.** The outcome is decided mostly by *decisions*, not
   by raw activity or twitch alone. There are real choices with tradeoffs and an
   opponent to read.
2. **Coordination is required and *amplifying*.** You can't win solo; a coordinated
   clan doesn't just *add up* its members — coordination *multiplies* the objective
   significantly. Five people on a plan ≫ five people doing their own thing.
3. **Normalized floor + skill ceiling.** Every member is leveled to a common baseline
   before and during the war (no pay-to-win, no grind advantage). But individual
   *skill* lets a person swing their team's outcome more than their headcount share
   would suggest.

## Where we are (what's already built — do NOT rebuild)

The server-side mode already ships (dark-launched; UI gated by `MUD_FIGHTS_VISIBLE`).

| Piece | State | Pillar relevance |
|---|---|---|
| **Crew** (player-facing "Sounder") | 5-member cap, leader+members, built from the friends graph, one crew per user. Tables `crews`/`crew_members`/`crew_invites` + lifecycle RPCs. | The coordination unit. |
| **War** | 5-day head-to-head between two crews, or vs the house bot ("The Mudlarks"). Challenge → accept → active → resolved. | The contest frame. |
| **Slop Toss minigame** | Timing skill: hold the bucket, release as a goblin crosses the strike zone. Bands whiff/weak/good/perfect → 0/1/2/3 mud. 7 throws/day, 21 mud/day cap per player. Goblin archetypes (grunt/scout/brute/warboss) vary speed × value. | **Pillar 3 skill ceiling — already good.** |
| **Normalization** | No buffs, no VIP, no regen, no consumables apply inside a war. Flat 7 throws/day for everyone. | **Pillar 3 floor — already done.** |
| **Win condition (Phase 1b, held for review)** | Daily-tug rope: each completed UTC day, the per-capita mud margin nudges a rope ±notches (cap ±4/day); rope to ±12 = early "rout"; else rope side at day 5 wins. Per-day quorum of 2 active. | A single global tug — thin on strategy. |
| **Rewards** | Snout pot (50% of loser's mud split among active winners), 72h regen buff, titles (`mud_champion`/`veteran`/`legend` by `war_wins`), 1 random war-exclusive cosmetic from a 25-item pool. | Stakes. |

### Honest scorecard of the *current* design vs the pillars

- **Pillar 1 (strategy): ~2/10.** The only decision is "who do we challenge." Inside a
  war there are essentially no choices — everyone throws their 7/day whenever, mud is
  summed per-capita, rope moves. No allocation, no timing-of-spend, no targeting, no
  reading the opponent. This is the biggest gap.
- **Pillar 2 (amplifying coordination): ~3/10.** Coordination today is *additive* with a
  floor: you need 2+ active members and more active members add more mud, but five
  coordinated players produce the same total as five uncoordinated ones. There is no
  multiplier for working together. The user explicitly wants coordination to *amplify
  significantly*.
- **Pillar 3 (normalized + skill): ~8/10.** Normalization is fully built. Skill swings
  personal output ~3× (a perfect-hitter banks ~21/day vs a sloppy ~7–10). Gap: skill
  isn't yet legibly tied to the *team* outcome, and there's no "caller/spotter" skill —
  only twitch timing.

**The job:** lift pillars 1 and 2 hard, without touching the pillar-3 foundation, and
add the persistent "list of clans with relative strength" the brief asks for.

## The design direction (v1 north star)

Three additions, layered on top of everything above:

### A. Clan = identity + ladder unit; War Party = the 5-person coordination unit

The brief says "create clans" and "a list of clans with relative strength." That reads
bigger than a 5-friend crew. Proposed reconciliation that serves *both* the ladder
and pillar 2 (coordination amplifies best at small N):

- A **Clan** is a persistent, named, joinable org with a roster and a **rating** (its
  relative strength). It's the social-identity and leaderboard unit — "the list of clans."
- A **War Party** of ≤5 is drawn from the clan's roster each week and is who actually
  fights. The party is small enough that real coordination is possible and *amplifies*.
- The party's weekly result moves the **clan's** rating. Bigger clans get *depth*
  (bench players with fresh throw budgets to rotate in) but can never field more than 5
  at once — so headcount never breaks normalization or dilutes coordination.

**v1 simplification (decision pending):** collapse clan==crew (the existing 5-cap crew
*is* the clan) and just add a persistent rating + ladder. Grow the org/bench layer in v2.
This is open fork **Q1** below.

### B. Fronts — the strategy engine (a repeated Colonel-Blotto over the week)

Replace the single global rope with **3 fronts** the goblin horde attacks each day —
e.g. **the Truffle Field**, **the Bog Bridge**, **the Village Gate**. Each front has:

- a daily **horde pressure** `P` (the mud needed to *hold* it that day; scales with siege
  day and opponent rating), and
- a **value** `V` (rope notches banked toward the war if you hold it).

Each day, the clan's limited mud (5 × 21 = 105 max, realistically ~50–80) must be
**committed across the fronts**. A front is **held** if the clan's mud on it ≥ `P`; held
fronts bank their `V`; the *opponent* is simultaneously allocating against the same
fronts, so each day is a head-to-head allocation round. Five daily rounds = a *repeated*
Blotto game with carry-over information → reads, bluffs, adaptation. **This is the
strategy.** (It also naturally generalizes the held daily-tug rope: per-front sub-ropes
instead of one.)

**The amplification lever (pillar 2):** make convergence *super-additive* and dispersion
*sub-additive*.

- Mud below `P` on a front banks **nothing** (you didn't hold it). So 30 mud spread
  10/10/10 across three fronts can hold *zero* fronts, while 30 mud concentrated past `P`
  on one front holds it.
- Holding a front with a **margin past a concentration threshold** converts the overkill
  into a **rout bonus** (extra notches) on that front. So a focused, coordinated clan
  banks *V + bonus*; a scattered clan banks ≤ V or nothing.
- Net effect: a clan that agrees on a plan and focuses can produce *multiples* of what the
  same five players produce throwing wherever — exactly "coordination amplifies the
  objective significantly."

The **leader sets a battle plan** (suggested mud per front); members throw into their
assigned front. Following the plan = amplification; absence/defection = a leaked front.

### C. Ladder + weekly cadence + siege modifiers (relative strength + freshness)

- **Clan rating** (seasonal, Elo-flavored): beating a stronger clan gains more; losing to a
  weaker one costs more. Resets each season. This *is* the "relative strength based on what
  they win in a timeframe." Surfaced as a **clan leaderboard** (the "list of clans") and a
  per-clan banner/tier.
- **Weekly cadence:** wars run on a fixed weekly clock (matches the brief's "cooperate better
  than your clan opponent for that week"). Challenge a specific rival, or get matched to a
  similar-rated clan.
- **Weekly siege modifier:** a rotating rule (e.g. "Warboss Week — warbosses 3× as common &
  double value"; "Fogged Gold — the perfect zone is invisible, pure feel"; "Two Fronts —
  only 2 fronts but higher pressure"). Keeps the meta from ossifying and forces re-planning
  weekly. Cheap to build (a modifier over SlopToss + scoring + front count).

## Why this makes all three pillars true

- **Strategy (1):** Fronts are a repeated simultaneous-allocation game vs a reading opponent.
  Who to contest, where to feint, when to commit reserves, how to react to yesterday's reveal —
  these decisions dominate the outcome. Siege modifiers force fresh strategy weekly.
- **Amplifying coordination (2):** The concentration/rout-bonus math makes a coordinated focus
  *multiply* output while dispersion wastes it. You literally cannot hold a front without the
  clan converging mud onto it — coordination is *required*, and when done right it amplifies
  *significantly*. The leader's battle-plan + a "caller" reading the opponent is the social half.
- **Normalized + skill (3):** Untouched floor — flat 7 throws/day, no buffs. Skill expresses
  three ways now: (a) timing → mud-per-throw (existing); (b) the marginal skilled thrower is
  the one whose mud pushes a contested front *past* `P` (high leverage on a coin-flip front);
  (c) the caller/leader who reads the opponent's allocation swings the whole party. Skill lets
  an individual affect the team outcome "more than expected" — by holding the front that flips
  the war.

## Open forks (proceeding on the bolded default; redirect any time)

- **Q1 — Clan size/shape.** Default: **clan == the existing 5-cap crew** for v1 (add rating +
  ladder only); grow the org/bench layer in v2. Alternative: build the bigger clan-with-bench
  org now.
- **Q2 — Front allocation visibility.** Default: **commit hidden, reveal at day rollover**
  (true Blotto, more strategic). Alternative: visible live (more reactive/tuggy, less mind-game).
- **Q3 — How members commit mud to a front.** Default: **leader sets a battle plan; each member
  picks which front to throw into** when they open Slop Toss (their 7 throws land on the chosen
  front). Alternative: throws auto-distribute by plan.
- **Q4 — Matchmaking.** Default: **direct challenge OR rating-matched auto-pairing**, weekly.

## v2 — Fronts of the Bog (tournament winner, contested Blotto)

Iteration 2 ran a 5-candidate tournament (31 agents): **Fronts/Blotto**, **Territory map**,
**Role draft**, **Raid windows**, **Supply relay** — each generated, adversarially stress-tested
on all 3 pillars + ops in parallel, math-checked, then synthesized. Scores (out of 40):

| Candidate | Total | S | C | N/Skill | Ops | Verdict |
|---|---|---|---|---|---|---|
| **Fronts (Blotto)** | **22** | 5 | 6 | 6 | 5 | Winner — only one whose amplifier is a real *contest* between two coordinated crews |
| Territory map | 21 | 6 | 6 | 5 | 4 | Best strategy surface, but binary flip makes coordination a *wall* not amplifier (inverts P3); 3-4 new tables + graph traversal |
| Role draft | 16 | 4 | 5 | 4 | 3 | Quarry archetypes are un-aimable RNG; Bannerman = one-member veto; synergy mult breaches skill ceiling or is a rounding artifact |
| Raid windows | 15 | 4 | 3 | 5 | 3 | Surge dies at the clamp; STACK/COMMIT dominant; needs per-throw timestamp ledger the substrate lacks |
| Supply relay | 15 | 4 | 4 | 4 | 3 | Always-chain dominant; per-capita inflates past the 21 floor; skill ceiling inverts |

**Key reframe (the winning insight):** the original v1 Fronts was parallel-PvE vs a *fixed public
threshold P* — the Pillar-2 critic showed that's not a contest. v2 makes fronts **contested
head-to-head**: both crews secretly allocate, and the day's rope movement is the **margin of
fronts-won**, not who clears a bar.

### Fronts of the Bog v2 — the mechanic

- **Board:** each UTC day the cron seeds **3 fronts** from a ~6-front deck. Each shows a public
  **value V ∈ {3,4,5}**; its hold-pressure **P is hidden** (shown as a fuzzy band light/med/heavy),
  revealed only at resolution → allocation is a decision *under uncertainty*, not a solved puzzle.
- **Plan:** any member self-assigns their front (`set_front_plan`); leader may set a default for
  *unassigned* members only (no cross-member writes = no grief). Front **locks at first throw**.
  **One redeploy token per war** (grafted from Raid Windows) re-stamps one member after seeing your
  own live build — a bluff/flex axis.
- **Throw:** Slop Toss **unchanged** (7 throws, 0-3 mud, 21 cap). Mud banks into the member's front.
  **Per-member-per-front contribution capped at 12** (grafted) so no single ace solos a front —
  holding needs 2+ real contributors.
- **Fog:** your own per-front build is live; the **opponent's is hidden until rollover** (RLS + not
  in the realtime publication). **Mandatory post-day recap** ("held Bridge by 3 mud; they stacked
  Truffle") — the contested-margin model is illegible without it.
- **Resolve (cron) — MARGIN rule [corrected in iter 3]:** per front, each side's effective mud =
  Σ min(memberMud, **12**). Above the **concede floor (0.6·P)**, the side with **MORE effMud wins the
  front + banks V** (extra mud keeps helping — this is what makes it a real contest); a near-tie
  (±1 mud) → higher **mean band value** wins (skill tiebreak); both below the floor → conceded.
  `front_margin = yourV − theirV`. ⚠️ The original spec's `smoothstep`-capped-at-V rule was
  **simulated and rejected** — it made fronts a threshold race where clearing the 2 biggest was a
  *dominant* play (Pillar 1 failed). Margin-based winners restore a genuine Blotto dilemma.
- **Rope math (the graft that beats the clamp):** `base_notch = round(per_capita_margin/5)` clamped
  ±4 **exactly as today** (the built floor + raw skill still set the day's sign — keeps partial/
  scattered crews relevant and the bot/quorum path byte-identical). **Then** add a *separate*
  `coord_notch = clamp(round(front_margin/FRONT_SCALE), −2, +2)`. `total = clamp(base+coord, −5, +5)`
  (MAX_NOTCH raised 4→5 so coordination isn't fully eaten by the base clamp). ROUT stays 12; cadence
  5→**7 days**.
- **Locked constants [verified by `scripts/sim_fronts.py`, iter 3]:** 3 fronts, **V = [5, 4, 3]**;
  hidden fuzzy **P ≈ [26, 22, 18]** (±20% jitter, revealed at rollover); per-member-per-front
  **cap = 12**; **FRONT_SCALE = 4**; base ±4, total ±5, ROUT 12, 7-day week.
- **Ladder:** new `crew_ratings` (Elo, seasonal, high-K provisional for first 3 wars), updated in
  `resolve_war` scaled by |rope margin| (rout > squeaker). This is the "list of clans w/ strength."

### Data-model + RPC deltas (from synthesis — held for review, flag-gated)

- New tables: `mud_front_pushes` (per member/day/front pool; RLS own-crew-only, **not** in realtime),
  `mud_war_fronts` (the day's board; `p_exact` revealed only at resolution), `mud_war_plans`
  (assignments; `locked` flips on first throw), `crew_ratings` (the ladder).
- `mud_wars` += `weekly_modifier`, `redeploy_used_challenger/defender`, `crew_rating_delta`.
- `throw_mud` **wire signature unchanged** (band-enum only; anti-cheat intact). Internally: after the
  atomic 7/21 upsert, derive front from `mud_war_plans` (default = crew's lowest-P front, **never** a
  dead Reserve) and write a sibling `mud_front_pushes` row in the same transaction. 12-cap applied at
  fold/read time so the budget clamp stays single-rowed/race-safe. Front is **server-derived**, never
  a client arg — no new forgeable field.
- New `set_front_plan`, `redeploy_member`. `score_mud_war_days` **rewrite** (base path verbatim +
  the new front fold). Cron also **seeds next day's board** at rollover before scoring the prior day.

### Open risks — status after iter 3 simulation (`scripts/sim_fronts.py`)

1. **P1 (genuine dilemma) — ✅ RESOLVED (after a design fix).** The original `smoothstep`-saturate
   rule was simulated and **failed** — `(3,2,0)` was dominant (in both always-wins & never-loses
   sets). Switching to the **margin rule** (more mud wins the front) makes the 3-front [5,4,3] board a
   genuine dilemma: dominant set **empty**, always-wins **empty**, maximin worst −2.0, and a clean
   **5-cycle** best-response loop `(5,0,0)→(0,2,3)→(2,3,0)→(3,0,2)→(4,1,0)→…`. No board expansion
   needed.
2. **P2 (amplification + read) — ✅ CONFIRMED.** Coordinated beats equally-skilled scattered **96%**
   (FRONT_SCALE=4). Reading/countering the opponent is the meta (the 5-cycle); a best-read crew
   out-notches a mis-reader by **~+2 of the ±5 daily cap** (conservative metric — true BR margins ran
   +2…+4). **Mirror draws ~14%** — not perpetual; deck rotation + the weekly modifier break remaining
   symmetry. *(Residual: the +2 read-swing metric is a floor, not tight; fine to revisit in tuning.)*
3. **P2/P3 (FRONT_SCALE) — ✅ TUNED.** Swept {3,4,5,6}×cap{12,15}. **FRONT_SCALE=4, cap=12** is the
   sweet spot: max amplification (coord>scatter 96%) while skill still clearly wins (next line).
4. **P3 (skill ceiling + under-roster) — ✅ CONFIRMED.** Skilled-scattered beats unskilled-coordinated
   **~90%** (coordination does *not* substitute for skill). The 12-cap kills the lone-ace carry. A
   3-active crew reliably holds **exactly one** front (V won = 5.0, never locked out); a 5-active crew
   holds ~2 of 3 (concedes ~1). No headcount lockout at P≈[26,22,18].
5. **Ops — open (unchanged).** Still a multi-table migration + `score_mud_war_days` core rewrite, NOT
   a surgical stamp. Must ship flag-gated with today's per-capita as the off-path; the fog RLS is
   load-bearing for P1 and needs an explicit regression test proving the opponent's unresolved-day
   fronts are unreadable. **This is the next phase.**

## Iteration log

- **Iter 1.** Mapped the build; scored current state (P1≈2, P2≈3, P3≈8); identified the gap as
  strategy + amplifying coordination + a ladder. Proposed v1 north star (Clan/War-Party split,
  Fronts, ladder, weekly modifiers).
- **Iter 2 (tournament, 31 agents).** 5 candidates generated → adversarially stress-tested on all
  pillars → math-checked → synthesized. **Fronts won (22/40)** but only after a critical reframe to
  **contested head-to-head** fronts + a **separate coord_notch** + 6 grafts (redeploy token, sub-notch
  bonus, fog+recap, weekly modifier, mean-band tiebreak, smoothstep+solo-cap). Honest finding: *no
  candidate broke 22/40, and the winner's pillar claims are unproven* — 5 open risks logged above.
- **Iter 3 (this pass — DESIGN VALIDATED).** Built `scripts/sim_fronts.py` and Monte-Carlo'd all four
  open quant risks. **Refuted** the spec's `smoothstep`-saturate resolution (P1 failed — `(3,2,0)`
  dominant), then **found the fix**: margin-based front winners make the 3-front [5,4,3] board a
  genuine dilemma (empty dominant set, 5-cycle BR). Tuned **FRONT_SCALE=4, cap=12**. Verified P2
  (coord>scatter 96%), P3 skill ceiling (skilled-scatter>unskilled-coord 90%) and no under-roster
  lockout (3-active holds 1 front). **All three pillars now hold with locked constants.** Remaining:
  the ops/implementation risk (#5).
- **Iter 4 (BUILD — migration).** Authored `supabase/migrations/20260667000000_mud_war_fronts.sql`
  (4 tables, fog RLS, board seeding, the margin fold, `throw_mud`/`score_mud_war_days`/`resolve_war`/
  `sweep`/`war_state` carried+extended, `set_front_plan`/`redeploy_member`/`crew_leaderboard` RPCs, Elo).
  Flag-gated on `mud_fronts_on()` (false default) so the off-path is byte-identical to 20260666. Ran a
  5-agent adversarial audit (carry-latest / flag-gate / fog-RLS / SQL / design-fidelity) — it caught a
  **fog-bypass blocker** (`war_fronts_state` PUBLIC-callable with a client-supplied `p_caller`), a
  migration-aborting **`row` reserved-word** error, an **`abs(hashtext)` int4 overflow**, missing REVOKEs
  letting anyone tamper the ladder, and a **rounding divergence** from the sim (numeric half-away vs
  Python half-to-even at front_margin ±2). **All fixed**; wrote `scripts/test_fog_rls.sql`. Note: P is
  **decoupled from V** in the seed (a cheap front can roll heavy) — the audit re-confirmed the dilemma
  holds under decoupling and it enriches the uncertainty. HELD FOR REVIEW — not pushed.
- **Iter 5 (BUILD — client + UI + ladder).** Step 2: extended `utils/mudWars.ts` (fronts types +
  `setFrontPlan`/`redeployMember`/`fetchCrewLeaderboard`) and `hooks/useMudWar` (`setFront` optimistic +
  `redeploy`); `constants/mudFights.ts` got the front constants + labels. Step 3: new
  `components/mudwar/FrontBoard.tsx` (recap + 3 contested fronts + tap-to-commit + redeploy status),
  wired above Slop Toss in `app/mud-war.tsx` (the user picked the on-screen board IA). Step 4: new
  `app/clan-ladder.tsx` off `crew_leaderboard`, linked from the Mud Fight header. **Whole feature
  typecheck-clean** (`tsc --noEmit` → 0 errors). End-to-end experience is BUILT and reachable in local
  dev; still HELD FOR REVIEW (no DB push).
- **Iter 6 (BUILD — client hardening).** The client code (which only got a typecheck, vs the migration's
  5-agent audit) got its own 4-agent adversarial review. It caught real bugs, all fixed: **bot-war recap
  showed false (zero) opponent mud** and **the recap held/lost verdict was computed client-side** (ignoring
  the concede floor + band tiebreak) — fixed by extracting a single SQL `fold_front_outcome` helper used by
  BOTH the rope fold and the recap (+ `bot_front_eff` for the bot's scripted mud) and surfacing an
  authoritative per-front `winner`; **the day counter was wrong for 7-day fronts wars** (hardcoded to 5) —
  fixed via `WAR_LENGTH_DAYS_FRONTS`; **a throw didn't update the front board / lock** — fixed by reconciling
  on success; **realtime ignored `mud_war_plans`** (teammate commits/redeploys invisible) — added a second
  subscription; **`setFront` could clobber fresher state** — functional update; plus empty-board / null-recap
  guards and ladder fetch-gate + corrected copy + focus-refresh. Whole feature still **typecheck-clean**.
  Deferred (noted): clan-ladder theme-token polish, an error-vs-empty sentinel, the redeploy action UI.
  Re-audited the iter-6 SQL changes (the `fold_front_outcome` extraction + recap CTE) with a focused
  agent: **clean** — behavior-preserving, and because the rope fold and the recap now share the one
  `fold_front_outcome`, the post-day reveal provably can't contradict how the rope moved.

## Verdict: the three pillars

| Pillar | Status | Evidence |
|---|---|---|
| 1 — strategy-predominant | ✅ | margin-rule 3-front board: empty dominant set, 5-cycle best-response loop |
| 2 — coordination amplifies | ✅ | coordinated beats equally-skilled scattered 96%; reading the opponent is the meta |
| 3 — normalized floor + skill ceiling | ✅ | floor untouched (7/0-3/21); skilled-scatter beats unskilled-coord 90%; no lone-ace carry; no under-roster lockout |

Build phase, step 1 of 4 (migration) DONE + audited. Steps 2–4 (client + UI + ladder) remain.

## Build progress

| Step | Deliverable | Status |
|---|---|---|
| 1 | Migration `20260667…_mud_war_fronts.sql` (tables, fog RLS, fold, RPCs, Elo) + fog test | ✅ authored + 5-agent audited + fixed, **held** |
| 2 | Client data layer — `utils/mudWars.ts` types/wrappers + `hooks/useMudWar` for fronts/plan/recap | ✅ typecheck-clean |
| 3 | War-screen UI — `components/mudwar/FrontBoard.tsx` (board + commit + fog + recap) wired into `app/mud-war.tsx` above Slop Toss | ✅ |
| 4 | Clan ladder screen — `app/clan-ladder.tsx` off `crew_leaderboard`, linked from the Mud Fight header | ✅ |

**Deferred to v2 (noted, not built):** leader redeploy *action* UI (the token + server RPC exist; v1 is self-commit only); weekly-modifier *gameplay effects* (stored + displayed only); front-flavored cosmetics on rout.

**To actually run it:** (1) apply the migration (needs explicit user "go" — never auto-pushed); (2) flip `mud_fronts_on()` → true to activate fronts on new wars; (3) `MUD_FIGHTS_VISIBLE` is already `DEV_PREVIEW` so the UI is reachable in local dev; (4) playtest via the `__DEV__` fast-forward harness.

## Next prompt (fed back into the loop)

> The Fronts of the Bog clan layer is designed (3 pillars sim-validated), built end-to-end (migration +
> client + war-screen board + recap + clan ladder), and typecheck-clean — all HELD FOR REVIEW. The
> remaining work is gated on the user: (1) apply the migration locally (`npm run db:push` only on
> explicit "go"); (2) flip `mud_fronts_on()` → true; (3) playtest in dev via the `__DEV__` fast-forward
> harness — verify the board renders, a throw commits to the chosen front + locks it, the daily fold
> moves the rope by base+coord, the post-day recap reveals both sides, a rout resolves + updates the
> ladder, and the off-path (fronts disabled) is unchanged. If the user wants more before launch, the
> v2 backlog is: leader redeploy *action* UI, weekly-modifier *gameplay effects*, front-flavored rout
> cosmetics, and (Q1 revisited) the larger clan-org/bench layer above the 5-crew. Otherwise the loop's
> goal — a completed end-to-end clan-war experience — is reached.
> mud-war screen as a board above SlopToss, or a separate "battle plan" sheet?
