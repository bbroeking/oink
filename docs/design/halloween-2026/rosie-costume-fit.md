# Hollow Jack Rosie fit boundary

This prototype replaces the rejected whole-silhouette paint mask. It renders the
unchanged Rosie source PNG first, then a transparent clothing-only Hollow Jack
overlay. The overlay's open face, inner-ear and hoof areas reveal actual source pixels rather than drawing a second pig. The hood intentionally covers the brows and much of the forehead; the tail is partly covered in this front view. The concept board's broader all-face/tail claim is not claimed for this raster fit.

The browser study is deliberately bounded to Rosie's twelve front-facing idle
frames at a 300 × 300 contain stage. Hood and romper are split into overlapping
render regions. The hood follows the reviewed per-frame crown contact, rotation
and head-width scale in `PIG_ATTACHMENT_FRAMES`; the short torso garment stays
on the authored front-idle body reference. Both regions read the same frame name
from `usePigPlayback` as the source image.

The accepted proof uses two complete garment assets rather than cropping bands
from the earlier combined extraction. A 360 × 360 fitting stage gives the
unchanged 300 × 300 Rosie frame 60 pixels of headroom and 30 pixels of side
padding. The complete hood renders at 360 × 320, keeping its stem, ear wraps,
side vines and face ring intact. The complete, true-alpha romper renders
independently at 260 × 213. Its padded source art lands over Rosie's short
y 208–283 torso, and its cuff centers align near stage x 105, 165 and 237 over
the three original hoof spans. The narrower fit prevents the open cuffs from
reading as phantom legs beside Rosie. There are no rectangular cuts
through painted clothing and no duplicated hood rim. This preserves the wide face window, large round head, compact
torso and short legs specified in the Claude Design concept. It contains no
sampled card texture, human arms or boots, and it does not replace Rosie's face.

This is not approval for the other five pigs or Rosie's turned, seated, walk,
jump, happy, sad, tired, surprise or wave families. Those need authored fitting,
front/back occlusion decisions and native renderer integration before shipping.
