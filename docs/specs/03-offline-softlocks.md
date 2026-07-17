# Spec 03 — Offline soft-locks: home_stats retry + saddling-up timeout

**Source:** GitHub issue #5 (`gh issue view 5`). Client-only.

## Part A — canTickle dies when home_stats fails

Mechanics: on boot failure of `home_stats`, `useHomeStats.refresh` swallows
the error (`hooks/useHomeStats.ts:306-308` — log only, no reschedule),
`statsLoaded` stays false, `stats.itemCount` stays 0 → `Barn.tsx:533-534`
rejects every tap with "Out of tickles!". Recovery only happens on screen
re-focus (`Barn.tsx:489-496`), never on app foreground.

Fix, three pieces:
1. Retry with backoff in `useHomeStats.refresh`'s catch (a few attempts,
   e.g. 2s/5s/15s, cancel on success/unmount — keep it inside the hook).
2. Foreground refresh: `AppState` "active" listener wired to `fetchStats`
   in Barn — mirror the bounty-badge pattern at
   `app/(tabs)/_layout.tsx:99-111`.
3. A visible retry affordance on the `!statsLoaded` render branch
   (`Barn.tsx:749`) — shared `Button`/`EmptyState`/`LoadingBeat` primitives,
   tokens only, whimsy voice (no raw "Error" copy).

## Part B — the "saddling up" gate can hang forever

Mechanics: `app/(tabs)/_layout.tsx:121-144` spins while
`username === undefined`; `refetchUsername` (:59-67) never handles fetch
errors, runs once, so an offline boot hangs the gate forever — and its
`usePopupHold` (:38-44) keeps ALL launch popups blocked too.

Fix: error branch + retry in `refetchUsername` (same modest backoff), and
after a timeout (~10s of failures) show a retry affordance instead of the
infinite spinner. Constraints:
- NEVER advance to `UsernameSetup` on failure — undefined-due-to-error must
  not be treated as "no username" (that would offer a rename screen to a
  named pig; the `??` null branch is only correct on a successful fetch).
- The popup hold must persist while the gate shows (it's what prevents the
  storybook wedge — see spec 05's notes).

## Verify

- Unit-test the retry/derivation logic where the hooks have existing test
  patterns in `__tests__/`.
- Full suite + typecheck.
