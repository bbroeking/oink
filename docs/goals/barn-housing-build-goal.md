# Build goal: personal Barn housing

Written: 2026-09-06. Status: local implementation delivered and database deployed
with explicit user authorization; hands-on acceptance remains open. Final acceptance and
rollout gates tracked in [the implementation record](../handoffs/2026-09-06-barn-housing.md).
The feature remains dark. The approved migration batch was applied on 2026-09-06;
[deployment verification](../../artifacts/habitat-db-2026-09-06/deployment/verification.md) records the live checks.
Latest local audit: 179 Jest suites / 1,544 tests and the full quality gate pass;
all 57 original and 420 expansion furnishing/position/theme combinations are recorded. Physical
assistive-technology and linked-account device acceptance remain open.

The user-requested 100-design expansion, finished artwork, dedicated Shop entry,
and once-per-account login announcement are implemented. The expansion migration
is applied; see [expansion acceptance](../handoffs/2026-09-06-barn-furnishing-expansion.md).

## Goal

Build the personal Barn Interior described in
[spec 24](../specs/24-player-barn-housing.md). Every player can enter their Barn
from Home, receive a starter arrangement, decorate six typed positions and a
room theme, acquire deterministic furnishings, save their layout durably, and
show the saved room to friends during the existing Visit flow. Touch and
accessible list editing must have the same capabilities.

Deliver a complete small housing system with finished room/furniture art and
working persistence, purchases, awards, visits and recovery. Housing must work
for a player with zero Motes and remain buildable before the Wager feature.
An optional fixed cabinet opens the existing Mote Machine and Contraption
Inventory through their own gates and APIs.

## Read before changing files

- Root `AGENTS.md`, `CONTEXT.md`, and spec 24.
- `docs/habitat.md` and `docs/adr/0003-habitat.md` for earlier decisions.
  The new spec preserves the six-position Barn concept and proposes changes
  to starter generosity, catalog ownership and Shop cadence; record those
  amendments when implementing instead of silently rewriting historical ADRs.
- `docs/barn-visiting-design.md`, `docs/wiki/barn-and-habitat.md`, and current
  `BarnVisitModal`, Home/Barn, pig stage, shop, friendship and visit RPC code.
- `docs/homegrown-adventures-build-goals.md` to respect its independent browser
  prototype and avoid depending on its unbuilt production systems.

Inspect current code and linked migration history before assigning work.
The current Home screen is an Exterior-equivalent, not an already-built
housing system. Preserve its tickle loop, cosmetics, notices and statistics.
Protect unrelated checkout changes and coordinate any shared route/type edits
with other active work.

## Work packages and checkpoints

1. **Freeze the housing contract.** Keep one frontal 2D room, six typed decor
   positions plus a required theme, design unlock ownership, and no free-drag
   coordinates. Finalize starter/layout, 18-design catalog, category/position
   rules, whole-layout save/replay, friend access and internal grant contract.
   Use proposed local defaults unless the user revises them; state inherited
   decisions separately from new recommendations in the implementation record.
2. **Build persistence and grants.** Add uniquely timestamped migrations for
   catalog, ownership, revisioned layouts and durable grant/purchase/save
   receipts. Implement owner reads, friend-only committed snapshots, starter,
   atomic save/buy and deterministic awards. Exercise authorization, replay,
   concurrency and balance/ownership integrity in the throwaway DB harness.
3. **Produce the room and launch art.** Finish all three themes, fifteen decor
   images, shared anchors, thumbnails, entry door and optional fixed cabinet.
   Use the existing pig appearance renderer and test two-pig composition.
   Record original art sources, final exports and missing-asset fallbacks.
4. **Build owner editing and acquisition.** Add Interior entry/route, view
   mode, draft reducer, spatial selection and equivalent list editor,
   undo/cancel/save, shop-return continuity and conflict recovery. Build the
   always-available Barn collection and exact earned-item requirements.
5. **Integrate visits and optional workshop.** Add Inside/Outside within the
   existing Visit session; display only the host's saved layout. Keep the
   original tickle/cooldown/cap/guestbook/kindness/emote/Streak rules. Wire
   owner-only machine/inventory routes without duplicating their economics.
6. **Verify and hand off.** Exercise new/existing accounts, two-device edits,
   lost responses, relaunch, offline drafts, permissions and every item slot.
   Capture current native art/accessibility acceptance, run required quality
   gates, update domain/decision/asset docs, and write a dated implementation
   handoff with migration and release gates.

## Preferred parallel agents

Delegate concrete independent tracks to **non-Astra** sub-agents after the
layout/grant interfaces are agreed. Suggested work distribution:

| Agent               | Preferred model                   | Ownership                                                                     |
| ------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Persistence/economy | `gpt-5.6-sol`                     | New tables, RPCs, idempotent grants and behavioral DB tests.                  |
| Scene/content       | `gpt-5.6-sol`                     | Theme/furniture assets, anchors, pure room renderer and composition evidence. |
| Owner flow          | `gpt-5.6-terra` or `gpt-5.6-sol`  | Draft hook, editor/list parity, route and save/conflict tests.                |
| Integration/review  | Lead, then a bounded Sol reviewer | Shop/Visit/optional cabinet integration and end-to-end acceptance.            |

Use Luna for small catalog, fixture or documentation work if useful. Respect
the available concurrency limit, give explicit file ownership, and rotate
review into a free slot. The lead owns shared `Barn`, Visit, Shop and generated
type changes unless expressly assigned to one worker. Do not create extra
user-owned chats and do not inherit an Astra model for delegated work.

## Completion evidence

Checked implementation items below are supported by local client/native fixture
and PostgreSQL harness evidence; they do not imply production rollout. Physical
assistive-technology and linked-account acceptance remain explicit open gates.

- [x] Every player has one idempotently initialized Barn with the specified
      starter items; no existing inventory or exterior appearance is reset.
- [x] All 18 designs have finished art, exact deterministic acquisition rules
      and placement behavior. Owned designs are not consumed by rearranging.
- [x] Place/move/remove/undo/cancel/save work in both editor modes; a committed
      layout survives relaunch and a stale device cannot overwrite a newer save.
- [x] Purchases, starter and milestone grants are atomic and replay-safe.
      Changed payloads cannot reuse a request ID to acquire or save something else.
- [x] Friends see committed furniture and both pigs, can inspect items and
      tickle normally, and cannot edit or inspect private inventory. Merely looking
      inside never starts a visit, spends its allowance or credits social progress.
- [x] With Mote functionality disabled or unavailable, decorating and visits
      still work. Enabled cabinet actions operate only on the owner's own machine
      and Contraption Inventory; no random furnishing is required.
- [ ] Small/large phones, large text, VoiceOver/list editor, Reduced Motion,
      missing assets, offline drafts and uncertain save/purchase recovery have
      current native evidence.
- [x] Behavioral DB/client tests and quality gates pass. Architecture changes,
      art provenance, migration order and queued release follow-ups are recorded.

Local completion is distinct from database rollout and public release. Follow
root AGENTS.md's explicit DB go and release checklist. Record any unavailable
device/art/export dependency precisely after completing independent work;
do not mark visual or native acceptance done from unit tests alone.

## Paste into the new chat

> Implement `docs/goals/barn-housing-build-goal.md` and its linked spec.
> Set and pursue this build goal through local implementation and recorded
> acceptance. Prefer non-Astra sub-agents—Sol for substantial work, Terra or
> Luna for bounded tasks—with clear file ownership and lead integration.
> Build the actual personal Barn Interior, finished launch art, persistent
> decorating, deterministic furniture acquisition and friend Visit integration.
> Use the spec's proposed defaults unless I revise them, record changes to
> earlier habitat decisions, and preserve current Home/Visit behavior and
> unrelated checkout work. Housing must function without the new Wager mode;
> its optional cabinet should reuse existing machine/inventory routes.
> Complete independent work and report concrete remaining gates. Respect
> AGENTS.md's explicit database go and release checklist.

## Starter onboarding follow-up — 2026-09-08

Free rooms now initialize on eligible login and authorized friend arrival.
Friend visits open in the saved two-pig interior. The provisioning migration is
applied; 179 suites / 1,548 tests pass. See
[the onboarding record](../handoffs/2026-09-08-barn-starter-onboarding.md) for
the complete verification result, including the CLI lint fallback and remaining
physical accessibility/live-account/release gates.

## Next-build activation — 2026-09-08

User authorized all-user housing in the next build. `HABITAT_VISIBLE = true`
now controls both shared housing hooks; the previous remote off flag does not
hide the new client. Home, Shop, direct routes, starter discovery and friend
interiors are enabled together. No production setting flip or new migration is
required. See [rollout record](../handoffs/2026-09-08-barn-housing-rollout.md)
for remaining physical-device, two-account and exact-build acceptance gates.
