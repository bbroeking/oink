# First-Week Checklist — build spec

Status: **draft / proposed** (2026-06-14). The top-pick onboarding approach from the
wiki page `docs/wiki/onboarding-and-guidance.md` (#3). A cozy, rewarded checklist
("Rosie's chores") that teaches the game's breadth **and** drives the exact D1–D7
retention actions the growth model (`docs/wiki/virality-and-growth-loops.md`) needs.

## As built (2026-06-14) — foundation done, not yet pushed/mounted

Two design changes from the proposal below, decided during implementation:

- **Dedicated tables, not the shared achievements catalog.** Onboarding items are
  heterogeneous booleans (tickle/dress/friend/visit/ritual) that don't fit the
  achievements one-progress-int-per-category ladder, and isolating them keeps the
  complex `my_achievements()` SQL untouched (carry-latest-def risk avoided). Same
  idempotency principle — `onboarding_claims` PK + `ON CONFLICT` + pay-only-on-`FOUND`.
- **v1 is 5 items; the streak item is DEFERRED** — no streak is persisted server-side
  yet (the engine is headless), so item 6 can't be evaluated. Add it when the
  streak/Garden ships.

Built + `tsc`-clean + 247 jest tests green: `supabase/migrations/20260649000000_onboarding_checklist.sql`
(`onboarding_milestones` + `onboarding_claims` + `onboarding_done` / `onboarding_progress`
/ `claim_onboarding`), `utils/onboarding.ts` (+ `__tests__/onboarding.test.ts`),
`components/OnboardingChecklist.tsx`, and **mounted end-to-end in `components/Barn.tsx`**
— a dismissible ambient card below the stat tickets, re-checked on Barn focus
(`onboardingKey` bumped in `useFocusEffect`) so milestones completed on other screens
(friend/visit/ritual) get picked up, with `onClaimed` refreshing the snout counter. It
self-hides once all milestones are claimed or the card is dismissed, so only new players
see it. **Remaining: the DB push** (awaiting "push it" — stacks after `20260647`/`20260648`).

## Goal

Turn feature-discovery into a small rewarded goal loop. A new player sees a short
list of first-week tasks; completing each ticks it off and grants a small one-time
snout reward via the existing achievements pipeline. The list teaches friends,
visiting, the streak, and cosmetics — the systems the 2-screen welcome carousel
never mentions.

## The items (v1)

Six items, ordered easy→social→sticky. Each maps to **server state that already
exists**, so completion needs no new tracking columns — just a read.

| # | Item (player copy) | Completion signal (server) | Reward |
|---|---|---|---|
| 1 | "Give Rosie her first tickle" | `tickles_earned >= 1` | +25 snouts |
| 2 | "Dress Rosie up" | any `profiles.active_*` cosmetic slot non-null | +25 |
| 3 | "Add your first friend" | ≥1 accepted row in `friendships` (`are_friends` / friend count ≥ 1) | +50 |
| 4 | "Visit a friend's Barn" | ≥1 row in `barn_visits` where `visitor_id = me` | +50 |
| 5 | "Bless or curse a friend" | ≥1 ritual cast by me (blessings/curses table) | +50 |
| 6 | "Keep a 3-day streak" | `streak >= 3` (the [[streak-and-garden]] engine) | +100 |

Total faucet: **+300 snouts, one-time, per account** — bounded and idempotent (see
faucet note below). Tune amounts before ship.

## Architecture — reuse, don't reinvent

The client/server split (decision in the wiki page): **presentation client-side,
rewards server-side via the achievements infra.**

### Server (rewards — authoritative, idempotent)
- Model the six items as a new **achievement category** (e.g. `kind = 'onboarding'`)
  in the existing `achievements` catalog (`20260520060000_achievements.sql`), so each
  grant flows through `try_claim_achievements()` and is recorded once in
  `user_achievements` (the existing UNIQUE/idempotency guarantee). **No new reward
  path** — this is the cash-faucet lesson from
  `docs/wiki/outputs/lint/2026-06-14-visit-cash-payout-review.md`: every snout grant
  stays server-authoritative + idempotent.
- Add an `onboarding_progress(uid)` RPC that returns, per item, `{key, done, claimed}`
  computed from existing state (the table above) — a pure read, no writes, so the
  client can render the checklist without trusting local flags for *completion*.
- Reuse the existing trigger checks where they already fire (friendships, blessings,
  curses, alignment) to auto-`try_claim` the matching onboarding milestone; for the
  ones with no trigger yet (first tickle, first visit, streak≥3), evaluate inside the
  RPC the relevant action already calls (the home tickle RPC, `tickle_at_barn`, the
  streak-credit path) — carry-latest-def discipline applies to any of those rewrites.
- Migration filename must sort after the latest (`20260648…`); see CLAUDE.md.

### Client (presentation only — AsyncStorage)
- A **checklist surface** (a `Sticker`-card list, cozy, Rosie-narrated) reachable from
  the Barn — e.g. a dismissible card in the Barn ambient layer or a small "Rosie's
  chores" entry. Reads `onboarding_progress()`; shows done/undone + the reward.
- Completion *reveal* reuses `AchievementUnlockModal` (plugged into `PopupQueue` via
  `usePopupSlot`) — the snout/celebration moment is already built.
- AsyncStorage holds only **presentation** state: whether the user has dismissed the
  card, and a "all done → collapse it" flag. Never the reward/claim state (that's the
  server's `user_achievements`).
- Hide the whole surface once all six are claimed (or after N days), so it doesn't
  linger for seasoned accounts.

## Faucet / abuse note

- One-time per account (idempotent via `user_achievements`), so the +300 can't repeat.
- Items 3–5 (friend/visit/bless) are friend-gated actions; with the `20260648`
  friends-only visit gate, none of these is farmable beyond the single grant.
- Track the +300 against the no-recurring-sink risk in `docs/wiki/snouts-economy.md`.

## Implementation order

1. Server: add the `onboarding` achievement rows + `onboarding_progress()` RPC +
   wire the three trigger-less claims into their existing RPCs (one migration).
2. Client: `onboarding_progress()` typed wrapper (`utils/`), the checklist card
   component, and the `usePopupSlot` reveal via `AchievementUnlockModal`.
3. Gate visibility: show only while incomplete; respect `usePopupHold` so it never
   fights the welcome carousel or launch modals.

## Open questions

- **Where does the card live?** Barn ambient card vs a dedicated "Rosie's chores"
  entry vs a first-launch panel. (Recommend: dismissible Barn card near the Garden.)
- **Reward sizing** — +300 total is a guess; balance against the daily earn rate.
- **Does item 6 (3-day streak) belong in "first week"?** It can't complete on D1, so
  the card must persist across sessions — fine, but confirm the streak engine surfaces
  `streak` to the client (today it's headless; ties into shipping the Garden).
- **Localization / copy** — Rosie's voice; keep it cozy, not task-master-y.
