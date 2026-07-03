---
title: "Mud Wars — clan-vs-clan progress views (data audit + surface specs)"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, ui, progress, clan-wars, design]
status: draft
---

# Mud Wars — viewing my clan's progress vs theirs

Founder ask: the war is **single-player-additive** — every member's solo actions sum for the clan — and players need to *see* that accumulation and the standing against the opponent all week. This memo audits what the wire already carries, then specs five surfaces. Slots into [[mudwar-scope-a-weathered-2026-07]] + [[mudwar-hunger-arc-cadence-2026-07]].

## 1. Data audit — what's free vs what needs a server read

The client already receives, per refresh (focus + realtime on slings/war rows, `hooks/useMudWar.ts:95-158`):

| Data | Where | Status |
|---|---|---|
| Rope standing (`ropePos`, caller-POV `ropeNorm` −1..1) | `war_state` (`20260666:299-302`) | ✅ shipped |
| Both sides: `total`, `perCapita`, `active`, `quorumMet` | `war_side` (`20260647`) | ✅ shipped |
| **My members with cumulative mud** (`members[]{username, slings}`, sorted desc) | same | ✅ shipped |
| **Opponent members with names + individual mud** | same — already on the wire, just never rendered | ✅ shipped (render restraint is a client choice; see §4) |
| Last folded day recap, both sides revealed per area | `war_fronts_state.recap` (`20260668`) | ✅ shipped (last day only) |
| Phase / `buildEndsAt` / `endsAt` / days math | `war_state` | ✅ shipped |
| Combined drain (mine.total + them.total) | derivable | ✅ pure client |
| Rope movement since I last opened the app | AsyncStorage diff of `ropeNorm` | ✅ pure client |
| **Day-by-day ledger (who took each day)** | per-day member rows EXIST (`mud_slings` day-bucketed, `UNIQUE(war_id,user_id,war_day)`) but per-day *notches* are folded into cumulative `rope_pos` and discarded (`20260666:81`) | ❌ new: tiny `mud_war_day_notches` history table + INSERT inside `score_mud_war_days` + `dayLedger` on `war_fronts_state` |
| Who dug this feeding window | H1's dig table (cadence memo) | ❌ rides H1's read |
| Per-member recency (`lastDay` = `MAX(war_day)`) | derivable server-side, not on wire | ❌ optional: one field added in `war_side` |

**Fold-function consolidation (carry-latest-def footgun):** `score_mud_war_days` and `war_fronts_state` are *already being carried* in Bog Weather M1 (`20260703100001`) — the day-notch INSERT and `dayLedger` read MUST ride that same migration, not a separate one. `war_side`'s latest def is still `20260647` — the optional `lastDay` field carries from there.

**Fog check:** the ledger exposes only *folded* days (same reveal rule as the shipped recap); window-diggers are own-crew only; nothing new leaks the opponent's current-day deploy/difficulty.

## 2. The five surfaces

Current `app/mud-war.tsx` ActiveWar order: siege chapter → countdown → rope → per-capita row → QuorumLine → pips → FrontBoard → minigame. New order: siege chapter (+ **Hunger stage chip**) → countdown → rope → per-capita → **① WarLedgerStrip** → **④ drain line** → **② CrewEffort** (replaces bare pips; hosts the kept-artifact render) → **③ RivalSide** (slim) → FrontBoard → feeding-ground strip (H2) → minigame. **⑤ AwayDigest** floats above everything when returning after >8h.

### ① WarLedgerStrip — the week at a glance
Seven small slots under the rope. Folded day = a knot pulled to the winning side's tint (rose = ours, lilac = theirs, neutral tie-knot for a wash); today = an open, gently pulsing slot; future days = dotted outlines. Hand-note copy: *"Day 4 of 7 — two knots yours."* **Rout proximity:** at |ropeNorm| ≥ 0.75 the losing end frays + *"Three notches from a rout."* (needs the rout constant client-side — the scope-a memo already flags `ROUT=12` has no mirror in `constants/mudFights.ts`).
Variant slotting: Fort Hero → knots as fence-posts under the scene; Bog Almanac → a 7-box stamp row (same language as the fort stamp card); War Table → notches carved into the rope rail.

### ② CrewEffort — my clan's additive progress
Replaces the anonymous pips. One row per member: name · mud numeral (progression number — allowed) · a small truffle dot if they dug the current feeding window (H1 read) · leader crown. Sorted by the shipped `slings DESC`. **The quiet pig is never shamed:** no red, no zeroes-in-bold; a 0-mud member renders softly with gift-framed copy — *"Hazel hasn't reached the bog yet."* — which becomes the Cover affordance's mount point later (idea A9). The crew's **kept artifact** renders here as the sum-made-visible: Fort Hero → the fort scene stage; Bog Almanac → the six-stamp card; War Table → the vertical milestone rail. Component: `components/mudwar/CrewEffort.tsx` taking `members`, `windowDiggers`, `artifact` render-prop.

### ③ RivalSide — their side, fair and cozy
**Aggregate only:** crew name, per-capita numeral, active heads as anonymous pig-nose pips, and their progress as a **distant silhouette** — their fort/hoard on the horizon, growing with their per-capita. Legible threat, zero individual shaming. Rationale: cross-clan member visibility invites dogpiling and aims guilt at strangers (violates gift-not-guilt across the clan boundary); the double-blind is the war's strategic soul. Note: `war_side` already ships their names+numbers — v1 restraint is render-level; a later privacy-hardening carry of `war_side` could strip opponent member rows from the wire (flag, don't build now).

### ④ The season layer — the drain both clans share
One warm line between ledger and CrewEffort: *"Together you've pried 214 tickles off him this war."* (`mine.total + them.total`, pure client — deliberately BOTH-clans framing; this is the founder's "competition is collaboration" made visible.) The **Hunger stage chip** (H3's `hunger_meter()`) sits beside the siege chapter line: *"He's Peckish."* The resolved modal's drain line is already specced in the cadence memo.

### ⑤ AwayDigest — "while you were away"
A dismissible Sticker atop the screen when the app opens >8h since last war visit (AsyncStorage stamp): up to 4 hand-written lines built from — rope delta since last seen (client diff: *"The rope crept their way overnight."*), yesterday's recap headline (*"You held Bog Bridge; Truffle Field fell."* — shipped recap), crewmate digs since (H1's read returning diggers for the last 3 window indexes), fresh-budget line (*"New throws are up."*). No new tables; one small widening of H1's read (last-24h windows, own crew only).

## 3. Estimates

| # | Surface | Server | Client | Est |
|---|---|---|---|---|
| ① | WarLedgerStrip | notch table + INSERT + `dayLedger` (rides M1 carry) | strip component | 1.0 d |
| ② | CrewEffort (+ artifact slot) | — (`lastDay` optional +0.25) | rows + artifact mount | 1.0 d |
| ③ | RivalSide | — | silhouette card | 0.5 d |
| ④ | Drain line + stage chip placement | — (H3 builds the meter) | two text mounts | 0.25 d |
| ⑤ | AwayDigest | widen H1 read to 3 windows | digest logic + Sticker | 1.0 d |
| | **Total** | | | **~3.75 d** (~3.0 pure client) |

Cut-first if trimming: **⑤ AwayDigest** — the war push deep-links (shared precondition S2) plus ① and the recap already deliver most of its value; it's the only surface with real state-tracking logic.

## Connects to
- [[mudwar-hunger-arc-cadence-2026-07]] — the heartbeat whose diggers/window reads these views consume
- [[mudwar-scope-a-weathered-2026-07]] — M1 carry these server reads must ride
- [[clan-buildout-audit-2026-07]] — the pips row + audit gaps this replaces
