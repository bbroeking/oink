# Full-body transformation contract

Hollow Jack is the first proposed full-body costume in Tickle the Pig. This
document defines the honest rendering boundary for the concept. It does not
claim production fit, shipping art, database support, or a current costume slot.

## Current capability

The native renderer has no costume slot today. `constants/slots.ts` routes hat,
bow, face, neck, aura, held, tickle, and background categories to existing
profile columns. `PigStage` composes auras behind the pig, the source pig, then
front accessories and held art. Its ordinary mask category is the Face slot and
is registered around the eyes; it cannot honestly carry a whole-body costume.

There are useful building blocks. The raster path already gives the pig and its
attachments one source-frame index, supports per-frame anchor resolution, and
has explicit layers behind and in front of the pig. React Native image rendering
supports transparent PNG alpha. Prebaked frame sequences also prove that the
renderer can select alternate art on the pig playback clock, though Hollow Jack
must remain a separate costume layer rather than replacing the source pig art.
Rive equipment support is a separate authored contract and cannot be assumed for
this first costume.

## Required render model

`category: costume` needs a dedicated body/full-body transformation slot. It
must never route through Hat or the existing Face mask column. The content ID is
`halloween_2026_hollow_jack_costume`.

For each pig and each source frame, author a registered costume shape on the
same 300 × 300 stage as the source pig. A costume frame may have two transparent
images:

1. a back region drawn behind the source pig; and
2. a front region drawn above the source pig.

Both regions advance from the same source-frame index as the pig. This preserves
feet, turns, jumps, and breathing without a second clock drifting out of sync.
The costume may fully cover the source pig when the authored silhouette calls
for it. The underlying pig stays mounted and unchanged, so animation state,
mood, reactions, facing, hit areas, and selected pig identity still belong to
the real pig. A face window or a narrow seam of the pig's coat under the face is
an optional art-direction tool for recognition, not a renderer shortcut.

The costume must support front/back occlusion per frame. A single full-canvas
sticker above the pig will fail whenever a hoof, vine, snout, or turn should pass
behind another form. A single sticker below the pig will disappear under the
body. The split-mask contract makes those relationships explicit.

## Equipment and identity

Equipping Hollow Jack visually hides every modular gear layer: hat, bow, glasses,
mask, neck, held item, aura, and tickle particle. The scene/background remains
visible. Hidden equipment IDs stay saved on the profile and are restored as soon
as the costume is removed. Equipping or removing the costume must not rewrite,
clear, or transfer those entitlements.

The player's chosen pig remains the account and social identity everywhere,
including Closet copy, visit labels, cards, ownership, and accessibility text.
The costume changes presentation only. Its permanent entitlement is granted by
the first copy of card `halloween_2026_card_hollow_jack_costume`; later trading
of that card copy never revokes the entitlement.

## Validation matrix

The art gate is every combination of six pigs and 48 source frames: 288 base
registrations before mirrored-facing and surface checks. Review each combination
for silhouette registration, transparent edges, ground contact, face-window or
coat-seam intent, front/back occlusion, and no flash of hidden modular gear.
Then exercise animation boundaries, front/profile transitions, mood and reaction
changes, reduced motion, frozen previews, visit mirroring, Closet, Barn, Visit,
shop preview, and any compact portrait that elects to show the costume.

A successful concept composite or one-pig idle loop is not a shipping-fit result.
Exceptions must name the pig, animation, frame, surface, and failed relationship.

## Viable first slice

The honest first slice is concept art plus a raster proof for one pig and one
short animation family, using separate back/front alpha masks on the shared pig
frame clock. It should demonstrate coverage, optional recognition cues, and one
occlusion crossing. It should not add a production slot, migration, ownership
write, Rive state machine, or claim support for all pigs.

If that proof reads well, the next step is the complete 6 × 48 authored mask set,
the dedicated persisted costume slot, renderer and Closet support, hide/restore
tests for existing equipment, and cross-surface acceptance. Until those gates
pass, Hollow Jack remains approved content direction pending art and rollout.

## Optional social beat

On a friend visit, a host pig may play a special **Spook** reaction when the
visitor wears Hollow Jack. Keep it cosmetic by default: no score, currency,
streak, reward, or gameplay buff. This supports Connect by giving the costume a
small friend-facing moment without turning it into an advantage.
