# Barn prestige gifts and visit ownership

The Barn already had 118 illustrated designs, starter gifts, three decorating/social milestones, ten collection reward tracks, a saved room editor, and friend visits. It had no furnishing rewards tied to permanent prestige. Visiting used the correct target IDs, but reusing a mounted visit when switching friends could retain the previous host's state.

## Implemented

The six established Wallow reward ranks now each gift an existing furnishing:

| Permanent Wallow rank | Gift | Placement |
| --- | --- | --- |
| 1 | Dried Herb Garland | Rafters |
| 2 | Barn Bunting | Back wall |
| 3 | Muddy Paw Rug | Center floor |
| 4 | Reading Chair | Either floor side |
| 5 | Tiny Radio | Shelf |
| 6 | Midnight Rafters | Room theme |

These are free alternatives to buying the existing designs early, using their finished artwork and retaining current prices. This adds no exclusive designs or new art. Gifts are durable ownership, cannot be duplicated, and do not auto-place themselves. Existing high-rank players receive all earlier gifts through migration backfill. Later ranks are reconciled when the Barn is opened or refreshed, including starter provisioning. The current gift ladder covers ranks 1–6; ranks above six retain all six gifts.

The Barn Collection shows the ladder, current permanent rank, owned gift count, and a Wallow gifts filter. Each eligible furnishing's card and purchase preview explains the free rank alternative. Live server catalog metadata controls this presentation, so an older backend does not advertise rewards it cannot grant. The client accepts owner responses and cached data without the new optional fields.

Server grants use the existing habitat advisory lock and durable receipt mechanism. Private reconciliation and grant helpers are not callable by clients. No profile update trigger was introduced: this avoids taking habitat locks from a profile update while a purchase holds the habitat lock and waits for the profile. A previously purchased design gets a receipt recording that it was already owned; it does not receive a second quantity, charge, or refund. Layouts, revisions, and balances remain unchanged by grants.

## Visit audit

- Friends list and UserSheet both pass the selected player's ID to the visit and now key it by that ID.
- BarnVisitModal also keys its complete inner session by target ID. Switching hosts resets pig/profile data, visit tallies, action callbacks, and request lifetimes together.
- `fetchFriendHabitat` sends the requested ID as `p_owner` and rejects a successful response whose snapshot owner differs.
- HabitatFriendRoom additionally checks the owner before rendering, rejects mismatched responses, and discards responses from an older request generation. The frame before the refresh effect runs cannot display the previous owner's room.
- The existing `view_habitat` RPC validates authentication, owner existence, blocks, and accepted friendship before provisioning or reading the requested owner's saved snapshot. Looking inside still does not credit a tickle visit or expose inventory/drafts.

## Next addition: discover furnishings during visits

Extend the existing tap-to-inspect label into an item detail sheet with the furnishing's name, source, exact unlock requirement, and a **Save to wishlist** action. For a purchasable item, offer a link to that item in the visitor's own Barn Collection; for a prestige gift, show the required Wallow rank. Read requirements from the visitor's authorized catalog, never the host's private inventory or grant receipts.

This is the next useful connection between the two systems: a friend's decorated room shows what progression can earn, and a wishlist gives the visitor a reason to return to decorating. Keep saving a wishlist entry separate from purchasing or placing. Measure inspection → wishlist → earned/purchased → placed conversion using explicit actions.

After that, consider three named saved-room presets to make 118 designs easier to rotate, followed by prestige-exclusive keepsakes for ranks beyond six. Those are proposals, not part of this implementation.

## Validation and rollout

- 141 tests passed across 22 Barn/habitat suites, including owner switches, late responses, malformed owner responses, grant metadata parsing, backward compatibility, position-aware gift filtering, purchases, saving, and durable recovery.
- The local Docker habitat database harness passed: rank 0–7 backfill, later catch-up, replay, prior ownership, gift placement, metadata visibility, private grants, authentication, wallet/revision preservation, and the earlier housing/concurrency checks.
- Scoped ESLint had zero errors and six existing React hook/compiler warnings in Barn Collection. Independent client review found no actionable issue.
- `npm run quality:loop` was used during edits. Final `npm run quality:check` passed all contract, sprite, TypeScript, layout Jest, and security Jest gates. The three RPC owner-binding tests also passed after correcting their mock typing.
- Evidence: `artifacts/barn-prestige-2026-09-10/`.

The linked migration list initially showed `20260908000000` as the latest applied migration. On 2026-09-10 the user explicitly approved deployment. The dry run identified only `20260910120000_habitat_prestige_rewards.sql`, and `npx supabase db push --linked --yes` applied it successfully. Read-only production checks confirmed its migration record, the six correct rank/price mappings, 49 prestige receipts and 49 newly owned gifts, zero missing eligible gifts, and no authenticated/anonymous execution access to the private reconciliation helper. No build or upload was performed. The client changes still require distribution; physical-device visual/accessibility acceptance and visits between real accounts remain release checks.

Release follow-up queued as `barn-prestige-gifts-and-owner-routing`; attach it to the first distributable build containing this work.
