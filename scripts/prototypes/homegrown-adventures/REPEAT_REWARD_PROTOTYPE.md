# PROTOTYPE — familiar-route reward loop

Question: once Glowroot is planted and both routes are familiar, which
deterministic base return stays useful to the next **farm → Bag → Adventure**
cycle without adding a currency, crafting tree, random reward, or prescribed
loadout?

Run:

```sh
npm run prototype:homegrown:repeat-reward
```

The terminal exposes the complete stock after every simulated repeat and lets
the player change crop, Tool, Carrier, and route. Each run includes planting or
tending, a boosted clean harvest, packing one Provision, the familiar-route
base return, Tool bonus, and Carrier return.

The three policies deliberately disagree about the base return:

1. **Keep the Discovery:** preserve the current Glowroot Seed return. This is
   truthful to the first Discovery but becomes dead stock after planting.
2. **Bring the Next Seed:** a familiar route brings one Clover Seed; on repeat
   outings, the Hand Trowel finds another Clover Seed. This directly restores
   the input for the next Provision crop while Lantern and Carrier choices
   retain their current jobs.
3. **Bring a Farm Boost:** a familiar route brings one Compost; on repeat
   outings, the Hand Trowel finds another Compost. This improves a crop but
   does not replenish Clover Seed and overlaps the Wicker Basket's job.

This is throwaway comparison code. Capture the verdict here, then rewrite only
the winning reward rule and its return presentation in production.

## Verdict

**Bring the Next Seed wins.** In the driven Clover / Lantern / Wicker Basket
case, three complete familiar outings left Clover Seed at the starting quantity
of two: each cycle spent one to grow the Provision and returned one to enable
the next cycle. Glowroot Seed stayed at zero, while Lantern and Wicker Basket
continued to determine Fiber and Compost.

The current **Keep the Discovery** policy exhausted both Clover Seeds after two
outings and accumulated four Glowroot Seeds with no use after planting. **Bring
a Farm Boost** also exhausted Clover after two outings while accumulating eight
Compost, overlapping the Wicker Basket without keeping the complete loop
available.

Production should change only a successful familiar outing: replace its base
Glowroot Seed with one Clover Seed, and let Hand Trowel's repeat bonus become a
second Clover Seed. First-time Glowroot and Lanternleaf Discoveries must retain
their established Glowroot Seed reward and planting ceremony. Near-Discoveries,
Lantern Fiber, Carrier returns, quantities, Bag freedom, and all Rive behavior
remain unchanged.
