# Build goal: Mote wagering and full animation suite

Written: 2026-09-06. Status: restarted from the specs with fresh independent audits, client fixes, live Rive routing corrections, and local verification. Matching Rive exports, shared Rosie authoring, native acceptance, and one unrelated full-quality lint failure remain open. See [current restart handoff](../handoffs/2026-09-07-mote-restart.md) and [earlier implementation evidence](../handoffs/2026-09-06-mote-wagering.md).

## Goal

Deliver the complete Mote Machine experience defined in
[spec 23](../specs/23-mote-wagering-and-animation.md) and its
[animation suite](../specs/23a-mote-animation-suite.md): an explicit earned-Mote
Wager mode with real losses and versioned payouts, the preserved guaranteed
Reveal mode, and a fully authored Rive/audio/haptic suite. A player can choose
a stake, commit exactly once, understand the exact result, recover it after
interruption, and use any Acorns in the existing Contraption Inventory.

This is a future build goal, not a claim that wagering already exists. The
spec's paytable and stake defaults are proposed. Implement them for local
acceptance unless the user changes them; report economy and audience-rating
implications before public rollout. Do not infer purchased stakes or cash prizes.

## Read before changing files

- Root `AGENTS.md` and `CONTEXT.md`.
- Both specs linked above; they define the new Wager behavior and animation
  deliverables. The animation manifest's exact names are finalized at contract
  freeze, not guessed by independent agents.
- `docs/rive-mote-machine-authoring.md` and
  `docs/handoffs/2026-09-05-mote-prestige-implementation.md` for the actual
  baseline and open source/native/rollout gates.
- `docs/specs/22-full-page-interactive-mote-machine.md` for preserved Reveal,
  Contraption, and legacy receipt behavior.

Inspect the current branch, dirty files, runtime hashes and linked migration
history. Preserve unrelated work. Verify the prestige migration's actual
status rather than assuming the previous handoff is current. Do not rebuild
the original wallet, prestige rewards or Contraption system from scratch.

## Work packages and checkpoints

1. **Freeze the game contract.** Record exact modes, stake/paytable version,
   weighted outcomes, net/total wording, reel mapping, receipt and recovery
   protocol, and v1 adapter behavior. Compute expected Mote and Acorn outputs
   and run short-session simulations. Identify any unresolved paid-source or
   audience-rating decision; independent local work can continue.
2. **Implement authoritative settlement.** Add uniquely timestamped migrations
   with immutable rules and v2 receipts, server-owned settlement, wallet
   revisions, owner-only history/recovery, and strict compatibility for v1.
   Test concurrent grants/spends and failure rollback in the throwaway harness.
3. **Produce the entire authored suite.** Obtain and archive current editable
   Rive source. Implement every required animation and result variant,
   reduced-motion behavior, Rosie reactions, sounds and haptic cues. Export
   and check all runtime copies; keep the working baseline until the new source
   exports and passes. Do not substitute a clip list for authored assets.
4. **Integrate the player flow.** Build mode/stake/paytable/history UI, the
   receipt-to-animation adapter, durable pending commands, result and wallet
   reconciliation, and inventory handoff. Carry forward Season/Shimmer earning
   entry points. Keep a pending v1 command on its original protocol.
5. **Run acceptance.** Exercise every outcome/stake/motion combination and
   critical recovery path through development-only fixtures and actual DB
   functions. Record current native captures, accessibility and performance
   results, then run the project's full quality and Rive gates.
6. **Prepare rollout.** Update current domain/authoring docs and a dated
   implementation handoff. Queue the economy/runtime follow-ups, document
   migration order and feature enablement/rollback, audience-rating result,
   exact build provenance and remaining device gates. Database push requires
   the user's explicit go; distributable builds follow the release checklist.

## Preferred parallel agents

Use bounded sub-agents with **explicit non-Astra models**. The lead owns
contract freeze, shared entry files and final integration. Suggested split:

| Agent                  | Preferred model                  | Ownership                                                                           |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| Economy/backend        | `gpt-5.6-sol`                    | Migrations, rules, settlement, DB harness and economy report.                       |
| Rive/animation         | `gpt-5.6-sol`                    | Editable source, runtime assets, binding manifest, animation verifier and captures. |
| Client flow            | `gpt-5.6-terra` or `gpt-5.6-sol` | Session/controller, UI, history, receipt adapter and focused tests.                 |
| Independent acceptance | `gpt-5.6-sol`                    | Review/QA after integration, with bounded test fixes assigned explicitly.           |

Run only as many as tool concurrency permits. Start parallel work after
agreement on receipt/binding contracts; rotate QA into an available slot.
Give each agent a file list and prevent simultaneous edits to shared routes,
types or assets. Use Luna for small documentation/fixture chores if useful.
Do not inherit Astra just because the lead runs Astra. Do not create separate
user-owned chats as a substitute for these temporary workers.

## Completion evidence

- [x] Reveal retains its old guarantees and receipts (database/client checks; installed V4 acceptance remains below).
- [x] Every Wager outcome/stake grants exactly its versioned table amount,
      including durable zero-return losses and neutral returned stakes.
- [x] Concurrent requests, retries, wallet updates and restarts cannot lose or
      duplicate funds or results; stale rules/altered requests cannot silently play.
- [ ] Every Rive-owned manifest row exists in editable source and current
      runtime, including loss, neutral result, full win suite and reduced motion.
      Native loading/render-failure rows have implemented fallback art and captured
      evidence. Text, reels, wallet, sound and haptic intensity agree on the outcome;
      bespoke Rosie clips are complete, not only their development mappings.
- [ ] The actual native journey reaches inventory and activates the helper;
      large text, VoiceOver, safe areas and performance have current evidence.
- [ ] Source archives, hashes, captures, rules arithmetic, simulation report,
      regression/DB tests, full quality gates and Rive gates are recorded.
- [x] Documentation and release follow-ups distinguish local completion,
      migration application, installed-binary acceptance and public availability.

Missing editable exports or native access must be recorded as unresolved;
do all independent implementation and validation before handing off the
specific remaining action. Do not call the full suite finished based only on
web fixtures or passing mocked bindings.

## Paste into the new chat

> Implement `docs/goals/mote-wagering-build-goal.md` and its linked specs.
> Set and pursue this build goal through local implementation and recorded
> acceptance. Use non-Astra sub-agents—prefer Sol, with Terra or Luna for
> bounded work—and keep integration with the lead. Preserve current Reveal,
> prestige Motes, durable receipts and unrelated checkout changes. Build the
> actual complete Rive/audio/haptic suite and earned-Mote Wager mode, not just
> planning documents. Follow the proposed spec defaults unless I revise them;
> do not add paid stakes or real-money prizes. Complete independent work and
> report any concrete source/device or rollout gates. Respect AGENTS.md's
> explicit database go and release checklist.
