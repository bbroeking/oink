// The Trough by the counter (Storefront build 2, 2026-09-16, taste-standard
// ruling 1: "the Trough is an object, not a section"). A wooden trough under
// the shelves holding the sounder's open drives as rows — the opener's pig,
// the item, a notched track, one chip — in place of the accordion. Rows and
// chips both open the Trough sheet (today's TroughSection); nothing is spent
// from here. Receipts for Troughs you helped fill sit in the trough too.
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { TroughDrive, TroughReceipt } from "@/hooks/useTroughDrives";
import { isPigId } from "@/utils/pigs";
import { formatExpiry, remainingMs } from "@/utils/duration";
import {
	TROUGH_NOTCHES,
	troughPillLabel,
	troughRowState,
	troughRowTitle,
} from "@/utils/troughRows";
import {
	AVATAR_SIZE,
	BORDER,
	PRESSED_FLAT,
	RADII,
	SHADOW_SM,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
	WOOD,
} from "@/constants/theme";
import { Chip, Tag } from "../ui/Chip";
import { Glyph } from "../ui/Glyph";
import { PigAvatar } from "../ui/PigAvatar";
import { ProgressTrack } from "../ui/ProgressTrack";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

/** The pig at the head of a row, and the mark on the pill and a receipt. */
const ROW_PIG = AVATAR_SIZE[0];
const PILL_MARK = 12;
const RECEIPT_MARK = 16;

function hoursLeft(iso: string): string {
	const ms = remainingMs(iso);
	return ms <= 0 ? "closing" : `${formatExpiry(ms)} left`;
}

function TroughRow({
	drive,
	onOpen,
}: {
	drive: TroughDrive;
	onOpen: () => void;
}) {
	const title = troughRowTitle(drive);
	const state = troughRowState(drive);
	const left = hoursLeft(drive.closes_at);
	const pigId = isPigId(drive.opener_pig_id) ? drive.opener_pig_id : "rosie";
	const progress = `${drive.raised.toLocaleString()} of ${drive.target.toLocaleString()} snouts`;
	// The row is one accessible element (its chip collapses into it), so the
	// label says what the chip would.
	const offer = drive.is_mine
		? "ask your Sounder"
		: state.quarterFilled
			? "your quarter is in"
			: state.chip > 0
				? `chip in ${state.chip}`
				: null;
	return (
		<Pressable
			onPress={onOpen}
			accessibilityRole="button"
			accessibilityLabel={[title, progress, left, offer]
				.filter(Boolean)
				.join(", ")}
			accessibilityHint="Opens the Trough"
			style={({ pressed }) => [styles.row, pressed && PRESSED_FLAT]}
		>
			<PigAvatar size={ROW_PIG} pigId={pigId} border={UI_COLORS.border} />
			<View style={styles.rowBody}>
				<View style={styles.rowTitle}>
					<T role="cardTitleSm" numberOfLines={1} style={styles.rowName}>
						{title}
					</T>
					<T role="kicker" tone="secondary" style={styles.rowLeft}>
						{left}
					</T>
				</View>
				<View style={styles.rowTrack}>
					<ProgressTrack
						value={drive.raised}
						max={drive.target}
						height="sm"
						notches={TROUGH_NOTCHES}
						accessibilityLabel={`${title} progress`}
						style={styles.track}
					/>
					<T role="numeral" style={styles.count}>
						{drive.raised.toLocaleString()} / {drive.target.toLocaleString()}
					</T>
				</View>
			</View>
			{drive.is_mine ? (
				<Chip
					label="Ask"
					tone="lilac"
					onPress={onOpen}
					accessibilityLabel="Ask your Sounder to chip in"
					accessibilityHint="Opens the Trough"
				/>
			) : state.quarterFilled ? (
				<Tag tone="sage" icon="check" label="Your quarter" />
			) : state.chip > 0 ? (
				<Chip
					label={`Chip in ${state.chip}`}
					tone="sun"
					selected
					onPress={onOpen}
					accessibilityLabel={`Chip in ${state.chip} snouts`}
					accessibilityHint="Opens the Trough, where the chip is confirmed"
				/>
			) : null}
		</Pressable>
	);
}

export function TroughByCounter({
	drives,
	receipts,
	onOpen,
}: {
	drives: readonly TroughDrive[];
	receipts: readonly TroughReceipt[];
	/** Open the Trough sheet, on one drive when the row names it. */
	onOpen: (driveId?: string) => void;
}) {
	if (drives.length === 0 && receipts.length === 0) return null;
	const pill = troughPillLabel(drives.length, receipts.length);
	return (
		<View style={styles.trough}>
			{/* The wood is a layer under the trough, not its container: the
			    native gradient view clips its children, and the pill hangs
			    over the rim. */}
			<LinearGradient
				colors={[WOOD.top, WOOD.bottom]}
				style={styles.wood}
				pointerEvents="none"
			/>
			<Sticker
				color="sage"
				radius={RADII.pill}
				shadow="sm"
				rotate={TILT.reveal}
				onPress={() => onOpen()}
				hitSlop={SPACE.sm}
				accessibilityRole="button"
				accessibilityLabel={`The Trough, ${pill}`}
				accessibilityHint="Opens the Trough"
				style={styles.pill}
			>
				<Glyph name="pigface" size={PILL_MARK} />
				<T role="kickerPillSm">The Trough · {pill}</T>
			</Sticker>
			<View style={styles.slop}>
				{receipts.map((r) => (
					<View key={r.donation_id} style={styles.receipt}>
						<Glyph name="pigface" size={RECEIPT_MARK} />
						<T role="bodySm" style={styles.receiptText}>
							You helped land the {r.item_name ?? r.item_id} — the herd came
							through!
						</T>
					</View>
				))}
				{drives.map((d) => (
					<TroughRow key={d.id} drive={d} onOpen={() => onOpen(d.id)} />
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// The wood: square shoulders, a rounded belly, the thin shadow.
	trough: {
		position: "relative",
		paddingTop: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingBottom: SPACE.sm,
	},
	wood: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderTopLeftRadius: RADII.sm,
		borderTopRightRadius: RADII.sm,
		borderBottomLeftRadius: RADII.xl,
		borderBottomRightRadius: RADII.xl,
		...SHADOW_SM,
	},
	pill: {
		position: "absolute",
		top: -SPACE.md,
		left: SPACE.md,
		zIndex: 3,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.xxs,
		paddingHorizontal: SPACE.sm,
	},
	// The slop inside — the sage panel the rows float in.
	slop: {
		backgroundColor: WHIMSY.sage,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderTopLeftRadius: RADII.hair,
		borderTopRightRadius: RADII.hair,
		borderBottomLeftRadius: RADII.md,
		borderBottomRightRadius: RADII.md,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		gap: SPACE.sm,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	rowBody: { flex: 1, minWidth: 0, gap: SPACE.xs },
	rowTitle: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	rowName: { flex: 1, minWidth: 0 },
	rowLeft: { flexShrink: 0 },
	rowTrack: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	track: { flex: 1 },
	count: { flexShrink: 0 },
	receipt: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	receiptText: { flex: 1 },
});
