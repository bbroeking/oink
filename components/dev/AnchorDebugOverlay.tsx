// Dev-only overlay for tuning accessory alignment. Draws, in the pig's
// 300×300 card space:
//   • every named anchor on the pig (cyan dot + label), resolved for
//     the CURRENT animation frame
//   • the bounding box of each equipped item (magenta) + the anchor it
//     is declared to attach to
// so item placement can be eyeballed against its anchor. __DEV__-gated;
// SwipeElement only mounts it in dev builds.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { resolveAnchor, CATEGORY_ANCHORS } from "../../constants/hats";
import type {
	AnchorName,
	HatOverlay,
	PigAnimationKey,
} from "../../constants/hats";

const CARD = 300; // SwipeElement's pig card is 300×300; anchors live here.

// All named anchors (REST_ANCHORS keys). eyes/feet are virtual midpoints.
const ANCHOR_NAMES: AnchorName[] = [
	"head",
	"eye_l",
	"eye_r",
	"eyes",
	"snout",
	"mouth",
	"neck",
	"body",
	"hand_l",
	"hand_r",
	"leg_l",
	"leg_r",
	"feet",
];

export interface DebugItem {
	label: string;
	category: string | null;
	overlay: HatOverlay;
}

export function AnchorDebugOverlay({
	anim,
	frameIdx,
	items,
}: {
	anim: PigAnimationKey;
	frameIdx: number;
	items: DebugItem[];
}) {
	return (
		<View style={styles.fill} pointerEvents="none">
			{/* Equipped-item bounding boxes. overlay uses bottom/left
			    (y from the card BOTTOM) → convert to a top offset. */}
			{items.map((it, i) => {
				const o = it.overlay;
				const top = CARD - (o.bottom ?? 0) - (o.height ?? 0);
				const anchorName =
					o.anchor ??
					(it.category && CATEGORY_ANCHORS[it.category]) ??
					"none";
				return (
					<View
						key={`item-${i}`}
						style={[
							styles.itemBox,
							{
								left: o.left ?? 0,
								top,
								width: o.width ?? 0,
								height: o.height ?? 0,
							},
						]}
					>
						<Text style={styles.itemLabel}>
							{it.label} → {anchorName}
						</Text>
					</View>
				);
			})}

			{/* Anchor dots — resolved for the live animation frame. */}
			{ANCHOR_NAMES.map((name) => {
				const a = resolveAnchor(anim, frameIdx, name);
				return (
					<React.Fragment key={name}>
						<View
							style={[styles.dot, { left: a.x - 4, top: a.y - 4 }]}
						/>
						<Text
							style={[
								styles.anchorLabel,
								{ left: a.x + 6, top: a.y - 5 },
							]}
						>
							{name}
						</Text>
					</React.Fragment>
				);
			})}

			<Text style={styles.legend}>
				anchors ● {anim} f{frameIdx} · item boxes ▢
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
	dot: {
		position: "absolute",
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#00E5FF",
		borderWidth: 1,
		borderColor: "#002B33",
	},
	anchorLabel: {
		position: "absolute",
		fontSize: 8,
		fontWeight: "700",
		color: "#00E5FF",
		textShadowColor: "#000",
		textShadowRadius: 3,
	},
	itemBox: {
		position: "absolute",
		borderWidth: 1.5,
		borderColor: "#FF3DDA",
		backgroundColor: "rgba(255,61,218,0.08)",
	},
	itemLabel: {
		fontSize: 8,
		fontWeight: "700",
		color: "#FF3DDA",
		textShadowColor: "#000",
		textShadowRadius: 3,
	},
	legend: {
		position: "absolute",
		bottom: 2,
		left: 4,
		fontSize: 8,
		fontWeight: "700",
		color: "#fff",
		textShadowColor: "#000",
		textShadowRadius: 3,
	},
});
