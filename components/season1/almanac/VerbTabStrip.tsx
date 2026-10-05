// The Almanac's verb tab strip — Feed · Draw · Pass, three compact Sticker
// cells in one row (Herd and Race retired with the herd race, 2026-09-21).
// Each carries a kickerPill label and ONE nowrap Caprasimo value; the Pass cell
// adds a thin XP bar. Every cell is the same height: each Sticker fills its
// flex column, and the cells without an XP bar reserve the bar's slot
// invisibly, so no cell runs taller or shorter than its neighbours and the
// label / value / bar rhythm is identical across the strip. (2026-09-17)
//
// Two facts, two signals (polish pass, 2026-10-04). The strip used to say
// "selected" with a cream fill and a lean and "act now" with the sun fill, so a
// selected Pass cell and a merely-ready Draw cell wore the same sun and nobody
// could tell which panel was open. Now:
//   · selected = the sun fill, the heavy border, the full 4pt sticker shadow
//     and a −1° lean — the same "you are here" the hanging-signs tab bar and
//     `SegmentedControl` draw, so the strip speaks the app's one selection;
//   · unselected = flat paper, the value in mute;
//   · act-now = the rose "!" corner badge the pass track's ready node already
//     wears, on any cell, selected or not — it never changes the fill.
//
// Compact chrome: every word on a cell states its ceiling (`CHROME_TYPE_CAP`)
// rather than truncating, the 2026-09-12 rule for tiles in a fixed row.
//
// Reduce Motion: the switch is a cut. With motion allowed, the newly selected
// cell lands with the one `tap` spring; under Reduce Motion it simply appears.
//
// VoiceOver: on iOS the cells are buttons with `selected` inside a tab-bar
// container (`TAB_ROLE` / `TAB_LIST_ROLE`), the tab bar's own fix; role "tab"
// gave iOS no trait, so a cell read as a bare element. (2026-10-04)

import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { KickerPill, Numeral, Sticker, T, TAB_LIST_ROLE, TAB_ROLE } from "@/components/ui";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	BORDER,
	CHROME_TYPE_CAP,
	MOTION_SPRING,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { ALMANAC_TABS, ALMANAC_TAB_LABEL, type AlmanacTab } from "./almanacState";

// Drawing geometry, not spacing: the selected cell's lean, the XP bar's
// height, the scale the landing spring starts from, and the act-now badge —
// the pass track's 20pt corner badge, drawn the same size here.
const SELECTED_TILT = -1;
const XP_BAR_H = 6;
const LAND_FROM = 0.96;
const TODO_BADGE = 20;

// What the badge means, spoken — the cell's label reads "Pass: 1 ready, claim now".
const TODO_SPOKEN: Record<AlmanacTab, string> = {
	feed: "dig now",
	draw: "draw now",
	pass: "claim now",
};

export interface VerbTabStripProps {
	values: Record<AlmanacTab, string>;
	/** Which cells wear the act-now badge. */
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
		<View style={styles.row} accessibilityRole={TAB_LIST_ROLE} testID={testID}>
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
	const inked = selected || todo;
	return (
		<Animated.View style={[styles.cellWrap, { transform: [{ scale: land }] }]}>
			<Sticker
				color={selected ? "sun" : "paper"}
				rotate={selected ? SELECTED_TILT : 0}
				radius={RADII.lg}
				border={selected ? BORDER.heavy : BORDER.ink}
				shadow={selected ? "sticker" : "none"}
				onPress={() => onSelect(tab)}
				accessibilityRole={TAB_ROLE}
				accessibilityLabel={todo ? `${label}: ${value}, ${TODO_SPOKEN[tab]}` : `${label}: ${value}`}
				accessibilityHint={`Shows the ${label} panel`}
				accessibilityState={{ selected }}
				testID={`almanac-tab-${tab}`}
				style={styles.cell}
			>
				<KickerPill
					star={false}
					tone={inked ? "primary" : "secondary"}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
				>
					{label}
				</KickerPill>
				<Numeral
					numberOfLines={1}
					tone={inked ? "primary" : "secondary"}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
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
				{todo ? (
					<View
						style={styles.todoBadge}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						testID={`almanac-todo-${tab}`}
					>
						<T
							role="kickerPill"
							tone="danger"
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
							style={styles.todoMark}
						>
							!
						</T>
					</View>
				) : null}
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
	// nothing — so all three cells share one vertical rhythm.
	barSlot: { opacity: 0 },
	// The act-now badge — the pass track's ready badge (rose disc, ink ring,
	// dark "!"), hung off the cell's top-right corner so it never moves the
	// cell's words. The pale-fill + dark-ink pair is the one that clears AA at
	// this size (audit C-02).
	todoBadge: {
		position: "absolute",
		top: -SPACE.xs,
		right: -SPACE.xs,
		width: TODO_BADGE,
		height: TODO_BADGE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.rose,
		alignItems: "center",
		justifyContent: "center",
	},
	todoMark: { letterSpacing: 0 },
});
