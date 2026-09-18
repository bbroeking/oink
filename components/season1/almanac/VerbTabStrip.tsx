// The Almanac's verb tab strip — Feed · Herd · Race · Pass, four compact
// Sticker cells in one row. Each carries a kickerPill label and ONE nowrap
// Caprasimo value; the Pass cell adds a thin XP bar. Every cell is the same
// height: each Sticker fills its flex column, and the three cells without an
// XP bar reserve the bar's slot invisibly, so no cell runs taller or shorter
// than its neighbours and the label / value / bar rhythm is identical across
// the strip. (2026-09-17)
//
// Three states, all drawn from tokens: selected = blush cream, the full 4pt
// sticker shadow and a −1° lean; unselected = flat paper with the value in
// mute; todo = the sun fill — gold means act-now and nothing else. A cell can
// be selected AND todo (an open feeding you are looking at stays gold).
//
// Reduce Motion: the switch is a cut. With motion allowed, the newly selected
// cell lands with the one `tap` spring; under Reduce Motion it simply appears.

import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { KickerPill, Numeral, Sticker } from "@/components/ui";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	BORDER,
	MOTION_SPRING,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { ALMANAC_TABS, ALMANAC_TAB_LABEL, type AlmanacTab } from "./almanacState";

// Drawing geometry, not spacing: the selected cell's lean, the XP bar's
// height, and the scale the landing spring starts from.
const SELECTED_TILT = -1;
const XP_BAR_H = 6;
const LAND_FROM = 0.96;

export interface VerbTabStripProps {
	values: Record<AlmanacTab, string>;
	/** Which cells wear the act-now sun. */
	todo: Record<AlmanacTab, boolean>;
	selected: AlmanacTab;
	onSelect: (tab: AlmanacTab) => void;
	/** The Pass cell's XP bar, 0..1 toward the next tier. */
	passProgress?: number;
	testID?: string;
}

export function VerbTabStrip({
	values,
	todo,
	selected,
	onSelect,
	passProgress,
	testID,
}: VerbTabStripProps) {
	return (
		<View style={styles.row} accessibilityRole="tablist" testID={testID}>
			{ALMANAC_TABS.map((tab) => (
				<VerbCell
					key={tab}
					tab={tab}
					value={values[tab]}
					todo={todo[tab]}
					selected={tab === selected}
					onSelect={onSelect}
					progress={tab === "pass" ? passProgress : undefined}
				/>
			))}
		</View>
	);
}

function VerbCell({
	tab,
	value,
	todo,
	selected,
	onSelect,
	progress,
}: {
	tab: AlmanacTab;
	value: string;
	todo: boolean;
	selected: boolean;
	onSelect: (tab: AlmanacTab) => void;
	progress?: number;
}) {
	const { reduceMotion } = useMotionPolicy();
	const [land] = useState(() => new Animated.Value(1));
	useEffect(() => {
		if (!selected || reduceMotion) {
			land.setValue(1);
			return;
		}
		land.setValue(LAND_FROM);
		const spring = Animated.spring(land, {
			toValue: 1,
			useNativeDriver: true,
			...MOTION_SPRING.tap,
		});
		spring.start();
		return () => spring.stop();
	}, [selected, reduceMotion, land]);

	const label = ALMANAC_TAB_LABEL[tab];
	return (
		<Animated.View style={[styles.cellWrap, { transform: [{ scale: land }] }]}>
			<Sticker
				color={todo ? "sun" : selected ? "cream" : "paper"}
				rotate={selected ? SELECTED_TILT : 0}
				radius={RADII.lg}
				border={BORDER.ink}
				shadow={selected ? "sticker" : "none"}
				onPress={() => onSelect(tab)}
				accessibilityRole="tab"
				accessibilityLabel={`${label}: ${value}`}
				accessibilityHint={`Shows the ${label} panel`}
				accessibilityState={{ selected }}
				testID={`almanac-tab-${tab}`}
				style={styles.cell}
			>
				<KickerPill star={false} tone={selected || todo ? "primary" : "secondary"}>
					{label}
				</KickerPill>
				<Numeral
					numberOfLines={1}
					tone={selected || todo ? "primary" : "secondary"}
					style={styles.value}
				>
					{value}
				</Numeral>
				{progress !== undefined ? (
					<View style={styles.bar} accessibilityElementsHidden>
						<View
							style={[
								styles.barFill,
								{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` },
							]}
						/>
					</View>
				) : (
					<View style={[styles.bar, styles.barSlot]} accessibilityElementsHidden />
				)}
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		gap: SPACE.sm,
	},
	cellWrap: { flex: 1, minWidth: 0 },
	// Tight sides so a seven-glyph value ("2 ready", "Dig now") never clips.
	// `flexGrow: 1` (basis auto, NOT `flex: 1`) stretches the Sticker to its
	// column once the row has settled on its tallest cell. `flex: 1` sets
	// flexBasis 0, and inside an auto-height column Yoga then measures the
	// Sticker at zero — the label and value collapse and the XP bar falls out
	// the bottom of the pill. (2026-09-17)
	cell: {
		flexGrow: 1,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.sm,
		gap: SPACE.xs,
	},
	value: { marginTop: SPACE.xxs },
	// The Pass cell's XP bar — a thin ink-outlined capsule with a lilac fill.
	bar: {
		height: XP_BAR_H,
		borderRadius: RADII.pill,
		borderWidth: BORDER.hair,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		overflow: "hidden",
		marginTop: SPACE.xxs,
	},
	barFill: {
		height: "100%",
		backgroundColor: WHIMSY.lilac,
	},
	// The same slot on the cells without an XP bar — takes the height, draws
	// nothing — so all four cells share one vertical rhythm.
	barSlot: { opacity: 0 },
});
