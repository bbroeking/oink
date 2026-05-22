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

- **2026-05-21 (Phase B) — Inbox data layer = client-side merge.**
  The spec calls for a unified feed but doesn't say how to source it.
  Chose to merge existing data client-side (`my_tickle_trades` RPC +
  a `friendships` query + the `blessings`/`curses` tables) rather than
  add a `my_inbox()` aggregating RPC. This means **Phase B needs no
  new migration and no `db push`** — it runs against the live DB as-is.
  A server-side RPC is a fine later optimization if the feed grows.
- **2026-05-21 (Phase B) — Trade push routes to `/friends`, not a
  segment.** A tapped trade notification lands on the Friends tab;
  it can't deep-link straight to the Inbox *segment* (segment is
  internal hub state). The Inbox badge draws the eye. Segment-level
  deep linking is a follow-up.

- **2026-05-21 (Phase C) — Friend rows tap straight to UserSheet.**
  The spec says UserSheet is the one door but didn't specify how a
  Friends-list row reaches it. Made the whole row a `Pressable` →
  opens UserSheet (a `›` chevron signals it). The old inline "Ask"
  `Alert.prompt` is gone.
- **2026-05-21 (Phase C) — Fixed two latent bugs while in
  `sendTickle`.** UserSheet read `r.hours` (the RPC returns
  `hours_remaining`) so the cooldown message always said "24h"; and
  it checked `reason === "already_pending"` (the RPC returns
  `already_active`). Both corrected.

## Changes from spec

- **2026-05-21 (Phase B) — Inbox passive feed scoped down.** The spec
  lists five passive row types (blessed/cursed you, trade answered,
  bounty ready, leaderboard pass). Phase B ships three —
  trade-answered, blessing-received, curse-received — and **defers
  bounty-ready + leaderboard-pass** rows. They need extra data
  sources; deferred to keep the phase bounded. Not dropped.

## Tradeoffs

- **2026-05-21 (Phase B) — Segment badge, not a tab-bar badge.** The
  unread count badges the **Inbox segment** inside the hub, not the
  Friends tab icon in the bottom bar. A true tab-bar badge needs the
  count lifted to `app/(tabs)/_layout.tsx` (cross-tree state). The
  segment badge is the clean, contained version; the tab-bar badge is
  a deferred follow-up. Cost: the count isn't visible from *other*
  tabs, only once you're in the Friends hub.

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
- **2026-05-21 (Phase B2) — `Friends.tsx` "pending" tab removed.**
  Friend requests live only in the Inbox now; `Friends.tsx` is down
  to two tabs (Friends / Add). The duplication flagged in the Phase B
  commit is resolved.
- **2026-05-21 (Phase D) — Phase D is being done in chunks.** It's
  the largest phase. **Chunk 1** (this commit): the receiver-
  notification push — a `ritual_push_notify` trigger on the
  `blessings`/`curses` tables + the deep-link route handler. The
  migration `20260528000000_ritual_push.sql` is committed to git but
  **NOT applied** — it needs a `db push` (gated). Remaining Phase D:
  the effect wiring (glow/miasma overlays, regen multiplier,
  half-taps, lucky boost), the casting animation, and the cooldown UI.
- **2026-05-21 (Phase D) — The regen-multiplier effect is the risky
  bit.** `warm_tea` / `sluggish_snout` change the *server-side* regen
  rate, which means editing `update_profile_and_item_count` +
  `tickle_info` — core RPCs that are already VIP-aware and layered
  across many migrations. Flagging now: that sub-chunk needs care
  and ideally a local `db reset` validation (blocked — no Docker).
- **2026-05-21 (Phase B) — Dead StyleSheet keys** left behind: the
  `tradePill*` keys in `Barn.tsx` and the `PendingList` keys
  (`subKicker`, `actionAccept*`, etc.) in `Friends.tsx`. Harmless
  (unused keys cost nothing, no tsc error); a `/deslop`-style sweep
  can clear them later.
