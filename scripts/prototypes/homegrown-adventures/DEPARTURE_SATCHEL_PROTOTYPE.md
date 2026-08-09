# Throwaway prototype — departure satchel attachment

Three variants of Position 8, switchable with `?variant=A|B|C` on the existing
Homegrown Adventures route. Run with `npm run prototype:homegrown` and open
`homegrown-adventures.html?mode=loop&position=8&variant=A`.

## Question

Where can Rosie's packed satchel live on the current front-facing canonical
Rive rig so it reads as worn equipment rather than a flat UI tile?

The approved comparison is
`assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/08-departure.png`.
That concept establishes a compact warm-brown satchel attached behind Rosie's
screen-left shoulder without hiding her face or body silhouette.

## Variants

- **A — Chest Bag:** the shipped native Rive group, unchanged. It remains
  attached during departure, but its rectangular flap sits squarely across
  Rosie's chest and reads as a UI tile.
- **B — Hip Satchel:** the same source shape, reduced and moved to Rosie's
  screen-left hip. It keeps the clasp recognizable, preserves her face and
  front legs, and is achievable by re-authoring the existing Rive group and
  its Pack / Return / Departure keys.
- **C — Back Sling:** body behind Rosie, strap in front, following the concept's
  layer structure. Canonical Rosie's current front-facing pose hides the body
  and turns the exposed strap into a loose tail-like line; it requires a larger
  three-quarter character-pose rewrite before it can work.

## Verdict

**B — Hip Satchel wins for the current rig.** Fold its lower screen-left
attachment into the existing native `rosie_satchel`; do not ship the DOM/SVG
study. Preserve `satchelEquipped`, item identity, Pack/Return/Departure motion
names, reducer timing, and the established counter-swing. A is the baseline;
C remains the future direction if Rosie receives a true three-quarter departure
pose.
