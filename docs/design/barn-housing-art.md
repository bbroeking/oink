# Barn housing art and scene contract

Date: 2026-09-06

## September reference amendment

The approved UI target is now recorded in `assets/concepts/barn-housing/01-warm-starter-target.png` and `02-furnished-target.png`. The runtime keeps the original three registered room paintings and isolated furnishing catalog, while adopting the targets' quieter composition: wall and hanging pieces occupy smaller upper-room anchors, floor furniture stays in narrower side lanes, the rug sits lower and shallower, and the shelf object stays on the painted left shelf. Host and visitor pigs now use 36% and 30% of the room width at their shared lower-floor anchors. Rosie's starter sketch uses the isolated `rosies_pencil_sketch_v4.png` artwork for both its room rendering and catalog preview. Patchwork Rug uses the isolated `patchwork_rug_v4.png`, removing the rectangular floor-colored residue around the earlier sprite. Full generation prompts for both replacements are recorded in `assets/concepts/barn-housing/README.md`.

The evidence builder reads normalized anchors directly from `constants/habitat.ts`, then center-fits each transparent sprite with the same `contain` behavior as `HabitatScene`. This replaces the earlier evidence-only pixel offsets, which could drift from the shipped layout when anchors changed.

The Barn Interior uses a fixed 390 × 844 portrait cutaway. The three themes share one camera, shelf, floor plane, and named safe regions. Furniture is authored once against those regions; the renderer never applies theme-specific offsets, skew, or rotation.

## Visual direction

The room is the painted world around the existing pig renderer. Broad flat painted shapes, warm brown contours, modest cel highlights, and readable silhouettes follow Rosie's shipped sprite language. Warm Plank Barn is honeyed daylight, Spring Whitewash is pale and fresh with sage structure, and Midnight Rafters is a quiet indigo moonlit treatment. The themes deliberately change atmosphere while preserving contrast and composition.

The fifteen finished furnishings use a built-in OpenAI image-generation source sheet saved as `assets/images/habitat/source/imagegen-furnishings-sheet-v2.png`. `scripts/habitat/generate-art.mjs` crops each named object, removes the connected backdrop, preserves alpha, fits it to its stable safe dimensions, and derives its thumbnail. The door, cabinet overlay, and missing-art fallback remain original project-authored SVGs retained beside the raster source.

The three finished room themes use a built-in OpenAI image-generation source pass saved as `assets/images/habitat/source/imagegen-room-triptych-v2.png`, then deterministic crops and exports from the same generator script. Prompt: “Create one horizontal triptych of three empty, identically registered frontal barn interiors: Warm Plank daylight, Spring Whitewash with sage beams, and Midnight Rafters. Keep a clear central two-pig floor, back-wall and rafter safe regions, a left shelf, and a far-right closed cabinet. Use polished cozy storybook painting, warm-brown outlines, rounded cartoon geometry, gouache/cel highlights, wood grain and controlled light; no pigs, furniture, text, UI, clutter, photorealism, or 3D.” The contact-sheet proof composites the project's shipped Rosie and Pickles sprites; those pig images are evidence only and are not duplicated into the housing bundle.

Furnishing generation prompt: “Create one transparent 5 × 3 sprite sheet in exact row-major catalog order, with fifteen isolated, uncropped Barn objects: the three wall designs; two hanging designs; crock, chair, hay bale, and milk-can lamp; three oval woven rugs; apple basket, open guestbook, and tiny radio. Match the polished cozy storybook pig with warm-brown contours, rounded cartoon geometry, gouache texture, soft cel highlights, consistent upper-left light, tactile materials, and role-correct room perspective. No background, grid, labels, UI, primitive vectors, clip art, photorealism, or 3D.”

The sheet placed Apple Basket and Guestbook Keepsake into overlapping source bounds. Apple uses a source-aware crop plus edge-alpha cleanup; the guestbook uses a separate transparent generation source at `assets/images/habitat/source/imagegen-guestbook-keepsake-v3.png` so both silhouettes remain complete. Its prompt requests one isolated open cream guestbook with complete blue cover, ribbon bookmark, daisies, ink marks, and rosy stamp in the same painted style, with no other objects or background.

## Anchors and layers

`constants/habitat.ts` is the scene source of truth. Each position has a normalized center, bounding size, accepted category, accessible label, and render layer. The order is theme, wall, rafters, floor centerpiece, left/right floor pieces, supplied pig stages, shelf object, then interaction UI. Every theme paints the shared shelf at left and a closed cabinet at far right, outside the seven customizable positions. An enabled owner adapter overlays controls only in that cabinet region.

The `HabitatScene` interface accepts a committed or draft snapshot plus caller-supplied `hostPig` and optional `visitorPig`. This keeps the existing live pig/cosmetics/tickle renderer authoritative. The visitor pig is 30% of scene width, slightly behind and left of the 36%-wide host pig. Furniture remains legible around both.

Spatial edit controls are at least 44 × 44 points, including at the smallest supported canvas. Empty markers exist only while editing. Every control exposes its position and selected design in its accessibility label; the separate list editor remains the full Dynamic Type and VoiceOver editing path.

## Launch set and compatibility evidence

The catalog contains exactly three room themes and fifteen furnishings:

- Wall: Rosie's Pencil Sketch, Pressed Clover Frame, Barn Bunting.
- Rafters: Firefly Lantern, Dried Herb Garland.
- Floor left/right: Sunflower Crock, Reading Chair, Hay Bale, Milk-can Lamp.
- Center floor: Patchwork Rug, Braided Straw Rug, Muddy Paw Rug.
- Shelf: Apple Basket, Guestbook Keepsake, Tiny Radio.

`scripts/habitat/build-evidence.mjs` recreates the review artifacts. `artifacts/habitat/two-pig-theme-contact-sheet.png` checks the same furnished two-pig composition in all three themes. `artifacts/habitat/all-furnishings-contact-sheet.png` contains every furnishing grouped by its compatible position family. `artifacts/habitat/exhaustive-compatibility-contact-sheet.png` renders all 57 furnishing × compatible-position × theme combinations at the runtime anchors; its adjacent JSON manifest fixes the cell order. Pure tests verify the closed catalog, 1,125-Snout paid total, category routing, fallback asset, seven independent 44-point controls, spoken room summary, and normal and Reduced Motion door contracts.

These desktop-generated composites record composition evidence. They do not claim native device, VoiceOver, Dynamic Type, or Reduced Motion acceptance; those checks belong in the implementation handoff after running the integrated screen on device.
## Furnishing expansion amendment — 2026-09-06

The 100-design expansion now has finished, individually generated transparent
artwork, runtime exports, and thumbnails. See the
[expansion acceptance and provenance record](../handoffs/2026-09-06-barn-furnishing-expansion.md).
The original art contract below remains the baseline for room themes and anchors.
