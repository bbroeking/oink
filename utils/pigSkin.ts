// Slop Club Rosie — CLIENT-ONLY PROTOTYPE member pig skin (exploratory).
//
// A gentle gold/rose WASH over the base pig frames so a member's Rosie reads as
// the gilded "club" variant. This is NOT final art and NOT server-backed. The
// wash is a low-opacity `tintColor` copy of each frame, kept tasteful (a wash,
// not a repaint); the tint itself arrives through `skinTintOverride` on the pig
// render path (see the member-perks prototype). The real version would ship
// bespoke gold Rosie sprite frames and gate on the durable is_vip flip.

// Opacity of the tintColor copy laid over the frame, so Rosie's shading still
// reads underneath the gilding.
export const PIG_SKIN_WASH = 0.34;
