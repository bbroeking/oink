# Prototype: current Farm stock on Rosie's known-route map

## Question

What is the quietest way to show current Compost and Willow Fiber stock on the
existing two-route map, so the new predictable material identities create an
informed choice without turning Rosie's Barn into an inventory dashboard?

This is a throwaway adjustment to the real Position 2 route. The app's existing
`variant` query already controls the broader player experiment, so these map
variants use `mapstock=A|B|C`. `stockcase=low-fiber|low-compost` changes only
the read-only prototype counts; it never mutates reducer state.

## Variants

- **A — Counts under each clue:** keeps the established route rows and attaches
  one tinted `Material · N held` line directly beneath each route promise.
- **B — One pantry bookmark:** keeps the route rows untouched and inserts one
  shared dark Farm-stock strip between the map heading and the routes.
- **C — Material tickets:** makes the predictable material the right-hand
  decision stub for each route, combining material, held count, and Choose.

## Run

```sh
npm run prototype:homegrown:build
python3 -m http.server 4174 --directory docs
```

Open:

```text
http://localhost:4174/homegrown-adventures.html?variant=A&mode=loop&position=2&route=lanternleaf&repeat=1&mapstock=A&stockcase=low-fiber
```

Use the floating arrows or keyboard Left / Right to compare. Toggle the bottom
label to swap low-Fiber and low-Compost cases.

## Acceptance lens

The winner must keep Rosie and the living Farm primary, keep both route rows
at least 44 CSS pixels tall, name both material and current quantity without
recommending a route, fit at 390×844 with no page overflow, and disappear
entirely when the prototype query is absent.

## Verdict

Choose **A — Counts under each clue**, then rewrite only that treatment for
production.

- It keeps the place name and environmental promise ahead of inventory while
  attaching the relevant held quantity to the same route. Both rendered rows
  remained about 54 CSS pixels tall.
- B introduced a dashboard-like stock band and compressed both route buttons
  to about 41 CSS pixels, below the 44-pixel touch floor.
- C fit cleanly at about 45 CSS pixels per row, but its right-hand material
  tickets made the outing read as a supply order before it read as exploration.

Both low-Fiber and low-Compost cases rendered with one authored Rive scene and
zero page overflow. Production should keep the existing map question, route
names, Choose affordances, and tinted inline facts; it should remove the
prototype query, switcher, fake stock cases, and both losing structures.
