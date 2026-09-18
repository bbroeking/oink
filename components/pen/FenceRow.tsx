// The fence row — six medallions along the rail, Rosie first. A tap makes
// the card below about that pig. Each medallion wears its pig's state: home
// (plain), selected (cream, the sticker shadow, a lean), out (dashed, faded —
// the pig is not here), back (a sun dot: something waits on the board),
// resting / locked (dashed cream2, muted name — a lapsed companion, or a pig
// not yet recruited).
import { ScrollView, StyleSheet, View } from "react-native";
import { PigPortrait, Sticker, T } from "@/components/ui";
import { BORDER, OPACITY, PIG_ACCENT, RADII, SPACE, WHIMSY } from "@/constants/theme";
import type { PigId } from "@/utils/pigs";
import type { MedallionState } from "./penState";

/** The medallion's diameter, the portrait inside it, and the cell it sits
 *  in (the medallion plus its name's breathing room — art geometry). */
const MEDALLION = 56;
const MEDALLION_PIG = 48;
const MEDALLION_CELL_W = 68;
/** The lean a selected medallion takes. */
const SELECTED_TILT = -1;
/** The sun dot that says "back" — a small disc pinned top-right. */
const DOT = 14;

export interface FenceMedallion {
	id: PigId;
	name: string;
	state: MedallionState;
}

interface Props {
	pigs: FenceMedallion[];
	selected: PigId;
	onSelect: (pig: PigId) => void;
}

const STATE_LINE: Record<MedallionState, string> = {
	home: "at home",
	out: "out looking",
	back: "back, on the board",
	resting: "resting",
	locked: "not yet recruited",
};

export function FenceRow({ pigs, selected, onSelect }: Props) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
			accessibilityRole="tablist"
			testID="fence-row"
		>
			{pigs.map((pig) => {
				const isSelected = pig.id === selected;
				const dashed = pig.state === "out" || pig.state === "resting" || pig.state === "locked";
				const faded = pig.state === "out";
				const muted = pig.state === "resting" || pig.state === "locked";
				return (
					<View key={pig.id} style={styles.cell}>
						<Sticker
							color={isSelected ? "cream" : pig.state === "resting" || pig.state === "locked" ? "cream2" : PIG_ACCENT[pig.id].tint}
							rotate={isSelected ? SELECTED_TILT : 0}
							radius={RADII.pill}
							shadow={isSelected ? "sticker" : "none"}
							border={isSelected ? BORDER.heavy : BORDER.thin}
							borderStyle={dashed ? "dashed" : "solid"}
							onPress={() => onSelect(pig.id)}
							accessibilityRole="tab"
							accessibilityState={{ selected: isSelected }}
							accessibilityLabel={`${pig.name}, ${STATE_LINE[pig.state]}`}
							accessibilityHint={`Shows ${pig.name}'s card`}
							testID={`fence-${pig.id}`}
							style={[styles.medallion, faded ? styles.faded : null]}
						>
							<PigPortrait pigId={pig.id} size={MEDALLION_PIG} />
						</Sticker>
						{pig.state === "back" ? <View style={styles.dot} testID={`fence-${pig.id}-back`} /> : null}
						<T role="label" tone={muted ? "disabled" : isSelected ? "primary" : "secondary"} align="center" numberOfLines={1}>
							{pig.name}
						</T>
					</View>
				);
			})}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		gap: SPACE.md,
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.md,
	},
	cell: { alignItems: "center", gap: SPACE.xs, width: MEDALLION_CELL_W },
	medallion: {
		width: MEDALLION,
		height: MEDALLION,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	faded: { opacity: OPACITY.ghost },
	dot: {
		position: "absolute",
		top: -SPACE.xxs,
		right: SPACE.xs,
		width: DOT,
		height: DOT,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
	},
});
