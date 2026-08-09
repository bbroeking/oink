# v0.124 known-route choice prototype

Question: after Rosie has discovered Glowroot and mapped Lanternleaf Path, what
should her third-morning Tickle do instead of assigning the identical
Lanternleaf job again?

Three treatments live on the existing Position 2 route with a review-only
third-morning state:

- **A — Repeat Yesterday:** the shipped crop chooser immediately repeats
  **Lights Past the Open Gate**.
- **B — Rosie's Map:** one compact storybook map offers the two earned routes,
  with time and environmental clues visible before farming.
- **C — World Trails:** two small route markers are attached directly to the
  physical Glowroot bed and open hedge.

Run `npm run prototype:homegrown`, then open:

`http://localhost:4174/homegrown-adventures.html?debug=1&mode=loop&position=2&route=lanternleaf&variant=A`

Use the bottom switcher or Left/Right Arrow to compare A, B, and C. In B or C,
choose either route to see the existing crop decision inherit that route's
language. The prototype stores the choice in component memory only; it does not
change reducer state, saves, rewards, crops, or Adventure resolution.

## Verdict

**B — Rosie's Map.** A makes the mapped Lanternleaf reward feel false by
assigning the same discovery job again. C preserves Rosie, but its two labels
cover the Barn door, open hedge, frog, and Glowroot bed while separating clues
the player needs to compare. B turns previous Adventures into one legible
choice, keeps time and environmental clues together, and hands the selected
route into the existing crop decision without inventing another destination.

Production should show the map only after both routes are actually known. The
morning Tickle should introduce **Rosie's map**, choosing a route should persist
one route id, and every existing downstream surface should continue deriving
from `adventureOpportunity(state)`. The HUD, scene description, crop question,
Bag, Adventure, return, reload, and Near-Discovery must all agree. Old saves and
the first two authored mornings keep their current automatic progression.
