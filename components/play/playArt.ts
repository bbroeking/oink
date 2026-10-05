// Matchmade play art: each game's icon and its board pieces. Painted 256 px
// stickers in the fan's family (thick warm ink outline, soft cel shade, two
// gold sparkles, subject ~88% of the box), generated through the Codex
// ImageGen lane by tools/gen_play_art.py and drawn with `contain`.
// Board pieces that already exist elsewhere (finds, dig things, the truffle,
// the Hungerer, the barn) are reused through Glyph rather than copied here.

import type { ImageSourcePropType } from "react-native";
import type { GameId } from "@/multiplayer/types";

export const GAME_ICONS: Record<GameId, ImageSourcePropType> = {
	rootle: require("../../assets/images/play/icons/rootle.png"),
	fence_the_pen: require("../../assets/images/play/icons/fence_the_pen.png"),
	mud_volley: require("../../assets/images/play/icons/mud_volley.png"),
	snout_says: require("../../assets/images/play/icons/snout_says.png"),
	out_looking: require("../../assets/images/play/icons/out_looking.png"),
};

export const ROOTLE_ART = {
	/** die[face - 1]: face 1 is the Hungerer, faces 2–6 are truffle pips. */
	die: [
		require("../../assets/images/play/rootle/die_1.png"),
		require("../../assets/images/play/rootle/die_2.png"),
		require("../../assets/images/play/rootle/die_3.png"),
		require("../../assets/images/play/rootle/die_4.png"),
		require("../../assets/images/play/rootle/die_5.png"),
		require("../../assets/images/play/rootle/die_6.png"),
	] as ImageSourcePropType[],
};

export const FENCE_ART = {
	/** Drawn horizontal; vertical fences rotate it 90°. Neutral wood, tinted per seat. */
	rail: require("../../assets/images/play/fence_the_pen/rail.png") as ImageSourcePropType,
	post: require("../../assets/images/play/fence_the_pen/post.png") as ImageSourcePropType,
	penTruffle: require("../../assets/images/play/fence_the_pen/pen_truffle.png") as ImageSourcePropType,
};

export const VOLLEY_ART = {
	mudball: require("../../assets/images/play/mud_volley/mudball.png") as ImageSourcePropType,
	bucket: require("../../assets/images/play/mud_volley/bucket.png") as ImageSourcePropType,
	splatBig: require("../../assets/images/play/mud_volley/splat_big.png") as ImageSourcePropType,
	splatSmall: require("../../assets/images/play/mud_volley/splat_small.png") as ImageSourcePropType,
	windupArc: require("../../assets/images/play/mud_volley/windup_arc.png") as ImageSourcePropType,
	lanePost: require("../../assets/images/play/mud_volley/lane_post.png") as ImageSourcePropType,
};

export const OUT_LOOKING_ART = {
	river: require("../../assets/images/play/out_looking/river.png") as ImageSourcePropType,
	hedge: require("../../assets/images/play/out_looking/hedge.png") as ImageSourcePropType,
	meadow: require("../../assets/images/play/out_looking/meadow.png") as ImageSourcePropType,
	farmhouse: require("../../assets/images/play/out_looking/farmhouse.png") as ImageSourcePropType,
	muddyTrotters: require("../../assets/images/play/out_looking/muddy_trotters.png") as ImageSourcePropType,
};
