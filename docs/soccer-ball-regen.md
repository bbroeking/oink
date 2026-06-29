# Soccer Ball — single-item regen

Regenerate `assets/images/hats/soccer_ball.png` (a **held** cosmetic) in the
cozy storybook accessory style. One item, centered, transparent.

## Workflow

1. Stage refs from `~/Desktop/ttp-refs/soccer-regen/` (idle_1, wizard, magic_wand, soccer_ball_current).
2. Drag them into ChatGPT.
3. Send the style anchor, then Batch 1.
4. Download → extract the ball → resize to 256×256 transparent → replace `assets/images/hats/soccer_ball.png`.
5. No `compute_overlays.py` needed — placement already lives in `hat_rel.generated.ts`
   (`soccer_ball: pivot {0.5,0.72}, widthFrac 0.42, hand_r`). New art just drops in.

## Style anchor (paste once)

```
I'm going to ask you to generate a single sprite image of a cosmetic
accessory item for a 2D mobile game. NO characters, NO pigs, NO people
— only the item itself.

I'm attaching reference images:
- idle_1: the cozy storybook pig this item sits beside (match its art style)
- wizard.png and magic_wand.png: existing accessories in the SAME game —
  match THIS exact accessory style (bold dark outline, flat painted
  shading, transparent background)
- soccer_ball_current.png: the current version of the item we're
  replacing — same subject, but make it cleaner, cuter, and crisper

Style for the accessory (STRICT):
- Flat children's storybook illustration with a bold ~3px dark
  charcoal-brown outline (like the reference accessories)
- Flat painted cel-shading only — NO 3D rendering, NO metallic
  gradients, NO photorealistic reflections, NO glossy highlights
- Soft, clean, slightly warm palette; very readable at small sizes
  (this is a mobile game, it must read at ~64px)
- No drop shadow, no ground shadow, no glow
- Pure transparent background — nothing behind the item
- A PURE 2D PAPER CUTOUT viewed straight from the front — a sticker
  glued to a flat surface, not a 3D-rendered object

Confirm you understand the references and the style, then I'll send
the item.
```

## Batch 1 of 1 — Soccer Ball (transparent, single centered item)

```
Generate ONE item only, centered on a transparent canvas with even
padding on all sides so nothing is cropped:

soccer_ball — a classic soccer ball with the traditional black-and-
white pentagon/hexagon panel pattern, drawn as a cozy storybook
sticker. Bold dark charcoal-brown outline. Flat cel-shaded panels:
soft warm off-white panels and soft warm charcoal panels (NOT pure
black, NOT photoreal). One gentle curved highlight crescent to show
roundness — flat-painted, not a glossy reflection. Cute, clean, and
instantly readable as a soccer ball at 64px. No text, no background,
no shadow on the ground — just the ball.
```
