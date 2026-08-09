# Prototype: predictable material identity for familiar routes

## Question

Which bounded reward rule makes choosing **A Glow Beneath the Hedge** versus
**Lights Past the Open Gate** mechanically meaningful while preserving the
guaranteed Clover Seed that begins the next farm → Bag → Adventure cycle?

## Fixed constraints

- Every successful familiar route still returns one Clover Seed.
- Hand Trowel, Lantern, Wicker Basket, and Cloth Wrap keep their established,
  freely chosen jobs.
- First-time Discoveries and Near-Discoveries do not change.
- Rewards remain deterministic and use only current Farm stock.
- No random loot, route currency, crafting tree, destination, or save field.

## Policies compared

1. **Shared Materials:** both routes return the established two Willow Fiber.
   This is balanced but leaves the route choice as prose.
2. **Add a Route Bonus:** both keep the Fiber, while the hedge adds one Compost
   and the gate adds one more Fiber. This distinguishes the receipts by
   inflating an already-complete reward package.
3. **Distinct Existing Materials:** the familiar hedge finds one Compost from
   its soft soil; the familiar gate gathers two Willow Fiber from its reflected
   leaves. The next Seed remains a separate guaranteed route return.

The terminal model simulates boosted Clover farming, Provision consumption,
Tool and Carrier effects, and two consecutive or alternating route visits.

Run:

```sh
npm run prototype:homegrown:route-rewards
```

## Verdict

Choose **Distinct Existing Materials**.

It makes the map answer a practical stockpile question: visit the warm roots
when Compost is low; visit the reflected leaves when Willow Fiber is low. It
does so with one existing material bundle per place, retains the guaranteed
next Seed, and avoids additive inflation. Alternating remains useful because
Compost feeds farming while Willow Fiber feeds Cloth Wrap.

Production should expose the identity before and after the choice:

- Map clue: **Soft soil · brings Compost Home** or **Reflected leaves · gathers
  Willow Fiber**.
- Return ledger: **Compost +1 · Warm roots +1** or **Willow Fiber +2 · Reflected
  leaves +2**.
- Adventure vignette: the route material should appear as one environmental
  consequence after Provision, Tool, and Carrier causes—not as another system.
