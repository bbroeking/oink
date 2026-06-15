---
title: Identity Model (Soul / Tribe / Banner)
aliases: [identity model, soul tribe banner, sounder collision, faction model]
tags: [design, strategy, proposal, social]
status: draft
sources:
  - doc: docs/wiki/outputs/memos/future-direction-2026-06.md
  - doc: CONTEXT.md
  - doc: docs/social-layer-ideas.md
  - doc: docs/teams-pushpull-design.md
  - doc: docs/sounder-mud-fight-spec.md
last_compiled: 2026-06-13
---

# Identity Model (Soul / Tribe / Banner)

A **proposed** (not yet implemented) three-layer frame that reconciles TTP's four overlapping "pick-a-side" systems into one legible identity — and resolves the live three-way collision on the word *"Sounder."* It is the organizing spine of the social/competitive design (see [[_topics]]).

## How it works

TTP accreted four "pick a side" systems in separate design sessions and never reconciled them: [[alignment]] (Goblins vs Angels), [[world-cup-allegiance]], the [[referral-program]] downline, and the new war crew ([[sounder-mud-fights]]). Without a frame, that's up to four faction badges on one pig — identity fatigue, and a brand that reads as a bug. The model collapses them into three layers, each owning exactly one cosmetic surface:

- **SOUL — permanent, personal.** Your moral axis = [[alignment]]. Carried alone, earned by behavior, reset each season at [[seasons-and-judgement-day]]. Cosmetic surface: your **aura**.
- **TRIBE — durable, belonging.** The crew you join = the war crew in [[sounder-mud-fights]] (invite-based, ≤5, persists across wars). The competitive "who's with me" layer. Cosmetic surface: your **crew banner/flag**.
- **BANNER — disposable, time-boxed.** A flag you fly for one event = [[world-cup-allegiance]] and future Rivalry events. Re-skinnable, never permanent. Cosmetic surface: the **event flag** slot (reused per event).

**The "Sounder" naming resolution.** The word currently means three different things in shipped artifacts — the friends graph (`CONTEXT.md`), the referral downline (the `sounder_*` / `crown_hog` titles granted to real users), and the war crew (the new spec, which reclaimed it). The proposal: war crew = **"Sounder"** (the most evocative, where investment is going), friends graph = **"Friends"**, referral downline = **"the Drove"** (already half-used in the `drove_captain` title). A display-name-only migration — no data moves.

## Key files

- `docs/wiki/outputs/memos/future-direction-2026-06.md` — where this frame is argued (strategic bet #3) and recommended.
- `CONTEXT.md` — currently calls the friends graph "Sounder"; needs updating to codify SOUL/TRIBE/BANNER so the next brainstorm can't fork a fifth faction.
- `docs/teams-pushpull-design.md` — the "Rivalry event" thinking that BANNER generalizes.
- `constants/featureFlags.ts` — `SOUNDER_VISIBLE` (referral) vs `MUD_FIGHTS_VISIBLE` (war crew); the flags whose player-facing words this model disambiguates.

## Connects to

- [[alignment]] — the SOUL layer (permanent moral axis).
- [[sounder-mud-fights]] — the TRIBE layer (the durable crew; owns the "Sounder" word under this model).
- [[world-cup-allegiance]] — the BANNER layer (disposable event flag).
- [[friends-graph]] — proposed rename to "Friends" to free up "Sounder."
- [[referral-program]] — proposed rename of the downline to "the Drove."

## Open questions / risks

- **Proposal, not shipped.** Nothing here is implemented; it's a design decision awaiting the founder's call (see the memo's open decisions).
- **The collision is live now.** `CONTEXT.md`, the seeded `sounder_*` titles, and the Mud Fights spec all use "Sounder" for different things today — shipping any new social surface before this is resolved bakes the contradiction into the UI.
- **Migration cost.** Resolving it is a display-name-only titles migration + a find/replace + a `CONTEXT.md` edit — cheap, but must land *before* `MUD_FIGHTS_VISIBLE` ever flips on.
