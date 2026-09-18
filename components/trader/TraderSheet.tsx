// The Ghost Sheep Trader's sheet — opened from his row on the Barn button's
// fan, only while he is at the hedge (hooks/useTrader).
//
// Layout (2026-09-17, second pass — the first put a paragraph card above
// 44pt tiles with 10pt prices; the task is "which find, for how much?", so
// the offers lead):
//   1. HIM — the sprite, and one short line in a speech bubble (he never
//      explains). Under them one hand line: how many he still takes, how long
//      he stays. After a sale the bubble holds the tally: before → tickled now.
//   2. THE OFFERS — every find in the bag as a big sticker tile, three
//      across: the art, its name, and the price as a real numeral with the
//      tickle mark. The one he fancies sits on cream with "pays double". Tap
//      a tile to pick it (it lifts to sun); the pinned footer hands it over.
//      One find per tap — a hand-off, not a checkout, because it is gone for
//      good and the footer says so.
//
// The find is CONSUMED (the only place a find leaves the world for tickles);
// the server answers the WHOLE bag and the caller installs it — a tile never
// leaves by a count. He never buys nothing: an empty bag is the EmptyState
// that points at the Dig, and "had enough" dims the offers rather than hiding
// them (what's left stays yours).
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, BORDER, OPACITY, RADII, SPACE } from "@/constants/theme";
import type { TraderAnim } from "@/constants/traderFrames";
import type { SatchelItem } from "@/utils/satchel";
import {
	priceFor,
	traderGreeting,
	traderMinutesLeft,
	traderRefusalCopy,
	traderStayLine,
	type TraderSaleOutcome,
	type TraderStatus,
} from "@/utils/trader";
import { EmptyState, Hand, Sheet, Sticker, T, TicketButton, TickleIcon } from "../ui";
import { FindArt } from "../satchel/FindArt";
import { TraderArt, TraderSprite } from "./TraderArt";

// An offer tile: three across a phone with the gaps, and a short last row
// keeps the same tile width rather than stretching to fill.
const OFFER_MIN_W = 96;
const OFFER_MAX_W = "32%";
// The speech bubble leans the other way from the sheet's stickers.
const BUBBLE_TILT = 1.5;

export interface TraderSheetProps {
	open: boolean;
	onClose: () => void;
	status: TraderStatus;
	/** When `status` was read — the stay line counts from here. */
	readAt: number;
	items: SatchelItem[];
	/** Hand one find over. Resolves the server's answer; the caller has
	 *  already applied the bag by the time it resolves. */
	onSell: (itemId: number) => Promise<TraderSaleOutcome>;
	/** A refusal, in his voice, for the caller's toast. */
	onRefused?: (line: string) => void;
}

interface Tally {
	before: number;
	after: number;
	findName: string;
	tickles: number;
}

export function TraderSheet({ open, onClose, status, readAt, items, onSell, onRefused }: TraderSheetProps) {
	const [picked, setPicked] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [tally, setTally] = useState<Tally | null>(null);
	// His beats: greet on open, take on a sale, shake on a refusal, leave when
	// the sale that spends the visit lands; after the leave he is gone (the
	// silhouette) until the sheet is next opened.
	const [anim, setAnim] = useState<TraderAnim>("greet");
	const [cue, setCue] = useState(0);
	const [gone, setGone] = useState(false);
	const play = useCallback((a: TraderAnim) => {
		setAnim(a);
		setCue((c) => c + 1);
	}, []);

	// A fresh sheet every time he is opened (state adjusted during render, the
	// React-sanctioned way — no effect). A picked tile that left the bag (sold
	// from another device, tossed) simply stops resolving to an item below.
	const [openSeen, setOpenSeen] = useState(open);
	if (openSeen !== open) {
		setOpenSeen(open);
		setPicked(null);
		setTally(null);
		setGone(false);
		setAnim("greet");
		setCue((c) => c + 1);
	}

	const visit = status.visit;
	const findsLeft = visit?.findsLeft ?? 0;
	const hadEnough = findsLeft <= 0;
	const minutes = traderMinutesLeft(status, readAt);
	const wantId: SatchelFindId | null = visit?.wantFindId ?? null;
	const pickedItem = picked == null ? null : (items.find((it) => it.id === picked) ?? null);
	const pickedFind = pickedItem ? satchelFind(pickedItem.find_id) : null;
	const pickedPrice = pickedItem ? priceFor(pickedItem.find_id, status) : 0;

	const sell = useCallback(async () => {
		if (!pickedItem || busy || hadEnough) return;
		setBusy(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		const r = await onSell(pickedItem.id);
		setBusy(false);
		if (!r.ok) {
			play("shake");
			onRefused?.(traderRefusalCopy(r.reason));
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		play("take");
		setTally({
			before: r.before,
			after: r.after,
			findName: satchelFind(r.findId)?.name ?? "a find",
			tickles: r.tickles,
		});
		setPicked(null);
	}, [pickedItem, busy, hadEnough, onSell, onRefused, play]);

	// The take that spends the visit hands off to the leave; the leave ends gone.
	const onAnimEnd = useCallback(
		(ended: TraderAnim) => {
			if (ended === "take" && hadEnough) play("leave");
			if (ended === "leave") setGone(true);
		},
		[hadEnough, play],
	);

	// The line under him: what he still takes, and for how long.
	const stayLine = status.present ? traderStayLine(minutes) : "wandered off";
	const countLine = hadEnough
		? `had enough for today · ${stayLine}`
		: `takes ${findsLeft} more find${findsLeft === 1 ? "" : "s"} · ${stayLine}`;

	const footer =
		items.length === 0 ? null : hadEnough ? (
			<Hand tone="secondary" align="center">
				what&apos;s left stays yours — he&apos;s back another day
			</Hand>
		) : (
			// A trade ticket: the stub is the price, the face is the verb. The find
			// is named by the lifted tile above, so the ticket does not repeat it.
			<TicketButton
				tone="golden"
				full
				stub={pickedItem ? `+${pickedPrice}` : "?"}
				stubCaption={pickedItem ? "tickles" : "pick one"}
				label={pickedFind ? "Hand it over" : "Pick a find to hand over"}
				disabled={!pickedItem}
				loading={busy}
				loadingLabel="handing it over"
				onPress={() => void sell()}
				accessibilityLabel={
					pickedFind ? `Hand over the ${pickedFind.name} for ${pickedPrice} tickles` : "Hand over a find"
				}
				accessibilityHint={
					pickedFind ? "Trades it away for tickles. It leaves the bag for good." : "Pick a find above first"
				}
				testID="trader-sell"
			/>
		);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="at the hedge"
			title="The Ghost Sheep Trader"
			footer={footer}
			testID="trader-sheet"
		>
			{/* ── 1. him ── */}
			<View style={styles.him} testID="trader-him">
				{gone ? (
					<TraderArt size={ART_SIZE.reveal} silhouette testID="trader-gone" />
				) : (
					<TraderSprite size={ART_SIZE.reveal} anim={anim} cue={cue} onEnd={onAnimEnd} testID="trader-sprite" />
				)}
				<Sticker
					color={tally ? "sun" : "paper"}
					radius={RADII.xl}
					pad
					rotate={BUBBLE_TILT}
					shadow="sm"
					accessibilityRole="text"
					accessibilityLabel={
						tally ? `${tally.before} before, ${tally.after} tickled now` : traderGreeting(status)
					}
					style={styles.bubble}
					testID={tally ? "trader-tally" : "trader-line"}
				>
					{tally ? (
						<>
							<View style={styles.tallyRow}>
								<T role="numeralLg">{tally.before}</T>
								<T role="hand" tone="secondary">
									→
								</T>
								<T role="numeralLg">{tally.after}</T>
							</View>
							<T role="kickerPill" tone="secondary">
								tickled now
							</T>
							<Hand tone="secondary">{`the ${tally.findName} went into his satchel · +${tally.tickles}`}</Hand>
						</>
					) : (
						<T role="handLg">{traderGreeting(status)}</T>
					)}
				</Sticker>
			</View>
			<Hand tone="secondary" align="center" style={styles.count} testID="trader-count">
				{countLine}
			</Hand>

			{/* ── 2. the offers ── */}
			{items.length === 0 ? (
				<EmptyState
					glyph="digBag"
					title="Nothing to trade"
					sub="Every Dig can turn up a find. He'll wander back."
				/>
			) : (
				<View style={styles.offers} accessibilityRole="list">
					{items.map((it) => {
						const f = satchelFind(it.find_id);
						const price = priceFor(it.find_id, status);
						const fancied = wantId != null && it.find_id === wantId;
						const selected = it.id === picked;
						return (
							<Sticker
								key={it.id}
								color={selected ? "sun" : fancied ? "cream" : "paper"}
								radius={RADII.lg}
								border={selected ? BORDER.heavy : BORDER.ink}
								shadow={selected ? "sticker" : "sm"}
								rotate={0}
								disabled={hadEnough}
								onPress={() => {
									if (hadEnough) return;
									Haptics.selectionAsync().catch(() => {});
									setPicked((p) => (p === it.id ? null : it.id));
								}}
								accessibilityRole="button"
								accessibilityLabel={`${f?.name ?? "a find"}, ${price} tickles${fancied ? ", the one he fancies" : ""}`}
								accessibilityHint={hadEnough ? "He has had enough for this visit" : "Picks it to hand over"}
								accessibilityState={{ selected }}
								style={[styles.offer, hadEnough && styles.offerSpent]}
								testID="trader-offer"
							>
								<FindArt id={it.find_id} size={ART_SIZE.badge} />
								<T role="kicker" numberOfLines={1} align="center">
									{f?.name ?? "a find"}
								</T>
								<View style={styles.price}>
									<TickleIcon size={ART_SIZE.mark} />
									<T role="numeral" tone={fancied ? "accent" : "primary"}>{`+${price}`}</T>
								</View>
								{fancied ? (
									<T role="kickerPillSm" tone="accent" numberOfLines={1}>
										pays double
									</T>
								) : null}
							</Sticker>
						);
					})}
				</View>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	him: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	bubble: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	tallyRow: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
	// A hand line between him and the offers sits closer to him than to them.
	count: { marginTop: SPACE.xs },
	offers: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.lg },
	offer: {
		flexGrow: 1,
		flexBasis: OFFER_MIN_W,
		maxWidth: OFFER_MAX_W,
		alignItems: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.xs,
	},
	// Spent: the offers stay readable (what's left is yours) but stop inviting.
	offerSpent: { opacity: OPACITY.dim, shadowOpacity: 0, elevation: 0 },
	price: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs },
});
