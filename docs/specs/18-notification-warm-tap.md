# Spec 18 — Notification tap while app is open: crash / non-neutral state

**Source:** founder bug report 2026-07-17: "if the app is open and you tap a
notification, it doesn't open the app in a neutral state — the app crashes."
This spec is DIAGNOSE-FIRST: reproduce the failure path in code before
changing anything, and write the diagnosis at the top of your report.

## Where to look

- `app/_layout.tsx` ~line 910-940: cold-start taps use
  `Notifications.getLastNotificationResponseAsync()` (the response listener
  doesn't fire for cold starts); warm/foreground taps use
  `Notifications.addNotificationResponseReceivedListener` → `routeForScreen`
  → router navigation.
- `utils/notificationRouting.ts` — `routeForScreen` mapping.
- Suspects to rule in/out (verify each against the code, don't assume):
  1. **Warm tap navigates while a native modal / popup-queue slot is
     presented** → the iOS #50152 wedge (navigation under a presented
     Modal, or a modal surviving a route change and eating touches —
     reads as "crash"/frozen). Check whether the warm-tap handler drains
     the popup queue / closes unmanaged sheets before `router.push`.
  2. **Cold-start `getLastNotificationResponseAsync` replays a STALE tap**
     on later warm launches/foregrounds (the same response object can be
     returned again) → app re-navigates unexpectedly instead of opening
     neutral. Check for a consumed-guard (response identifier stamped once).
  3. **Navigation before the router is ready** (tap lands during the
     saddling gate / onboarding hold) → expo-router throws on navigate
     before mount. Check ordering vs `authChecked` + the username gate.
  4. Route target missing (a `screen` value in pushes with no
     routeForScreen mapping navigating to null/invalid).

## Fix expectations

- A warm tap must land the app on the target screen with no wedge: close /
  release any presented sheet or queued popup first (the spec-02 primitives
  — holds, two-phase dismiss — are available), THEN navigate after the
  teardown beat.
- A stale last-response must never replay: consume-once guard keyed on the
  response's notification identifier + date (AsyncStorage or module state).
- A tap that arrives before the router/auth gate is up defers the
  navigation until the shell mounts (a pending-route ref), never throws.
- Keep `routeForScreen` the single source of truth; unknown screens no-op
  cleanly.

## Verify

- Unit-test the consume-once guard + pending-route deferral (pure parts).
- Manual reasoning in the report for each suspect: confirmed / ruled out,
  with file:line. Full suite + typecheck.
