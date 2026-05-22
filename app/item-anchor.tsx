// Dev tool — define each accessory's anchor-RELATIVE placement.
//
// For the selected item you set:
//   • pivot  — the attach point ON the item (tap the item canvas)
//   • width  — the item's size as a fraction of the pig
//   • anchor — which pig anchor the pivot snaps onto
// The preview shows the item placed the relative way; Save writes to
// AsyncStorage (item_anchor_rel_v1), which SwipeElement reads live.
// When happy, paste the printed RelSpec into HAT_REL in hats.ts.
import React, { useEffect, useMemo, useState } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	GestureResponderEvent,
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HAT_IMAGES, PIG_CANVAS, resolveAnchor } from "@/constants/hats";
import type { AnchorName, RelSpec } from "@/constants/hats";
import { SpritePig } from "@/components/ui/SpritePig";

const REL_KEY = "item_anchor_rel_v1";
const ANCHORS: AnchorName[] = [
	"head", "eye_l", "eye_r", "eyes", "snout", "mouth", "neck",
	"body", "hand_l", "hand_r", "leg_l", "leg_r", "feet",
];
const ITEM_BOX = 230; // item-placement canvas width
const PREVIEW = 260; // pig preview size

export default function ItemAnchorTool() {
	const itemIds = useMemo(() => Object.keys(HAT_IMAGES).sort(), []);
	const [itemId, setItemId] = useState(itemIds[0]);
	const [rel, setRel] = useState<Record<string, RelSpec>>({});
	const [pivot, setPivot] = useState({ x: 0.5, y: 1 });
	const [widthFrac, setWidthFrac] = useState(0.4);
	const [anchor, setAnchor] = useState<AnchorName>("head");
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		AsyncStorage.getItem(REL_KEY).then((v) => {
			if (v) setRel(JSON.parse(v));
		});
	}, []);

	// Load the selected item's saved spec (or sensible defaults).
	useEffect(() => {
		const s = rel[itemId];
		if (s) {
			setPivot(s.pivot);
			setWidthFrac(s.widthFrac);
			setAnchor(s.anchor ?? "head");
		} else {
			setPivot({ x: 0.5, y: 1 });
			setWidthFrac(0.4);
			setAnchor("head");
		}
		setSaved(false);
	}, [itemId, rel]);

	const src = Image.resolveAssetSource(HAT_IMAGES[itemId]);
	const aspect = src && src.width ? src.height / src.width : 1;
	const itemH = ITEM_BOX * aspect;

	// Place the pivot by tapping the item image.
	const onItemTap = (e: GestureResponderEvent) => {
		const { locationX, locationY } = e.nativeEvent;
		setPivot({
			x: Math.max(0, Math.min(1, locationX / ITEM_BOX)),
			y: Math.max(0, Math.min(1, locationY / itemH)),
		});
		setSaved(false);
	};

	const save = async () => {
		const next = { ...rel, [itemId]: { pivot, widthFrac, anchor } };
		setRel(next);
		await AsyncStorage.setItem(REL_KEY, JSON.stringify(next));
		setSaved(true);
	};

	// Preview geometry — anchor resolved at idle frame 0.
	const a = resolveAnchor("idle", 0, anchor);
	const scale = PREVIEW / PIG_CANVAS;
	const aScreen = { x: a.x * scale, y: a.y * scale };
	const previewW = widthFrac * PREVIEW;
	const previewH = previewW * aspect;

	const specText = `${itemId}: { pivot: { x: ${pivot.x.toFixed(
		3
	)}, y: ${pivot.y.toFixed(3)} }, widthFrac: ${widthFrac.toFixed(
		3
	)}, anchor: "${anchor}" },`;

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<Stack.Screen options={{ title: "Item Anchors" }} />
			<ScrollView contentContainerStyle={styles.scroll}>
				{/* Item picker */}
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.pickerRow}>
						{itemIds.map((id) => (
							<Pressable
								key={id}
								onPress={() => setItemId(id)}
								style={[
									styles.chip,
									id === itemId && styles.chipActive,
								]}
							>
								<Text
									style={[
										styles.chipText,
										id === itemId && styles.chipTextActive,
									]}
								>
									{rel[id] ? "● " : ""}
									{id}
								</Text>
							</Pressable>
						))}
					</View>
				</ScrollView>

				<View style={styles.canvases}>
					{/* Item canvas — tap to set the pivot */}
					<View>
						<Text style={styles.label}>tap the attach point</Text>
						<Pressable onPress={onItemTap}>
							<View style={[styles.itemCanvas, { height: itemH }]}>
								<Image
									source={HAT_IMAGES[itemId]}
									style={{ width: ITEM_BOX, height: itemH }}
									resizeMode="contain"
								/>
								{/* pivot crosshair */}
								<View
									style={[
										styles.cross,
										{
											left: pivot.x * ITEM_BOX - 1,
											top: 0,
											height: itemH,
										},
									]}
								/>
								<View
									style={[
										styles.crossH,
										{
											top: pivot.y * itemH - 1,
											left: 0,
											width: ITEM_BOX,
										},
									]}
								/>
								<View
									style={[
										styles.pivotDot,
										{
											left: pivot.x * ITEM_BOX - 6,
											top: pivot.y * itemH - 6,
										},
									]}
								/>
							</View>
						</Pressable>
					</View>

					{/* Preview — item placed the relative way on the pig */}
					<View>
						<Text style={styles.label}>preview on pig</Text>
						<View style={styles.preview}>
							<SpritePig animation="idle" size={PREVIEW} />
							<Image
								source={HAT_IMAGES[itemId]}
								style={{
									position: "absolute",
									width: previewW,
									height: previewH,
									left: aScreen.x - pivot.x * previewW,
									top: aScreen.y - pivot.y * previewH,
								}}
								resizeMode="contain"
							/>
							<View
								style={[
									styles.anchorDot,
									{ left: aScreen.x - 5, top: aScreen.y - 5 },
								]}
							/>
						</View>
					</View>
				</View>

				{/* Width control */}
				<View style={styles.controlRow}>
					<Text style={styles.label}>width</Text>
					<Pressable
						onPress={() => {
							setWidthFrac((w) => Math.max(0.05, +(w - 0.02).toFixed(3)));
							setSaved(false);
						}}
						style={styles.stepBtn}
					>
						<Text style={styles.stepText}>−</Text>
					</Pressable>
					<Text style={styles.value}>{widthFrac.toFixed(3)}</Text>
					<Pressable
						onPress={() => {
							setWidthFrac((w) => Math.min(1.5, +(w + 0.02).toFixed(3)));
							setSaved(false);
						}}
						style={styles.stepBtn}
					>
						<Text style={styles.stepText}>+</Text>
					</Pressable>
				</View>

				{/* Anchor picker */}
				<Text style={styles.label}>anchor</Text>
				<View style={styles.anchorRow}>
					{ANCHORS.map((nm) => (
						<Pressable
							key={nm}
							onPress={() => {
								setAnchor(nm);
								setSaved(false);
							}}
							style={[
								styles.aChip,
								nm === anchor && styles.aChipActive,
							]}
						>
							<Text
								style={[
									styles.aChipText,
									nm === anchor && styles.aChipTextActive,
								]}
							>
								{nm}
							</Text>
						</Pressable>
					))}
				</View>

				<Pressable onPress={save} style={styles.saveBtn}>
					<Text style={styles.saveText}>
						{saved ? "✓ Saved — live in the app" : "Save"}
					</Text>
				</Pressable>

				<Text style={styles.spec} selectable>
					{specText}
				</Text>
				<Text style={styles.hint}>
					Saved specs render live (SwipeElement reads them). Paste
					the line above into HAT_REL in constants/hats.ts to commit.
				</Text>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: "#1A1614" },
	scroll: { padding: 14, gap: 12 },
	pickerRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
	chip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: "#2E2824",
	},
	chipActive: { backgroundColor: "#FF3DDA" },
	chipText: { color: "#BBB", fontSize: 11, fontWeight: "600" },
	chipTextActive: { color: "#fff" },
	canvases: {
		flexDirection: "row",
		gap: 14,
		flexWrap: "wrap",
		justifyContent: "center",
	},
	label: {
		color: "#888",
		fontSize: 11,
		fontWeight: "700",
		marginBottom: 4,
		textTransform: "uppercase",
	},
	itemCanvas: {
		width: ITEM_BOX,
		backgroundColor: "#3A3430",
		borderRadius: 8,
	},
	cross: { position: "absolute", width: 2, backgroundColor: "#00E5FF" },
	crossH: { position: "absolute", height: 2, backgroundColor: "#00E5FF" },
	pivotDot: {
		position: "absolute",
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: "#FF3DDA",
		borderWidth: 2,
		borderColor: "#fff",
	},
	preview: {
		width: PREVIEW,
		height: PREVIEW,
		backgroundColor: "#3A3430",
		borderRadius: 8,
	},
	anchorDot: {
		position: "absolute",
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: "#00E5FF",
		borderWidth: 1.5,
		borderColor: "#002B33",
	},
	controlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
	stepBtn: {
		width: 38,
		height: 38,
		borderRadius: 8,
		backgroundColor: "#2E2824",
		alignItems: "center",
		justifyContent: "center",
	},
	stepText: { color: "#fff", fontSize: 22, fontWeight: "700" },
	value: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
		minWidth: 60,
		textAlign: "center",
	},
	anchorRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
	aChip: {
		paddingHorizontal: 9,
		paddingVertical: 5,
		borderRadius: 7,
		backgroundColor: "#2E2824",
	},
	aChipActive: { backgroundColor: "#00E5FF" },
	aChipText: { color: "#BBB", fontSize: 11, fontWeight: "600" },
	aChipTextActive: { color: "#002B33" },
	saveBtn: {
		backgroundColor: "#FF3DDA",
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center",
		marginTop: 4,
	},
	saveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
	spec: {
		color: "#9FE",
		fontSize: 11,
		fontFamily: "SpaceMono",
		backgroundColor: "#0E0C0B",
		padding: 10,
		borderRadius: 8,
	},
	hint: { color: "#777", fontSize: 11, lineHeight: 16 },
});
