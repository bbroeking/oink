// Rosie at rest wearing one stall piece: the stall card's and the stall page's
// hero (B1 / B2). The shop preview rule (2026-07-16): the pig is frozen at
// rest, the piece rides its own PigStage slot (the renderer's own placement,
// never an eyeballed overlay), drawn at the 300pt canvas and scaled down.
// Backgrounds are not worn here: the stall's backdrop is the scene itself.
import { StyleSheet, View } from "react-native";
import { PigStage, type EquippedItem } from "@/components/ui/PigStage";
import { PIG_CANVAS, type HatRow } from "@/constants/hats";

type SlotProps = {
	equipped?: EquippedItem | null;
	equippedBow?: EquippedItem | null;
	equippedGlasses?: EquippedItem | null;
	equippedMask?: EquippedItem | null;
	equippedNeck?: EquippedItem | null;
	equippedAura?: EquippedItem | null;
	equippedHeld?: EquippedItem | null;
};

/** The PigStage prop a piece rides, by category (ItemPreviewModal's routing). */
export function stallSlot(item: Pick<HatRow, "id" | "category" | "emoji"> | null): SlotProps {
	if (!item) return {};
	const slot: EquippedItem = {
		id: item.id,
		category: item.category ?? null,
		emoji: item.emoji ?? null,
	};
	switch (item.category) {
		case "hat":
			return { equipped: slot };
		case "bow":
			return { equippedBow: slot };
		case "glasses":
			return { equippedGlasses: slot };
		case "mask":
			return { equippedMask: slot };
		case "scarf":
		case "necklace":
			return { equippedNeck: slot };
		case "aura":
			return { equippedAura: slot };
		case "held":
			return { equippedHeld: slot };
		default:
			return {};
	}
}

export function StallPig({
	item,
	size,
}: {
	item: Pick<HatRow, "id" | "category" | "emoji"> | null;
	/** The drawn side, in points; the 300pt stage scales to it. */
	size: number;
}) {
	const scale = size / PIG_CANVAS;
	// The offset that keeps a centre-scaled canvas inside the size box.
	const shift = (size - PIG_CANVAS) / 2;
	return (
		<View
			style={{ width: size, height: size }}
			pointerEvents="none"
			accessible={false}
			importantForAccessibility="no-hide-descendants"
		>
			<View
				style={[
					styles.canvas,
					{ left: shift, top: shift, transform: [{ scale }] },
				]}
			>
				<PigStage pigAnimation="idle" pigFrozen {...stallSlot(item)} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	canvas: {
		position: "absolute",
		width: PIG_CANVAS,
		height: PIG_CANVAS,
	},
});
