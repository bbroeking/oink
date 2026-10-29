# Halloween 2026 card art QA

Reviewed 2026-10-14 against the 34 `cardArtVersion` selections in `content.json`. This is card-render QA only. It does not approve any image as production wearable/profile art or establish attachment pivots, occlusion, side views, or fit across pigs and animation frames.

## Result

- **All 34 selected images pass card-art review.** They read as cheerful painted storybook objects/scenes with the established dark cocoa outlines, warm highlights, and Halloween palette.
- The selected regenerations `005-v2`, `007-v2`, `009-v2`, `014-v2`, `023-v2`, and `029-v2` resolve the previously observed problems. Spirit Glow v2 has a clean lavender halo and complete padded ellipse without the cyan, electric-blue, and magenta edge contamination visible in rejected v1. `029-v2` contains only the bat-ear cap; the unrelated bow and potion from the rejected version are absent.
- No selected object has high-opacity artwork clipped by its canvas. A few older images have isolated low-alpha edge pixels, but their alpha-128 bounds remain safely inset and visual inspection shows complete silhouettes.
- The eight backgrounds are opaque, character-free, and retain usable central space for the pig/card composition.

## Method

Each selected PNG was opened with Pillow to record dimensions, color mode, alpha extrema, nonzero-alpha bounding box, and edge contact. Transparent assets were also checked at an alpha threshold of 128 to distinguish faint generation residue from meaningful silhouette clipping. All 34 selections were inspected together on a checkerboard contact sheet; geometry-sensitive and flagged images were then inspected at source resolution. Asset files and rejected versions were not modified.

`Alpha` below reports whether the file contains a true zero-alpha background. Bounding boxes use Pillow's `(left, top, right, bottom)` convention. Backgrounds are intentionally opaque RGB.

## Selected-file inventory

| # | Selected file | Size / mode | Alpha / nontransparent bbox | Visual QA |
|---:|---|---|---|---|
| 001 | `001-moonbrew-witch-hat-card-v1.png` | 1297×1213 RGBA | α 0–255; (39,69,1261,1213) | Pass; complete silhouette. Bottom contact is faint residue only. |
| 002 | `002-hedge-broom-card-v1.png` | 1297×1213 RGBA | α 0–255; (81,46,1269,1213) | Pass; compact readable broom. Bottom contact is faint residue only. |
| 003 | `003-high-collar-scarf-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,53,1259,1187) | Pass; full collar is visible. Left contact is low-alpha residue; α≥128 starts at x=83. |
| 004 | `004-pip-candle-card-v1.png` | 1297×1213 RGBA | α 0–255; (41,54,1251,1167) | Pass; clean holder and flame. |
| 005 | `005-patchwork-bolt-cap-card-v2.png` | 1254×1254 RGBA | α 0–255; (33,28,1232,1222) | Pass; regenerated cutout is clean, centered, and free of the v1 haze. |
| 006 | `006-stitched-bow-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,8,1296,1193) | Pass; full bow is visible. Edge contacts are low-alpha fringe; α≥128 bbox is (36,137,1264,1078). |
| 007 | `007-friendly-skull-facepaint-card-v2.png` | 1254×1254 RGBA | α 0–255; (0,79,1220,1232) | Pass; regenerated mask has complete side bones, chin, and open apertures. Left contact is faint residue. |
| 008 | `008-crossbones-bow-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,32,1291,1191) | Pass; complete silhouette. Left contact is low-alpha fringe; α≥128 starts at x=118. |
| 009 | `009-linen-knot-headwrap-card-v2.png` | 1254×1254 RGBA | α 0–255; (33,45,1238,1222) | Pass; regenerated knot and both tails have clear padding. |
| 010 | `010-scarab-lantern-card-v1.png` | 1297×1213 RGBA | α 0–255; (113,39,1245,1213) | Pass; bottom contact is faint residue only. |
| 011 | `011-lantern-sprout-cap-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,33,1265,1213) | Pass; cap, leaf, and curl are complete. Edge contacts are low-alpha residue. |
| 012 | `012-pumpkin-treat-pail-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,23,1277,1181) | Pass; pail, handle, and intended treats are readable. Left contact is faint residue. |
| 013 | `013-silly-sheet-ghost-hood-card-v1.png` | 1297×1213 RGBA | α 0–255; (0,0,1261,1213) | Pass; hood silhouette and openings are complete. Top/left contacts are low-alpha residue; α≥128 bbox is (84,112,1211,1104). |
| 014 | `014-spirit-glow-card-v2.png` | 1536×1024 RGBA | α 0–254; (25,37,1510,998) | Pass; clean padded lavender ellipse, readable cocoa-outlined stars, and no v1 chromatic edge noise. Rejected v1 remains preserved because cyan/magenta/blue contamination fringed its translucent lower arc. |
| 015 | `015-moonpuff-wolf-ears-card-v1.png` | 1254×1254 RGBA | α 0–255; (25,55,1234,1208) | Pass; clean padded headband and ear silhouette. |
| 016 | `016-moon-charm-card-v1.png` | 1254×1254 RGBA | α 0–255; (37,71,1218,1230) | Pass; complete cord, bead, and charm. |
| 017 | `017-lantern-porch-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; warm porch scene with clear central floor. |
| 018 | `018-haunted-orchard-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; orchard framing leaves a clear central lawn. |
| 019 | `019-moonlit-graveyard-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; gentle storybook graveyard with a clear central path. |
| 020 | `020-witches-wood-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; cheerful enchanted woods and open central trail. |
| 021 | `021-cobweb-barn-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; barn interior retains a broad central stage. |
| 022 | `022-candy-lantern-trail-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; bright readable path and balanced edge decorations. |
| 023 | `023-halloween-2026-pirate-tricorn-hat-card-v2.png` | 1254×1254 RGBA | α 0–255; (0,55,1224,1113) | Pass; regenerated hat is clean and free of the v1 brown halo. Left contact is faint residue; α≥128 starts at x=141. |
| 024 | `024-halloween-2026-toy-cutlass-card-v1.png` | 1254×1254 RGBA | α 0–255; (0,101,1230,1214) | Pass; complete toy-like cutlass. Left contact is faint residue. |
| 025 | `025-halloween-2026-patched-straw-hat-card-v1.png` | 1254×1254 RGBA | α 0–255; (0,29,1240,1254) | Pass; full brim and patches are visible. Edge contacts are low-alpha residue; α≥128 bbox is (42,250,1213,986). |
| 026 | `026-halloween-2026-straw-bow-card-v1.png` | 1254×1254 RGBA | α 0–255; (33,56,1170,1222) | Pass; clean, readable straw bow. |
| 027 | `027-halloween-2026-spark-goggles-card-v1.png` | 1774×887 RGBA | α 0–255; (40,7,1734,857) | Pass; complete wide goggles with even padding. |
| 028 | `028-halloween-2026-bubbling-flask-card-v1.png` | 1254×1254 RGBA | α 0–255; (0,23,1224,1254) | Pass; flask-only art with intended bubbles. Edge contacts are faint residue; α≥128 bbox is (331,210,923,1035). |
| 029 | `029-halloween-2026-bat-ear-cap-card-v2.png` | 1374×1145 RGBA | α 0–255; (65,45,1297,1089) | Pass; cap-only regeneration, with no bow, potion, or unrelated prop. |
| 030 | `030-halloween-2026-bat-wing-bow-card-v1.png` | 1254×1254 RGBA | α 0–255; (25,53,1179,1213) | Pass; clean symmetrical bat-wing bow. |
| 031 | `031-halloween-2026-star-headwrap-card-v1.png` | 1374×1145 RGBA | α 0–255; (49,35,1360,1095) | Pass; all fabric tails and ornament points are intact. Right padding is 14 px at nonzero alpha and 80 px at α≥128, sufficient for the selected card render. |
| 032 | `032-halloween-2026-crystal-ball-card-v1.png` | 1254×1254 RGBA | α 0–255; (0,87,1234,1204) | Pass; complete ball and crescent stand. Left contact is faint residue; α≥128 starts at x=290. |
| 033 | `033-halloween-2026-haunted-ship-deck-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; distinct moonlit ship deck with broad open center and no character. |
| 034 | `034-halloween-2026-harvest-moon-cornfield-bg-card-v1.png` | 1254×1254 RGB | Opaque | Pass; distinct harvest-moon field with a clear central path and no character. |

## Production-fit boundary

These files are approved here only as the selected unlock-card illustrations. Wearable production art still requires transparent accessory-only exports, authored profile art where required, placement-studio authoring, and verification in the production renderer on every pig and source animation frame. A clean card illustration does not establish that production fit.

## Night Two additions, 035–039

The five selected v1 rasters are registered through the same deterministic art
builder. Hollow Jack is a complete empty suit silhouette, Cobweb Crown has three
rounded jewel drops, Ghostlight Lantern has a friendly mint flame, Little Haunt
is an original spectral bog frog, and Whispering Crypt is a character-free,
opaque stage with an open central floor. Art windows use contain for item art
and cover for scenes. No frame, lettering or pig is baked into these files.

All four isolated illustrations have true transparent alpha. Their substantial
silhouettes (alpha >16) remain inside the canvas; a few nearly transparent edge
pixels extend farther. The crypt is fully opaque. This checks card art, not
accessory pivots, costume masks, front/profile fit or animation registration.
Generation prompts and source paths are preserved in art-generation.json.

## Founder correction: Hollow Jack v2 and separate garment layers

035 v1 is rejected: the humanoid empty suit did not fit Rosie's anatomy. Selected
card art v2 shows a broad head hood and a short pig romper, guided by the actual
Rosie idle sprite. A combined transparent overlay was derived, then rejected as
a live split-image technique after visible crop seams. The live fit now uses
separate complete hood-v1 and romper-v3 clothing layers; their source face/ear
and cuff apertures have true alpha. Romper-v1/v2 are rejected for a brown smoky
halo and opaque cuff interiors and must not be bundled by the accepted renderer.
All originals and generation prompts remain in the provenance record. This is
front-idle prototype fitting; native and other-pig/pose acceptance is separate.

## Fitted costume expansion, 040–044

All five selected card illustrations use true-alpha painted Rosie costume references. Runtime clothing is separate: five 1393×1129 RGBA hoods with face/ear windows and five 1254×1254 RGBA rompers with three real hoof windows. No generated pig face is used in the wearable renderer. Prompt/source provenance is in `costume-card-expansion-art-generation.json`, `hood-expansion-art-generation.json` and `romper-expansion-art-generation.json`; final composed fit review is recorded in `costume-expansion-verification.md`.
