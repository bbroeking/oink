# Lounge walk-cycle sprites — ChatGPT ImageGen brief

Rosie's ¾-view (Pokémon-style) walk cycle for the Slop Club Lounge
(`docs/lounge-farm-spec.md`). One direction per batch, 4 frames per
strip. Batch 1 (south/toward-viewer) is the P0 style gate — STOP after
it for the founder eyeball test before sending 2–5.

References to drag in (staged in `~/Desktop/ttp-refs/lounge-sprites/`):
- `rosie.png` — THE character (canonical Rosie).
- `walk_1.png` — the existing sprite rendering style to match.
- `rosie-rig-ready-turnaround-v3.png` — quadruped anatomy from four views.

Post-processing after download: per-frame bbox extraction → pad each
frame to a uniform square box (anchor = feet center) → verify silhouette
consistency across frames → `assets/images/sprites/rosie/lounge/`
(`walk_s_1..4.png`, etc.).

## Style anchor (paste once)

```
You are generating game sprite frames for "Tickle the Pig," a cozy
hand-drawn mobile game. The attached images are your ONLY character
reference: the pink pig "Rosie" (big head, round body, blush cheeks,
dark hooves, small curled tail), her existing sprite rendering style
(soft watercolor fill, warm ink outline, sticker-like), and a four-view
anatomy turnaround.

We are making a 4-frame WALK CYCLE seen from a Pokémon-style 3/4
top-down camera (like Pokémon Emerald overworld characters: slightly
above and behind/ahead, NOT straight-on, NOT true top-down).

RULES for every image you generate in this conversation:
- ONE horizontal row of exactly 4 frames, evenly spaced, with clear
  empty gutters between frames. Plain solid WHITE background.
- The SAME pig in all 4 frames: identical size, identical proportions,
  identical colors, same camera angle. Only the legs, body bob, ear
  flop, and tail change between frames.
- Rendering: flat sticker style matching the reference sprites — soft
  watercolor fill, warm dark-brown ink outline, NO 3D shading, NO
  gradients, NO glossy highlights, NO drop shadows, NO ground shadow.
- Quadruped walk cycle phases across the 4 frames:
  frame 1 = left-front leg + right-rear leg forward (contact),
  frame 2 = all legs passing under the body, slight body rise,
  frame 3 = right-front leg + left-rear leg forward (contact),
  frame 4 = passing again, slight body dip.
- Keep the pig's feet on a consistent invisible baseline across frames.
- No text, no labels, no frame numbers, no borders.

Reply "ready" if you understand — do not generate an image yet.
```

## Batch 1 of 5 — walk SOUTH (toward the viewer)

```
Generate the 4-frame strip: Rosie WALKING SOUTH — toward the camera,
face and belly visible, from the 3/4 top-down angle (we see the top of
her head and ears, her face, front legs stepping toward us, rear legs
mostly hidden behind her body). Her curled tail peeks over her back.
Follow every rule from the style anchor.
```

## Batch 2 of 5 — walk NORTH (away from the viewer)

```
Generate the 4-frame strip: Rosie WALKING NORTH — away from the camera.
We see her back, the top of her head, both ears from behind, her round
rump with the curled tail centered, rear legs stepping away from us.
Her face is NOT visible. Same size, angle, palette, and rendering as
the approved south strip. Follow every rule from the style anchor.
```

## Batch 3 of 5 — walk EAST (right-facing profile)

```
Generate the 4-frame strip: Rosie WALKING EAST — full side profile
facing RIGHT, from the 3/4 top-down angle (we see her right side, one
eye, one blush cheek; far-side legs visible but slightly behind the
near-side legs; tail curl at her left rump edge). Same size, angle,
palette, and rendering as the approved strips. Follow every rule from
the style anchor.
```

## Batch 4 of 5 — walk WEST (left-facing profile)

```
Generate the 4-frame strip: Rosie WALKING WEST — full side profile
facing LEFT, the exact mirror of the east strip (left eye, left blush
cheek visible; tail curl at her right rump edge). Do NOT simply flip
the east image — redraw it facing left with the same phases. Same size,
angle, palette, and rendering as the approved strips. Follow every rule
from the style anchor.
```

## Batch 5 of 5 — idle SOUTH

```
Generate the 4-frame strip: Rosie STANDING IDLE facing SOUTH (toward
the camera), same 3/4 top-down angle as the south walk strip. Four
gentle idle frames: 1 = neutral stand, 2 = slight body sink + ear flop,
3 = neutral, 4 = slight rise + tail wiggle. All four legs planted in
every frame — she is NOT walking. Same size, angle, palette, and
rendering as the approved strips. Follow every rule from the style
anchor.
```
