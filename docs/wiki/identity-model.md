---
title: Identity Model (Soul / Tribe / Banner)
aliases: [identity model, soul tribe banner, sounder collision, faction model]
tags: [design, strategy, proposal, social]
status: stable
sources:
  - doc: docs/wiki/outputs/memos/future-direction-2026-06.md
  - doc: CONTEXT.md
  - doc: docs/social-layer-ideas.md
  - doc: docs/teams-pushpull-design.md
  - doc: docs/sounder-mud-fight-spec.md
last_compiled: 2026-07-03
---

# Identity Model (Soul / Tribe / Banner)

A three-layer frame (**the Sounder-collision rename shipped 2026-07-03**) that reconciles TTP's four overlapping "pick-a-side" systems into one legible identity — and resolves the former three-way collision on the word *"Sounder."* It is the organizing spine of the social/competitive design (see [[_topics]]).

## How it works

TTP accreted four "pick a side" systems in separate design sessions and never reconciled them: [[alignment]] (Goblins vs Angels), [[world-cup-allegiance]], the [[referral-program]] downline, and the new war crew ([[sounder-mud-fights]]). Without a frame, that's up to four faction badges on one pig — identity fatigue, and a brand that reads as a bug. The model collapses them into three layers, each owning exactly one cosmetic surface:

- **SOUL — permanent, personal.** Your moral axis = [[alignment]]. Carried alone, earned by behavior, reset each season at [[seasons-and-judgement-day]]. Cosmetic surface: your **aura**.
- **TRIBE — durable, belonging.** The crew you join = the war crew in [[sounder-mud-fights]] (invite-based, ≤5, persists across wars). The competitive "who's with me" layer. Cosmetic surface: your **crew banner/flag**.
- **BANNER — disposable, time-boxed.** A flag you fly for one event = [[world-cup-allegiance]] and future Rivalry events. Re-skinnable, never permanent. Cosmetic surface: the **event flag** slot (reused per event).

**The "Sounder" naming resolution (shipped).** The word meant three different things in shipped artifacts — the friends graph (`CONTEXT.md`), the referral downline (the `sounder_*` / `crown_hog` titles granted to real users), and the war crew (which reclaimed it). The resolution: war crew = **"Sounder"** (the most evocative, where investment is going), friends graph = **"Friends"**, referral downline = **"the Drove"** (already half-used in the `drove_captain` title). Shipped 2026-07-03 as a display-name-only change — no data moves, no `title_id`/RPC/flag renames.

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

## Status (shipped 2026-07-03)

- **The Sounder-collision rename is done** (branch `feat/identity-model-sounder-rename`): war crew keeps "Sounder"; friends graph → "Friends"; referral downline → "the Drove". Covered the client display strings, the `titles` display names/descriptions (migration `20260705000000_identity_model_drove_rename.sql`, validated on the plain-Postgres Docker harness), and the trough/referral function announcement copy. `title_id`s, RPC names, and feature-flag keys (`mud_wars`, `SOUNDER_VISIBLE`) are unchanged, so nothing breaks for existing title holders.
- **Precondition cleared.** This was the BLOCKING first item in [[mudwar-whats-next-2026-07|Mud Wars — What's Next]]; it had to land *before* `mud_wars` / `MUD_FIGHTS_VISIBLE` ever flips on, and now has.
- **Still future work.** Only the naming collision shipped; the SOUL (aura) and BANNER (event-flag) *cosmetic surfaces* are codified as the frame but not yet built.
