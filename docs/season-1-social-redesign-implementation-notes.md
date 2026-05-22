# Season 1 Social Redesign — Implementation Notes

Running log kept while implementing `season-1-social-redesign.md`.
Decisions the spec didn't cover, deviations, tradeoffs, and heads-up
items. Newest entries at the bottom of each section.

---

## Off-spec decisions

- **2026-05-21 — Work on `main`, not a feature branch.** The spec
  doesn't say where to implement. Chose `main` (per-phase commits keep
  it bisectable) over a `social-redesign` branch, because the project's
  workflow is main-centric and build 67 is already a cut `.ipa` — main
  moving on can't affect it. If the refactor destabilizes main, build
  67 is unaffected.
- **2026-05-21 — Tab label = "Friends".** The spec left the tab name
  open (recommended "Friends"). Going with "Friends".
- **2026-05-21 (Phase A) — Renamed the route file**
  `app/(tabs)/leaderboard.tsx` → `friends.tsx`. The spec said
  "repurpose the Ranks tab" without saying whether to rename the
  route. Renamed it — only one caller referenced the route
  (`Barn.tsx`), so the rename was cheap, and leaving a route literally
  named `leaderboard` that renders the Friends hub would mislead
  future readers.
- **2026-05-21 (Phase A) — `router.push("/friends" as any)`.** Expo
  Router's typed-route union regenerates only when Metro runs; with
  Metro down it still lists the old `/leaderboard`. Cast to `any` to
  satisfy `tsc` — and the codebase already casts routes this way
  (`Account.tsx` does `router.push("/achievements" as any)`), so this
  matches the existing pattern. The cast can be dropped once the
  route types regenerate.
- **2026-05-21 (Phase A) — Sounder card left in Account.** The spec
  folds the Sounder/referral section into the top of the Friends
  segment, but Phase A's checklist only covers moving `Friends.tsx`.
  Left the Sounder card where it is for now — moving it cleanly means
  relocating its data fetch too, and it pairs naturally with the
  Phase E referral revival. Deferred, not dropped.

## Changes from spec

_(none yet)_

## Tradeoffs

_(none yet)_

## Heads-up

- **2026-05-21 — Build 67's TestFlight state is unverified.** It was
  built + handed off for Transporter upload; no confirmation it landed
  or that the migrated app runs clean on a device. This redesign is
  being implemented on top of unverified-shipping code.
- **2026-05-21 — Metro is down** (crashed, OOM). Implementation is
  verified via `tsc` + `jest` only; on-device smoke-testing is pending
  a Metro restart.
- **2026-05-21 (Phase A) — 2 pre-existing `tsc` errors in
  `SwipeElement.tsx`** (Animated.Text `pointerEvents` typing). Not
  introduced by this work, not touched — flagging so they're not
  mistaken for redesign fallout.
- **2026-05-21 (Phase A) — `Friends.tsx` now mounts standalone** in
  the hub's body, where before it lived inside Account's `ScrollView`.
  Its internal scroll behavior should be checked on-device — if the
  friends list is long it may need its own scroll container now.
