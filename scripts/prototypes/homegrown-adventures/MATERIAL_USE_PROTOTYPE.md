# Material-use map prototype

Three variants of Rosie's existing third-morning route map, switchable with
`?usehint=A|B|C` on the existing `homegrown-adventures.html` route.

Question: how can the map explain what Compost and Willow Fiber already do
without adding another explanation layer, prescribing a route, or making Farm
inventory more important than the place Rosie will explore?

- **A — One useful sentence:** replace the old environmental promise plus
  stock badge with one compact material / quantity / use sentence inside each
  place row.
- **B — Pocket use key:** preserve place-first route rows and move both uses
  into one shared key at the bottom of the map.
- **C — Use-led ticket:** make each route's material, quantity, and use the
  right-hand affordance for the whole route button.

Review both the real third-morning stock state (2 Compost / 4 Willow Fiber)
and narrow viewport geometry. The winner must keep each route at least 44px
tall, retain one authored scene canvas, avoid page overflow, and let the player
still explain the route as a place rather than an inventory order.

## Verdict

**A — One useful sentence wins.** It is the only treatment that teaches the
existing use while reducing the route row from a promise plus a separate stock
badge to one material / quantity / use sentence. The destination name remains
the strongest row text and the explicit Choose affordance remains unchanged.

Rendered evidence at the review viewport:

- A: 194.88px map, 45.36px transformed route targets, one authored canvas,
  zero page overflow. Place name remains first; the two uses are accessible in
  the exact route button names.
- B: 195.72px map, 41.16px transformed route targets. The shared key creates a
  second reading zone and turns the map into a miniature reference panel.
- C: 198.24px map, 47.04px transformed route targets. It is touch-safe, but the
  colored use ticket outranks the place and makes the choice read like a supply
  order.

Production should rewrite A without the `usehint` query, switcher, alternate
branches, or prototype CSS. Preserve the established route outcomes and source
the two counts from real `farmStock`; this is a clarity change, not an economy
change.
