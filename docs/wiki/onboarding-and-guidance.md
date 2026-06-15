---
title: Onboarding & In-App Guidance
aliases: [onboarding, tutorial, coachmarks, first-run, new-user, guidance]
tags: [design, onboarding, retention, ui, future]
status: draft
sources:
  - code: components/Onboarding.tsx
  - code: components/ui/PopupQueue.tsx
  - code: components/AchievementUnlockModal.tsx
  - code: components/ReleaseNotesModal.tsx
  - sql: supabase/migrations/20260520060000_achievements.sql
  - spec: docs/onboarding-first-week-checklist-spec.md
last_compiled: 2026-06-14
---

# Onboarding & In-App Guidance

How TTP teaches a brand-new player its (large) feature surface. The **outward** growth work in [[virality-and-growth-loops]] says retention is the precondition for everything — and onboarding is the **top of the retention funnel**, the single biggest lever on D1. This page audits today's first-run experience, names six guidance approaches, and records the recommended stack + the client/server split.

## The gap

A new user gets a **2-screen welcome carousel** (`components/Onboarding.tsx`, gated once by AsyncStorage `seen_onboarding`):

1. "Hi, I'm Rosie! — tap me to tickle."
2. "Earn & dress me up — spend hearts in the shop."

…then is dropped into a Barn with **five tabs and ~12 systems** ([[friends-graph]], [[barn-visiting]], [[blessings-curses-effects]], [[alignment]], [[streak-and-garden]], [[trough]], [[lucky-pig]], [[achievements-and-titles]], [[world-cup-allegiance]]…) and **no further guidance**. The intro teaches ~10% of the game. Everything that drives D1–D30 retention (the streak, friends, visiting) goes untaught.

## Reusable scaffolding (what exists)

- **[[architecture-seams|PopupQueue]]** (`components/ui/PopupQueue.tsx`) — a robust priority modal-serializer. New guidance modals plug in as `usePopupSlot(id, want, priority)`; `usePopupHold(active)` blocks all popups behind a gate screen (auth / username / onboarding). The backbone for any launch-time or contextual nudge.
- **`AchievementUnlockModal` + `try_claim_achievements`** — the idempotent threshold-grant + reveal pipeline ([[achievements-and-titles]]). The rewarded-milestone path for any onboarding checklist rides this, not a new reward path.
- **`ReleaseNotesModal`** — versioned "what's new" pattern (AsyncStorage `RELEASE_SEEN_KEY`); the model for feature-announcement nudges.
- **`SpritePig`** (animated Rosie: wave/idle/…) + **`Sticker`** cards — the cozy UI primitives every guidance surface should be built from ([[design-system]]).
- **The "How visiting works" sheet** (`BarnVisitModal`) — the existing per-feature explainer pattern, generalizable into a "How to play" surface.

## Six ways to guide users

| # | Approach | Teaches | Reuses | Effort | Trade-off |
|---|---|---|---|---|---|
| 1 | **Extend the welcome carousel** (breadth-first) — +2–4 cards (friend, visit, streak) | breadth | `Onboarding.tsx` as-is | tiny | front-loaded; forgotten by the time it's needed |
| 2 | **Just-in-time coachmarks** — Rosie spotlights a real element on first visit to a screen | in-context, one tip at a time | `SpritePig` + new spotlight overlay + per-tip AsyncStorage | medium | needs a reusable anchor/overlay primitive built once. **Best comprehension** |
| 3 | **Rewarded first-week checklist** ("Rosie's chores") — tickle, dress, add friend, visit, 3-day streak, each → snouts | breadth **+ the exact D1–D7 retention actions** | achievements grant + reveal modal | medium | **top pick — doubles as the retention spine.** See `docs/onboarding-first-week-checklist-spec.md` |
| 4 | **Self-teaching empty states** — every surface explains itself on first encounter (Friends empty state, Garden first-show, Closet hint) | at the moment of need | per-surface AsyncStorage + `Sticker` | low-med | diffuse; no single "aha" |
| 5 | **Staged feature unlocking** — drip tabs/systems (Shop after ~10 tickles, Friends after first cosmetic…), each a small reveal | paced, low-overwhelm | reveal modal + tab gating | higher | power users may feel gated; threshold tuning |
| 6 | **"How to play" + Rosie "what next?" helper** — always-available sheet + state-aware nudges ("Rosie's lonely — visit a friend?") | reference + pull-based | the "How visiting works" sheet + PopupQueue | low-med | opt-in; passive users may never tap |

## Recommendation

Layer **3 → 2 → 4**: the **rewarded first-week checklist** as the backbone (it *is* the retention spine from [[virality-and-growth-loops]] — it pushes users to the streak/friend/visit actions the flywheel needs), **just-in-time coachmarks** for moment-of-need teaching, **self-teaching empty states** as the cheap incremental fill-in. Avoid a long upfront tour — doing-with-reward beats reading. Extend the carousel (#1) only as a stopgap.

## The client/server split (decision)

- **Presentation → client (AsyncStorage), no migrations:** carousel, coachmarks, empty-state hints, all "seen this tip" flags. Fast, zero-risk.
- **Rewarded checklist milestones → server, idempotent:** any snout grant must be server-authoritative + idempotent — the direct lesson from the [[barn-visiting]] cash-faucet review ([[../outputs/lint/2026-06-14-visit-cash-payout-review]]). **Built** (`20260649`) as dedicated `onboarding_milestones` / `onboarding_claims` tables rather than the achievements catalog — the heterogeneous booleans don't fit the achievements one-progress-per-category ladder, and isolation avoids a carry-latest-def edit to the complex `my_achievements()` SQL. Same principle: `claim_onboarding()` re-checks done-ness from authoritative state and pays once per (user, milestone) via the PK + `ON CONFLICT`. No parallel client-trusted reward path.

## Build status (2026-06-14)

The recommended #3 (first-week checklist) is **built end-to-end, `tsc`-clean, 247 jest tests green — only the DB push remains**: `20260649_onboarding_checklist.sql` + `utils/onboarding.ts` (+ test) + `components/OnboardingChecklist.tsx`, **mounted in `Barn.tsx`** as a dismissible ambient card below the stat tickets (re-checked on Barn focus; `onClaimed` refreshes the snout counter; self-hides once complete so only new players see it). v1 ships **5 items** (tickle / dress / friend / visit / ritual, +200 snouts total one-time); the "3-day streak" item is **deferred** until [[streak-and-garden]] persists a server-readable streak. Spec + as-built notes: `docs/onboarding-first-week-checklist-spec.md`.

## Connects to

- [[virality-and-growth-loops]] — onboarding is the top of the retention funnel; the checklist (#3) is the same set of D1–D7 actions the flywheel depends on.
- [[streak-and-garden]] / [[happiness-and-mood]] — the retention primitives the checklist should drive the player toward (and which #4 empty-states should explain on first appearance).
- [[barn-visiting]] / [[friends-graph]] / [[referral-program]] — the social features the current intro never mentions; prime coachmark / empty-state targets.
- [[achievements-and-titles]] — the grant + reveal infra the rewarded path reuses.
- [[architecture-seams]] — `PopupQueue` is the presentation backbone; `usePopupHold` keeps guidance from fighting launch modals.

## Open questions / risks

- **status: draft** — design exploration; #3 has a build spec, the rest need specs before build.
- **Reward sizing is a faucet** — onboarding snout grants mint currency; keep them one-time + idempotent and model the total against the no-recurring-sink risk in [[snouts-economy]].
- **Coachmark overlay is net-new infra** (#2) — an anchored spotlight primitive doesn't exist yet; build it once, reuse everywhere.
- **Sequencing vs launch:** onboarding quality matters most *after* the App Store listing is public (when real new users arrive). Until then it's building ahead of the audience — but unlike heavyweight features, it's cheap and directly lifts the D1 that everything else compounds on.
