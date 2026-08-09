# Provision stockpile visibility prototype

## Question

How should the completed Home drawer show the Clover Lunches and Moonberries
the player deliberately accumulated without turning Rosie's calm Homecoming
into a separate inventory screen?

Run the study at:

`homegrown-adventures.html?variant=A&mode=loop&position=11&route=lanternleaf&repeat=1&stockpile=1&debug=1`

The study gives the same reducer-owned Home state four Clover Lunches and five
Moonberries, opens the existing drawer, and changes presentation only.

## Treatments

### A — Materials Only

The v0.125 baseline remains one short four-column strip for Clover Seed,
Glowroot Seed, Compost, and Willow Fiber. It is calm and compact, but the
semantic **Current Farm stock** group omits both usable Provisions.

### B — Pantry + Supplies

One larger top shelf leads with Clover Lunch and Moonberries, their exact
counts, and their Adventure uses. A quieter four-cell shelf beneath keeps Seeds
and Materials complete. Both remain inside the existing expandable Home
pocket.

### C — Complete Tally

All six items share a compact two-column, three-row ledger. It is complete and
scannable, but it gives every item equal weight, removes the farm-to-Adventure
meaning, and covers more of Rosie and the Kitchen Patch.

## Verdict

**B — Pantry + Supplies wins.**

The render makes accumulated crops feel intentional rather than forgotten. It
answers both questions the loop needs—**what can Rosie pack next?** and **what
supports another Farm day?**—while remaining a temporary expansion of the
existing Home pocket. It preserves the familiar Homecoming plaque, Rosie, the
Farm, and the one **Begin another day** action.

## Production contract

- Render the real `farmStock` quantities; do not create a second inventory or
  presentation-owned totals.
- Lead with Clover Lunch and Moonberries under a plain-language Provision
  heading and retain their existing Adventure uses.
- Keep Clover Seed, Glowroot Seed, Compost, and Willow Fiber in one quieter
  supporting shelf.
- Keep the drawer collapsed by default and preserve the existing toggle,
  focus, reduced-motion, and next-day behavior.
- Do not change harvest yield, Bag cost, reward quantities, route outcome,
  persistence, Rive input, or authored motion.
- Verify a real Moonberry repeat so five remaining berries are visible after
  one of six harvested berries is packed.
