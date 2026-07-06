# Wiki Maintenance Log

Append-only record of compile / ingest / query / lint operations on this wiki.
Newest entries at the bottom. Format: `## [YYYY-MM-DD] <op> | <what>`. See
[[CLAUDE]] for the four loops.

## [2026-06-13] compile | initial wiki build

Initial compilation of the Tickle the Pig game-design wiki from the repo as raw
source. Created:

- **23 concept pages** across 7 categories — Core Loop & Economy ([[core-loop-and-tickle-trade]], [[happiness-and-mood]], [[regen]], [[streak-and-garden]], [[lucky-pig]], [[barn-and-habitat]]), Social ([[blessings-curses-effects]], [[friends-graph]], [[referral-program]], [[barn-visiting]], [[trough]]), Cosmetics & Progression ([[shop-cosmetics-closet]], [[achievements-and-titles]]), Season & Competitive ([[alignment]], [[seasons-and-judgement-day]], [[world-cup-allegiance]], [[sounder-mud-fights]]), Monetization & Economy ([[snouts-economy]], [[battle-pass-and-slop-club]]), Infrastructure ([[notifications]], [[architecture-seams]]), and Design & Strategy ([[identity-model]], [[design-system]]).
- **2 memos** under `outputs/memos/` — [Future Direction — June 2026](outputs/memos/future-direction-2026-06.md) (strategy + roadmap) and [UI Layout Audit — June 2026](outputs/memos/ui-layout-audit-2026-06.md) (cross-page design-system spec).
- **Meta files** — [[_index]] (catalog by category + memos section), [[_topics]] (taxonomy spined on the SOUL/TRIBE/BANNER [[identity-model]]), [[_glossary]] (domain terms from `CONTEXT.md` + page titles/aliases), and this [[log]].

## [2026-06-13] lint+fix | author missing identity-model page

The initial build's `identity-model` author agent failed to return (one of 23
parallel writers), leaving the page absent while 6+ pages + the meta files
already linked `[[identity-model]]` — i.e. broken links. Gap-filled:

- Authored [[identity-model]] (the proposed Soul/Tribe/Banner frame + the
  "Sounder" naming resolution; `status: draft` since it's a proposal).
- Added it to [[_index]] under Design & Strategy.
- Lint result: **23 concept pages, 0 broken concept-page wikilinks, 0 orphans.**
  (The only unresolved `[[slug]]`/`[[link]]` tokens are literal examples in
  [[CLAUDE]]'s format spec, not real links.)

## [2026-06-13] review+fix | Mud Fights code review filed + HIGH/MED fixes applied

Multi-agent review of [[sounder-mud-fights]] (pre-DB-push): 20 verified findings,
0 refuted. Filed the full report to
[[../outputs/lint/2026-06-13-mud-fights-review]] and applied the fixes in
`20260647000000_mud_fights.sql` + the client (still unpushed):

- 6 HIGH fixed: titles `world_cup` carry-latest-def (migration would've aborted),
  self-blessing CHECK (buff never granted), `war_state`/`war_side` roster leaks,
  two-simultaneous-wars, dead resolved-screen CTA.
- MED economy/auth guards: bot-farm (no leaderboard/title credit for house wins),
  collusion 24h rematch cooldown, crew-cap `FOR UPDATE`, PendingWar error surfacing.
- Updated [[sounder-mud-fights]] risks + [[architecture-seams]]-relevant footgun note.
- Verified: `tsc --noEmit` clean, jest green. pgTAP awaits DB push.

## [2026-06-14] ingest+compile | viral-games research → future-vision page

External-research pass (goal: build out TTP's future vision, grounded in how
viral games actually work). Five parallel research lenses (growth math, case
studies, cozy/pet analogs, out-of-app shareability, retention↔virality flywheel)
with sourced URLs. Created:

- **Memo** [[../outputs/memos/viral-games-research-2026-06]] — the sourced
  external research (the "what does virality look like" knowledge base).
- **Concept page** [[virality-and-growth-loops]] (`status: draft`) — TTP's growth
  model: audits which viral pattern each existing system already instances
  ([[referral-program]], [[barn-visiting]], [[trough]], [[achievements-and-titles]],
  and the unexploited [[alignment]]+[[seasons-and-judgement-day]] "verdict"
  engine) and names the prioritized future bets (visible [[streak-and-garden]]
  Garden → two-sided visiting → a Judgement-Day "Verdict Card" identity artifact →
  App-Clip/deep-link friction-killers). Outward companion to the inward
  [[../outputs/memos/future-direction-2026-06]] sequencing thesis.
- **Meta** — added both to [[_index]] (Design & Strategy + Outputs), [[_topics]]
  (Design & Strategy), and 3 terms to [[_glossary]] (Growth loops/Virality,
  Verdict Card, Viral coefficient).

## [2026-06-14] fix+compile | barn-visit visitor payout (player bug report)

Player report: visited a friend's barn, tapped 4×, watched their count go 1735 →
1739, then snap back to 1735 on leaving ("a cash issue"). Root cause: the visit
screen optimistically `+1`s the visitor's "YOU" tally (seeded from `tickles_earned`,
`BarnVisitModal.tsx:227,299`) but `tickle_at_barn` (`20260646`) credited only the
*host's* leaderboard — the visitor got nothing, so `home_stats` overwrote the
optimism on exit. Wrote `20260648000000_visit_tickles_to_visitor.sql` (carry-latest-def
from 646 + a visitor `tickles_earned` credit, leaderboard-only so visiting mints no
spendable snouts). Updated [[barn-visiting]] (corrected the reward paragraph, added
the bug/fix note + a faucet-watch risk, added the two SQL sources). **Migration
written, pending DB push** (stacks after the also-unpushed `20260647` mud-fights).

## [2026-06-14] revise+review | visit payout → real snouts, adversarial faucet review

Player clarified "cash is the player's cash" → the visit reward must be spendable
snouts, not leaderboard-only. Changed `20260648` so the visitor earns the SAME as
the host (`counter` + `tickles_earned`). Ran a 4-lens adversarial review (filed at
[[../outputs/lint/2026-06-14-visit-cash-payout-review]]):

- ⛔ **BLOCKER (fixed):** the snout credit opened an UNBOUNDED faucet — the 3h
  cooldown only blocks *switching* barns, so re-tapping one barn ran 7/hr with no
  daily cap (~168/day solo, ~336/day for a no-friendship-gate collusion ring).
  Added a per-visitor **20/day mint cap** (reuses the `cooldown` refusal → existing
  nap screen, no client change).
- ⚠️ **Open decisions (flagged, not closed):** a friendship gate (coupled to the
  open stranger-visiting question; a mutual-accept ring defeats the cap alone) and
  whether visit-`tickles_earned` should feed the referral "engaged" +500/+500 gate.
- ✅ Migration-safety clean (carry-latest-def verified, nothing dropped); achievements
  unaffected.
- Reconciled the wiki: [[barn-visiting]] reward paragraph + faucet note, and the
  [[virality-and-growth-loops]] risk bullet that wrongly still said "leaderboard only,
  no snouts." **Still pending DB push + the two product decisions.**

## [2026-06-14] fix+investigate | visit friends-only gate + referral payout trace

Player: "we shouldn't allow non-friends to visit each other" + "250 added to
leaderboard on referral — look into that whole process."

- **Friends-only visiting** (resolves decision #1 in
  [[../outputs/lint/2026-06-14-visit-cash-payout-review]]): added an
  `are_friends(caller, target)` gate to `tickle_at_barn` in `20260648`
  (server-authoritative, returns `not_friends`) and friend-gated the Visit button
  in `components/UserSheet.tsx` (it was shown to ANYONE, incl. leaderboard
  strangers). Resolves the long-open stranger-vs-friend question on
  [[barn-visiting]]. `tsc` clean.
- **Referral payout trace:** every referral reward writes `counter` (snouts),
  NEVER `tickles_earned` (leaderboard) — referral does **not** add to the
  leaderboard, and there is no 250 payout (250 = the Slop Club stipend). Amounts:
  signup +100/+100, engaged +500/+500, code redeem +50, completion +100;
  `tickles_earned` is only the *gate* for engaged (≥50) / completion (≥100). Filed
  the full payout map into the lint review. The `20260648` visit credit is the one
  new path feeding the 50-tickle engaged gate — the single remaining open decision.
  Updated [[barn-visiting]], [[virality-and-growth-loops]], [[referral-program]].

## [2026-06-14] compile | onboarding & in-app guidance design

Player: "look into UI and onboarding improvements — a handful of ways to guide new
users." Audited the current first-run (a once-shown 2-screen carousel in
`Onboarding.tsx` covering only tap→shop, ~10% of the surface) + the reusable
scaffolding (`PopupQueue`, `AchievementUnlockModal` + `try_claim_achievements`,
`SpritePig`/`Sticker`). Created:

- **Concept page** [[onboarding-and-guidance]] (`status: draft`) — six guidance
  approaches (extend carousel / just-in-time coachmarks / **rewarded first-week
  checklist** / self-teaching empty states / staged unlocking / "how to play"
  helper), the recommended stack (checklist → coachmarks → empty states), and the
  decided client-presentation / server-rewards split (rewards reuse the achievements
  grant infra — the cash-faucet lesson: snout grants stay server-authoritative +
  idempotent). Framed as the top of the [[virality-and-growth-loops]] retention funnel.
- **Build spec** `docs/onboarding-first-week-checklist-spec.md` — the top-pick
  checklist: six items mapped to existing server state, granted via an `onboarding`
  achievement category + `try_claim_achievements`, surfaced through
  `AchievementUnlockModal`; +300 one-time idempotent faucet.
- **Meta** — added to [[_index]] + [[_topics]] (Design & Strategy) and [[_glossary]]
  (Onboarding).

## [2026-06-14] build | first-week checklist foundation (onboarding #3)

"Go — this seems like a good start." Built the server + client foundation for the
[[onboarding-and-guidance]] top pick (the rewarded first-week checklist):

- `supabase/migrations/20260649000000_onboarding_checklist.sql` — dedicated
  `onboarding_milestones` (5 seeded: tickle/dress/friend/visit/ritual) +
  `onboarding_claims` (idempotency PK) + `onboarding_done(uid)` (single
  authoritative done-check) + `onboarding_progress()` (read) + `claim_onboarding()`
  (server-authoritative, pay-only-on-`FOUND` idempotent grant). +200 snouts total,
  one-time. Built as dedicated tables (NOT the achievements catalog) to fit the
  heterogeneous booleans + avoid a carry-latest-def edit to `my_achievements()`.
- `utils/onboarding.ts` typed wrappers + `components/OnboardingChecklist.tsx` (cozy
  Sticker card; auto-claims earned milestones, flashes the reward, retires when done).
- `tsc` clean. **The "3-day streak" 6th item is deferred** — no streak persisted
  server-side yet ([[streak-and-garden]] is headless).
- **Mounted end-to-end in `components/Barn.tsx`** — a dismissible ambient card below
  the stat tickets, re-checked on Barn focus (`onboardingKey` in `useFocusEffect`) so
  friend/visit/ritual completed elsewhere are picked up, `onClaimed` → snout-counter
  refresh; self-hides once complete. Added `__tests__/onboarding.test.ts` (8 tests).
  **`tsc` clean, 247 jest green. Pending only the DB push.** Updated
  [[onboarding-and-guidance]] + the spec to as-built.

## [2026-06-14] author+optimize | Judgement Day (3 options) + Mud Wars plans

Two workflows: (1) authored 4 build-ready plans grounded against the real
`finalize_season`/cron/modal code, each adversarially verified; (2) ran the
plan-optimizer loop (weighted rubric → score → critique → rewrite to plateau) on
each. Filed to `outputs/memos/`:

- **Judgement Day A — The Quiet Reckoning** (cozy/personal/ship-now) — **93** (82→93).
- **Judgement Day B — The Great Schism** (faction drama/post-launch) — **97** (76→94→96→97);
  the loop surfaced a real bug (an inline `system_announcements` row renders in
  `WhileAwayModal`, not `JudgementDayModal`, so the village result would show twice).
- **Judgement Day C — The Living Almanac** (repeatable season engine) — **91** (64→79→88→91);
  the loop caught a catastrophic fabrication — `public.seasons` ALREADY EXISTS (the
  battle-pass table), so the new table was renamed `judgement_seasons`.
- **Team / Clan / Mud Wars — Rollout Plan** — **89** (72→88.7→89); rebuilt around the
  founder's 2026-06-14 voice-memo decisions (challenge/accept, group-tickle scoring,
  winner +50% of loser's tickles as snouts + regen buff, isolated reset-to-zero field,
  invite-not-random ≤5 clan, fully-optional). Surfaced + resolved two build tensions
  (group-tickle vs the shipped flat-20 anti-snowball sling; `find_challengeable_crews`'
  friend-on-opponent-crew gate). Cataloged all four in [[_index]].

## [2026-06-14] research+plan+optimize | mud-war co-op mechanics (×6)

Founder grill resolved the mud-war design (real collaborative daily activities →
war-scoped points; rewards = war-exclusive cosmetics + a capped core payout;
3-on/1-off). Workflow: researched co-op interaction design (4 lenses → brief
`coop-mechanics-research-2026-06.md`), then authored + plan-optimized an
implementation plan for each of six co-op mechanics, all grounded on the
`20260647` mud-fights stack and the capped-bonus-on-flat-sling fairness spine:

- **Wallow Buddies** (pairwise) — **92**; **Build the Mud Fort** (shared-goal, doubles
  as a cosmetic) — **92**; **Rally Call** (synchronized + push) — **91**; **The Heave**
  (synchronized) — **90**; **Crew Truffle Hunt** (shared-goal) — **90**; **Cover for a
  Crewmate** (asymmetric) — **90**.
- The optimizer caught real, fatal bugs in the drafts: Heave's combo window derived
  from `mud_slings.created_at` (only ever the day's *first* sling); Wallow's invalid
  `COALESCE`-in-PK idempotency guard; Cover decrementing the helper's own `mud_slings`
  (corrupting the score numerator); a 13-digit migration filename that would sort
  *before* existing migrations. Truffle-hunt's one residual gap: `challenge_house` has
  no rematch cooldown, so bot wars could farm the capped bonus (flagged, undecided).
- Cataloged the brief + six plans in [[_index]].

## [2026-06-14] pivot+research+plan+optimize | async "telephone" co-op + war items

Founder pivot: NOT live/synchronized mechanics → **telephone-type (async)**, and
"we want a lot of items" (research from Miniclip + co-op games). Cut Heave/Rally/Wallow
(all required co-presence); kept the async survivors (Truffle Hunt, Mud Fort).
Workflow: researched 4 lenses (async/telephone, Miniclip/casual, item systems, async
fairness → brief `coop-telephone-items-research-2026-06.md`), then plan-optimized:

- **Pass the Slop Bucket** (async relay) — **94**; the optimizer reframed it from a
  single-baton relay (which violated the research's "parallelize, never serialize"
  rule — one no-show freezes everyone) into a **parallel lap meter** anyone fills
  anytime, baton demoted to nudge-narration.
- **The Mud Heap** (collaborative sculpture → shareable cosmetic) — **95**; base +
  REACTOR palette pieces that build on the crewmate's last piece, a crew-named capstone.
- **War Spoils** (the large war-exclusive item system) — **95**; rarity ladder
  (Muddy→…→Heirloom), recolor variants, themed sets w/ completion bonus, a 30-50-tier
  War Pass, cozy gacha-with-pity + dupe-insurance, seasonal vaulting, animated apex;
  MVP phasing (all-static Phase 1, animation Phase 2), worked alt-farming trace.

Key research finds: Miniclip's own analysis says 1:1 friend tools out-retain formal
clubs; volume of items comes from multiplier mechanics (recolors/sets/passes) not more
art (1 anchor × 8 palettes × 5 themes = 40 SKUs/base). Cataloged in [[_index]].

## [2026-06-14] compile | Refreshed team-clan-mud-wars-plan.md to the async telephone pivot
Rewrote the Mud Wars rollout plan to the resolved ASYNC design. Tension #1 ("maximize
group tickles" vs the flat sling) is now RESOLVED — the cooperation answer is the four
async telephone mechanics ([[mudwar-coop-slop-bucket]], [[mudwar-coop-mud-heap]],
[[mudwar-coop-truffle-hunt]], [[mudwar-coop-mud-fort]]) layered as capped, participation-
gated, off-leaderboard bonuses on the flat-20 base sling — no hand-waved future bonus.
Season-2 content = one of those co-op mechanics + the [[mudwar-war-spoils-items]] cosmetic
economy. Kept all still-valid gating (Sounder naming = blocking-first, economy wall,
population flip-trigger, launch coupling, push-dark, MVP phasing) + the "fight strangers
with your friends" discovery tension. Noted at top it's the rollout/gating companion to
[[mud-wars-master-plan]]. Grounded in the real unpushed base (20260647, WAR_LENGTH_DAYS=5
shipping, MUD_FIGHTS_VISIBLE=false) + the four footguns (carry-latest-def, INLINE
announcements, idempotent payouts, filename sorts after 20260649).

## [2026-06-14] consolidate | Mud Wars master plan + async rollout refresh

Pulled all the mud-war work into one master and re-optimized the stale rollout.

- **[[../outputs/memos/mud-wars-master-plan|Mud Wars — Master Plan]]** (new) —
  plan-optimized to **98** (93→96→98). Single source of truth: the loop, the 7
  design principles, the four co-op mechanics (Slop Bucket 94 / Mud Heap 95 /
  Truffle Hunt 90 / Mud Fort 92), the War Spoils item economy (95), rollout/gating,
  open decisions, and a phased build-order table (Base live → Mechanic → War Spoils
  static → Animation). Overview-that-links — sub-plans keep their full detail.
- **[[team-clan-mud-wars-plan]]** refreshed to the async pivot + re-optimized
  **89 → 95.3**: Tension #1 (group-tickle vs flat sling) is now RESOLVED by the
  telephone mechanics (additive+capped, not a multiplicative hand-wave); added
  per-workstream exit conditions + a minimal critical path.
- The optimizer's sharpest catch: the cadence swap (5→3 days) touches the war clock
  in exactly TWO writers (`challenge_house` INSERT + `accept_challenge` ends_at
  UPDATE) — `challenge_crew`'s `interval '24 hours'` is the rematch cooldown, not the
  war length. Cataloged the master in [[_index]].

## [2026-06-14] implement | Applied the UI layout audit across 6 screens

Turned [[../outputs/memos/ui-layout-audit-2026-06|UI Layout Audit]] into code via a
fan-out workflow (6 parallel per-screen agents + a tsc/jest verify pass).

- **Foundation tokens** added to `constants/theme.ts`: `SPACE` (4/8/12/16/24),
  `SHADOW_SM` (the 2,2 chip/button tier next to `STICKER_SHADOW`'s 4,4), `PAGE_PAD`
  (18), `TAB_SAFE` (74); `SectionHeader` default `ruleWidth` 90 → **64**.
- **Mechanical fixes applied** to Home/Barn (+ onboarding card), Account, Achievements,
  Season, Shop, Friends/Leaderboard/Inbox: PAGE_PAD edge unification, spacing-scale
  snapping, two-tier shadows, radius snapping, canonical headers/rule widths, the
  one progress-bar language (`lilacDeep` fill), TAB_SAFE bottom padding, bare Views →
  Stickers. `tsc` clean · 247 jest green.
- **Deferred (device QA):** #11 modal-CTA/`Button.tsx` rework (Button still on the
  legacy `COLORS` pink palette — routing modal CTAs through it recolors ItemPreviewModal)
  and #4 SafeAreaView/Platform-paddingTop rewrap (each fork now carries a `// TODO(ui-audit)`
  marker). Status block appended to the memo.

## [2026-07-03] query | Season-2 push: Higgsfield storyboard + clan-war options + clan audit
- Filed `outputs/memos/mudwar-challenge-options-2026-07.md` — 3 founder options for the
  weekly clan-vs-clan challenge (A: ship rhythm war + Bog Weather buffs/debuffs on the
  inert siege modifier; B: challenger-stakes-the-terms Gauntlet; C: race-not-duel
  Hunger's-Hoard PvE-pressure carve). Recommends A now → C mid-season.
- Filed `outputs/memos/clan-buildout-audit-2026-07.md` — client lifecycle coverage,
  ranked gaps (redeploy picker dead path, zero war push deep-links, no leader
  rename/kick/transfer RPCs, invites invisible outside the segment, no crew identity),
  and the 3-way "Sounder" overload landmine (crew vs referral vs herd — 29 crew UI
  strings across 7 files are the true rename surface).
- Wrote `docs/great-hunger-higgsfield-storyboard.md` (repo docs, not wiki) — per-shot
  image-to-video board for the 30s opening off the composited shot frames.

## [2026-07-03] query | Mud Wars options A/B/C: research + build scopes filed
- Filed `outputs/memos/mudwar-scope-a-weathered-2026-07.md` (~12 dev-days to bounded flip;
  weather global-per-week + additive-only; Fort/redeploy client-only), `…scope-b-gauntlet…`
  (B-v1 pin/counter-pin = strict superset of A, +~3 client days; variants staged behind
  wars_played≥2), `…scope-c-hungers-hoard…` (11–15 days; race fold half-exists via the
  bot-war branch; mode column + Golden-Tickles ledger buildable during A for 2–3 days).
- Corrected `mudwar-consolidated-brief-2026-07.md` anti-cheat claim: caller_id-folded
  CHART_SEED never shipped; seeds are hashtext(war:day:front), charts client-cosmetic.

## [2026-07-03] compile | Founder direction: wars drain the Great Hunger + 8h heartbeat
- Filed `outputs/memos/mudwar-hunger-arc-cadence-2026-07.md` — three-layer structure
  (crew co-op → clan-vs-clan race → server-wide Hunger drain), the "Feedings" 8-hour
  Snatch heartbeat (one free tap/window, +1 mud, crew echo bonus w/ retro-credit,
  capped +6/day), and the season Hunger-energy meter (derived SUM, staged visible
  weakening, Judgement-Day finale coupling). Supersedes the pure-duel framing in
  mudwar-challenge-options: direction = Option A's build wearing Option C's story.
  Adds ~4 dev-days to the A-v1 path (≈16 total to flip).

## [2026-07-03] compile | Truffle Dig verb + full rewards spec
- Revised `mudwar-hunger-arc-cadence-2026-07.md`: heartbeat verb is now the **Truffle
  Dig** (scratch-to-root gesture, no fail state, 1/8h window, golden crew echo);
  dug truffles are kept as the war currency.
- Filed `outputs/memos/mudwar-rewards-spec-2026-07.md` — Golden Truffle economy
  (sources: digs/milestones/resolve; sink: weekly-rotating Truffle Exchange at
  25/60/120/250/500 by tier; pouch cap 999, no auto-conversion), full payout tables
  (win/loss/draw/no-quorum/bot), in-week milestone mints 10/25/50, exclusives
  release calendar (sets, Heirlooms, stage commemoratives, finale item), rarity
  mapping of the shipped 25 items. Deletes resolve_war's raw-snout mint at flip
  (closes precondition #2/B2). Net +3.0 dev-days → ≈19–20 days total to flip.
- Code findings while verifying: (1) LIVE trigger grants a war cosmetic on EVERY
  human-beats-bot war (docs claimed bot wars grant nothing) — spec fixes to
  first-bot-win-only; (2) milestone mints must ride the same throw_mud/submit_run
  carries as Bog Weather M1 (carry-latest-def footgun).

## [2026-07-03] compile | Dig minigame ("the Patch") + clan progress views
- Filed `outputs/memos/mudwar-dig-minigame-2026-07.md` — Sinnoh-Underground-style
  6x5 mud board w/ emerging truffle silhouettes, rub + snout-shove tools, cozy
  "stir meter" (graceful end, nothing lost, no fail state), week escalation.
  Integration rec: L1 (heartbeat only; rhythm spine untouched). +3d over flat dig.
- Filed `outputs/memos/mudwar-progress-views-2026-07.md` — 5 surfaces (WarLedgerStrip,
  CrewEffort w/ gift-framed quiet-pig copy, RivalSide aggregate-only, shared drain
  line + stage chip, AwayDigest). ~3.75d, mostly pure client. Findings: daily notches
  are discarded at fold (20260666:81 — needs tiny mud_war_day_notches table riding
  Bog Weather M1's SAME carry); war_side already ships opponent member names+mud to
  the client (render restraint now, wire-trim later).

## [2026-07-03] decision | Truffle Patch crowned; full build begins
- Founder crowned the Truffle Patch (mock #1) after the three-way playable bake-off.
  Decision set logged in SKILL.md (Patch heartbeat + Golden Truffle economy +
  wars-drain-the-Hungerer). Build phases: P1 Patch in-app, P2 progress surfaces,
  P3 Hungerer staging everywhere, P4 Truffle Exchange, P5 flip prep. Art manifest +
  ChatGPT brief pack being compiled for the icon-gen pipeline.
- Filed `docs/great-hunger-art-manifest.md` (31-line asset inventory, P1-P4 batches,
  8-9 ChatGPT generations total) + `docs/briefs/s2-art-chatgpt-briefs.md` (paste-ready
  icon-gen batches, two style anchors, refs staging list).
- Filed `outputs/memos/s2-accessory-ideas-2026-07.md` — 18 new accessory ideas across
  the war's empty slots (mask/scarf/necklace/bow/cape/glasses/tickle_particle), two
  new sets (Hungerer's Table w/ Famished-gated Crown capstone; Rooter's Kit w/ the
  Golden Snuffle Dust particle capstone), 2 animated Heirlooms in cosmeticFx vocab,
  and a 6-item generate-next shortlist = one new Sheet F batch.

## [2026-07-07] memo | Mud Wars founder-decisions doc

Drafted [Mud Wars — Founder Decisions](outputs/memos/mudwar-founder-decisions-2026-07.md), gathering the pending Season-2 decisions (payout model, crew permanence, cadence, v1 co-op choice, finale + flip timing) with options, tradeoffs, what each gates, and the verified current code reality per decision. Corrects a stale claim (the Great Hunger meter is built + dark via `hunger_meter()`/`world_boss`, not designed-only) and notes preconditions 1 & 3 + the redeploy UI are done in PRs #22/#23 — leaving payout (#2) and launch-coupling (#4) as the only remaining flip blockers, both founder calls.
