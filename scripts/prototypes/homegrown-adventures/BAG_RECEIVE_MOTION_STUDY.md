# PROTOTYPE — Rosie Bag receive motion study

Question: **How should one freely chosen item enter Rosie's already-open Bag
without producing a second satchel or covering Rosie?**

Run `npm run prototype:homegrown:serve`, then open Position 7 with
`?mode=loop&position=7&motionStudy=1&variant=A`. The bottom switcher and left /
right arrow keys cycle three throwaway treatments. Bag-pocket arrow keys remain
reserved for the real tablist.

## Locked visual context

- Approved composition:
  `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/07-free-bag-selection.png`
- Keep Rosie and one open Bag visible throughout.
- The chosen item must become recognizable inside the Bag.
- React remains authoritative for stock, slot selection, costs, persistence,
  and all Adventure outcomes.
- Rive may perform Rosie; it does not own the item or the Bag decision.
- No new currency, confirmation, equipment rule, screen, or instruction panel.

## Variants

### A — Pocket Landing

The selected item follows one 520ms arc from its choice card into the matching
open-Bag pocket. The Bag yields only at impact. Authored Rive **Rosie Notice**
acknowledges the movement without showing the Rive satchel.

Tests explicit source → destination causality and keeps the physical item
primary.

### B — Bag Answers

No item crosses the scene. The already-visible Bag gives one drawstring-like
tug and warm rim response while the destination token drops into place. Rosie
continues her calm authored breathing pose.

Tests whether the destination alone can acknowledge selection with the least
visual traffic.

### C — Rosie Celebrates

The chosen token settles immediately. The existing authored Rive **Rosie
Tickle** response becomes the main payoff; the open Bag answers with one late,
quiet lift.

Tests whether affection should outrank mechanical source → destination clarity.

## Rejected baseline

The shipped v0.136 animation plays authored Rive **Bag Receive** at the same
time as the DOM item flight and existing open Bag. During the first frames, a
second large satchel crosses Rosie's face while two Clover tokens are also
visible. The result is technically animated but visually says “three things
happened” instead of “this item entered that Bag.”

## Selection criteria

1. One Bag, one item, one readable destination.
2. Rosie's eyes and expression remain visible.
3. The source and selected pocket remain understandable after 120ms.
4. No choice card, Bag pocket, or departure action is blocked.
5. Reduced motion preserves the settled selection with no transient layer.
6. Repeated Provision, Tool, Carrier, replacement, and removal choices remain
   truthful.

The winning treatment must be rewritten without prototype variants before it
can land on `main`.

## Verdict

**A — Pocket Landing wins.** In the rendered game, one Clover Lunch, Hand
Trowel, Wicker Basket, or alternate item leaves its real choice column and
lands on the matching physical pocket. The existing Rive **Rosie Notice** lean
supports that cause without covering Rosie's face or introducing a second Bag.
The destination token remains hidden until the moving token arrives, preventing
the old double-item frame.

**B — Bag Answers** preserves the cleanest scene, but the tug and rim response
are too quiet to explain which choice changed. **C — Rosie Celebrates** gives
the strongest affection beat, but her large hop becomes the subject and the
item appears to teleport. The rejected authored **Bag Receive** baseline still
shows a second satchel across Rosie, so it is not retained for per-item choices.

Production translation: keep Rive for Rosie's Notice performance, keep React
as the item and slot authority, use one short DOM flight for the physical
object, crossfade the settled pocket only on arrival, and reserve the fitted
authored satchel for the later whole-Bag packing/departure handoff.
