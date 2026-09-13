// The receipt grammar — a ledger of lines that sum to one total, the way the
// tickle receipt and the rivalry receipt both read. One fixed icon column so
// labels and numbers share a vertical rhythm, each line a `ListRow`, a quiet
// hand-voice note for the empty / fail-soft states, and the total set off by a
// dashed rule so it reads as the sum. [C-09, C-18]
//
//   <ReceiptRows>
//     <ReceiptRow index={0} icon={…} label="…" value={12} />
//   </ReceiptRows>
//   <ReceiptNote>the pig keeps its secrets for now</ReceiptNote>
//   <ReceiptTotal icon={…} label="tickles this season" value={total} />
//
// `icon` is whatever mark the ledger uses — an `Icon`, a `Glyph`, a raster
// receipt glyph — sized by the caller; the column here only centres it.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BORDER, SPACE, UI_COLORS } from "@/constants/theme";
import { ListRow } from "./ListRow";
import { T } from "./Text";

// Drawing geometry: the fixed icon column every receipt line shares.
const ICON_COL = 32;

const formatValue = (value: number | string) =>
	typeof value === "number" ? value.toLocaleString("en-US") : value;

export function ReceiptRows({ children }: { children: ReactNode }) {
	return <View style={styles.rows}>{children}</View>;
}

export function ReceiptRow({
	index,
	icon,
	label,
	value,
	accessibilityLabel,
}: {
	index: number;
	icon: ReactNode;
	label: string;
	value: number | string;
	accessibilityLabel?: string;
}) {
	return (
		<ListRow
			index={index}
			tilt={false}
			leading={<View style={styles.iconCol}>{icon}</View>}
			title={label}
			trailing={<T role="cardTitle">{formatValue(value)}</T>}
			accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
		/>
	);
}

/** The quiet line for an empty or fail-soft ledger — never an error state. */
export function ReceiptNote({ children }: { children: ReactNode }) {
	return (
		<T role="hand" tone="secondary" align="center" style={styles.note}>
			{children}
		</T>
	);
}

export function ReceiptTotal({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: number | string;
}) {
	return (
		<View style={styles.totalRow}>
			<View style={styles.iconCol}>{icon}</View>
			<T role="cardTitle" style={styles.totalLabel}>
				{label}
			</T>
			<T role="sectionTitle">{formatValue(value)}</T>
		</View>
	);
}

const styles = StyleSheet.create({
	rows: { gap: SPACE.sm, marginTop: SPACE.xs },
	iconCol: {
		width: ICON_COL,
		alignItems: "center",
		justifyContent: "center",
	},
	note: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
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
});
