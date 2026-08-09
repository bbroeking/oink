# Repeat Home memory prototype

## Question

After Rosie revisits a route that is already mapped, how should Position 11
close the day without presenting the route as a new Discovery again?

Run the study at:

`homegrown-adventures.html?variant=A&mode=loop&position=11&route=lanternleaf&repeat=1&debug=1`

Use the bottom switcher to compare all three treatments against the same
persisted repeat-Adventure state.

## Treatments

### A — New Route Again

The v0.124 baseline keeps **The Barn remembers**, **Lanternleaf Path is
mapped**, and **New route**. It preserves the established layout but
contradicts the repeat outing represented by `selectedAdventureOpportunityId`.

### B — Familiar Homecoming

The same restrained storybook plaque becomes **Today's outing · A familiar
trail brought Rosie Home**. The compact Home pocket says **Lanternleaf Path ·
visited today** and **Known trail · Rosie Home · Supplies stocked**. This
separates today's event from the permanent route without adding another
surface.

### C — Place + Supplies

The plaque becomes a two-column ledger: the known place on the left and the
returned supplies on the right. It is accurate, but it makes the emotional
end-of-day beat feel like an inventory receipt and reduces the calm visual
hierarchy around Rosie.

## Verdict

**B — Familiar Homecoming wins.**

The rendered 390-by-844 game frame keeps Rosie and the living Farm primary,
uses the already established storybook hierarchy, and tells one legible truth:
Rosie safely returned from a place she knows. It does not repeat the new-route
ceremony, and it lets the existing Farm-stock drawer retain responsibility for
exact quantities.

## Production contract

- Derive repeat presentation from reducer-owned
  `selectedAdventureOpportunityId`; do not add a second history flag.
- Support both known routes, not only Lanternleaf Path.
- Keep first-time Glowroot and Lanternleaf Discovery presentations unchanged.
- On a repeat day, the plaque names a familiar Homecoming and the chosen route.
- The compact pocket says the route was visited today and that supplies were
  stocked; it never says **New route**.
- The Position 11 rail names the chosen route as revisited.
- Exact stock quantities remain in the existing expandable Farm-stock drawer.
- Do not add rewards, progression, timers, Rive inputs, or save facts.
- Keep the `repeat=1` direct-review path so repeat Home truth can be rendered
  and checked without replaying two complete days.
