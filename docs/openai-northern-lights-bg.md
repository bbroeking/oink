# OpenAI / ChatGPT — Northern Lights animated background (legendary)

Turn the `northern_lights` legendary cosmetic from an aura into an **animated
background**: a looping set of 3–4 painted night-sky frames whose aurora ribbons
undulate when cross-faded in-engine. Full painted scenes (NOT transparent),
portrait, matching the house background style (see `assets/images/backgrounds/
bog_dusk_bg.png`, `golden_mire_bg.png`).

- **Final asset size:** 355 × 593 (portrait) per frame, PNG, downscaled from
  ChatGPT's output. Files: `assets/images/backgrounds/northern_lights_1.png` …
  `_4.png`.
- **Loop:** the engine cross-fades 1 → 2 → 3 → 4 → 1 slowly (~1.6 s/frame). So
  the stars, mountains, and horizon must stay **fixed** across all frames; only
  the **aurora** moves. Frame 4 must read as "one step before frame 1" so the
  wrap is seamless.
- **Quota:** 4 frames = 4 image generations (ChatGPT free tier caps ~3–5/day).
  3 frames also loops cleanly if we need to stop early.

## Style anchor (paste once)

```
I'm going to ask you to generate a sequence of FULL-SCENE background frames for a
2D mobile game — a cozy children's storybook painted illustration. This is a
BACKGROUND (a filled scene that fills the whole canvas), NOT a transparent item.
NO characters, NO pigs, NO people, NO text. Portrait orientation, tall (about
2:3, e.g. 1024×1536). Scene: a serene NIGHT SKY with a shimmering NORTHERN
LIGHTS aurora (green + teal + violet ribbons) arcing across a deep indigo,
star-speckled sky, above a simple dark low horizon of rounded hills/mountains.
Soft painted gradients, gentle glow on the aurora, bold simple shapes, no harsh
detail — it must read clearly behind game UI. It should feel LEGENDARY: rich,
luminous, magical. Confirm the style, then I'll send the frames one at a time.
```

## Batch 1 of 4 — Frame 1 (establish the scene)

```
FRAME 1 of a 4-frame seamless loop. Paint the full night-sky scene: deep indigo
star-speckled sky, a low dark rounded-hill horizon along the bottom ~20%, and a
NORTHERN LIGHTS aurora of layered green→teal→violet ribbons sweeping diagonally
from lower-left up to upper-right, with a soft luminous glow. This frame is the
reference for the next three — remember the exact star positions, hill shape, and
color palette. Portrait, full filled scene, no text.
```

## Batch 2 of 4 — Frame 2 (aurora drifts)

```
FRAME 2 of the loop. Keep the sky color, the stars, and the dark hills EXACTLY
as in Frame 1 (same positions, same palette) — change ONLY the aurora: let the
ribbons drift slightly to the right and undulate, the brightest fold moving up
and over, as if one beat later in a slow shimmer. Same portrait, same framing.
```

## Batch 3 of 4 — Frame 3 (aurora peaks)

```
FRAME 3 of the loop. Same fixed sky, stars, and hills as Frames 1–2. Move the
aurora ribbons further along the same drift — now at their fullest, brightest
spread across the upper sky, a new violet fold rising on the left. Same portrait,
same framing.
```

## Batch 4 of 4 — Frame 4 (returning toward Frame 1)

```
FRAME 4 of the loop — the LAST frame before it wraps back to Frame 1. Same fixed
sky, stars, and hills. Settle the aurora ribbons back toward their Frame-1
positions (drifting left and dimming slightly), so cross-fading Frame 4 → Frame 1
is seamless with no jump. Same portrait, same framing.
```

## Post-processing (after download)

1. Crop/letterbox each frame to 2:3, downscale to **355×593**, save as
   `assets/images/backgrounds/northern_lights_<n>.png`.
2. Register the frame list in `constants/animatedBackgrounds.ts`
   (`northern_lights → [frame1…frame4]`) and use frame 1 as the static card
   thumbnail in `constants/hats.ts` `HAT_IMAGES.northern_lights`.
3. `PageBackground` cross-fades the frames when the equipped bg is animated.
4. Migration: flip `northern_lights` `category` `aura → background` (keep
   legendary + cost), and clear any `active_aura_id = 'northern_lights'`.
