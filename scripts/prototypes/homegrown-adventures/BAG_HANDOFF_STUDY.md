# PROTOTYPE — Rosie’s Bag handoff study

Question: how should the one open Bag at Position 7 become the fitted Rive
satchel on Rosie at Position 8 without reading as a cut or as two Bags?

Run:

```sh
npm run prototype:homegrown:build
cd docs && python3 -m http.server 4296
```

Open the same packed-Bag route with
`?mode=loop&position=7&handoffStudy=1&variant=A`, `B`, or `C`. Choose one item
for each pocket, press **Pack Rosie’s Bag**, and use the floating switcher to
return to Position 7 for the next treatment.

Approved visual context:

- `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/07-free-bag-selection.png`
- `assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/08-departure.png`

## A — Shoulder Handoff

The physical Bag closes, follows one direct arc toward Rosie’s shoulder, and
crossfades into the existing authored Rive Pack animation. This tests whether
continuous object identity is more important than letting Rosie own the motion.

## B — Rosie Collects It

The Bag closes and travels only halfway. Rosie’s authored Pack response owns
the rest of the pickup. This tests a more character-led handoff with less DOM
travel and a longer overlap between the physical Bag and fitted satchel.

## C — Storybook Fold

The Bag closes in place and a warm illustrated page turn covers the scene
change. This tests whether a deliberate storybook transition can make the cut
feel intentional even without showing the complete physical route.

## Invariants

- React keeps the exact Provision, Tool, Carrier, costs, persistence, and
  Position 8 loadout.
- The existing Rive **Rosie Pack** one-shot owns the attached satchel response.
- No variant adds a new item, route, reward, timer, or Adventure rule.
- Reduced motion skips the travel while preserving the same packed state.

## Verdict

**A — Shoulder Handoff wins.** It is the only treatment that preserves the
identity of the one Bag all the way from packed pockets toward Rosie's fitted
Rive satchel. Cropping the real open-Bag artwork into a body and lid makes the
close belong to the approved art instead of introducing a flat replacement.
The authored Rive Pack response begins only as the smaller moving Bag reaches
Rosie, so character animation completes the attachment rather than duplicating
the object.

B left a large Bag in front of Rosie for too long and created the longest
two-Bag overlap. C made the cut deliberate, but the page turn hid the physical
cause the checkpoint exists to explain and became a scene-wide ceremony.

Production should keep A's bounded close → shoulder arc → authored Pack
sequence, remove every study class and switcher, keep React's reducer action
at the end of the handoff, and suppress the redundant second Pack trigger after
that reducer action commits.
