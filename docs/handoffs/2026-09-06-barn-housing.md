# Personal Barn housing — local implementation and acceptance

Latest amendment: the [100-design furnishing expansion and login discovery](2026-09-06-barn-furnishing-expansion.md)
are now implemented, with finished art and an applied expansion migration.
References to 18 designs below describe the original launch baseline.

Date: 2026-09-06. Implements [spec 24](../specs/24-player-barn-housing.md).
Status: local implementation and available native acceptance complete; physical
assistive-technology and linked-account acceptance remain open. The approved prestige,
wagering, and housing migrations were applied on 2026-09-06. Housing and wagering
remain disabled; no distributable build or upload has occurred. See the
[deployment record](../../artifacts/habitat-db-2026-09-06/deployment/verification.md).

## Delivered behavior

Home's Inside entry and the always-available Barn collection are gated by
`habitat`. Interior has six typed furnishing positions and one required theme,
with a finished four-design starter arrangement and exactly 18 launch designs.
Touch selection and the accessible list use the same draft reducer for placing,
moving, removing, undoing, cancelling, and saving. A design is an enduring unlock,
not an inventory quantity. Moving a floor item clears its former position.

The collection shows price, ownership, description, rarity, deterministic earn
requirements, and a room preview before a separately confirmed Snout purchase.
Returning from a selected position preserves the draft and previews the new
purchase only after the latest account refresh finishes. Saving is a separate
explicit action. Editor mutations are disabled during save acknowledgement.

Friends can enter/leave the committed Interior within their existing Visit
session. The same host/visitor pig nodes and tickle callback preserve Visit
accounting. Looking inside calls only the authorized snapshot read. Private
ownership, prices, balances, purchase receipts, and edit actions are not exposed.
Friend snapshots are cleared on background/auth change and reauthorized on
foreground; refusal returns the viewer outside.

The optional owner-only illustrated Workshop cabinet uses existing machine/inventory gates
and routes. It does not fetch anything for visitors or when disabled. An inventory
error does not prevent decorating or navigation. Housing's isolated database
harness deliberately omits Mote/Wager migrations.

Home shares its existing pig controller with Interior while unmounting the hidden
Home pig renderer. A cold deep link mounts one compact fallback controller.
Existing exterior backgrounds are omitted only in the Interior renderer.

## Persistence and authorization

Migration: `supabase/migrations/20260906190000_player_barn_housing.sql`.
Dedicated catalog, ownership, revisioned room/slots, milestone, and grant/save/buy
receipt tables are private under RLS; clients cannot directly write them.
RPCs are `claim_habitat_starter`, `my_habitat`, `view_habitat`, `save_habitat`, and
`buy_habitat_item`; `grant_habitat_item` is internal. Every save validates the
whole layout and expected revision. Exact request payloads are replayable;
changed payloads cannot reuse receipts. Purchases lock balance/ownership and
charge once. Required grant failures roll back their initiating transaction.

The client persists confirmed rooms, editable drafts with their base revision,
and exact pending commands under account-specific keys before sending mutations.
It serializes simultaneous Interior/Collection commands, retains uncertain
responses for replay, rejects stale account results, and never rolls back to a
lower revision. Conflicts preserve the draft for Review latest/Keep latest or
explicit Reapply and another save.

Guestbook Keepsake is earned only from a new stamp inserted after deployment;
there is no historical backfill. Apple Basket is awarded on the first custom
save; Firefly Lantern on the first save filling all six decor positions.

## Defaults and historical amendments

[ADR 0008](../adr/0008-personal-barn-housing.md) records amendments to ADR 0003:
generous starter, dedicated tables, permanent collection, whole-room save, and
shorter door transition. Historical habitat documents retain their original
content with a pointer to the amendment. CONTEXT.md records the implemented seam.

Retain the proposed 50/100/175 Snout tiers. Four common, four uncommon, and three
rare purchases total 1,125 Snouts. Nominal base regeneration is one tickle/hour
(`20260826000000_preserve_sluggish_snout_regen.sql`, lines 47–105), and consuming a
Home tickle earns one Snout (`20260772000000_referral_tickle_reward.sql`, lines
219–230). At neutral continuous spend this is about 24/day: approximately 2.1,
4.2, and 7.3 days per tier, or 46.9 days for all paid designs, before modifiers,
visits, bonuses, and one-time rewards. Bank caps and missed play affect realized
pace. Existing restored cosmetic prices start around 120–150 and reach 1,200
for an epic (`20260712000000_restore_art_backlog_items.sql`, lines 16–26).
Housing is intentionally easier to start collecting. These calculations validate
relative launch affordability, not a measured player retention forecast.
Immediately before seeding, the linked aggregate across 85 players showed a median
of 504 Snouts and a 75th percentile of 3,629. At that point 80.0%, 74.1%, and 64.7%
could afford the common, uncommon, and rare tiers respectively. The proposed
50/100/175 prices were retained.

## Art

All three illustrated room themes and fifteen transparent furnishing designs
ship as local PNGs with thumbnails, source art, and a reproducible export pipeline.
Door/cabinet/fallback art is bundled. [Art provenance](../design/barn-housing-art.md)
records prompts and processing. Room rendering waits for the current required
assets to settle and uses a visible fallback when an asset fails.

Composition proofs: `artifacts/habitat/all-furnishings-contact-sheet.png` and
`artifacts/habitat/two-pig-theme-contact-sheet.png`. These are composition evidence,
not substitutes for native interaction or assistive-technology acceptance.

## Verification record

- Independent housing database harness: PASS, including authorization,
  starter/grants, receipts, invalid payloads, revision conflicts, guestbook,
  concurrent saves/buys/starter/grants, and no direct client privileges.
- Full database harness with configured migration extras: PASS.
- Linked database lint at error level: PASS (`results: []`).
- Pre-deployment migration list: remote head `20260829010000`; the three pending
  migrations were subsequently applied with explicit user authorization (deployment record below).
- Database evidence: `artifacts/habitat-db-2026-09-06/verification.md`.
- Fast quality gate: PASS. Final full quality and native evidence appended below.

Native acceptance uses the actual exported Interior, collection, editor and Scene
components in the development-only `/barn-housing-preview` route. Its account and
wallet are explicitly local fixtures backed by AsyncStorage, with replay, offline,
response-loss, and conflict controls. It performs no real housing/wallet writes.
SQL authorization/economy evidence comes from the separate PostgreSQL harness.

## Remaining rollout and manual gates

The database migration is deployed and the feature remains dark. A linked backend
Home-to-Interior/new-and-existing-account/two-real-friends acceptance run still
requires test-account flag configuration and an authenticated native session.
The local fixture does not prove production network or Visit-accounting behavior.

Physical VoiceOver speech/focus traversal, Switch Control, hardware keyboard,
and exact release-installed binary acceptance must be recorded separately; native
AX snapshots and Jest assertions alone do not mark these gates passed. Verify
all exterior backgrounds and largest equipped outfits/companions on the installed
binary as part of that matrix.

`personal-barn-housing` is queued in `docs/release-followups.json`. Attach it to
the first distributable build containing housing; do not mark notified until that
version is confirmed live publicly. Any build must follow RELEASE_CHECKLIST.md,
including a pre-build gate report and changelog. No build is authorized by a
quality command. Linked database types were regenerated after the approved push;
semantic comparison confirmed no existing tables, views, functions, or enums were removed.
The changes reflect the three applied migrations; unrelated checkout changes are preserved.

## Final local gate results

`npm run quality:check:full`: **PASS** on 2026-09-06. The run passed quality
contracts, sprite integrity, security contracts, TypeScript, all **174 Jest
suites / 1,512 tests**, production-source lint, simulator-free iOS Metro export,
full database harness, and linked database lint. Lint retains existing warnings;
there were zero errors. The production export is a JavaScript/asset verification
artifact, not a distributable IPA. Complete log:
`artifacts/habitat-native-2026-09-06/quality-full.log`.

New behavioral coverage includes catalog/type rules; client receipt replay,
corrupt storage, account switches and conflicting instances; purchase-return
refresh ordering; editor mode parity and save-in-flight disabling; max-text row
stacking; Home pig-controller sharing; visitor read revocation; and cabinet gates.
The popup-priority source scanner now recognizes Home's conditional Interior
slot IDs while retaining strict canonical registry coverage. The collection's
shared PageHeader back target received a minimum width of 44 pt after native
measurement found a 30 pt target.

### Native fixture acceptance (iOS 26.4, development client)

Devices: iPhone 17e **390 × 844 pt**, iPhone 17 Pro **402 × 874 pt**, and
iPhone 17 Pro Max **440 × 956 pt**. The 17e used the actual OS content size
`accessibility-extra-extra-extra-large`; reduced motion was explicitly injected
through the application's shared MotionPolicyProvider. Evidence is under
`artifacts/habitat-native-2026-09-06/`.

| Exercised behavior | Result and evidence |
| --- | --- |
| Move right, remove, undo, cancel | PASS. `undo-restores-moved-item-ax.json` restores the right-floor Sunflower Crock and disables clean Save/Undo. |
| Spatial selection/place/save | PASS. `spatial-place-save.png`; selected empty Rafters, placed Dried Herb Garland, saved, and returned to the room. |
| Purchase and return to position | PASS after fixing the refresh race. `purchased-garland-draft-ax.json`; purchased garland appears in the draft, separate from committed save. |
| Lost save response | PASS. `lost-save-response-ax.json` retains the draft and exposes Retry; `replayed-save-no-conflict-ax.json` reconciles without a false conflict. Subsequent reopening renders the committed garland. |
| Lost purchase response | PASS. `lost-buy-response-ax.json`, `replayed-buy-1100-snouts-ax.json`: the fixture starts with 1,200, spends 50 on garland and 50 on clover, then replay reports 1,100 and owned clover, without a second charge. Final UI copy explains uncertainty and retry rather than showing a raw network code. |
| Stale device save | PASS. `conflict-preserves-draft.png` / matching AX JSON, then `reapplied-save-ax.json`: Review latest → Reapply my draft → explicit Save succeeds. |
| Offline draft/reopen | PASS. `offline-draft-reopened-ax.json`: Sunflower Crock remains moved left after reopening while offline, right is empty, and Save when online is disabled. Reconnect then saving through spatial mode succeeds. |
| Largest-text list/choices | PASS for layout and touch. `small-maxtext-list.png`, `small-maxtext-choices.png`, and AX JSONs: all seven labels remain full-width in a scrollable list; choice text wraps without squeezed words; actions remain visible and at least 44 pt. A theme was selected and saved at this size. |
| Three themes / both pigs / representative large outfit | PASS. `large-warm-two-pigs-outfit.png`, `large-spring-two-pigs-outfit.png`, `large-midnight-two-pigs-outfit.png`: Rosie with wizard hat, balloon and gold aura plus Pickles; all six furniture positions are occupied. Ceiling anchor was moved above the wall picture after native overlap testing. This is representative outfit coverage, not an exhaustive largest-equipment proof. |
| Visitor item inspection | PASS for renderer/UI. `friend-inspection-ax.json` opens Rosie's Pencil Sketch description from its wall target. Actual friendship/Visit accounting remains covered by SQL/client contracts and awaits linked-account device acceptance. |
| Unknown asset fallback | PASS. `large-missing-art-fallback.png`: deliberately unknown wall asset displays the bundled furniture fallback while the rest of the room renders and remains inspectable. |

`native-control-summary.json` summarizes recorded native controls.
`source-sha256.json` fingerprints the housing/direct integration sources at
handoff; the checkout was already dirty and includes another active feature.
No commits or unrelated checkout resets were made.

Early screenshots (`first-pass-iphone17pro.png`, `saved-move.png`, and
`saved-move-final.png`) are defect-discovery history, not final acceptance.
During capture, Expo development-only notification/keychain logs were dismissed,
and Metro was reloaded after asset updates; these are not production acceptance
results. Static composition sheets predate the final ceiling-anchor separation;
the final native captures are authoritative for that placement.

Local code, art, DB/client checks, and available native fixture acceptance are
complete. The overall build goal remains open for the physical assistive-technology
and linked-account gates listed above. Those gates were not silently checked off.

Final handoff rerun: `npm run quality:check` also **PASS** after the final layout
adjustments; log `artifacts/habitat-native-2026-09-06/quality-fast.log`.
`final-collection-ax.json` confirms the collection Back target is now 44 × 44 pt.
The two additionally booted acceptance simulators were shut down after capture,
and the 17e text-size preference was restored to the standard Large setting.
The original iPhone 17 Pro and development Metro server remain available for
review. Open `ticklethepig://barn-housing-preview` in the development client to
exercise the isolated local fixture; production routes remain feature-gated.


## Completion audit and final refinements

A second independent contract/UI audit found and closed additional edge cases:

- Pending save/buy commands now replay before and independently of the owner
  read. A recovered purchase merges its confirmed item and current balance into
  the durable owner cache before an optional refresh. Account identity guards
  cover every asynchronous refresh publication; revision ordering compares only
  snapshots belonging to the same owner.
- Missing or malformed legacy themes explicitly recover to Warm Plank Barn.
  The recovery marker survives cached reloads and keeps Save available until the
  next acknowledged repair. This presentation fallback does not grant ownership;
  the server still validates every saved design. Invalid furniture payloads are
  rejected. Missing room artwork uses the Warm Plank art fallback.
- A four-design first-entry welcome has durable account-specific intent and seen
  markers. Only a definite `not_found` initializes a room; an indeterminate
  `no_data` response cannot silently initialize or replay the welcome. The intent
  is persisted before claiming so an interrupted response can recover it.
- Confirmed furniture purchases reuse the existing purchase toast with the design
  name and current balance, plus one accessibility announcement. Preview dismissal
  completes before draft navigation/feedback. Account departure suppresses stale
  purchase feedback. Tests cover acknowledgement, uncertain response, modal
  handoff, and account changes.
- Room and list controls have explicit labels, hints, roles and state. A concise
  room summary appears in the native accessibility tree without hiding individual
  furniture controls. Separate 44-point spatial controls avoid overlapping art
  hit rectangles; the cabinet uses its finished art and gear badge instead of a
  cramped text label. Selection uses 160 ms motion or an immediate reduced-motion
  state. Both owner and friend entry/exit share the door transition; Reduced Motion
  uses 150 ms opacity with no door travel. Owner route navigation adds no stack slide.
- The actual `BarnVisitModal` client component is covered by behavioral tests:
  Inside/Outside calls no extra Visit mutation, both Interior pig nodes share the
  original tickle callback, the guestbook appears only after a successful tickle,
  and porch credit is recorded once. These mocked-boundary tests do not replace
  the still-pending linked-account native pass.

The exhaustive art proof is now
`artifacts/habitat/exhaustive-compatibility-contact-sheet.png`, with a machine-readable
manifest and 57 individual composites: all 15 furniture designs in every compatible
position across all three themes, including both floor positions. The lead and
scene agent inspected the sheet. This proof uses the final shared art anchors;
existing native outfit/two-pig captures remain the native composition evidence.

Additional native evidence under `artifacts/habitat-native-2026-09-06/`:

| Audit acceptance | Evidence |
| --- | --- |
| Welcome, safe area, four starter designs, single dismissal | `audit-starter-welcome.png` and AX JSON. Native inspection found and fixed a status-bar overlap by giving the native modal its own SafeAreaProvider. Final heading begins below the 62-point top inset. |
| Maximum-text welcome scrolling/dismissal and list | `audit-small-maxtext-welcome.png`, `audit-small-welcome-dismissed-ax.json`, `audit-small-maxtext-list.png` and AX JSON; actual iPhone 17e OS maximum text size, not a mocked font scale. |
| Native room summary | `audit-room-summary-ax.json` contains theme, furnished count and named placements. This proves the node exists; physical speech/focus acceptance stays open. |
| All seven spatial targets with the cabinet enabled | `audit-seven-spatial-taps.json`; each tap opened the matching position choices. `audit-spatial-controls-ax.json` records 44-point targets and the non-overlapping cabinet region. |

The overall goal remains open for the explicitly listed hands-on assistive-technology
and linked-account gates. No database push, distributable build, upload or public
rollout occurred during this audit.


Final audit gate: `npm run quality:check:full` **PASS** with **174 suites /
1,512 tests**, TypeScript, production lint (zero errors), iOS export, full DB harness,
and linked DB lint (`results: []`). This supersedes the earlier 170/1,485 baseline.
The final full log is `quality-full.log`. `audit-purchase-toast.png` captures the
confirmed 50-Snout Dried Herb Garland purchase, 1,150 current balance, and automatic
return to its Rafters draft; placement still requires the separate Save Barn action.

The final illustrated cabinet target is 54 × 88 pt in the 402-point view:
`audit-final-cabinet-room.png`, `audit-final-saved-room-ax.json`, and
`audit-final-cabinet-tap-ax.json` verify the updated control and its native tap.
The final maximum-text simulator was restored to Large text and shut down.
The fast quality handoff check also passes; `quality-fast.log` is current.

Native Reduced Motion owner exit is recorded in
`audit-reduced-motion-exit-focused.mp4` and the corresponding frame strip: a short
opacity transition with no lateral door movement, followed by navigation out of
the local fixture. The exact 150 ms configuration is covered by the transition
contract test; sampled video alone is not a frame-time benchmark. The untrimmed
capture also includes an earlier development HMR event and is not used to time exit.

A final recovery regression additionally verifies that acknowledged save snapshots
and matching clean drafts are durably cached before clearing the pending command.
A failed owner refresh followed by an offline remount retains the confirmed room;
if there is no owner payload to reconcile, the identical command remains available
for a later retry. Purchase receipts follow the same durable-before-clear ordering.

Normal save/purchase acknowledgments now use the same durable ordering as replay.
Equal-revision fresh save reads retain newly granted deterministic rewards; room
revision ordering is not incorrectly used as an ownership/balance version. The
final persistence-focused run passes all 25 tests across the hook and client contract.

Final native durability acceptance: moved Sunflower Crock from left to right,
saved, immediately set the fixture offline, and remounted the screen.
`audit-save-offline-remount-ax.json` confirms the committed right-floor placement,
retained purchased garland, and offline banner. The fixture was reconnected afterward.

Final frozen-source verification is complete: both `quality:check:full` and
`quality:check` pass after the acknowledgment-ordering changes. The copied final
logs report 174 suites / 1,512 tests. Housing source fingerprints match the files
verified by these runs. The goal stays open for hands-on assistive-technology and
linked-account acceptance; those unperformed checks are not reported as passed.


## Remaining-gates revalidation

The next goal turn rechecked all recorded housing source fingerprints against the
current worktree: no changes. The current full/fast logs still pass, and a fresh
linked migration listing confirms remote head `20260829010000`. The three pending
local migrations remain prestige `20260905174000`, wagering `20260906010000`, and
housing `20260906190000`. A generic DB push would include all three; rollout scope
must be explicit before applying anything. No push was attempted.

The same authorization/manual-acceptance blockers have persisted across three
goal turns. The goal is now blocked pending those inputs, not marked complete.
The production-RPC owner/friend journey, hands-on assistive-technology pass, and
installed-device acceptance matrix remain unproven. Local source/tests/art and
native fixture evidence are complete. Machine-readable revalidation:
`artifacts/habitat-native-2026-09-06/remaining-gates-audit.json`.

## Authorized deployment — 2026-09-06

The user subsequently authorized migrations. The prestige, wagering and housing
batch applied successfully, followed by a tested correction for secure sampler
extension resolution (`20260906200000`). Linked lint is clean, the combined DB
harness passes, and regenerated linked schema types pass TypeScript and the fast
quality gate. Housing and wagering flags remain false. Prestige Mote rewards
are live through their existing claims. The preceding blocked audits are historical;
the database authorization gate is now resolved.

[Deployment verification and raw evidence](../../artifacts/habitat-db-2026-09-06/deployment/verification.md)
record the exact migrations, pre-seed economy aggregate and remaining physical /
linked-account acceptance gates. No distributable build or upload was performed.

## ChatGPT visual target and app match

The user's subsequent visual request produced two imagegen screen targets and
new isolated pencil portrait/rug assets. The app now uses a full-route owner room,
compact top/bottom controls, smaller shared furnishing/pig proportions, and a
large-text action sheet. Inspection details remain scrollable and fully exposed
to accessibility. [Visual acceptance record](../../artifacts/habitat-visual-match-2026-09-06/verification.md)
includes the new source fingerprints, native screenshots, focused tests, quality
gate and iOS asset export. Earlier native screenshots/art fingerprints represent
the prior layout; hands-on and linked-account gates remain open.

## Fullscreen editing and 100 furnishing ideas

The next user revision removes the broad owner header/footer entirely, leaving
floating Outside, Collection and Edit controls. Editing retains the same full
room canvas with explicit markers and floating controls; the accessible list
shares the same draft. Native maximum-text overlap in the editing status was
corrected with a bounded compact status and readable placement glyphs.

The [100-design proposal](../design/barn-furnishing-expansion-100.md) supplies
ten collections with concrete descriptions and individual art briefs. It is
not runtime inventory or generated art; the 18-design launch catalog remains.
[This pass's verification](../../artifacts/habitat-immersive-edit-2026-09-06/verification.md)
records native edit/list/move/undo/cancel/save checks and current quality results.
Hands-on assistive-technology and linked-account acceptance remain open.
