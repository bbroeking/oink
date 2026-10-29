# Recruit pig accessory visual review

Read-only review of the regenerated normal-size contact sheets for Bandit,
Pickles, and Biscuit. Coverage was all 51 head items across all 48 source frames
for each pig: **7,344 frame/item/pig panels**. The complete catalog was checked
in grouped indexes, with full-resolution inspection of disputed fits and
representative broad-brim, rigid-cap, narrow-contact, and full-head-wrap items.
An aggregate crop of every item's four `face_sit` panels was also checked for
each pig after the authored crown calibration was applied.

## Resolved shared correction

The earlier `face_sit_1`–`face_sit_4` landmark at x=193–195 was too far toward
the snout on all three pigs. Cowboy and pirate brims projected past the forehead
while leaving too much rear crown uncovered; the bog helmet and crown sat on the
forward forehead rather than between the ear roots. The astronaut shell and
Aurora opening also appeared right-heavy.

The regenerated sheets use this authored `face_sit` calibration for all four
frames:

- crown: **x=178, y=40** on the 300 × 300 contain stage
- rotation: **+6°**, clamped with the global ±8° rule
- scale: keep the existing per-pig `face_sit` family-static scale

This point is intentionally an anatomical calibration, not a visible-contour
measurement. In the raw Rosie `face_sit_1` art, the far ear overlaps the true
crown. The visible first-opaque outline at x≈175 is the far-ear hump around
y≈20, while the skull/ear-root seat is hidden below it around y≈38–43. The
current x≈194 follows the descending forehead tangent. A contour-only detector
cannot recover the hidden hat seat reliably.

The aggregate review of all 51 items confirms that this shared correction seats
the hats between the ear roots for Bandit, Pickles, and Biscuit. No residual
forward bias or item-specific compensating offset is needed.

## Family-static scale recommendation

Use one median scale for each pig and pose family so blinks, hoof positions,
effect lines, and jump compression cannot pulse hat size:

| Pig | idle | walk | jump | happy | sad | tired | surprise | wave | face | face_sit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bandit | 1.008 | 0.969 | 0.857 | 0.931 | 0.994 | 1.015 | 0.875 | 0.876 | 1.013 | 1.051 |
| Pickles | 1.014 | 0.946 | 0.867 | 0.939 | 0.970 | 0.973 | 0.885 | 0.875 | 0.998 | 1.026 |
| Biscuit | 1.015 | 0.941 | 0.861 | 0.927 | 0.982 | 0.992 | 0.877 | 0.885 | 0.994 | 1.042 |

For `face` and `face_sit`, keep the side-art family baseline and aspect ratio;
the values above are within-family ratios, not front-width substitutions.

## Verified behavior and remaining exceptions

Across idle, walk, jump, happy, sad, tired, surprise, wave, `face`, and
`face_sit`, all 51 items follow head translation without a visible single-frame
jump in the contact sheets. First/last-frame seating remains spatially
consistent. Bandit’s stripe makes the center relationship especially legible;
Pickles and Biscuit show the same result without relying on shared coloration.

The earlier `astronaut` exception on `tired_3`–`tired_4` is resolved. The
item-specific depressed-pose scale and authored pivot keep the lower helmet ring
clear of the eyes and snout through all sad and tired frames on Bandit, Pickles,
and Biscuit. Re-review of all 48 regenerated astronaut frames per pig found no
floating, clipping, discontinuity, or new exception.

One source-art limitation remains and should not be corrected with landmark
offsets:

- `aurora_glow_hood`, `sad_1`–`sad_4` and `tired_1`–`tired_4`, all three pigs:
  the deep fur opening intentionally obscures much of the eyes/cheeks on the
  lowered head. The outer hood remains centered and stable. This is intrinsic
  to the source opening and cannot be fixed without a shallower side/depressed
  pose asset or per-pose mask.

No other item/animation/frame exception was found among the 7,344 reviewed
panels. The remaining playback check at normal game size is tracked separately
by the parent review; this document records the complete static contact-sheet
review for the three requested pigs.
