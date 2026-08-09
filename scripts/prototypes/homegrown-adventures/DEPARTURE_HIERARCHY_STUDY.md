# PROTOTYPE — Position 8 departure hierarchy

Question: how should Position 8 say “Rosie is packed; send her down that path”
without repeating the same preparation fact in the HUD, loadout ribbon, fitted
satchel, and large action?

Run `npm run prototype:homegrown:build`, serve `docs/`, then open Position 8
with `?mode=loop&position=8&departureStudy=1&variant=A`, `B`, or `C`.

Approved visual context:

- `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/08-departure.png`
- the shipped v0.138 Bag-to-shoulder endpoint at feature commit `d9f4e16`

## A — One Gate Sign

One sign beside the hedge owns both the exact packed loadout and the departure
action. This tests maximum consolidation: one surface, one decision.

## B — Packed on Rosie

Three small physical item tokens stay beside Rosie's fitted satchel while the
existing path action remains separate. This tests whether visual inventory can
replace the report ribbon without hiding the exact choices.

## C — Quiet Receipt

One slim, single-height receipt preserves all three names under the HUD while
the existing path action remains primary. This tests the least disruptive
distillation of the shipped composition.

## Invariants

- React keeps the exact Provision, Tool, Carrier, costs, persistence, and
  Position 8 reducer state.
- The existing authored Rive satchel and Departure one-shot are unchanged.
- Every treatment has one primary action and remains fully keyboard accessible.
- No treatment adds a route, item, reward, timer, or Adventure rule.

## Verdict

**C — Quiet Receipt wins.** It is the only treatment that keeps the exact
Provision, Tool, Carrier, and lining quantity readable without becoming the
subject of the scene. Rosie, her fitted Rive satchel, the glowing path target,
and the one departure action retain the same visual order as the approved
concept. The HUD keeps only the opportunity name, so no sentence repeats the
loadout.

A combined everything into one action, but the resulting sign became a large
inventory panel over the hedge and Barn. B made the items feel physical, but
three tilted tokens looked like fresh choices placed on the crop beds rather
than facts already packed on Rosie.

Production should keep C's one 52px-or-smaller receipt under the quiet HUD,
keep its exact item names and Cloth Wrap lining count, remove the HUD's repeated
detail only at settled Position 8, and retain the existing path action and Rive
Departure untouched. No study class, switcher, or losing markup should ship.
