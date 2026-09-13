# Starter Barn onboarding and friend arrivals

The introduction now leads with a free furnished room. Eligible login discovery
prepares Warm Plank Barn, Rosie's Pencil Sketch, Sunflower Crock, and Patchwork
Rug before showing the illustrated gift announcement. Its primary action is
“See my Barn”; Shop and Maybe later remain available. The starter welcome
explains Edit and visiting friends, and also appears when the room was already
prepared by login or an authorized guest. Welcome dismissal remains local to
account/device; the announcement retains its existing account/version server ACK.

Housing-enabled friend visits now open directly inside the saved room with host
and visitor pigs. Outside remains available; unavailable rooms fall back outside.
Changing friends or reopening a visit starts inside again. The existing tickle
handler, budgets, guestbook eligibility and social accounting are unchanged.

Migration `20260908000000_habitat_starter_provisioning.sql` centralizes the four
starter grants in a private, locked helper. First authorized friend inspection
also prepares an absent room, so a friend need not have returned since rollout.
Friendship and blocking authorization run before provisioning. Replays grant no
duplicates, consume no Snouts, and never replace saved decorations or revisions.
The view and discovery RPCs are now VOLATILE because they may provision housing;
their response shapes and privileges are preserved. There is no bulk backfill,
new Mote dependency, or automatic Visit credit.

## Verification

- Focused client coverage includes existing-room welcome/dismissal, announcement
  navigation after acknowledgment, default interior arrival, both pig tickles,
  target changes/reopening, flag-off behavior, and unavailable-room fallback.
- Isolated housing database harness passes, including denied anonymous/blocked/
  non-friend callers, private inventory omission, unchanged saved layouts and
  wallets, and concurrent friend inspection versus owner starter claim.
- Native evidence uses local fixture data with real onboarding and scene
  components. Production-account end-to-end visits remain a release gate.
- Evidence: `artifacts/habitat-onboarding-2026-09-08/`.

Housing remains feature-gated. Physical assistive-technology acceptance, live
account acceptance and the release checklist remain open. No distributable build
or upload is part of this change. Release follow-up `barn-starter-onboarding` is
queued for the first build that contains it.

## Final result

The migration was applied under the user's earlier explicit authorization to run
housing migrations. Dry run contained only this migration; post-push dry run is
up to date. Linked types changed only by the private helper signature.

`quality:check` passes. The full runner passed contracts, TypeScript, all 179 Jest
suites / 1,548 tests, production lint, iOS export, and the complete DB harness.
Its final `npx supabase` lint process (downloaded CLI 2.117.0) stalled and was
terminated. The identical linked lint was run with installed Supabase 2.84.2 and
passed after deployment; `linked-lint.log` records this separate final gate.
The full-run log therefore is not an uninterrupted green run. Focused client
verification passes 6 suites / 39 tests.

Simulator evidence records the illustrated gift announcement, successful owner
entry, four-item starter welcome, and the saved two-pig scene. At the maximum
Dynamic Type size, all three announcement actions remain reachable by scrolling
(74.7 / 133 / 74.7 point button heights). Normal text size is restored. These are
visual/touch and accessibility-tree checks, not physical VoiceOver acceptance.
