# Spec 05 — Reinstall flow: silent first-session popups + veteran storybook re-run

**Source:** GitHub issue #11 (`gh issue view 11`). Two halves. Any migration
is AUTHORED ONLY — never `db push`.

## Part A — root launch popups silent for the entire first session

`app/_layout.tsx:272` flips `authChecked` true after the initial
`getSession()` resolves — whether or not a session exists. Every root popup
effect keys on `[authChecked]` only (schism :333, finale :358, While-Away
:690, achievements :733) and there is NO `onAuthStateChange` at root (only in
`app/(tabs)/_layout.tsx:52`). Reinstall: getSession → null → effects run
userless → user signs in → effects never re-run. Schism/finale/achievements
partially recover via AppState "active" listeners; While-Away has none and
stays silent all session.

Fix: root `onAuthStateChange` (or equivalent session-identity key) that
re-runs these effects on sign-in. Constraints:
- Re-triggered wants MUST queue behind the onboarding `usePopupHold`
  (`app/(tabs)/_layout.tsx:38-44`) — never present over the storybook (its
  comment documents the "stuck on Hi, I'm Rosie!" wedge).
- Idempotent: don't double-present for already-signed-in warm launches;
  don't re-anchor While-Away's `since`/`away_seen_v1` marker to "now" on the
  re-trigger (it persists only on modal dismiss at :667-668, :975 — keep
  that; the normalizer's system-only guard at :660-668 stays).

## Part B — veteran re-runs the storybook

Onboarding-seen is AsyncStorage-only: gate reads `seen_onboarding`
(`app/(tabs)/_layout.tsx:73-76`); `components/Onboarding.tsx:52,107` writes
it locally, never server-side. Reinstall wipes it → veteran replays the
whole storybook.

Fix: persist onboarding-seen server-side and consult it alongside the local
flag. `utils/onboarding.ts` already models server-authoritative onboarding
milestones — prefer extending that lane (or a profiles column via a new
migration, carry-latest-def if replacing any function). Rules:
- Local `seen_onboarding="1"` still satisfies the gate (don't storybook
  current veterans at rollout).
- On completing onboarding, write BOTH local + server (fail-soft if the
  server write fails or the migration isn't pushed yet — the client must
  work against today's prod schema).
- Fresh install + existing account + pushed server flag ⇒ no storybook,
  and Part A's fix means their launch popups still arrive.

## Verify

- Unit tests for the gate decision matrix (local flag × server flag ×
  session presence) in `__tests__/`.
- Full suite + typecheck.
