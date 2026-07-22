// The tickle breakdown receipt (spec 17) — "how this pig earned its tickles."
// Any player's season tickles_earned decomposed into its real ledger sources;
// self and others render identically (the total is already public on the board).
// Reached from leaderboard rows, UserSheet, and your own season count.
//
// Layout + animation mirror HoofprintsSheet: a decoupled backdrop fade +
// slide-up sheet (the dim doesn't drag with the card), a paper Sticker, and the
// dig-receipt row pattern from TrufflePatch's EndLine (fixed icon column + label
// + right-aligned number). Tokens only, no emoji — Glyph/Icon in the icon column.
//
// It is an UNMANAGED native Modal, so it MUST take the useUnmanagedModalHold
// latch (spec 02): while open the popup queue admits nothing and drains anything
// presented, so a foreground poll (schism/finale/achievements on AppState
// "active") can't wedge a queued popup over it (the #50152 bug). Closing lifts
// the hold and queued popups re-admit after the handoff gap.

import { useEffect, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	Image,
	Pressable,
	StyleSheet,
	Animated,
	Easing,
	Dimensions,
	type ImageSourcePropType,
} from "react-native";
import { Sticker } from "./ui/Sticker";
import { SectionHeader } from "./ui/SectionHeader";
import { LoadingBeat } from "./ui/EmptyState";
import { useUnmanagedModalHold } from "./ui/PopupQueue";
import {
	fetchTickleBreakdown,
	tickleBreakdownRows,
	type TickleBreakdown,
	type TickleLane,
	type TickleRow,
} from "@/utils/tickleBreakdown";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

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
// separate from the general Glyph set because this six-icon family was drawn
// together for this compact ledger and should stay visually coherent here.
const RECEIPT_ICONS: Record<TickleLane, ImageSourcePropType> = {
	home_taps: require("../assets/images/glyphs/receipt/home.png"),
	visit_taps: require("../assets/images/glyphs/receipt/friends.png"),
	dig_finds: require("../assets/images/glyphs/receipt/truffle.png"),
	pass_tiers: require("../assets/images/glyphs/receipt/pass.png"),
	trades: require("../assets/images/glyphs/receipt/trades.png"),
	lucky: require("../assets/images/glyphs/receipt/lucky.png"),
};

const RECEIPT_HEART = require("../assets/images/glyphs/receipt/heart.png");

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
function ReceiptRow({ row }: { row: TickleRow }) {
	return (
		<View style={styles.row}>
			<View style={styles.iconCol}>
				<LaneIcon lane={row.lane} />
			</View>
			<Text style={styles.rowLabel} numberOfLines={1}>
				{row.label}
			</Text>
			<Text style={styles.rowValue}>{row.value.toLocaleString("en-US")}</Text>
		</View>
	);
}

export function TickleBreakdownSheet({ userId, fallbackTotal, onClose }: Props) {
	const open = !!userId;
	// Unmanaged native Modal → hold the popup queue while open (spec 02). See the
	// header note; HoofprintsSheet takes the identical latch.
	useUnmanagedModalHold(open);

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

	// Sheet animation — one Animated.Value drives backdrop opacity AND the sheet
	// translateY in lockstep so the dim doesn't slide with the card.
	const screenH = useRef(Dimensions.get("window").height).current;
	const sheetAnim = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		if (!open) return;
		sheetAnim.setValue(0);
		Animated.timing(sheetAnim, {
			toValue: 1,
			duration: 320,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [open, sheetAnim]);

	if (!open) return null;

	const rows = data ? tickleBreakdownRows(data) : [];
	const total = data ? data.total : (fallbackTotal ?? 0);
	const backdropOpacity = sheetAnim;
	const sheetTranslateY = sheetAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [screenH, 0],
	});

	return (
		<Modal visible transparent animationType="none" onRequestClose={onClose}>
			<Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View
				pointerEvents="box-none"
				style={[
					styles.sheetWrap,
					{ transform: [{ translateY: sheetTranslateY }] },
				]}
			>
				<Pressable onPress={() => {}}>
					<Sticker
						color="paper"
						rotate={-0.6}
						radius={RADII.xxl}
						style={[styles.sheet, STICKER_SHADOW]}
					>
						<View style={styles.grabber} />
						<SectionHeader
							kicker="the tickle receipt"
							title="How this pig earned it"
						/>

						{loading ? (
							<View style={styles.loadingWrap}>
								<LoadingBeat label="tallying the ledger" />
							</View>
						) : missing ? (
							// Fail-soft: the RPC is dark (unpushed). Show the known total and
							// a quiet line — never an error state (spec 17).
							<>
								<Text style={styles.secrets}>
									the pig keeps its secrets for now
								</Text>
								<TotalRow total={total} />
							</>
						) : rows.length === 0 ? (
							// A pig with nothing on its ledger yet (fresh, or all-zero).
							<>
								<Text style={styles.secrets}>
									no tickles reclaimed yet this season
								</Text>
								<TotalRow total={total} />
							</>
						) : (
							<>
								<View style={styles.rows}>
									{rows.map((row) => (
										<ReceiptRow key={row.lane} row={row} />
									))}
								</View>
								<TotalRow total={total} />
							</>
						)}
					</Sticker>
				</Pressable>
			</Animated.View>
		</Modal>
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
			<Text style={styles.totalLabel}>tickles this season</Text>
			<Text style={styles.totalValue}>{total.toLocaleString("en-US")}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: 14,
		paddingBottom: 28,
	},
	sheet: {
		padding: 18,
		paddingTop: 10,
	},
	grabber: {
		alignSelf: "center",
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: SPACE.md,
	},
	loadingWrap: { paddingVertical: SPACE.xl, alignItems: "center" },
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
	receiptIcon: { width: 26, height: 26 },
	totalIcon: { width: 24, height: 24 },
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
	// The total, set off by a dashed rule above it so it reads as the sum.
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
	// The fail-soft / empty line — quiet hand voice, centered.
	secrets: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
});
