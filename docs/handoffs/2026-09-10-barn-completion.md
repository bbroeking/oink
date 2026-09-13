# Barn completion implementation — 2026-09-10

## Delivered

The lead and three Sol sub-agents implemented the approved Barn completion plan in the existing workspace. No commit, distributable build, upload, or store release was made. Existing unrelated changes were preserved. The user-authorized Impeccable update completed to v4.3.1 for the next session in the project’s `.agents` and `.claude` installations.

- **Earn, notice, place:** owner acquisition journal, separate presented/seen acknowledgments, one catch-up gift sheet, honest already-owned messaging, Later retaining New, and Preview/Place handoffs into the existing unsaved draft. Season Wallow reveals follow the rank summary and respect focus/account changes. Starter and purchase receipts do not trigger the gift sheet.
- **Prestige identity:** four exclusive, free framed shelf keepsakes at ranks 1, 3, 6, and 10, alongside the six existing gifts. The displayed inscription uses the host’s current lifetime rank, including ranks beyond ten. Catalog total is 122. The original designs and prices remain unchanged.
- **Discovery:** All/Owned/New/Wishlist filters compose with existing collection/position/search controls. The Wallow roadmap is collapsed by default and uses live catalog metadata. Earned provenance comes from the owner journal; visitor details show public requirements without guessing the host’s acquisition source.
- **Room choice:** two named presets, explicit draft-copy save versus public activation, optimistic revision checks, durable idempotent receipts, safe replay, and separate live-room/preset conflicts. Real unfinished drafts remain protected; a clean old draft no longer creates a false conflict after activation. Replacing an active preset’s positions clears its active marker.
- **Visits:** keyed owner sessions and stale-response guards cover the profile sheet and Barn actions. The host name remains visible inside. The read-only furnishing inspector uses an inline, scrollable, accessible overlay inside the existing native visit modal. Collection navigation dismisses the entire enclosing sheet and verifies the viewer account before navigating.
- **Appreciation and measurement:** existing Barn guestbook access is surfaced in the owner’s room. Acquisition events now come from actual new grants in the same database transaction; the client no longer infers purchase provenance from `isForSale`.

## Database deployment

Applied `supabase/migrations/20260910130000_habitat_completion.sql` with `npx supabase db push --linked --yes`, under the user’s prior “yes migrate the db” authorization. The dry run listed this migration only. The earlier `20260910120000_habitat_prestige_rewards.sql` was already applied.

Read-only live checks confirmed:

- New migration recorded once; keepsakes at ranks 1/3/6/10, cost zero, not for sale.
- 27 new keepsake receipts; all 49 original prestige receipts preserved.
- Zero missing eligible prestige gifts.
- All five new private tables have RLS and deny direct authenticated SELECT.
- Anonymous users cannot read the journal; authenticated owners can acknowledge their own receipts; clients cannot invoke the grant helper.
- Linked database lint at error level returns no errors. Warning-level lint reports existing unrelated function warnings; no new completion function warnings were returned.

Evidence and repeatable read-only SQL: `artifacts/barn-completion-2026-09-10/`.

## Validation

- Full Jest suite: **190 suites / 1,629 tests passed**. `npm run quality:check`, TypeScript, scoped ESLint, and the release-followup queue check passed. Logs are in the evidence directory.
- Scoped changed-file whitespace checks passed. A broader diff check also reported pre-existing trailing whitespace in unrelated `components/ui/EmptyState.tsx:64`; it was left untouched.
- Docker Habitat harness passed, including authorization/RLS, existing reward contracts, catch-up, source/analytics deduplication, wishlist, preset validation, conflicts, retry replay, and simultaneous identical activation through dblink.
- Added regressions for multi-batch offline acknowledgment with A→B→A account changes, local dismissal while the network hangs, separate New state, delayed route propagation, native-modal compatibility, preset clean-draft adoption versus real conflict, and fixture callback isolation.
- iPhone 17 Pro / iOS 26.4 development simulator: observed the compact collection, full 122-design fixture, ten-gift reveal, preview into an unsaved room, draft recovery across refresh, save confirmation, and the two-slot save/activate sheet. Native review caught the false preset conflict, a starter-copy error, and a fixture navigation fallback; fixes have automated regression coverage. The final fixes still need the ordinary two-account/device acceptance pass below.
- The fixture fallback briefly opened the signed-in user’s own Barn for reading. No live purchase, room save, preset activation, tickle, or social message was performed during simulator QA. The callback now remains inside the local fixture even without a position filter.

## Art provenance

Four original trophy cutout attempts contained painted checkerboards despite transparent-output instructions. They were not shipped. The final artwork uses deliberately opaque, full-bleed square wooden frames, copied unchanged from the image generator. No scripted image editing was performed. Their lower inscription plates receive the runtime rank text. The manifest records source paths, dimensions, hashes, and byte sizes. The four exports total about 10.7 MB; future approved asset optimization can reduce that packaging cost.

## Remaining release acceptance

These are implementation-complete changes, not an installed release candidate. The queued `barn-completion-journal-presets` follow-up must attach to the first distributable build containing them. Follow `docs/RELEASE_CHECKLIST.md` before any build.

On the installed candidate, verify two ordinary accounts: exact host identity and saved layout, block/unfriend/foreground invalidation, visitor wishlist and own-collection handoff, guestbook opening, Wallow→gift→preview→save→friend view, weak-network recovery/relaunch, preset activation and conflicts, VoiceOver focus, large text/keyboard behavior, and old-client compatibility. Recheck the latest callback and clean-draft fixes visually. No claims are made that unit tests establish those device outcomes.

The next product step is observed playtesting of this completed loop. Radio/lamp responses remain optional later polish; a new currency, mastery economy, public voting system, or unlimited placement is outside this slice.
