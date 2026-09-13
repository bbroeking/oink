# Barn completion plan

Implementation status: delivered with three Sol sub-agents on 2026-09-10. Both Barn reward migrations are applied. See [completion handoff](../handoffs/2026-09-10-barn-completion.md) for implemented behavior, evidence, art treatment, and remaining installed-device acceptance. The proposal below is retained as the original planning record.

Date: 2026-09-10. Status: researched proposal following the approved prestige migration; the additions below have not been implemented.

## Deployment completed

The user approved the database push. A linked dry run identified only `20260910120000_habitat_prestige_rewards.sql`; that migration was applied successfully. Read-only checks found:

- Correct six rank-to-furnishing mappings with existing prices and sale availability intact.
- 49 prestige grant receipts, all 49 newly owned; zero eligible gifts missing at verification time.
- The migration recorded in the linked database.
- Neither anonymous nor authenticated roles can invoke the private reconciliation helper.
- Linked database lint at error level returned no findings.

The new client presentation and visit routing fixes still need distribution in an app build. No build or upload was requested or performed. The release follow-up remains queued, not marked released.

## Assessment

The Barn has a substantial foundation: 118 finished designs, a starter room, atomic saves, persistent drafts and retries, six decor positions plus a theme, ten collection tracks, preview-before-purchase, permanent Wallow gifts, two-pig visits, stamps, kindness, visit streaks, and Porch Rounds.

To feel complete, it needs a more continuous experience: a player should notice what they earned, understand why it matters, put it somewhere easily, show a room that expresses a choice, and see that friends appreciated it. Today those steps live in separate screens and some handoffs are absent.

## Priorities

### 1. Finish the reward-to-placement path

**Verified gap.** Season rank-up has no furnishing reveal. Grants reconcile during Barn reads, so a new item can enter ownership silently. The owner payload does not expose acquisition source or unseen grants. Collection purchases have feedback, but owned items offer a disabled Owned control rather than a placement action. The interior's route handoff currently handles `purchasedItemId`, while gift entry has no equivalent.

Evidence: `app/(tabs)/season.tsx` Wallow success flow; `utils/habitat.ts:54`; `app/barn-interior.tsx:64`; `app/barn-collection.tsx:525`; progression audit below.

**Proposed slice.** A brief gift reveal with **Preview in my Barn** and **Later**, a durable New marker, and a **Place** action for any owned furnishing. Preview opens a compatible slot in the existing draft. A committed room changes only on Save. A group of backfilled gifts gets one calm summary rather than six popups. Already-owned gifts are acknowledged honestly and never presented as another copy.

This is my first product recommendation. It makes the newly deployed rewards felt immediately and improves every later acquisition source.

### 2. Give prestige visible identity and a continuing goal

**Verified gap.** The six current rewards are also purchasable, and there is no additional Barn gift after rank 6. Players who bought ahead can reach a rank and receive no new visible object. Current gifts are useful progression benefits, but their appearance does not identify a prestige achievement.

**Proposed slice.** Keep the existing gifts and add a small, prestige-exclusive keepsake family: for example a Wallow plaque or trophy whose inscription shows the attained rank and whose appearance changes at a few authored milestones. Start with one compatible decor position and a bounded set of art variants. Show the next actual configured unlock and backfill entitled players. A changing rank inscription can recognize every further rank without promising a new illustration for every integer.

The exact art and milestone cadence are product proposals, not an inferred requirement or a claim that ranks currently stop at six. Keep the reward cosmetic; do not change regeneration, prices, or add refunds as part of this work.

### 3. Make the collection easy to use

**Verified gap.** The catalog searches names/descriptions and filters collections/position. The editor lists compatible owned items, but there are no New/Favorites filters or wishlist, and no general owned-item Place handoff. There is one saved room with six decor slots to express 118 designs.

Evidence: `app/barn-collection.tsx:151`, `components/habitat/HabitatEditor.tsx:77`, `components/habitat/HabitatSlotList.tsx:126`, `utils/habitat.ts:48`.

**Proposed slice.** Add Owned, New, and Wishlist filters, clear position labels, and source requirements. Then add one alternate named preset (two arrangements total), with exactly one explicitly active room that visitors see. Use the same existing ownership and layout validation; switching a preset must not duplicate items or overwrite an unfinished draft without a choice. Add a third preset only if two prove limiting.

### 4. Connect visits to inspiration and acknowledgment

**Verified gap.** A visitor can inspect a furnishing's name and description but cannot see its unlock requirements, bookmark it, or open its entry in their own collection. Guestbook history and kindness already exist; their presence should be carried into the room rather than replaced by another social system.

**Proposed slice.** A styled item detail sheet with available acquisition paths, **Save to wishlist**, and an explicit link to the visitor's own collection. Keep the host's saved room read-only. Never infer how a friend acquired an item from its appearance; use public catalog requirements, not their inventory or private receipts. Add a persistent host label and a small room-level view of existing guestbook appreciation. Opening or inspecting a Barn continues to give no tickle/visit credit.

### 5. Close the correctness and acceptance gaps

The earlier owner-routing fixes are in place. The broader audit found a separate, confirmed code-level race in `UserSheet`: target-scoped requests lack completion guards, so responses for A can populate stats or eligibility after the sheet switches to B. Address that before more social UI.

Ordinary sign-out already unmounts the authenticated tab tree. Direct non-null account replacement and post-action delayed callbacks are defense-in-depth cases to reproduce and test, not confirmed normal-sign-out failures. See the social audit for that distinction.

One concrete analytics defect also needs correction: `app/barn-interior.tsx:118–135` classifies an acquired item as a purchase when `isForSale` is true. Prestige gifts remain for sale, so sale availability cannot identify acquisition source. Initial-load grants also bypass this session-only ownership comparison. Use authoritative acquisition events/receipt summaries and deliberate deduplication before trusting a reward-placement funnel.

Physical VoiceOver, large text, weak-network recovery, two ordinary accounts, blocks/unfriending, and the exact installed candidate remain release acceptance work. The migration checks and 141 earlier Barn tests do not establish those device outcomes.

### Later polish

Two optional furnishing interactions could make the room feel lived in: a radio that follows the player's audio settings and a lamp with a subtle glow. The workshop cabinet already has a functional interaction. Add small furnishing responses only after the core paths above work, with Reduced Motion and mute respected.

A single nearest-next-goal summary can reuse existing collection progress. A new mastery economy, extra currencies, public voting, an open housing feed, unlimited furniture placement, and a large room expansion are outside the proposed completion slice.

## Research and how it informs the proposal

- FFXIV documents previews of unowned furnishings, category browsing, search, and newly added item categories. Barn already has previews and search; the useful extension is helping players find and use newly acquired pieces. [Official patch 5.0 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/330f2b280067d69d85b17831c66712a499e97484).
- Palia added housing search, visitor presence feedback, and a record of reactions from the last Home Tour. For Barn, this supports surfacing existing visits/stamps/kindness close to the saved room. It does not establish a need for a new vote system or reward currency. [Official patch 0.183](https://www.palia.com/news/patch-183).
- Nintendo's decorating products provide finished-room presentation and multiple creative canvases; the research note captures these first-party examples. An alternate Barn preset is the smaller proposed adaptation.

These are shipped-product precedents. The priorities and expected benefits for this game are design judgments; the sources do not prove a retention effect for Barn.

## Proposed sub-agent breakdown

Use Sol for substantial implementation/review and Terra for bounded QA/data work, consistent with AGENTS.md. These are implementation assignments proposed after three completed audit/research assignments. They have not been launched as feature work.

| Agent | Exclusive ownership | Deliverable and acceptance |
| --- | --- | --- |
| 1. Visit correctness | `components/UserSheet.tsx`, `components/BarnVisitModal.tsx`, focused identity tests | Out-of-order A/B profile results cannot alter B; host and visitor identities stay correct; direct account replacement and delayed actions are tested; existing visit budgets/stamps remain unchanged. |
| 2. Reward contract and prestige content | New reward migrations, `utils/habitat.ts`, generated DB types, `constants/habitat.ts`, new prestige art assets | Own-acquisition source, new/already-owned distinction, durable acknowledgment, catch-up, and bounded prestige content. Server-authoritative and retry-safe; correct lock order; old clients still parse; no wallet/layout mutation from gifts. Hand off frozen payloads before UI agents consume them. |
| 3. Reward experience | Season reward presentation, a new Barn gift component/hook, reward-flow tests | One reveal/summary per unacknowledged gift group, New survives dismissal/restart, Preview/Later both work, duplicate ownership is described honestly. Lead owns route integration in `app/barn-interior.tsx`. |
| 4. Collection and visitor discovery | `app/barn-collection.tsx`, `HabitatItemPreviewModal.tsx`, `HabitatFriendRoom.tsx`, new item-detail/wishlist modules | Owned/New/Wishlist views, truthful multiple acquisition paths, owned-item Place callback, exact visitor item inspection, navigation to the visitor's own collection. No edits to the host's room and no private host inventory access. |
| 5. Presets and decorating | `HabitatEditor.tsx`, `HabitatSlotList.tsx`, a new preset module/hook, preset tests | Two arrangements with one active saved layout, cancel/undo/conflict behavior preserved, no inventory duplication, no accidental replacement of active room. Backend agent owns any schema/API changes needed. |
| 6. Integration QA and measurement | Dedicated integration tests, acceptance fixtures/checklist, analytics validation; lead applies shared call-site edits | Exact source attribution, no duplicate events, gift → preview → save → friend view journey; two-account, offline/retry, accessibility and installed-candidate evidence. |

The lead owns integration changes to shared routes/hooks, `utils/interactionAnalytics.ts`, the ADR/domain updates, final verification, and release follow-ups. Do not let multiple agents edit these seams concurrently.

### Execution order within the four-slot limit

1. Lead freezes the reward/provenance, acknowledgment, placement, and preset contracts. Run Agents 1 and 2 alongside bounded Agent 6 baseline/reproduction work.
2. After Agent 2's payloads are stable, run Agents 3, 4, and 5 in parallel. The lead integrates their components into shared routes; their file boundaries remain separate.
3. Reuse Agent 2 for any preset migration after client contract review; then Agent 6 exercises the integrated journeys while the lead reviews diffs and runs required quality/database gates.

First shippable slice: target-safe profile sheet plus reward acknowledgment and owned-item placement. Next: distinctive prestige keepsake and visitor discovery. Presets follow when the acquisition-to-placement loop is working. The assignments above can be split by this delivery order rather than holding the first slice for every feature.

## Definition of done

A fresh player understands the starter room and places something. A returning high-rank player sees all entitled gifts without repeated popup spam. A newly promoted player sees exactly what changed and can preview and save it. A purchaser and a gift recipient both find their item easily. A friend sees the correct saved Barn, recognizes its owner, and can inspect a design and plan how to earn it. The owner can see existing appreciation and safely try another arrangement.

Verify those journeys with observed playtests and the installed candidate. Measure authoritative grants separately from purchases, then gift acknowledgment, first placement, successful room saves, furnishing inspections, wishlist use, and confirmed social actions. Compare behavior across new owners, high-rank catch-up players, and repeat decorators before changing price or adding another progression track.

## Supporting audits

- [Progression and rewards](../audits/2026-09-10-barn-progression-completeness.md)
- [Visiting and identity](../audits/2026-09-10-barn-social-completeness.md)
- [Primary-source research](../research/2026-09-10-barn-completeness-primary-sources.md)
- [Implementation and deployment record](../handoffs/2026-09-10-barn-prestige-and-visits.md)
