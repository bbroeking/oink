# Game body reference — supersedes the initial card masters

The user rejected the taller body used in the first co-op card template. The earlier `pigs/masters/rosie-v2.png` and `pigs/masters/pepper.png` uploads are **not authoritative for the primary game's body**. Their use as the card anatomy source was a mistake.

## Source of truth

The live game routes `PigStage` through `PigRenderer` to the raster sprite pack (`RasterPig` / `SpritePig`, `constants/pigFrames.generated.ts`, `constants/pigFramesExtra.ts`). Rive is gated: `components/ui/rivePigAsset.ts` currently exports an undefined source. Roster portraits and authored masters do not override live game anatomy.

These four files are byte-for-byte copies, renamed only for clear uploads to Claude Design:

| Reference | Original |
| --- | --- |
| `rosie-game-front.png` | `assets/images/sprites/rosie/idle_1.png` |
| `rosie-game-three-quarter.png` | `assets/images/sprites/rosie/face_1.png` |
| `pepper-game-front.png` | `assets/images/sprites/pepper/idle_1.png` |
| `pepper-game-three-quarter.png` | `assets/images/sprites/pepper/face_1.png` |

All source canvases are 370 × 383. `scripts/normalize-pig-masters.py` explicitly treats shipping Rosie's sprite as the immutable game layout reference and warns about standalone concepts drifting into different body shapes.

## Invariants across views and poses

- Large round head, compact rounded torso, short stubby legs, small hooves, very little visible neck.
- Preserve head-to-body relationship, torso length, leg length, eye spacing, snout, ears, tail, coat and hoof markings.
- Front and three-quarter views may differ in projection and pose; they depict the same body. Use the game's existing corresponding view whenever available.
- Render source pixels at their natural aspect ratio with `contain` and uniform scaling. Never stretch one axis to fill an art window.
- Break-out is a presentation layer: restrained translation, uniform scale and shadow. It must not elongate limbs or torso, crop the head away, or hide so much of the body that the silhouette changes.
- Compare the source sprite and card side by side for every new illustration or future 3D model. A matching palette alone is insufficient.
- Higher-resolution art or new angles require a separate anatomy review against this model sheet. Generated concepts and existing card full art do not silently become the new character reference.

The Claude Design correction updates the existing Workshop / CoopCard canvas rather than creating a competing design system. Earlier screenshots in the parent directory show the rejected master-based version and are historical evidence, not approved body references.

## Verified correction

- Updated the existing [Claude Design Workshop](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Co-op+Card+Workshop.dc.html) and shared CoopCard component to use the four live sprites. Added a Front / Three-quarter radio selector and a source-versus-standard-versus-breakout comparison for both pigs.
- Verified all four uploaded reference files match their original source bytes with `cmp`.
- Inspected Rosie front at 320 and Rosie/Pepper three-quarter at 393. The compact torso and short legs remain recognisable and all hooves remain visible. Title and rules stay above the art.
- The image wrappers use `background-size: contain`; checked Pepper's rendered three-quarter images, with no image-level transform. No anatomical redraw or new 3D model was introduced.
- Saved screenshots: `rosie-source-and-cards.png`, `three-quarter-cards-393.png`, and `pepper-three-quarter-393.png`.
- `npm run quality:check` was rerun and still fails the pre-existing 138-vs-91 line-clamp budget and `my_drives` default-role revocation gate. See `quality-check.txt`. This correction changes the private canvas and reference docs, not production app source or game rules.
