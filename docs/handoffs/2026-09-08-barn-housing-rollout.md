# Barn housing: next-build rollout

User authorization: enable housing for all users in the next build (2026-09-08).

## Activation

`HABITAT_VISIBLE = true` is bundled with the next client. Both shared housing
flag hooks resolve it immediately, including while the legacy remote flag is
false, missing, or unavailable. The remote `habitat` setting and user overrides
are intentionally no longer authoritative for this released client. Other
feature flags retain their existing remote/loading behavior. Authentication,
friendship, blocking, wallet and ownership authorization remain server-enforced.

This activates Home Inside, Barn Furnishings in Shop, starter login discovery,
owner routes, and the two-pig friend Interior together. Previously installed
clients continue using their existing code and remote flag. No global remote
switch is required at release time. Reversing this client activation requires
changing the constant and shipping another build; do not rely on the legacy
remote flag as a kill switch for the new binary.

Required migrations through `20260908000000_habitat_starter_provisioning.sql`
were applied in earlier work. The next build must include the complete housing
implementation, all 118 designs, expansion and starter onboarding changes.

## The menu in the screenshot

“Local acceptance controls” belongs to `/barn-housing-preview`, a development
fixture backed by local simulator storage. Reset, offline, lost-response and
conflict actions exercise the implementation. The route uses a `__DEV__` guarded
require and redirects to Home in a production build. It is not player onboarding,
a production inventory editor, or the normal Home/Visit route.

## Final release checks

No additional furniture or player flow is planned. Before shipping:

- Test physical VoiceOver, Switch Control and keyboard navigation through the
  welcome, spatial/list editors, Shop and saved friend room.
- Use two non-admin accounts on the candidate: fresh starter grants, returning
  player introduction, purchase/relaunch recovery, saved-room friend arrival,
  blocked/non-friend rejection, and unchanged Visit budgets/tickle credit.
- Build and test the exact distributable via `docs/RELEASE_CHECKLIST.md`, including
  clean install/upgrade and confirming that fixture controls are absent.
- Include personal-barn-housing, barn-furnishing-expansion-100,
  barn-starter-onboarding and barn-housing-next-build-rollout follow-ups in the
  first build containing these changes. Record its actual version/build number.

These are device/release acceptance gates, not missing art or an outstanding
migration. No distributable build or upload was started in this task.

## Verification result

`npm run quality:check` passes (contracts, sprite integrity, TypeScript and fast
layout/security tests). The rollout-focused run passes 5 suites / 23 tests,
including legacy false/missing/failed remote flag responses and preservation of
other remote flags. Changed-source lint passes. Independent read-only review
found no additional housing implementation blocker; its six focused suites /
33 tests also pass. Evidence lives in `artifacts/habitat-rollout-2026-09-08/`.
The simulator-free iOS production export also passes; it is verification only,
not a signed distributable build.
