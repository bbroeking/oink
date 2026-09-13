// The tickle breakdown receipt (spec 17) — "how this pig earned its tickles."
// Any player's season tickles_earned decomposed into its real ledger sources;
// self and others render identically (the total is already public on the board).
// Reached from leaderboard rows, UserSheet, and your own season count.
//
// Wave-4 conformance pass: the panel is the `Sheet` primitive (its kicker/title
// slots replace the in-sheet SectionHeader, and it takes the unmanaged-modal
// latch itself), each lane is a `ListRow`, and the summed total keeps its dashed
// rule through `BORDER.thin`. [C-09, C-18]
//
// It is an UNMANAGED native Modal, so it MUST take the useUnmanagedModalHold
// latch (spec 02): while open the popup queue admits nothing and drains anything
// presented, so a foreground poll (schism/finale/achievements on AppState
// "active") can't wedge a queued popup over it (the #50152 bug). `Sheet` takes
// that latch internally; closing lifts the hold and queued popups re-admit after
// the handoff gap.

import { useEffect, useState } from "react";
import {
	View,
	Image,
	StyleSheet,
	type ImageSourcePropType,
} from "react-native";
import { ListRow, LoadingBeat, Sheet, T } from "./ui";
import {
	fetchTickleBreakdown,
	tickleBreakdownRows,
	type TickleBreakdown,
	type TickleLane,
	type TickleRow,
} from "@/utils/tickleBreakdown";
import { BORDER, SPACE, UI_COLORS } from "@/constants/theme";

interface Props {
	// The pig whose receipt to show. Null = closed (drives the sheet the same way
	// HoofprintsSheet's `open` does).
	userId: string | null;
	// The already-known season total (the board/strip/sheet all have it). Used as
	// the fail-soft display when the RPC is missing (unpushed server) — the sheet
	// still shows the total, never an error.
	fallbackTotal?: number | null;
	onClose: () => void;
}

// Receipt-specific art keeps every lane at the same optical scale. These are
// separate from the general Glyph set because this compact family was drawn
// together for this compact ledger and should stay visually coherent here.
const RECEIPT_HEART = require("../assets/images/glyphs/receipt/heart.png");

const RECEIPT_ICONS: Record<TickleLane, ImageSourcePropType> = {
	home_taps: require("../assets/images/glyphs/receipt/home.png"),
	ads: RECEIPT_HEART,
	visit_taps: require("../assets/images/glyphs/receipt/friends.png"),
	dig_finds: require("../assets/images/glyphs/receipt/truffle.png"),
	pass_tiers: require("../assets/images/glyphs/receipt/pass.png"),
	trades: require("../assets/images/glyphs/receipt/trades.png"),
	lucky: require("../assets/images/glyphs/receipt/lucky.png"),
};

// Drawing geometry: the fixed icon column every receipt line shares and the art
// inside it, so labels and numbers stay in one vertical rhythm.
const ICON_COL = 32;
const RECEIPT_ART = 26;
const TOTAL_ART = 24;

function LaneIcon({ lane }: { lane: TickleLane }) {
	return (
		<Image
			source={RECEIPT_ICONS[lane]}
			style={styles.receiptIcon}
			resizeMode="contain"
			accessible={false}
		/>
	);
}

// One receipt line — icon column + whimsy label + the real number, right-aligned.
// Mirrors TrufflePatch's EndLine so the two ledgers read in the same voice.
function ReceiptRow({ row, index }: { row: TickleRow; index: number }) {
	return (
		<ListRow
			index={index}
			tilt={false}
			leading={
				<View style={styles.iconCol}>
					<LaneIcon lane={row.lane} />
				</View>
			}
			title={row.label}
			trailing={
				<T role="cardTitle">{row.value.toLocaleString("en-US")}</T>
			}
			accessibilityLabel={`${row.label}, ${row.value}`}
		/>
	);
}

export function TickleBreakdownSheet({ userId, fallbackTotal, onClose }: Props) {
	const open = !!userId;

	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<TickleBreakdown | null>(null);
	// True once a fetch resolved to null (unpushed migration / network) — the
	// fail-soft "secrets" state, distinct from "still loading".
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		if (!userId) {
			setData(null);
			setMissing(false);
			return;
		}
		setLoading(true);
		setData(null);
		setMissing(false);
		let cancelled = false;
		fetchTickleBreakdown(userId).then((d) => {
			if (cancelled) return;
			if (d) setData(d);
			else setMissing(true);
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [userId]);

	if (!open) return null;

	const rows = data ? tickleBreakdownRows(data) : [];
	const total = data ? data.total : (fallbackTotal ?? 0);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="the tickle receipt"
			title="How this pig earned it"
			testID="tickle-breakdown-sheet"
		>
			{loading ? (
				<View style={styles.loadingWrap}>
					<LoadingBeat label="tallying the ledger" />
				</View>
			) : missing ? (
				// Fail-soft: the RPC is dark (unpushed). Show the known total and
				// a quiet line — never an error state (spec 17).
				<>
					<T role="hand" tone="secondary" align="center" style={styles.secrets}>
						the pig keeps its secrets for now
					</T>
					<TotalRow total={total} />
				</>
			) : rows.length === 0 ? (
				// A pig with nothing on its ledger yet (fresh, or all-zero).
				<>
					<T role="hand" tone="secondary" align="center" style={styles.secrets}>
						no tickles reclaimed yet this season
					</T>
					<TotalRow total={total} />
				</>
			) : (
				<>
					<View style={styles.rows}>
						{rows.map((row, i) => (
							<ReceiptRow key={row.lane} row={row} index={i} />
						))}
					</View>
					<TotalRow total={total} />
				</>
			)}
		</Sheet>
	);
}

// The total, pinned at the bottom above a hairline rule — the one number the
// board competes on, now shown as the sum of its parts.
function TotalRow({ total }: { total: number }) {
	return (
		<View style={styles.totalRow}>
			<View style={styles.iconCol}>
				<Image
					source={RECEIPT_HEART}
					style={styles.totalIcon}
					resizeMode="contain"
					accessible={false}
				/>
			</View>
			<T role="cardTitle" style={styles.totalLabel}>
				tickles this season
			</T>
			<T role="sectionTitle">{total.toLocaleString("en-US")}</T>
		</View>
	);
}

const styles = StyleSheet.create({
	loadingWrap: { paddingVertical: SPACE.xl, alignItems: "center" },
	rows: { gap: SPACE.sm, marginTop: SPACE.xs },
	iconCol: {
		width: ICON_COL,
		alignItems: "center",
		justifyContent: "center",
	},
	receiptIcon: { width: RECEIPT_ART, height: RECEIPT_ART },
	totalIcon: { width: TOTAL_ART, height: TOTAL_ART },
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
	// The fail-soft / empty line — quiet hand voice, centered.
	secrets: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
});
