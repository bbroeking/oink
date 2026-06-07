# Snout coin icon — generation brief

The in-game currency is **snouts**. We want a more stylistic icon that fits Tickle
the Pig's cozy hand-drawn sticker look (replacing the current flat SVG coin in
`components/ui/SnoutCoin.tsx`). One batch generates several variations to pick from.

## Style anchor (paste once)

```
You are generating economy/currency ICONS for a cozy mobile game called "Tickle the Pig."

ART STYLE — match this exactly:
- Hand-drawn STORYBOOK STICKER look: a single consistent thick dark-brown ink outline around every shape.
- Flat cel shading — at most ONE soft highlight and ONE soft shadow. NO metallic gradients, NO glossy 3D reflections, NO photorealism.
- Warm, cozy palette. Chunky, rounded, friendly forms.
- Think RuneScape-meets-Animal-Crossing as a paper sticker.
- Must read clearly at very small sizes (down to 24px): bold simple silhouette, no fine detail.
- Each icon is a PURE 2D PAPER CUTOUT seen straight from the front. The bottom edge is a solid painted edge, never an opening or inner cavity.
- Plain flat single-color background (light), generous padding, icons evenly spaced. NO text, NO letters, NO numbers.

I'll attach reference screenshots of the game's art style. Acknowledge the style, then wait for my item prompt.
```

## Batch 1 of 1 — Snout coins

```
Generate ONE image: a horizontal row of 4 distinct variations of the "snout" currency coin, evenly spaced with lots of padding, on a plain flat light background.

Each variation is a round GOLD COIN viewed straight on, with a cute PIG SNOUT on its face (a soft pink oval snout with two dark nostril holes). Hand-drawn sticker style: thick brown ink outline, flat warm-gold coin body with one soft highlight at the top-left, pink snout. Cozy, chunky, friendly.

The 4 variations:
1. Classic flat round gold coin with a centered pink snout.
2. Gold coin with a gently scalloped / ridged rim, pink snout.
3. A rounded snout-shaped gold token (the coin silhouette itself is a snout).
4. A small overlapping stack of 2–3 snout coins.

Reminders: flat 2D sticker, NO 3D metallic gloss, NO text or letters, bold readable silhouette at tiny sizes, single consistent dark-brown ink outline. One row, 4 items, plain background.
```

## Post-processing

- Pick the favorite variation; crop it square with transparent/flat padding.
- Save as `assets/images/snout-coin.png` (and a 2x/3x if needed).
- Swap `components/ui/SnoutCoin.tsx` to render the `<Image>` instead of the SVG (same `size` prop, square). Everything imports `SnoutCoin`, so the swap is one file.
