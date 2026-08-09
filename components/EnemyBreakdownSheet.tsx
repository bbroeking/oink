// Directional receipt for one Enemy-board rivalry. The leaderboard ranks the
// pair by total curses; this bottom sheet answers the next question—who cursed
// whom—without making every ranked row taller.

import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EnemyPairRow } from "@/utils/pairBonds";
import {
	FONTS,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import { Icon } from "./ui/Icon";
import { SectionHeader } from "./ui/SectionHeader";
import { SheetGrabber, SlideUpSheet } from "./ui/SlideUpSheet";
import { Sticker } from "./ui/Sticker";
import { useUnmanagedModalHold } from "./ui/PopupQueue";

interface Props {
	enemy: EnemyPairRow | null;
	onClose: () => void;
}

function name(value: string | null) {
	return value ?? "Anonymous";
}

export function EnemyBreakdownSheet({ enemy, onClose }: Props) {
	const open = !!enemy;
	useUnmanagedModalHold(open);

	if (!enemy) return null;

	const nameA = name(enemy.name_a);
	const nameB = name(enemy.name_b);
	const rows =
		enemy.curses_a_to_b == null || enemy.curses_b_to_a == null
			? []
			: [
					{ key: "a-b", label: `${nameA} cursed ${nameB}`, value: enemy.curses_a_to_b },
					{ key: "b-a", label: `${nameB} cursed ${nameA}`, value: enemy.curses_b_to_a },
				];

	return (
		<SlideUpSheet
			open={open}
			onClose={onClose}
			duration={320}
			backdropLabel="Close rivalry breakdown"
		>
			<Pressable onPress={() => {}}>
				<Sticker
					color="paper"
					rotate={-0.6}
					radius={RADII.xxl}
					style={[styles.sheet, STICKER_SHADOW]}
				>
					<SheetGrabber />
					<SectionHeader kicker="the rivalry receipt" title={`${nameA} vs ${nameB}`} />

					{rows.length > 0 ? (
						<View style={styles.rows}>
							{rows.map((row) => (
								<View key={row.key} style={styles.row}>
									<View style={styles.iconCol}>
										<Icon name="ghost" size={22} color={WHIMSY.curseGreen} />
									</View>
									<Text style={styles.rowLabel}>{row.label}</Text>
									<Text style={styles.rowValue}>{row.value.toLocaleString()}</Text>
								</View>
							))}
						</View>
					) : (
						<Text style={styles.secrets}>the rivalry ledger is still catching up</Text>
					)}

					<View style={styles.totalRow}>
						<View style={styles.iconCol}>
							<Icon name="ghost" size={24} color={WHIMSY.ink} />
						</View>
						<Text style={styles.totalLabel}>curses exchanged</Text>
						<Text style={styles.totalValue}>{enemy.curses.toLocaleString()}</Text>
					</View>
				</Sticker>
			</Pressable>
		</SlideUpSheet>
	);
}

const styles = StyleSheet.create({
	sheet: {
		padding: 18,
		paddingTop: 10,
	},
	rows: { gap: SPACE.sm, marginTop: SPACE.xs },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	iconCol: {
		width: 32,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	rowLabel: {
		...TYPE.body,
		color: WHIMSY.ink,
		flex: 1,
		minWidth: 0,
	},
	rowValue: {
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	totalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginTop: SPACE.md,
		paddingTop: SPACE.md,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	totalLabel: {
		...TYPE.cardTitle,
		color: WHIMSY.ink,
		flex: 1,
		minWidth: 0,
	},
	totalValue: {
		...TYPE.sectionTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	secrets: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingVertical: SPACE.md,
	},
});
