# Accessory attachment visual review — Rosie, Copper, and Pepper

Date: 2026-10-14

## Coverage and method

Reviewed the generated static contact sheets in `artifacts/accessory-attachment-preview/contact-sheets` for every current hat on Rosie, Copper, and Pepper:

- 51 hats × 3 pigs × 48 source frames = **7,344 rendered combinations** across 153 sheets.
- Every sheet was inspected in a grouped thumbnail index. Rosie rigid and representative styles were additionally inspected from their full 1500 × 2160 sheets: `astronaut`, `aurora_glow_hood`, `beanie`, `bog_helmet`, `bunny_ears`, `candlelit_circlet`, `cat_ears`, `chef_toque`, `cherry_pop_bow`, `cowboy`, `crescent_moon_cap`, `crown`, `daisy_flower_crown`, `devil_horns`, `ermine_coronet`, `frost_monarch_crown`, `frosted_cupcake_crown`, `ganache_truffle_crown`, `halo`, `hibiscus_sun_crown`, `hungerers_crown`, `leaf_crown`, `masquerade_plume_hat`, `messenger`, `moth_waltz`, `muddy_cap`, and `mushroom_cap`.
- Each sheet contains idle 1–12; face 1–4; face-sit 1–4; walk 1–4; jump 1–4; happy 1–4; sad 1–4; tired 1–4; surprise 1–4; and wave 1–4.
- This is a static source-frame review. Normal-size live playback, loop seams, and transitions are separate verification and are not claimed here.
- Bandit, Pickles, and Biscuit were not part of this visual pass.

After the face-sit calibration was regenerated, all four `face_sit` frames were rechecked for all 51 hats on the same three pigs: **612 final-state face-sit combinations**. This follow-up used four-frame strips at a readable character scale rather than relying on the earlier all-frame thumbnails.

After the astronaut lowered-pose calibration, its complete 48-frame sheet was regenerated and inspected for all six pigs: Rosie, Copper, Pepper, Bandit, Pickles, and Biscuit (**288 final astronaut combinations**).

## Result

No floating, slipping, discontinuous scale changes, or single-frame position jumps were visible in the reviewed Rosie, Copper, or Pepper sheets. Rigid hats, crowns, small circlets, ears/horns, tall hats, and asymmetric hats consistently followed the crown through the large vertical changes in jump 1–4 and the low head poses in sad 1–4 and tired 1–4. Side-facing art remained attached through face 1–4 and face-sit 1–4. The same placement pattern held across all three reviewed pigs.

The regenerated face-sit pass also showed continuous placement from frames 1 through 4 for every hat. No face-sit-specific offset, scale, rotation, or layer adjustment is supported by the final contact sheets.

The astronaut's authored `sad` and `tired` overrides resolve the previously observed visor-rim clipping. Eyes and snouts remain clear in sad 1–4 and tired 1–4 on all six pigs, including the lowest tired 4 pose. The other 40 frames retain their prior fit and attachment. This exception is resolved in the final sheets.

## Remaining visual exceptions

| Item | Pig | Animation / frame | Observation | Classification |
| --- | --- | --- | --- | --- |
| `aurora_glow_hood` | Rosie, Copper, Pepper | face 1–4; face-sit 1–4 | The supplied side art, `assets/images/hats/side/aurora_glow_hood.png`, remains a large rigid circular opening around the profile head. It is consistently attached after calibration, but reads more like a portal than fabric wrapping the skull. | Minor source-art / wrap limitation |
| `aurora_glow_hood` | Rosie, Copper, Pepper | sad 1–4; tired 1–4 | The fixed circular opening leaves uneven empty space above and beside the lowered head and can crowd the lowered ear/forehead contour. Tracking is continuous. | Source-art / wrap limitation |
| `hungerers_crown` | Rosie, Copper, Pepper | face 1–4; face-sit 1–4 | This item uses `assets/images/hats/hungerers_crown.png`; it has no entry in `HAT_SIDE_IMAGES`. Its very wide frontal silhouette overlaps the near and far ear regions in profile. Attachment is stable, but the artwork does not describe a side fit. | Minor source-art / perspective limitation |

The earlier pass also flagged `astronaut` and `masquerade_plume_hat` too broadly. The final face-sit strips confirm that both use supplied side art—`assets/images/hats/side/astronaut.png` and `assets/images/hats/side/masquerade_plume_hat.png`—and both fit consistently on Rosie, Copper, and Pepper in face-sit 1–4. They are not remaining face-sit exceptions.

No safe per-animation transform tweak would resolve the two remaining art limitations. Moving, scaling, or rotating `aurora_glow_hood` would move its already-correct attachment point without changing the circular opening. The same changes to `hungerers_crown` would not create profile perspective and would weaken its intended wide fit. A true improvement would require revised side artwork (and a `HAT_SIDE_IMAGES` entry for `hungerers_crown`), not another anchor adjustment.

## Interpretation limits

The contact sheets demonstrate source-frame geometry and consistency, including the most displaced poses. They cannot prove timing behavior at loop boundaries, transitions between clips, or the exact appearance at normal game size. Those require the live playback pass. The exceptions above should not be treated as anchor regressions: their pivot follows the head, while the flat accessory artwork lacks a profile/deformed variant needed for a fully natural wrap.
