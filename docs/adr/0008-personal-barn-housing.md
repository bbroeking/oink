# Personal Barn housing: launch contract

Date: 2026-09-06. Implements spec 24; amends ADR 0003.

The user adopted the proposed defaults in `docs/specs/24-player-barn-housing.md`
and authorized local implementation and verified acceptance. Database rollout
still requires a separate explicit go. Housing launches dark behind `habitat`.

## Inherited decisions

One personal Barn has an Exterior (the existing Home) and a frontal illustrated
Interior. The Interior has six typed decor positions and one required theme.
Design unlocks are durable, never quantities; moving between the two floor
positions removes the previous placement. Friends can inspect the committed
room but cannot edit it. Furniture is bought with Snouts or earned from clear
milestones. There are no random furnishings or Mote requirements.

## Amendments to ADR 0003

- **Starter arrangement replaces empty launch.** First entry grants Warm Plank
  Barn, Rosie's Pencil Sketch, Sunflower Crock, and Patchwork Rug, with rafters,
  right floor, and shelf open. Existing inventory and cosmetics are untouched.
- **Dedicated housing tables replace catalog reuse.** Furniture never enters
  `hats`, `user_hats`, wearable equip RPCs, or cosmetic slot enums. No old housing
  data migration is needed: the earlier document described an unbuilt system.
- **Always-available Barn collection replaces daily rotation.** Eleven paid
  designs cost 1,125 Snouts in total. Three deterministic milestones add Apple
  Basket, Firefly Lantern, and Guestbook Keepsake. Rewards cannot grant twice.
- **Whole-room save replaces per-slot writes.** One exact seven-key command,
  expected revision, request UUID, and durable result receipt make saves atomic
  and retryable. Conflicts preserve the draft and require a fresh explicit save.
  Purchase receipts retain historical price/balance separately from current funds.
- **Door motion uses the shared Reduced Motion policy.** Spec 24's shorter
  transition budget supersedes ADR 0003's approximate 600 ms proposal.

The Homegrown Adventures browser prototype remains independent. The optional
fixed workshop cabinet calls the existing Mote Machine and Contraption
Inventory interfaces under their canonical gate. Cabinet failure cannot gate
housing, and visitors have no workshop inventory access.

## Rollout consequences

Server authorization remains authoritative. Housing has no writes to
`barn_visits`; existing tickles, caps, pair cooldowns, guestbook eligibility,
kindness, emotes, and Visit Streaks retain their existing owners. Looking inside
does not begin or credit a visit. Housing initialization and grants are safe
whether a guestbook milestone happens before or after first room entry.

See the dated [implementation record](../handoffs/2026-09-06-barn-housing.md)
for verification, art provenance, and outstanding rollout/device gates.

## Immersive room amendment — 2026-09-06

The user requested more of the screen for the Barn and an explicit editing mode.
Owner viewing now uses the full route behind compact floating Outside, Collection,
and Edit controls. Spatial editing retains the identical room canvas and adds
position markers plus safe-area-aware Cancel, More, Undo, and Save controls.
The accessible list editor remains available through More, using the same draft.
This supersedes the earlier broad owner header/footer arrangement.

The [100-design expansion proposal](../design/barn-furnishing-expansion-100.md)
adds ten collections of compatible furnishings. These are proposed content and
art briefs; the runtime catalog remains 18 designs. Collection ownership awards
are proposed future deterministic hooks, not implemented grants.

## Furnishing expansion amendment — 2026-09-06

The user's subsequent instruction to implement all planned art supersedes the
proposal-only status above. The runtime now contains the original 18 designs
plus all 100 illustrated expansion designs. Each of ten collections has eight
fixed-price Snout purchases and deterministic rewards at four/eight owned paid
designs. Private receipts and the existing habitat lock make grants retry-safe.

Barn Furnishings has a dedicated Shop entry. Discovery uses an illustrated,
once-per-account/version in-app login announcement, gated on housing visibility
and server availability. Local dismissal precedes presentation teardown, with
durable server acknowledgment retry; losing the network cannot block dismissal.
This adds no external push-notification permission or random/Mote dependency.

The expansion migration is applied; release and housing enablement remain open.
See the [expansion acceptance record](../handoffs/2026-09-06-barn-furnishing-expansion.md).

## Starter onboarding and friend arrival amendment — 2026-09-08

The user requested a gifted first room and direct visits into the two-pig Barn.
This supersedes first-owner-entry-only provisioning and exterior-first friend
arrival. Eligible login discovery or an authorized friend inspection initializes
an absent room using the same four starter grants. Existing layouts are never
replaced. The view RPC now performs this narrowly scoped housing write after
friendship/block checks; looking inside still does not begin or credit a Visit.
The in-app announcement leads with the starter gift and opens the owner's Barn.
Friend visits default inside with both pigs, retaining Outside and failure fallback.

See [implementation and acceptance](../handoffs/2026-09-08-barn-starter-onboarding.md).

## All-user next-build activation — 2026-09-08

The user authorized housing for everyone in the next build. The bundled
`HABITAT_VISIBLE` constant now resolves both housing flag hooks to enabled/loaded,
independent of the old remote `habitat` flag or tester overrides. Other flags and
server authorization are unchanged. This supersedes the dark rollout statements
above for the next client only. See [rollout and acceptance](../handoffs/2026-09-08-barn-housing-rollout.md).

## Empty starter Barn amendment — 2026-09-12

The user requested that everyone's Barn start empty. This supersedes the
automatically furnished starter arrangement above. Owner entry, authorized
friend inspection, and eligible discovery now initialize the Warm Plank Barn
shell with all six decoration positions empty. The same four starter designs
remain owned, ready for the player to place from their collection.

The migration clears only the exact untouched legacy starter arrangement:
revision zero, Warm Plank Barn, the original three placements, and no save
receipt. It preserves saved layouts, other arrangements, owned designs, and
grant receipts. Converted rooms advance their revision so a stale draft cannot
silently restore the old starter. Saving the empty default grants no decorating
milestone; placing a starter gift qualifies for the first-custom-layout reward.

Database rollout requires the separate explicit go described in `AGENTS.md`.
