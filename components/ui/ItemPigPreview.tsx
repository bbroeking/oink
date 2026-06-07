// A small pig wearing a single shop item — the same slot-building logic the
// ItemPreviewModal uses, extracted so the shop can show a live "try-on"
// preview that follows the scroll (see whatever you're browsing without
// tapping in). Auras render behind, held items in the hand, everything else
// is the main slot; PigStage owns z-order + anchoring.
import React from "react";
import { View } from "react-native";
import { PigStage, type EquippedItem } from "./PigStage";
import { PIG_CANVAS } from "@/constants/hats";

type PreviewItem = EquippedItem;

export function ItemPigPreview({
	item,
	size = 120,
}: {
	item: PreviewItem | null;
	size?: number;
}) {
	const slot = item
		? { id: item.id, category: item.category ?? null, emoji: item.emoji ?? null }
		: null;
	const isAura = item?.category === "aura";
	const isHeld = item?.category === "held";
	const isFlag = item?.category === "flag";

	const scale = size / PIG_CANVAS;
	return (
		<View
			style={{
				width: size,
				height: size,
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			<View style={{ transform: [{ scale }] }}>
				<PigStage
					equipped={isAura || isHeld || isFlag ? null : slot}
					equippedAura={isAura ? slot : null}
					equippedHeld={isHeld ? slot : null}
					equippedFlag={isFlag ? slot : null}
				/>
			</View>
		</View>
	);
}
