// The six table emotes (multiplayer/protocol EMOTES) drawn as stickers the
// game already owns: five of the visit's parting emotes and Rosie's own face
// glyph, so the tray is one painted family (the fan-marks ruling,
// 2026-09-17) and nothing new had to be drawn. There is no free text at a
// table: strangers share it, so this set is the whole vocabulary.
//
//   oink    the waving pig       (a hello)
//   love    two snouts, one heart
//   giggle  the confetti laugh
//   wow     Rosie, eyes wide
//   oops    a pig who slipped into the mud
//   gg      a mug raised: good game, thanks for the round

import type { ImageSourcePropType } from "react-native";
import { glyphSource } from "@/components/ui";
import { EMOTES, type Emote } from "@/multiplayer/protocol";
import { EMOTE_LABEL } from "@/utils/multiplayer/copy";
import { VISIT_EMOTE_IMAGES } from "@/utils/visitEmotes";

export const EMOTE_ART: Readonly<Record<Emote, ImageSourcePropType>> = Object.freeze({
	oink: VISIT_EMOTE_IMAGES.golden_wave,
	love: VISIT_EMOTE_IMAGES.snout_boop,
	giggle: VISIT_EMOTE_IMAGES.confetti_oink,
	wow: glyphSource("pigface"),
	oops: VISIT_EMOTE_IMAGES.mud_bath,
	gg: VISIT_EMOTE_IMAGES.slop_thanks,
});

export { EMOTES, EMOTE_LABEL };
