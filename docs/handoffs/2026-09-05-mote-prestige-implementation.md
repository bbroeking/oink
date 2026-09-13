# Prestige Motes and Mote Machine completion

Date: 2026-09-05. Local implementation complete. Migration **not applied**;
native release acceptance and editable Rive source export remain outstanding.

## Implemented behavior

Permanent Wallow Rank 3+ adds **one Mote at tiers 3, 8, 13, 18, and 23** on each
prestige lap after the ordinary pass. The original five rewards remain. These
amounts and positions were the stated implementation default; no alternative
was supplied. Existing eligible players can claim reached tiers in their
current lap, including when they already collected its original rewards.
Completed historical laps receive no backfill. Membership is not required.
High-rank players still begin each season on the ordinary pass. Shimmer Pocket
Motes continue unchanged.

The new migration `20260905174000_prestige_mote_rewards.sql` adds the rank-gated
catalog and transactional claim grants. `season_state`, individual claims,
claim-all, and rollover share eligibility. Profile-before-progress locking
serializes claims, rollover, and Mote spends; the existing unique per-lap tier
receipt prevents duplicate grants. The public Wallow tuning/cosmetic wrapper
and the Golden Truffle overflow claimer are preserved. Updated claim routers
reject an expected season/lap mismatch with `pass_changed`. Their optional
parameters support old callers, and the legacy claim-all item list reports the
actual Mote count. The new client omits context parameters until the server
exposes Mote support.

The pass renders the shared Mote sprite through its existing reward resolver,
shows exact granted quantities, immediately reconciles its entry-card wallet
from the receipt, and rejects stale reads that would overwrite that balance.
Mote confirmations offer **Use Motes** after modal dismissal. Mote-only sweeps
use that confirmation; mixed sweeps retain the existing summary and subsequent
mystery reveal. Empty-wallet hints identify both Shimmer Pockets and Rank 3's
Prestige Path. The subtitle derives its reward count from the catalog.

The existing Rosie/Barn Rive machine remains integrated and locally enabled.
One Mote yields a guaranteed 1/2/3/5 Clockwork Acorns, with the first resource grant
unlocking the Auto-Tickler. Animation never determines the grant. No `.riv`
binary or native runtime dependency was changed for prestige rewards.

## Verification

- `npm run quality:check:full`: **PASS**, including 157 Jest suites / **1,413
  tests**, TypeScript, production lint (zero errors; 533 repository warnings),
  layout/security gates, simulator-free iOS Metro export, the throwaway
  PostgreSQL harness, and read-only linked database lint. This export is not an
  IPA or a device acceptance run.
- `npm run quality:loop` ran during source/API changes. A final standalone
  `quality:check` result is saved alongside the full report.
- Behavioral PostgreSQL coverage: ranks 0–6; ordinary/eligible prestige paths;
  current-lap catch-up; unchanged original claims/rewards and rank hats; Golden
  Truffle overflow and mystery fallback; duplicate/sweep claims; hidden-reward
  rollover exclusions; stale season/lap rejection; fresh XP after rollover;
  privilege checks; authenticated concurrent claim-one/claim-all; and both
  spend-before-grant and grant-before-spend orders. It follows an earned Mote
  through the real spin receipt, inventory, and one-day Auto-Tickler activation.
  Only the harness's unrelated social/mystery seams are stubbed; wallet and
  claim/Contraption functions use the actual migrations. No production player
  balances were changed.
- Client tests cover immediate balance updates, stale read suppression,
  refused claims, expected context, old-server compatibility, exact summaries,
  shared art, and **Use Motes**/keep-for-later behavior. Existing native binding
  and screen recovery tests remain passing.
- Rive contract: **30 names, three byte-identical runtime copies**. SHA-256:
  `ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`.
  Actual WASM state-machine gate: **4.300-second spin, Result Hold, four repeated
  selectors in full and reduced motion**. Behavior tests do not certify pixels.
- Browser acceptance used the actual development routes at localhost:8083 and
  their local-only fixtures, never a production wallet. Full repeated plays
  showed 1/2/3 Acorn outcomes, wallet 8→7→6→5 and stored Acorns 0→1→3→6.
  Inventory activation spent one Acorn (6→5), showed about 24 hours active, and
  confirmed the Auto-Tickler was wound. At **320×568**, reduced-motion play
  showed a complete result and replay button without clipping; the empty state
  fit the new earning hint. Lost-response acceptance showed **Check last play**
  and recovered the same one-Mote/one-Acorn result. Forced renderer failure
  disabled spending and retained all eight Motes. Temporary viewport override
  was reset. These checks plus component/database tests cover the journey's
  seams; they are not a continuous native prestige-claim acceptance run.
- Release follow-up queue validates with 17 entries. New
  `prestige-mote-rewards` and existing `mote-machine-animation-completion` are
  queued; neither has a containing build or release notification recorded.

Evidence logs and the full structured quality report are under
`artifacts/mote-prestige-2026-09-05/`. The `before/` directory preserves the
starting versions of touched files that were already dirty. Unrelated work
in this shared checkout was retained.

## Remaining gates

1. **Database go.** Read-only linked migration history showed all 349 prior
   migrations applied, ending `20260829010000`; the new timestamp is later.
   No database push was run. Recheck pending migrations at rollout and apply
   only after the explicit user go required by root `AGENTS.md`.
2. **Fresh editable source.** The local `.rev` backup predates the repaired
   runtime. The cloud editor opened, but its export controls closed without
   producing a download, including an observed download-event timeout. No
   current editable archive could be obtained. Preserve the verified binary,
   hash-guarded repair scripts, and provenance in
   `docs/rive-mote-machine-authoring.md`; archive a current editor export and
   rerun the Rive gates before declaring source handoff complete.
3. **Native acceptance.** The existing native Debug host's bundled asset hash
   matched the canonical runtime; this task did not rebuild or interactively
   validate that host. Native controls were unavailable in the current tools.
   Test the installed current client: prestige claim→immediate wallet→machine,
   full/reduced repeated plays, safe areas/large text/VoiceOver, app background
   and resume, restart with a pending receipt, empty wallet, renderer failure,
   lost response recovery, and inventory activation. Automated native-binding
   and recovery tests do not replace this gate.
4. **Release.** No distributable build, upload, store submission, or release
   occurred. Follow `docs/RELEASE_CHECKLIST.md`, including changelog, gates,
   local build and artifact checks, then Transporter. Attach both follow-ups
   to the first containing build. For an RC, validate the exact installed
   binary and obtain the explicit go/no-go. Confirm the public version before
   marking the feature released or follow-ups notified.
