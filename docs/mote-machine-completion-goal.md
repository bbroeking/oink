# Complete the Mote Machine and add post–Prestige 2 Mote rewards

Written: 2026-09-05.
Status: local implementation complete; final verification recorded in the [implementation handoff](handoffs/2026-09-05-mote-prestige-implementation.md). Native acceptance, editable-source export, and rollout remain open.

## Goal

Finish and validate the existing Rosie/Barn Rive Mote Machine in the game,
and give players beyond Prestige 2 a continuing way to earn Motes from the
post-completion battle pass. A player must be able to claim an earned Mote,
open the machine, spend exactly one Mote, see the server-confirmed Clockwork
Acorn reward, and use those Acorns in the Contraption Inventory. Existing
eligible players must be included, not just players who reach that rank after
the change.

Reuse the current machine, wallet, receipt ledger, and Wallow progression.
The feature is implemented locally only after the end-to-end checks pass;
release acceptance and public availability are separate milestones.

## Current state, verified on 2026-09-05

| Area | State | Evidence |
| --- | --- | --- |
| Rive artwork and animation | Implemented: Rosie cabinet, three continuous clipped reels, lever, Mote deposit, Acorn reveal, and persistent result. | [Authoring contract](rive-mote-machine-authoring.md). |
| Runtime asset | Bundled in the shared assets, iOS, and Android; all three copies are byte-identical. | `npm run verify:rive-mote-machine` passed: 30 required names; SHA-256 `ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`. |
| Actual state-machine behavior | Full motion runs for 4.3 seconds and enters Result Hold; four repeated result selectors work in full and reduced motion. | `npm run test:rive-mote-machine-state-machine` passed against the current bundled asset. This verifies behavior, not rendered pixels. |
| Game integration | Production route, Season entry card, native and web Rive adapters, receipt recovery, and Contraption inventory exist. Current `MOTE_MACHINE_VISIBLE` is `true`. | `app/mote-machine.tsx`, `components/mote-machine/`, `components/season1/MoteMachineCard.tsx`, `app/contraptions.tsx`, `constants/featureFlags.ts`. |
| Focused regression checks | Seven suites / 34 tests passed in this review. | Native binding, screen recovery, entry card, client RPC contract, acceptance fixtures, experience, and migration checks. |
| Economy | Current local SQL and app contract spend one Mote for a guaranteed 1, 2, 3, or 5 Clockwork Acorns. First receipt unlocks the Auto-Tickler; repeats replenish its resource. | `utils/moteMachine.ts`, `supabase/migrations/20260829000000_contraptions_and_streaks.sql`. Live server behavior was not exercised in this review. |
| Prestige rewards | Implemented locally: five additional Motes at tiers 3/8/13/18/23 from permanent rank 3. The original rewards remain. Migration is prepared and unapplied. | `20260905174000_prestige_mote_rewards.sql`; behavioral harness covers eligibility, catch-up, claims, rollover, concurrency and legacy callers. |
| Shipped availability | Build 179's changelog says the machine was hidden. Today's local enablement is not evidence of a new release. | [Build 179](builds/2026-08-30-build-179.md), [September 5 audit](audits/2026-09-05-code-quality-and-performance.md). |
| Editable-source archive | Latest local `.rev` predates the September 5 source repair. A fresh editable backup remains outstanding. | Runtime provenance in [the authoring contract](rive-mote-machine-authoring.md#runtime-provenance--2026-09-05). |

Older handoffs describe Tickle payouts, alchemy controls, a missing export, or
an unfinished state machine. They are historical. The current contract is a
guaranteed Contraption-resource reveal. Rive properties named `tickles` and
`ticklesLabel` are legacy presentation names, not Tickle grants.

## Implemented reward rules

The implementation uses permanent Wallow rank **3 or higher**
(`profiles.wallow_count > 2`) on the prestige path after the ordinary pass.
Each eligible lap adds **one Mote at tiers 3, 8, 13, 18, and 23**, preserving
all five existing rewards. This was the stated implementation default after
the user requested execution; no alternative policy was supplied.

Reached tiers in an existing eligible player's **current lap** are claimable
even if the original five rewards were already collected. Finished historical
laps are not backfilled. A new season keeps permanent rank but begins with the
ordinary pass; Mote tiers become available on its subsequent prestige path.
Slop Club is not required, and Shimmer Pockets still grant Motes.

The server uses one rank-filtered catalog for display, single/all claims and
Wallow rollover. Permanent rank changes only on rollover; profile and progress
locks keep a lap's eligibility stable during claims and concurrent spends.
Updated clients send the expected season and lap; stale requests receive
`pass_changed` before granting anything. Optional parameters preserve older
callers, and the older claim-all item summary includes the actual Mote count.

## Implementation work

### 1. Finish machine acceptance and source provenance

- [x] Verify the current runtime copies and actual state-machine progression.
- [x] Run the seven focused Mote Machine regression suites.
- [ ] Archive a current editable `.rev` from the corrected cloud source. Keep
  the hash-guarded repair and its provenance until a fresh editor export passes
  all existing gates directly.
- [ ] Visually test the current bundled asset in a rebuilt native development
  client: ready, deposit, lever, full spin, staggered stops, reveal, result
  hold, and repeated plays. Do not treat old simulator screenshots as evidence
  for the September 5 repaired binary.
- [ ] Verify Reduced Motion, small-phone safe areas, large text, VoiceOver,
  background/resume, empty wallet, failed renderer, lost response after commit,
  and app restart during a pending play.
- [x] Confirm balances and the displayed reward match the durable receipt and
  that retrying a pending play never spends a second Mote in the database,
  client recovery tests, and development browser acceptance. Native repetition
  remains part of the device gate above.

### 2. Add authoritative prestige Mote rewards

- [x] Record the selected eligibility, quantity, placement, and catch-up rules.
- [x] Add a new uniquely timestamped migration after the latest applied
  migration. Extend the reward catalog and grant path without editing historical
  migrations or replacing existing earned rewards.
- [x] Make `season_state`, `claim_wallow_tier`, `claim_season_tier`,
  `claim_ready_tiers`, and the Wallow rollover checks agree on the eligible
  rewards. Updating only the displayed catalog is insufficient: rollover must
  not block lower-rank players on hidden rewards.
- [x] Credit the existing `profiles.mote_balance` transactionally with a unique
  claim receipt. Derive the caller, rank, season, lap, tier, and amount on the
  server. Concurrent claim-one, claim-all, retries, and machine spends must
  remain consistent; use a compatible locking order.
- [x] Preserve the Golden Truffle overflow fix, Mystery Hat Box behavior,
  permanent rank rewards, and existing XP/overflow semantics.
- [x] Handle existing eligible players without resetting claims or regranting
  old prizes. If historical catch-up is selected, give it an independently
  idempotent ledger and verify the eligible cohort read-only before rollout.
- [x] Keep legacy callers safe: grant only what a successful claim records,
  return truthful results, and explicitly test any older app behavior affected
  by new required claims before exposing those rewards.

### 3. Complete the player flow

- [x] Show Mote art, count, locked/ready/claimed states, and the next reward in
  the existing pass layout (`utils/rewardArt.ts`, `utils/seasonPass.ts`,
  `components/season1/YourTakeStrip.tsx`, `app/(tabs)/season.tsx`).
- [x] Extend claim results and claim-all summaries in `hooks/useSeason.ts` and
  the Season screen so the player sees the exact number of Motes granted.
- [x] Offer a clear **Use Motes** action from the Mote reward confirmation to
  `/mote-machine`. Refresh the entry card and wallet after claiming; focus-only
  refresh may leave the card stale while the player remains on Season.
- [x] Replace the hard-coded prestige subtitle's “five rewards” if the reward
  count changes. Update empty-wallet and earning hints to explain the new
  prestige source as well as Shimmer Pockets.
- [x] Use the same recognizable Mote icon throughout reward art, entry card,
  balance, and confirmation.
- [x] Update `CONTEXT.md`: the current Mote source description and Mote Machine
  seam still need to reflect prestige earning and Contraption-resource grants.

### 4. Verify and prepare release

- [x] Add behavioral database tests for ranks 0/1/2 (excluded) and 3+ (eligible),
  base pass versus prestige path, a high-rank player in a fresh season,
  already-earned tiers, chosen catch-up behavior, duplicate/concurrent claims,
  claim-all, rollover, and a claim racing a machine spend.
- [x] Verify the journey in component/hook tests, the real database harness,
  and the development browser: earned Mote → wallet → Rive spin → exact Acorn
  receipt → inventory → Auto-Tickler activation. These checks cover the seams;
  one continuous journey on the exact installed native release remains open.
- [x] Run `npm run quality:loop` during layout/API work, then
  `npm run quality:check`; run the release-grade full quality gate and Rive
  gates before preparing a distributable build. Record current failures rather
  than carrying forward historical pass counts.
- [x] Queue the new prestige economy change in `docs/release-followups.json`
  while implementing it. Reuse the already queued
  `mote-machine-animation-completion` entry for animation/receipt verification.
  Both are queued; attaching them to the first containing build remains a release gate.
- [ ] Apply migrations only after the explicit database go required by
  `AGENTS.md`. Before any distributable build, follow
  `docs/RELEASE_CHECKLIST.md`, write its changelog, and report its gates. Use
  local EAS with the required heap; upload through Transporter.
- [ ] Validate the exact installed release binary. If designated an RC, follow
  the RC lane and explicit go/no-go. Confirm the public store version before
  marking the feature released or its follow-ups notified.

## Definition of done

A player beyond Prestige 2, including someone already at that rank when this
ships, can earn the specified Mote reward, claim it exactly once, see the
updated balance immediately, and use it in the polished Rive machine. One
Mote yields one durable, useful Contraption-resource result; interruptions
cannot lose or duplicate the spend or grant. Lower ranks retain their existing
reward paths without hidden claim blockers. Native acceptance, quality gates,
editable-source provenance, migration rollout, and the release checklist have
recorded outcomes.

## Execution prompt

> Complete the existing Mote Machine and implement post–Prestige 2 battle-pass
> Mote rewards using `docs/mote-machine-completion-goal.md`. Read `AGENTS.md`,
> `CONTEXT.md`, and `docs/rive-mote-machine-authoring.md` first. Preserve the
> working Rosie/Barn Rive asset and authoritative Contraption economy. Follow
> the recorded reward policy and implement
> database claims and the complete reward-to-machine player flow. Include
> existing eligible players and protect retries, concurrent claims, and Wallow
> rollover. Run the documented behavioral and quality gates, archive current
> editable source, and record native acceptance. Respect the explicit database
> go and release-build requirements; distinguish local completion from release.
