# Mote Machine — Rive parts handoff (Rosie style lock)

Scope: art-only source package for the 390 × 844 pt portrait `Mote Machine`
artboard. Raster sources are exported at roughly 2× or higher and are intended
for import into Rive; semantic labels, balances, calls to action, and navigation
must remain native/Rive text and vector UI.

## Status at a glance

| Piece                         | Deliverable                             | Status                                                                                 |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| Barn/meadow plate             | `background-open-barn-meadow-v1.png`    | Approved source candidate                                                              |
| Empty cabinet + attached tray | `cabinet-shell-empty-v1.png`            | Approved source candidate; see window-overlay note                                     |
| Project-symbol vertical strip | `reel-strip-project-symbols-v1.png`     | Approved source candidate; duplicate the five-cell cycle for runtime looping           |
| Brake tab                     | `brake-tab-v1.png`                      | Approved source candidate; one instance reused three times                             |
| Mote droplet                  | `mote-droplet-v1.png`                   | Approved source candidate                                                              |
| Lever arm / knob              | `lever-arm-v1.png`, `lever-knob-v1.png` | Approved source candidates                                                             |
| Attached reward tray/pocket   | baked into `cabinet-shell-empty-v1.png` | Good static source; manually redraw only the tray lip if it must animate independently |
| Clockwork Acorn reward        | `clockwork-acorn-reward-icon-v1.png`    | Approved source candidate                                                              |

The sources deliberately do **not** rasterize text, numbers, balances, ticket
shapes, status strings, CTA copy, or navigation.

## Files

### Final importable PNGs

- `background-open-barn-meadow-v1.png` — 853 × 1844 RGB background plate.
- `cabinet-shell-empty-v1.png` — 853 × 1844 RGBA, empty cabinet and attached
  empty tray. Alpha was derived from the chroma-key source.
- `reel-strip-project-symbols-v1.png` — 724 × 2172 RGBA. Six cells: Clockwork
  Acorn, Mote, Auto-Tickler brush, blessing sun/wing, curse thorn/cloud, then
  Clockwork Acorn again. The repeated acorn is a boundary helper, not a sixth
  reward kind.
- `brake-tab-v1.png` — 480 × 300 RGBA.
- `mote-droplet-v1.png` — 350 × 380 RGBA.
- `lever-arm-v1.png` — 300 × 520 RGBA.
- `lever-knob-v1.png` — 360 × 380 RGBA.
- `clockwork-acorn-reward-icon-v1.png` — 480 × 460 RGBA.

### Kept provenance / crop sources

- `cabinet-shell-empty-chromakey-source-v1.png`
- `reel-strip-project-symbols-chromakey-source-v1.png`
- `components-sheet-chromakey-source-v1.png`
- `components-sheet-v1.png` — alpha-clean source for the five individually
  cropped components. Do not import this sheet at runtime.

All alpha PNGs were made from a flat green source with the bundled chroma-key
tool using `--auto-key border --soft-matte --transparent-threshold 12
--opaque-threshold 220 --despill`. The corners are transparent and all final
component crops retain generous alpha padding.

## Rive import plan

Use a 390 × 844 artboard. These are **artboard points**, not source pixels.
Keep rasters as images; use Rive vector paths/masks for the three reel apertures,
native/Rive semantic text, and all interaction hit targets.

### Recommended artboard bounds and pivots

| Rive asset / node       | Artboard placement                                                  | Pivot / transform                                                               | Notes                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `bg.openBarnMeadow`     | `(0, 0, 390, 844)`                                                  | top-left, scale to cover                                                        | Full-bleed background. Crop a little of the lower dirt as needed, never show a rasterized UI label.                                  |
| `machine.cabinetBase`   | `(24, 80, 341, 738)`                                                | top-left, scale `0.400` from 853 × 1844                                         | Static painted cabinet and tray. It leaves room for the lever at right.                                                              |
| `machine.moteCradle`    | drawn from cabinet at approximately `(128, 216, 132, 134)`          | visual guide only                                                               | Place the Mote on top of this guide at rest.                                                                                         |
| `machine.mote`          | center `(195, 278)`, nominal `66 × 72`                              | pivot `(175, 331)` in its 350 × 380 source; use the drop tip/base vertical axis | Idle: 1–2 pt float, 2% scale breathe. Deposit: scale 1.12 then settle.                                                               |
| `machine.reel.left`     | aperture `(65, 392, 73, 202)`                                       | mask anchor top-left                                                            | See mandatory bezel overlay note below.                                                                                              |
| `machine.reel.center`   | aperture `(157, 392, 76, 202)`                                      | mask anchor top-left                                                            | Same strip source; vary initial Y by a whole cell.                                                                                   |
| `machine.reel.right`    | aperture `(252, 392, 74, 202)`                                      | mask anchor top-left                                                            | Same strip source; vary initial Y by a whole cell.                                                                                   |
| `machine.reel.strip.*`  | `~74 × 222` behind each aperture                                    | top-center, vertical only                                                       | Import at a width that slightly overscans each aperture. Use a duplicated five-cell cycle; never scale non-uniformly while spinning. |
| `machine.brake.*`       | centers `(102, 374)`, `(195, 374)`, `(289, 374)`, nominal `58 × 36` | source center `(240, 150)`                                                      | One `brake-tab-v1.png` image instanced three times. Press y +3, scale y 0.92 for brake state.                                        |
| `machine.lever` (group) | base anchor around `(351, 621)`                                     | group pivot at the mechanical base                                              | Parent rotation `-35°` rest / `18°` pulled; use spring settle unless Reduce Motion.                                                  |
| `machine.lever.arm`     | child of `machine.lever`, nominal `78 × 135`                        | pivot `(112, 457)` in its 300 × 520 source                                      | Set source-base pivot before rotating. The visible arm points up-right at rest.                                                      |
| `machine.lever.knob`    | child of `machine.lever`, align its socket to arm cap               | pivot `(180, 330)` in its 360 × 380 source                                      | Keep as a separate raster so its scale/shine can pop on engage.                                                                      |
| `machine.tray`          | baked guide `(60, 611, 270, 122)`                                   | static until manually redrawn                                                   | Acorn lands at `(195, 660)`. For a true reveal, animate the Acorn and a vector tray-lip overlay, not the cabinet raster.             |
| `machine.reward.acorn`  | center `(195, 658)`, nominal `70 × 67`                              | pivot `(240, 382)` in its 480 × 460 source                                      | Start `opacity 0, scale .72, y +14`; reveal after result lock.                                                                       |

### Required hierarchy / draw order

```text
MoteMachine (artboard 390×844)
├─ bg.openBarnMeadow
├─ machine
│  ├─ cabinetBaseGuide                 (static candidate raster)
│  ├─ reelStrips                       (behind bezel overlay)
│  │  ├─ reel.left.mask → reel.left.strip
│  │  ├─ reel.center.mask → reel.center.strip
│  │  └─ reel.right.mask → reel.right.strip
│  ├─ reelBezelOverlay                 (manual vector redraw; see below)
│  ├─ brakeTabs
│  │  ├─ brake.left
│  │  ├─ brake.center
│  │  └─ brake.right
│  ├─ moteCradle
│  │  └─ moteDroplet
│  ├─ lever
│  │  ├─ leverArm
│  │  └─ leverKnob
│  └─ rewardTray
│     ├─ trayLipOverlay                (manual vector redraw only if animated)
│     └─ clockworkAcorn
└─ semanticUi                          (native / Rive vector text only)
```

### Important production caveat — no fabricated cutout claim

`cabinet-shell-empty-v1.png` has attractive _painted empty cream windows_, not
transparent holes. Therefore it cannot sit above moving raster strips without
covering them. In Rive, use it as the accurate style/position guide, then make
the following small manual redraws from it:

1. Three rounded-rectangle masks at the aperture bounds above.
2. A thin rose/dark-brown bezel overlay that follows the cabinet window edges.
3. Optionally, the cream tray front lip as a separate vector/painted overlay if
   the reward needs to emerge from behind it.

This is deliberately called out rather than pretending the single cabinet
raster is already a fully layered Rive file. The background, cabinet silhouette,
tray silhouette, strip, brake tab, Mote, lever parts, and Acorn are real clean
PNG sources; masks/overlays are the only required manual redraw work.

## Reel-strip crop and loop strategy

Treat the strip as six evenly spaced cells after import. The painted outer
border should be clipped away by each Rive aperture; import it slightly wider
than the aperture and use the **interior cell rhythm**, not its full transparent
bounds, to tune the final 5-symbol cell height. Copy the first five cells into
a vertical group twice (`A B C D E A B C D E`) and animate that group upward.
The generated sixth Acorn (`A`) exists to visually validate the seam while
setting the loop; do not add a separate reward category for it.

For spin motion: accelerate 140–180 ms, constant travel 600–900 ms, then brake
each reel 100–160 ms apart. In reduced motion, skip travel and crossfade/settle
to the selected symbol while retaining the brake-tab press.

## Generation record

Mode: built-in `image_gen` only. Local filesystem post-process: bundled chroma
key helper and `sips` non-destructive crops. No CLI image model/API was used.
Referenced style inputs on every applicable call:

- `/Users/bbroeking/projects/oink/assets/concepts/mote-machine/2026-08-30-rosie-style-lock/barn-stage-style-calibration-v1.png`
  — approved composition/style calibration.
- `/Users/bbroeking/projects/oink/assets/images/homepage-bg.jpg` —
  meadow/environment reference (background call only).
- `/Users/bbroeking/projects/oink/assets/images/sprites/rosie/idle_1.png` —
  shipped Rosie contour and palette reference.

### Prompt: `background-open-barn-meadow-v1.png`

```text
Use case: illustration-story
Asset type: Rive artboard background plate for a 390x844 portrait mobile game, export-quality raster at 2x.
Input images: first image is composition/style calibration only; second image is environment/color reference; third image is Rosie contour/style reference.
Primary request: create a bright open barn-and-meadow BACKGROUND PLATE ONLY. No game machine, no UI, no words, no numbers, no logos, no characters, and no collectible icons.
Scene/backdrop: view outward from inside a simple red-painted barn, wide open center view to cheerful rolling fresh-green meadow and blue sky. A few big pale-wood barn beams frame the upper edges and sides but leave an uncluttered central stage. Distant tiny red barn may be present. Small daisy and leaf accents live at extreme lower corners only. Reserve a calm clear central area for an overlaid machine.
Style/medium: polished 2D storybook game illustration matching the references: clean, confident dark cocoa-brown outlines; smooth rounded geometry; soft cel-painted highlights; low texture; very restrained wood grain; handmade warmth without fabric or paper collage.
Composition/framing: vertical 390x844 ratio, full bleed, generous empty central stage; no foreground object crosses into center.
Lighting/mood: sunny, inviting, warm daylight.
Color palette: barn red and rose, pale sunlit cream wood, sky blue, fresh green, soft gold, dark brown ink.
Constraints: no machine or UI/text. No paper stitches, stitched fabric, scrapbook debris, photorealism, 3D render, steampunk, dense wood grain, gear wallpaper, casino imagery, neon, watermark.
```

### Prompt: `cabinet-shell-empty-v1.png`

```text
Use case: illustration-story
Asset type: Rive layered cabinet-shell sprite. Generate on a removable flat chroma-key background.
Input images: first reference establishes the approved Mote Machine silhouette and layout only; second reference establishes Rosie’s shipped illustration contour, coloring, and friendly rounded form.
Primary request: ONE EMPTY MOTE-MACHINE CABINET SHELL only, front-facing and vertically centered, designed to occupy most of a 390x844 portrait artboard. A rounded barn-red/rose painted arcade cabinet with clean dark cocoa-brown outlines, two large empty vertical reel WINDOWS side by side or three narrow empty reel windows, one empty small Mote cradle above them, and a generously sized attached empty Clockwork-Acorn reward tray/pocket under them. Include no lever, no brake tabs, no symbols, no Mote droplet, no acorn, no text, no numbers, no labels, no buttons. The reel windows must be visibly empty cream interiors with an unadorned, clean flat area where a moving strip can sit.
Scene/backdrop: a perfectly flat solid #00ff00 chroma-key background for background removal. It must be one uniform color, no floor plane, no shadows, no gradient, no texture, no reflections, and no #00ff00 used in the cabinet.
Style/medium: production-ready 2D storybook game asset, cohesive with Rosie: smooth rounded cartoon geometry, confident dark-brown 3–4px outlines at final 2x scale, soft cel-painted light cream highlights, rose/barn-red/sun/cream/fresh-green palette. Painted wood only as a very subtle broad surface cue, never dense grain. Use small simple leaf flourishes only if needed.
Composition/framing: portrait aspect near 390x844, full machine complete, front-on, generous 40px equivalent green padding all around, clear separable silhouette; no cropped edges.
Constraints: no fabric seams or stitches, no paper-craft collage, no generic gears, springs or casino symbols, no steampunk, no 3D, no photorealism, no neon, no watermark, no typography.
```

### Prompt: `reel-strip-project-symbols-v1.png`

```text
Use case: illustration-story
Asset type: single vertical Rive reel-strip texture, designed to be clipped behind an empty reel window. Generate on a flat removable chroma-key background.
Input images: first reference gives game-world palette only; second is Rosie’s shipped visual-style reference.
Primary request: make ONE narrow, long, perfectly straight vertical strip with six equally tall adjacent cream cells, each cell containing one centered clean project-specific icon. Top-to-bottom cell sequence: (1) Clockwork Acorn: a simple golden acorn with a tiny visible circular clock-face inset and one little key-like winding tab; (2) Mote droplet: a luminous smooth blue-violet water droplet with three tiny star specks; (3) Auto-Tickler part: a friendly tan wooden-handled brush/whisk with soft bristles, clearly a tickling tool rather than a spring; (4) blessing part: a small sunny golden disk with one simplified white wing flourish; (5) curse part: a compact plum-gray cloud with a single soft green thorn sprout; (6) exact repeat of Clockwork Acorn so the top/bottom visual rhythm is loop-safe. Every symbol has the same centered scale, crisp dark cocoa-brown outline, and empty cream cell background. No symbols other than the listed five.
Scene/backdrop: the strip floats centered on a perfectly flat solid #00ff00 chroma-key background. Background must be uniform #00ff00 with no shadow, texture, floor, reflection, or gradient. Do not use #00ff00 in the strip.
Style/medium: clean production 2D storybook game sprite matching Rosie: smooth rounded geometry, dark brown outlined shapes, soft cel-painted highlights, bright barn-red/rose/sun/cream/fresh-green accents but no fabric or stitched texture.
Composition/framing: very tall narrow portrait strip; generous green padding around the entire strip; the strip ends cleanly at the edge of the first and sixth cells without caps, tabs, labels, or trim.
Constraints: no text, no numbers, no generic gears, springs, coins, slots, casino glyphs, steampunk, photorealism, 3D, neon, watermark.
```

### Prompt: components sheet and individual crops

```text
Use case: illustration-story
Asset type: Rive component sprite sheet on a removable chroma-key background. Every component must be fully separate, with no overlaps and large clear space between objects.
Input images: first reference gives approved Mote Machine art direction and palette; second reference establishes Rosie’s shipped clean rounded illustration style.
Primary request: make exactly five isolated production-ready parts in a simple 2-column grid, all floating on the same flat green background: top-left: ONE small rounded gold-and-rose brake tab, like a padded stop-button tab, front-on, no symbols; top-right: ONE Mote droplet, blue-violet, smooth rounded water-drop silhouette, three tiny white star specks; middle-left: ONE lever ARM ONLY, a warm golden wood/metal handled long slender arcade lever shaft, angled up-right, visibly no knob attached; middle-right: ONE lever KNOB ONLY, a round glossy rose-pink ball knob with a short dark-gold socket at its base, no shaft; bottom-center: ONE Clockwork Acorn reward icon, golden acorn with a tiny clock face inset and a small key-like winding tab. Do not draw any other items.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform with no shadow, no floor plane, no gradient, no texture, no reflection. Do not use #00ff00 in any part.
Style/medium: clean 2D game pieces matching Rosie: smooth rounded geometry, confident dark cocoa-brown outlines, soft cel highlights, golden sun, rose, blue-violet, cream, fresh-green palette; high silhouette clarity; no fabric/stitch treatment.
Composition/framing: portrait, objects evenly spaced with at least 100px green gap from all other parts and image edges; each has generous clean padding.
Constraints: no tray, no cabinet, no text, no numbers, no labels, no generic gears, no springs, no casino symbols, no steampunk, no 3D render, no photorealism, no neon, no watermark.
```

`components-sheet-v1.png` was cropped non-destructively with these source
rectangles, in `(x, y, width, height)` source pixels: brake `(45, 155, 480,
300)`; Mote `(600, 130, 350, 380)`; arm `(130, 520, 300, 520)`; knob `(575,
590, 360, 380)`; Clockwork Acorn `(300, 1010, 480, 460)`.
