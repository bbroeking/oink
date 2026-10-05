// The fence row — six medallions along the rail, Rosie first. A tap makes
// the card below about that pig. Each medallion wears its pig's state: home
// (plain), selected (cream, the sticker shadow, a lean), out (dashed, faded —
// the pig is not here), back (a sun dot: something waits on the board),
// resting / locked (dashed cream2, muted name — a lapsed companion, or a pig
// not yet recruited).
//
// VoiceOver: on iOS the medallions are buttons with `selected` inside a
// tab-bar container (`TAB_ROLE` / `TAB_LIST_ROLE`), the tab bar's own fix; role
// "tab" gave iOS no trait. The container is a plain View inside the scroller,
// the shape verified on device. (2026-10-04)
import { ScrollView, StyleSheet, View } from "react-native";
import { PigPortrait, Sticker, T, TAB_LIST_ROLE, TAB_ROLE } from "@/components/ui";
import { BORDER, CHROME_TYPE_CAP, OPACITY, PAGE_PAD, PIG_ACCENT, RADII, SPACE, WHIMSY } from "@/constants/theme";
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
			style={styles.rail}
			testID="fence-row"
		>
			<View style={styles.row} accessibilityRole={TAB_LIST_ROLE} testID="fence-tabs">
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
								accessibilityRole={TAB_ROLE}
								accessibilityState={{ selected: isSelected }}
								accessibilityLabel={`${pig.name}, ${STATE_LINE[pig.state]}`}
								accessibilityHint={`Shows ${pig.name}'s card`}
								testID={`fence-${pig.id}`}
								style={[styles.medallion, faded ? styles.faded : null]}
							>
								<PigPortrait pigId={pig.id} size={MEDALLION_PIG} />
							</Sticker>
							{pig.state === "back" ? <View style={styles.dot} testID={`fence-${pig.id}-back`} /> : null}
							<T
								role="label"
								tone={muted ? "disabled" : isSelected ? "primary" : "secondary"}
								align="center"
								numberOfLines={1}
								maxFontSizeMultiplier={CHROME_TYPE_CAP}
							>
								{pig.name}
							</T>
						</View>
					);
				})}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	// The rail bleeds to the screen's edges and pads its medallions back to
	// the page's inset, so the sixth pig peeks from the phone's edge instead
	// of being cut mid-name at the page margin ("Pickl", 064 — the list-bleed
	// ruling, 2026-09-15).
	rail: { marginHorizontal: -PAGE_PAD },
	row: {
		flexDirection: "row",
		gap: SPACE.md,
		paddingHorizontal: PAGE_PAD,
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
