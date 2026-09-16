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
import {
	LoadingBeat,
	ReceiptNote,
	ReceiptRow,
	ReceiptRows,
	ReceiptTotal,
	Sheet,
} from "./ui";
import {
	fetchTickleBreakdown,
	tickleBreakdownRows,
	type TickleBreakdown,
	type TickleLane,
	type TickleRow,
} from "@/utils/tickleBreakdown";
import { SPACE } from "@/constants/theme";

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
// Two lanes share the exchange mark: a tickle trade and a Satchel swap are the
// same gesture at different stakes, and the label beside it names which. (The
// `ads`/`heart` pair sets the precedent — the receipt family is drawn for this
// ledger, and no new art is owed for a lane that already has its drawing.)
const RECEIPT_EXCHANGE = require("../assets/images/glyphs/receipt/trades.png");

const RECEIPT_ICONS: Record<TickleLane, ImageSourcePropType> = {
	home_taps: require("../assets/images/glyphs/receipt/home.png"),
	ads: RECEIPT_HEART,
	visit_taps: require("../assets/images/glyphs/receipt/friends.png"),
	swaps: RECEIPT_EXCHANGE,
	dig_finds: require("../assets/images/glyphs/receipt/truffle.png"),
	pass_tiers: require("../assets/images/glyphs/receipt/pass.png"),
	trades: RECEIPT_EXCHANGE,
	lucky: require("../assets/images/glyphs/receipt/lucky.png"),
};

// The art in the receipt's icon column.
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

function LaneRow({ row, index }: { row: TickleRow; index: number }) {
	return (
		<ReceiptRow
			index={index}
			icon={<LaneIcon lane={row.lane} />}
			label={row.label}
			value={row.value}
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
					<ReceiptNote>the pig keeps its secrets for now</ReceiptNote>
					<TotalRow total={total} />
				</>
			) : rows.length === 0 ? (
				// A pig with nothing on its ledger yet (fresh, or all-zero).
				<>
					<ReceiptNote>no tickles reclaimed yet this season</ReceiptNote>
					<TotalRow total={total} />
				</>
			) : (
				<>
					<ReceiptRows>
						{rows.map((row, i) => (
							<LaneRow key={row.lane} row={row} index={i} />
						))}
					</ReceiptRows>
					<TotalRow total={total} />
				</>
			)}
		</Sheet>
	);
}

// The total — the one number the board competes on, shown as the sum of its
// parts.
function TotalRow({ total }: { total: number }) {
	return (
		<ReceiptTotal
			icon={
				<Image
					source={RECEIPT_HEART}
					style={styles.totalIcon}
					resizeMode="contain"
					accessible={false}
				/>
			}
			label="tickles this season"
			value={total}
		/>
	);
}

const styles = StyleSheet.create({
	loadingWrap: { paddingVertical: SPACE.xl, alignItems: "center" },
	receiptIcon: { width: RECEIPT_ART, height: RECEIPT_ART },
	totalIcon: { width: TOTAL_ART, height: TOTAL_ART },
});
