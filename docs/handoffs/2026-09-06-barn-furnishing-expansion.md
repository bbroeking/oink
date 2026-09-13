# Barn furnishing expansion and login discovery

Implemented on 2026-09-06. The expansion migration is applied to the linked
database. Housing remains feature-gated and has not been released in a new
distributable build.

## Delivered

- All 100 planned designs have individually generated ChatGPT artwork, preserved
  transparent source PNGs, normalized runtime PNGs, and 128-pixel thumbnails.
  The merged catalog contains 118 unique designs and complete art coverage.
- Ten collections each contain eight Snout purchases and two earned designs.
  Own any four paid designs to earn the ceiling piece; own all eight to earn the
  rug. The expansion's 80 purchases total 7,500 Snouts. Original prices, starters,
  and three original milestones remain intact.
- The Shop has its own Barn Furnishings section. The collection supports search,
  collection filters, ownership, prices, room preview, and relevant 4/8 progress.
- The next eligible login shows an illustrated in-app announcement with Shop,
  Enter Barn, and Maybe Later actions. It waits for the housing flag and server
  availability. Account/version-scoped local dismissal is saved before hiding;
  a stable request retries server acknowledgment after interruption. Offline
  acknowledgment cannot trap the player. Timers and pending callbacks are guarded
  against logout, account changes, unmount, and rapid repeated activation.
- New furniture uses the existing six typed positions, list/spatial editor,
  revisioned saves, purchase recovery, and saved friend-room inspection. No new
  themes, placement types, Motes, wagering, or random acquisition were added.

## Database and verification

Migration `20260907010000_barn_furnishing_expansion.sql` was applied using the
user's explicit migration authorization. The preceding dry run contained only
this migration. Post-push dry run reports up to date, linked lint reports no
errors, and linked TypeScript types were regenerated and checked.

The migration adds collection metadata, deterministic grants and progress, and
private account/version announcement acknowledgments. Existing habitat locks,
unique receipts, and server ownership checks protect purchases and grants.
Housing smoke and concurrency coverage proves the expansion without Mote or
wagering migrations, including concurrent milestone purchases and ACK retries.

`npm run quality:check:full` passed: layout/security contracts, sprite integrity,
TypeScript, 179 Jest suites / 1,544 tests, lint with zero errors, simulator-free
iOS export, the full database harness, and linked database lint. Final
`npm run quality:check` and TypeScript passed after linked type regeneration.
Initial integration failures from 18-item test assumptions and duplicated fixture
metadata were corrected. One early direct harness invocation omitted the
canonical extra migration arguments; the full quality runner passed with them.

## Art and native acceptance

[Evidence directory](../../artifacts/habitat-expansion-2026-09-06/) includes logs,
native screenshots, accessibility trees, ten collection contact sheets, and
30 scene sheets. The asset validator checks all 100 unique exports, alpha,
dimensions, source/thumbnail presence, and SHA-256 identity. All 420 compatible
item/position/theme combinations fit the shared room bounds. All ten collection
sheets were visually reviewed; scene samples were inspected against the room.

Native checks use the real components with the isolated simulator fixture,
without production account or wallet writes. The announcement's three actions
are reachable with the largest iOS text size; moving its heading into the same
scroll area fixed a clipped-action issue found during acceptance. Native purchase
acceptance bought four Orchard designs for 375 Snouts and automatically granted
Blossom Bough Mobile at 4/8 ownership. Pearwood Rocker and that mobile were placed
and saved in the full-screen Barn.
The friend fixture displayed both saved pieces and inspected the rocker's name
and description. A cold app relaunch restored both pieces; with discovery still
enabled in the fixture, the acknowledged announcement stayed absent.

Exact prompts and generated source paths are retained in the
[first-50 manifest](../../artifacts/habitat-expansion-art/lead-first50-manifest.json)
and [last-50 manifest](../../artifacts/habitat-expansion-art/agent-last50-manifest.json).
Runtime images are in `assets/images/habitat/expansion`, thumbnails in
`assets/images/habitat/thumbnails/expansion`, and originals in
`assets/images/habitat/source/expansion`. Runtime exports total 22,706,718 bytes.

## Remaining release gates

No distributable build, upload, notification push, or housing flag enablement was
performed. Players receive the in-app announcement after installing a build
containing this work and becoming eligible when housing is enabled. The release
checklist, physical VoiceOver/Switch Control/keyboard acceptance, and live
two-account friend/relaunch acceptance remain open. These are not replaced by
simulator accessibility-tree or local fixture checks.

Release follow-up `barn-furnishing-expansion-100` is queued for the first
distributable build containing the expansion.
