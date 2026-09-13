// Directional receipt for one Enemy-board rivalry. The leaderboard ranks the
// pair by total curses; this bottom sheet answers the next question—who cursed
// whom—without making every ranked row taller.
//
// Wave-4 conformance pass: the panel is the `Sheet` primitive (its kicker/title
// slots replace the in-sheet SectionHeader), each direction is a `ListRow`, and
// the summed total keeps its dashed rule through `BORDER.thin`. [C-09, C-18]

import { StyleSheet, View } from "react-native";
import type { EnemyPairRow } from "@/utils/pairBonds";
import { BORDER, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { Icon, ListRow, Sheet, T } from "./ui";

// Drawing geometry: the fixed icon column every receipt line shares, so labels
// and numbers stay in one vertical rhythm.
const ICON_COL = 32;
const ROW_MARK = 22;
const TOTAL_MARK = 24;

interface Props {
	enemy: EnemyPairRow | null;
	onClose: () => void;
}

function name(value: string | null) {
	return value ?? "Anonymous";
}

export function EnemyBreakdownSheet({ enemy, onClose }: Props) {
	const open = !!enemy;

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
		<Sheet
			open={open}
			onClose={onClose}
			closeLabel="Close rivalry breakdown"
			kicker="the rivalry receipt"
			title={`${nameA} vs ${nameB}`}
			testID="enemy-breakdown-sheet"
		>
			{rows.length > 0 ? (
				<View style={styles.rows}>
					{rows.map((row, i) => (
						<ListRow
							key={row.key}
							index={i}
							tilt={false}
							leading={
								<View style={styles.iconCol}>
									<Icon name="ghost" size={ROW_MARK} color={WHIMSY.curseGreen} />
								</View>
							}
							title={row.label}
							trailing={<T role="cardTitle">{row.value.toLocaleString()}</T>}
							accessibilityLabel={`${row.label}, ${row.value}`}
						/>
					))}
				</View>
			) : (
				<T role="hand" tone="secondary" align="center" style={styles.secrets}>
					the rivalry ledger is still catching up
				</T>
			)}

			<View style={styles.totalRow}>
				<View style={styles.iconCol}>
					<Icon name="ghost" size={TOTAL_MARK} color={WHIMSY.ink} />
				</View>
				<T role="cardTitle" style={styles.totalLabel}>
					curses exchanged
				</T>
				<T role="sectionTitle">{enemy.curses.toLocaleString()}</T>
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	rows: { gap: SPACE.sm, marginTop: SPACE.xs },
	iconCol: {
		width: ICON_COL,
		alignItems: "center",
		justifyContent: "center",
	},
	// The total, set off by a dashed rule above it so it reads as the sum.
	totalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginTop: SPACE.md,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	totalLabel: {
		flex: 1,
		minWidth: 0,
	},
	secrets: {
		paddingVertical: SPACE.md,
	},
});
