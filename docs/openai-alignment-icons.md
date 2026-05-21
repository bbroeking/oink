# Alignment Emblem Icons — OpenAI Image-Gen Brief

The 3 alignment emblems — Generous / Pilgrim / Greedy — as raster
PNGs. They replace the interim SVG icons in AlignmentBadge, the
schism reveal, and the Judgement Day finale.

These render small (≈15–22px in the badge) and large (≈64–72px in the
modals), so they must read as bold, simple silhouettes.

## Workflow
1. Generate the 3 below in ChatGPT's image generator.
2. Each should be a single emblem, centered, transparent background.
3. Save to `assets/images/alignment/` as `generous.png`,
   `pilgrim.png`, `greedy.png`.
4. Claude swaps the `<Icon>` calls for `<Image>` once they land.

---

## Style anchor (paste once)

```
I'm generating 3 emblem icons for a cozy 2D mobile game. They are a
matched SET — same outline weight, same flat style, same visual
mass — so they sit together in a row.

Style for every emblem:
- Flat children's storybook illustration, bold ~3px black outline
- Flat painted cel-shading only — NO 3D, NO gradients, NO glossy
  highlights, NO drop shadows
- Soft saturated colors
- A single emblem, centered, with even margin
- PURE transparent background
- Must stay readable shrunk down to ~16px — keep shapes bold,
  chunky, and simple; no fine detail

Confirm, then I'll send the three.
```

## 1 — Generous emblem  →  `generous.png`

```
A glowing golden halo: a clean ring tilted very slightly, with one
small four-point sparkle near its upper edge. Warm gold. Flat
painted, bold black outline, transparent background, centered.
No face, no character — just the halo.
```

## 2 — Pilgrim emblem  →  `pilgrim.png`

```
A small balance scale, perfectly level: a short upright post, a
horizontal beam, two round shallow pans hanging level, a simple
triangular base. Brass-and-warm-wood palette. Chunky and bold so it
reads tiny. Flat painted, bold black outline, transparent
background, centered.
```

## 3 — Greedy emblem  →  `greedy.png`

```
A pair of curved goblin horns rising from a small shared base,
sharp points, sweeping outward and up. Dark charcoal with a faint
mossy-green tint. Flat painted, bold black outline, transparent
background, centered. No face, no character — just the horns.
```

---

## Wiring (once the PNGs land)
- New `constants/alignmentIcons.ts` (or extend `hats.ts` pattern) mapping
  `angel → generous.png`, `neutral → pilgrim.png`, `goblin → greedy.png`.
- `AlignmentBadge`, `AlignmentSchismModal`, `JudgementDayModal` render
  `<Image>` instead of `<Icon name="halo|scales|horns">`.
- The 3 interim SVG cases in `Icon.tsx` can then be removed.
