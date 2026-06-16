# OpenAI / ChatGPT — Northern Lights animated background (legendary)

`northern_lights` becomes an **animated background**: a Tickle-the-Pig painted
version of a real aurora (reference: `~/Desktop/ttp-refs/northern-lights/
aurora_reference.jpg`), as **6 frames** where the aurora colors **wave back and
forth**. The engine **ping-pongs** the frames (1→2→…→6→5→…→1), so the wave reads
as a continuous back-and-forth sway and no frame needs to seam back to frame 1.

## The look (from the reference photo)

Vibrant aurora over water: green curtains overhead, magenta/pink curtains on the
right, teal/blue on the left, a dark mountain silhouette at the lower-left, a calm
sea and low grassy horizon along the bottom, deep blue starry sky. Render it as
**Tickle the Pig storybook art**: flat painted illustration, soft saturated
gradients, bold simple shapes, cozy children's-book feel — **NOT photorealistic**.
It should feel **legendary**: luminous and magical.

- **Final asset:** 355 × 593 (portrait) per frame, PNG, downscaled from ChatGPT's
  output. Files: `assets/images/backgrounds/northern_lights_1.png` … `_6.png`.
- **Fixed across frames:** sky color, stars, dark mountain, sea, horizon — all
  identical every frame. ONLY the aurora curtains move/recolor.
- **The wave:** Frame 1 = curtains swept toward the LEFT; progress them rightward
  through Frame 6 = swept toward the RIGHT, with the green/pink/teal bands shifting
  position as they sway. Ping-pong playback then sweeps them back left → a smooth
  back-and-forth shimmer.
- **Quota:** 6 generations. If your plan caps image-gen we'll get what we can and
  resume; the wave works with 5 too.

## Style anchor (paste once — references are attached)

```
I've attached a photo of a real aurora (northern lights). I want you to generate a
sequence of FULL-SCENE background frames for a 2D mobile game (Tickle the Pig) that
RE-PAINT this aurora scene in the game's art style: a flat, painted children's
storybook illustration — soft saturated gradients, bold simple shapes, cozy and
luminous, NOT photorealistic, NO photo texture. Keep the composition and colors of
the attached photo: green aurora curtains overhead, magenta/pink curtains to the
right, teal/blue to the left, a dark mountain silhouette lower-left, a calm sea and
low grassy horizon at the bottom, deep-blue star-speckled sky. PORTRAIT orientation
(tall, about 2:3, e.g. 1024×1536) — adapt the wide scene to a vertical frame. NO
characters, NO pigs, NO people, NO text. It must feel LEGENDARY. I'll then ask for
6 frames of a back-and-forth wave where ONLY the aurora moves. Confirm the style,
then I'll send Frame 1.
```

## Batch 1 of 6 — Frame 1 (establish; curtains swept LEFT)

```
FRAME 1 of a 6-frame wave. Paint the full aurora scene in the storybook style we
agreed: deep-blue starry sky, dark mountain silhouette lower-left, calm sea + low
grassy horizon along the bottom, and the AURORA curtains — green overhead, with
teal/blue and magenta/pink draperies — swept toward the LEFT side of the sky. This
frame locks the sky, stars, mountain, and sea for the next five. Portrait, full
filled painted scene, no text.
```

## Batch 2 of 6 — Frame 2

```
FRAME 2. Keep the sky, stars, mountain, and sea EXACTLY as Frame 1. Move ONLY the
aurora: the curtains sway a step to the right, the green fold drifting over and the
pink edge widening. Same portrait, same painted style.
```

## Batch 3 of 6 — Frame 3

```
FRAME 3. Same fixed sky/stars/mountain/sea. Aurora curtains sway further right,
now centered overhead, brightest through the middle. Same portrait, same style.
```

## Batch 4 of 6 — Frame 4

```
FRAME 4. Same fixed sky/stars/mountain/sea. Aurora curtains continue rightward,
the magenta/pink dominant on the right, teal trailing left. Same portrait, style.
```

## Batch 5 of 6 — Frame 5

```
FRAME 5. Same fixed sky/stars/mountain/sea. Aurora curtains nearly fully swept to
the RIGHT, pink brightest on the right edge. Same portrait, same style.
```

## Batch 6 of 6 — Frame 6 (curtains swept RIGHT)

```
FRAME 6 — the right-most extreme of the wave. Same fixed sky/stars/mountain/sea.
Aurora curtains fully swept to the RIGHT. (Playback ping-pongs back from here, so
this is the opposite end of the sway from Frame 1 — no need to match Frame 1.) Same
portrait, same painted style.
```

## Post-processing (after download)

1. Crop/letterbox each frame to 2:3, downscale to **355×593**, save as
   `assets/images/backgrounds/northern_lights_<n>.png` (1…6).
2. Register the frame list in `constants/animatedBackgrounds.ts`
   (`northern_lights → [frame1…frame6]`) and use frame 1 (or a mid frame) as the
   static card thumbnail in `constants/hats.ts` `HAT_IMAGES.northern_lights`.
3. `PageBackground` cross-fades + **ping-pongs** the frames (forward then reverse)
   when the equipped bg is animated — handles any 5–7 frame count.
4. Migration: flip `northern_lights` `category` `aura → background` (keep legendary
   + cost), and clear any `active_aura_id = 'northern_lights'`.
