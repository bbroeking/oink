// The Ghost Sheep Trader's sheet — opened from his row on the Barn button's
// fan, only while he is at the hedge (hooks/useTrader).
//
// Layout (2026-09-17, second pass — the first put a paragraph card above
// 44pt tiles with 10pt prices; the task is "which find, for how much?", so
// the offers lead):
//   1. HIM — the sprite, and one short line in a speech bubble (he never
//      explains). Under them one hand line: how many he still takes, how long
//      he stays. After a sale the bubble holds the tally: before → tickled now.
//   2. THE OFFERS — the bag as big sticker tiles, three across: the art, its
//      name, and the price as a real numeral with the tickle mark. The one he
//      fancies sits on cream with "pays double".
//
// Sets and trade-ups (2026-10-29, the trader canvas's direction A,
// docs/design/claude-design/trader-2026-10-29 boards A2 to A4): "pairs pay
// more, three alike go up".
//   • A2, the sheet: one tile per find with a ×N badge. Tapping a tile makes
//     a HAND of that find: one, then two (a pair, half again), then three when
//     three alike can trade up (rare cannot), then none. The hand strip under
//     the bag spells the pair's sum; a hint says what one more would do.
//   • A3, the confirm: three alike → his pick of the next rarity, seeded for
//     the day, shown before anything moves. The ticket confirms; "keep them"
//     steps back.
//   • A4, the receipt: the bubble's tally runs across the whole open sheet
//     (before the first hand-off → tickled now, and the last hand-off's line),
//     and a lilac card says what came back for the three.
// A pair is two plain sales (the server judges the pair over the visit's
// ledger), so the hand-over sends each find's own id, one after the other.
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
import { ART_SIZE, BORDER, OPACITY, RADII, SPACE, WHIMSY } from "@/constants/theme";
import type { TraderAnim } from "@/constants/traderFrames";
import type { SatchelItem } from "@/utils/satchel";
import {
	bagGroups,
	findPlural,
	maxHand,
	priceFor,
	priceHand,
	tradeUpPick,
	traderGreeting,
	traderMinutesLeft,
	traderRefusalCopy,
	traderStayLine,
	type BagGroup,
	type TraderSaleOutcome,
	type TraderStatus,
	type TraderTradeUpOutcome,
} from "@/utils/trader";
import { Button, EmptyState, Glyph, Hand, Sheet, Sticker, T, TicketButton, TickleIcon } from "../ui";
import { FindArt } from "../satchel/FindArt";
import { TraderArt, TraderSprite } from "./TraderArt";

// An offer tile: three across a phone with the gaps, and a short last row
// keeps the same tile width rather than stretching to fill — the empty places
// are dashed "not yet" slots, so the grid stays three-up (2026-09-20).
const OFFER_MIN_W = 96;
const OFFER_MAX_W = "32%";
const OFFER_COLUMNS = 3;
// The speech bubble leans the other way from the sheet's stickers.
const BUBBLE_TILT = 1.5;
// The hand strip and the came-back card lean a touch, each its own way (A2/A4).
const HAND_TILT = 0.6;
const CAME_BACK_TILT = 0.8;
const NOTE_TILT = -0.5;

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
	/** Three alike for one of the next rarity. Absent → no trade-ups offered. */
	onTradeUp?: (findId: SatchelFindId) => Promise<TraderTradeUpOutcome>;
	/** A refusal, in his voice, for the caller's toast. */
	onRefused?: (line: string) => void;
}

interface Tally {
	before: number;
	after: number;
	line: string;
}

interface CameBack {
	findId: SatchelFindId;
	gaveFindId: SatchelFindId;
	count: number;
	newToBag: boolean;
}

interface HandPick {
	findId: SatchelFindId;
	count: number;
}

export function TraderSheet({ open, onClose, status, readAt, items, onSell, onTradeUp, onRefused }: TraderSheetProps) {
	const [hand, setHand] = useState<HandPick | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [tally, setTally] = useState<Tally | null>(null);
	const [cameBack, setCameBack] = useState<CameBack | null>(null);
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
	// React-sanctioned way — no effect). A hand whose finds left the bag (sold
	// from another device, tossed) simply stops resolving below.
	const [openSeen, setOpenSeen] = useState(open);
	if (openSeen !== open) {
		setOpenSeen(open);
		setHand(null);
		setConfirming(false);
		setTally(null);
		setCameBack(null);
		setGone(false);
		setAnim("greet");
		setCue((c) => c + 1);
	}

	const visit = status.visit;
	const findsLeft = visit?.findsLeft ?? 0;
	const hadEnough = findsLeft <= 0;
	const minutes = traderMinutesLeft(status, readAt);
	const wantId: SatchelFindId | null = visit?.wantFindId ?? null;
	const tradeUpsOn = status.tuning.tradeUp && onTradeUp != null;
	const groups = bagGroups(items);

	// The live hand: clamped to what the bag and the visit still allow.
	const handGroup: BagGroup | null = hand ? (groups.find((g) => g.findId === hand.findId) ?? null) : null;
	const handMax = handGroup ? maxHandFor(handGroup) : 0;
	const handCount = handGroup ? Math.min(hand?.count ?? 0, handMax) : 0;
	const priced = handGroup && handCount > 0 ? priceHand(handGroup.findId, handCount, status) : null;
	const handFind = handGroup ? satchelFind(handGroup.findId) : null;
	const pickFind = priced?.kind === "tradeUp" ? satchelFind(priced.pickId) : null;
	const showConfirm = confirming && priced?.kind === "tradeUp" && pickFind != null && handFind != null;

	function maxHandFor(g: BagGroup): number {
		const m = maxHand(g.findId, g.items.length, status);
		// Without the trade-up mutation wired, a hand stops at the pair.
		return tradeUpsOn ? m : Math.min(m, status.tuning.pairMultiplier > 1 ? 2 : 1);
	}

	const tapTile = (g: BagGroup) => {
		if (hadEnough || busy) return;
		const max = maxHandFor(g);
		if (max <= 0) return;
		Haptics.selectionAsync().catch(() => {});
		setConfirming(false);
		setHand((h) =>
			h && h.findId === g.findId ? (h.count + 1 > max ? null : { findId: g.findId, count: h.count + 1 }) : { findId: g.findId, count: 1 },
		);
	};

	// (Plain functions: the hand is derived each render, and the React
	// Compiler owns the memoization here.)
	const handOver = async () => {
		if (!handGroup || !priced || priced.kind !== "sell" || busy || hadEnough) return;
		setBusy(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		let first: number | null = null;
		let last = 0;
		let paid = 0;
		let sold = 0;
		let pairHit = false;
		let refusal: string | null = null;
		for (const it of handGroup.items.slice(0, priced.count)) {
			const r = await onSell(it.id);
			if (!r.ok) {
				refusal = r.reason;
				break;
			}
			first ??= r.before;
			last = r.after;
			paid += r.tickles;
			sold += 1;
			pairHit ||= r.pair;
		}
		setBusy(false);
		if (refusal != null) onRefused?.(traderRefusalCopy(refusal));
		if (sold === 0) {
			play("shake");
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		play("take");
		const name = satchelFind(handGroup.findId)?.name ?? "find";
		const line =
			sold >= 2
				? `a pair of ${findPlural(handGroup.findId)} went into his satchel · +${paid}`
				: pairHit
					? `the ${name} made a pair in his satchel · +${paid}`
					: `the ${name} went into his satchel · +${paid}`;
		const before = first ?? last;
		setTally((t) => ({ before: t?.before ?? before, after: last, line }));
		setHand(null);
	};

	const tradeUp = async () => {
		if (!handGroup || priced?.kind !== "tradeUp" || !onTradeUp || busy) return;
		setBusy(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		const r = await onTradeUp(handGroup.findId);
		setBusy(false);
		setConfirming(false);
		if (!r.ok) {
			play("shake");
			onRefused?.(traderRefusalCopy(r.reason));
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		play("take");
		setCameBack({ findId: r.gotFindId, gaveFindId: r.gaveFindId, count: r.count, newToBag: r.newToBag });
		setHand(null);
	};

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

	const footer = (() => {
		if (items.length === 0) return null;
		if (hadEnough) {
			return (
				<Hand tone="secondary" align="center">
					what&apos;s left stays yours. he&apos;s back another day
				</Hand>
			);
		}
		if (showConfirm && handFind && pickFind) {
			return (
				<TicketButton
					tone="golden"
					full
					stub="3→1"
					stubCaption="trade up"
					label={`Trade three ${findPlural(handFind.id)} for ${pickFind.withArticle}`}
					loading={busy}
					loadingLabel="trading up"
					onPress={() => void tradeUp()}
					accessibilityLabel={`Trade three ${findPlural(handFind.id)} for ${pickFind.withArticle}`}
					accessibilityHint="The three leave the bag for good; his pick comes back"
					testID="trader-trade-up-confirm"
				/>
			);
		}
		// A trade ticket: the stub is the price, the face is the verb. The find
		// is named by the lifted tile above, so the ticket does not repeat it.
		if (priced?.kind === "tradeUp" && handFind && pickFind) {
			return (
				<TicketButton
					tone="golden"
					full
					stub="3→1"
					stubCaption="trade up"
					label={`Trade three ${findPlural(handFind.id)} for ${pickFind.withArticle}`}
					onPress={() => setConfirming(true)}
					accessibilityLabel={`Trade three ${findPlural(handFind.id)} for ${pickFind.withArticle}`}
					accessibilityHint="Shows the trade-up before anything moves"
					testID="trader-sell"
				/>
			);
		}
		const sell = priced?.kind === "sell" ? priced : null;
		const label = !sell ? "Pick a find to hand over" : sell.count >= 2 ? "Hand over the pair" : "Hand it over";
		return (
			<TicketButton
				tone="golden"
				full
				stub={sell ? `+${sell.total}` : "?"}
				stubCaption={sell ? "tickles" : "pick one"}
				label={label}
				disabled={!sell}
				loading={busy}
				loadingLabel="handing it over"
				onPress={() => void handOver()}
				accessibilityLabel={
					sell && handFind
						? sell.count >= 2
							? `Hand over two ${findPlural(handFind.id)} for ${sell.total} tickles`
							: `Hand over the ${handFind.name} for ${sell.total} tickles`
						: "Hand over a find"
				}
				accessibilityHint={
					sell ? "Trades it away for tickles. It leaves the bag for good." : "Pick a find above first"
				}
				testID="trader-sell"
			/>
		);
	})();

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
				{showConfirm && handFind && pickFind ? (
					<Sticker
						color="cream"
						radius={RADII.xl}
						pad
						rotate={BUBBLE_TILT}
						shadow="sm"
						accessibilityRole="text"
						style={styles.bubble}
						testID="trader-line"
					>
						<T role="handLg">
							{`Three ${findPlural(handFind.id)}, little pig? Then ${pickFind.withArticle} is yours. My pick of which. No take-backs.`}
						</T>
					</Sticker>
				) : (
					<Sticker
						color={tally ? "sun" : "paper"}
						radius={RADII.xl}
						pad
						rotate={BUBBLE_TILT}
						shadow="sm"
						accessibilityRole="text"
						accessibilityLabel={
							tally ? `${tally.before} before, ${tally.after} tickled now. ${tally.line}` : traderGreeting(status)
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
								<Hand tone="secondary">{tally.line}</Hand>
							</>
						) : (
							<T role="handLg">{traderGreeting(status)}</T>
						)}
					</Sticker>
				)}
			</View>

			{showConfirm && handFind && pickFind ? (
				<TradeUpConfirm
					give={handFind.id}
					pick={pickFind.id}
					busy={busy}
					onBack={() => setConfirming(false)}
				/>
			) : (
				<>
					{/* ── A4: what came back for three alike ── */}
					{cameBack ? <CameBackCard cameBack={cameBack} /> : null}
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
						<>
							<View style={styles.bagHead}>
								<T role="sectionTitle" accessibilityRole="header">
									Your bag
								</T>
								<Hand tone="secondary">
									{tally || cameBack
										? "after"
										: status.tuning.pairMultiplier > 1
											? "tap finds to make a hand"
											: "tap a find to pick it"}
								</Hand>
							</View>
							<View style={styles.offers} accessibilityRole="list">
								{groups.map((g) => {
									const f = satchelFind(g.findId);
									const price = priceFor(g.findId, status);
									const fancied = wantId != null && g.findId === wantId;
									const inHand = handGroup?.findId === g.findId ? handCount : 0;
									const selected = inHand > 0;
									const owned = g.items.length;
									const openPair = visit?.unpaired.includes(g.findId) ?? false;
									const note =
										selected && priced?.kind === "sell" && priced.count >= 2
											? `a pair · +${priced.total}`
											: selected && priced?.kind === "tradeUp"
												? "three alike · up"
												: fancied
													? "pays double"
													: openPair && status.tuning.pairMultiplier > 1
														? "makes a pair"
														: null;
									return (
										<Sticker
											key={g.findId}
											color={selected ? "sun" : fancied ? "cream" : "paper"}
											radius={RADII.lg}
											border={selected ? BORDER.heavy : BORDER.ink}
											shadow={selected ? "sticker" : "sm"}
											rotate={0}
											disabled={hadEnough}
											onPress={() => tapTile(g)}
											accessibilityRole="button"
											accessibilityLabel={`${f?.name ?? "a find"}, ${price} tickles${fancied ? ", the one he fancies" : ""}${owned > 1 ? `, ${owned} in the bag` : ""}${selected ? `, ${inHand} in your hand` : ""}`}
											accessibilityHint={
												hadEnough ? "He has had enough for this visit" : "Adds one to your hand"
											}
											accessibilityState={{ selected }}
											style={[styles.offer, hadEnough && styles.offerSpent]}
											testID="trader-offer"
										>
											{owned > 1 ? (
												<View style={styles.countBadge} testID="trader-offer-count">
													<T role="kickerPillSm" tone="onDark">{`×${owned}`}</T>
												</View>
											) : null}
											<FindArt id={g.findId} size={ART_SIZE.badge} />
											<T role="kicker" numberOfLines={1} align="center">
												{f?.name ?? "a find"}
											</T>
											<View style={styles.price}>
												<TickleIcon size={ART_SIZE.mark} />
												<T role="numeral" tone={fancied ? "accent" : "primary"}>{`+${price}`}</T>
											</View>
											{note ? (
												<T role="kickerPillSm" tone="accent" numberOfLines={1}>
													{note}
												</T>
											) : null}
										</Sticker>
									);
								})}
								{/* Room for more finds: the dashed slots that square off a short
								    last row. Empty, so VoiceOver has nothing to read there. */}
								{Array.from(
									{ length: (OFFER_COLUMNS - (groups.length % OFFER_COLUMNS)) % OFFER_COLUMNS },
									(_, i) => (
										<Sticker
											key={`empty-${i}`}
											color="cream"
											radius={RADII.lg}
											borderStyle="dashed"
											shadow="none"
											rotate={0}
											style={styles.offer}
											testID="trader-offer-empty"
										/>
									),
								)}
							</View>
							{/* ── A2: the hand strip, and what one more would do ── */}
							{priced?.kind === "sell" && handFind && (priced.count >= 2 || priced.openPair) && priced.pair ? (
								<HandStrip findId={handFind.id} count={priced.count} price={priced.price} total={priced.total} openPair={priced.openPair} />
							) : null}
							{priced?.kind === "sell" && priced.count === 2 && handGroup && handFind ? (
								<TradeUpHint
									findName={handFind.name}
									pickId={tradeUpsOn ? tradeUpPick(handFind.id, status) : null}
									owned={handGroup.items.length}
									roomForThree={findsLeft >= status.tuning.tradeUpCount}
								/>
							) : null}
						</>
					)}
				</>
			)}
		</Sheet>
	);
}

/** A2: the hand under the bag — the pair's art, its name, and its sum. */
function HandStrip({
	findId,
	count,
	price,
	total,
	openPair,
}: {
	findId: SatchelFindId;
	count: number;
	price: number;
	total: number;
	openPair: boolean;
}) {
	const pairOf = `a pair of ${findPlural(findId)}`;
	// The sum in words: two now, or the one that pairs with the one he took earlier.
	const sum = !openPair
		? `${price} + ${price}, then half again: ${total} tickles`
		: count >= 2
			? `the first pairs with the one he took earlier: ${total} tickles`
			: `pairs with the one he took earlier: +${total}`;
	return (
		<Sticker
			color="cream"
			radius={RADII.lg}
			rotate={HAND_TILT}
			shadow="sm"
			accessibilityRole="text"
			accessibilityLabel={`${pairOf}. ${sum}`}
			style={styles.hand}
			testID="trader-hand"
		>
			<View style={styles.handArt}>
				{Array.from({ length: Math.min(count, 2) }, (_, i) => (
					<View key={i} style={i > 0 ? styles.handArtOverlap : null}>
						<FindArt id={findId} size={ART_SIZE.glyphMd} />
					</View>
				))}
			</View>
			<View style={styles.handWords}>
				<T role="cardTitleSm">
					{pairOf}
				</T>
				<Hand tone="secondary">{sum}</Hand>
			</View>
			<View style={styles.price}>
				<TickleIcon size={ART_SIZE.mark} />
				<T role="numeralLg">{`+${total}`}</T>
			</View>
		</Sticker>
	);
}

/** A2: what one more of the pair would do — tap it (it is in the bag) or
 *  hold it (find one more first). Silent when it would not trade up. */
function TradeUpHint({
	findName,
	pickId,
	owned,
	roomForThree,
}: {
	findName: string;
	pickId: SatchelFindId | null;
	owned: number;
	roomForThree: boolean;
}) {
	const pick = pickId ? satchelFind(pickId) : null;
	if (!pick || !roomForThree) return null;
	const verb = owned >= 3 ? "tap" : "hold";
	return (
		<Hand tone="secondary" align="center" style={styles.hint} testID="trader-hint">
			{`${verb} one more ${findName} and he will trade all three for ${pick.withArticle}`}
		</Hand>
	);
}

/** A3: three alike → his pick, before anything moves. */
function TradeUpConfirm({
	give,
	pick,
	busy,
	onBack,
}: {
	give: SatchelFindId;
	pick: SatchelFindId;
	busy: boolean;
	onBack: () => void;
}) {
	const giveFind = satchelFind(give);
	const pickFind = satchelFind(pick);
	return (
		<View style={styles.confirm} testID="trader-trade-up">
			<T role="sectionTitle" accessibilityRole="header">
				Trade up
			</T>
			<View style={styles.upRow}>
				<View style={styles.upGive}>
					{[0, 1, 2].map((i) => (
						<Sticker
							key={i}
							color="sun"
							radius={RADII.lg}
							border={BORDER.heavy}
							shadow="sticker"
							rotate={0}
							style={styles.upTile}
						>
							<FindArt id={give} size={ART_SIZE.glyphMd} />
							<T role="kicker" align="center">
								{giveFind?.name ?? "find"}
							</T>
						</Sticker>
					))}
				</View>
				<Glyph name="arrowRight" size={ART_SIZE.glyphSm} />
				<Sticker
					color="lilac"
					radius={RADII.lg}
					shadow="sm"
					rotate={0}
					accessibilityRole="text"
					accessibilityLabel={`${pickFind?.withArticle ?? "a find"}, ${pickFind?.rarity ?? ""}`}
					style={styles.upGet}
					testID="trader-trade-up-pick"
				>
					<FindArt id={pick} size={ART_SIZE.glyph} />
					<T role="kicker" align="center">
						{pickFind?.name ?? "find"}
					</T>
					{/* On lilac the kicker is ink (theme: one accent, restricted by rule). */}
					<T role="kickerPillSm">
						{pickFind?.rarity ?? ""}
					</T>
				</Sticker>
			</View>
			<Sticker color="paper" radius={RADII.lg} pad rotate={NOTE_TILT} shadow="sm">
				<Hand align="center">
					Three of a kind go into his satchel. One find of the next rarity comes back, his choice, seeded for the
					day. Rare has no trade-up: nothing sits above it.
				</Hand>
			</Sticker>
			<Hand tone="secondary" align="center">
				finds for finds. he never pays snouts, and nothing here is for sale.
			</Hand>
			<Button
				variant="handLink"
				full
				onPress={onBack}
				disabled={busy}
				accessibilityHint="Back to the bag; nothing moves"
				testID="trader-trade-up-back"
			>
				keep them
			</Button>
		</View>
	);
}

/** A4: the find that came back for three alike. */
function CameBackCard({ cameBack }: { cameBack: CameBack }) {
	const got = satchelFind(cameBack.findId);
	const sub = `came back for ${cameBack.count === 3 ? "three" : cameBack.count} ${findPlural(cameBack.gaveFindId)}${
		cameBack.newToBag ? " · new to your bag" : ""
	}`;
	return (
		<Sticker
			color="lilac"
			radius={RADII.xl}
			pad
			rotate={CAME_BACK_TILT}
			shadow="sticker"
			accessibilityRole="text"
			accessibilityLabel={`${got?.withArticle ?? "a find"} ${sub}`}
			style={styles.cameBack}
			testID="trader-came-back"
		>
			<View style={styles.cameBackRow}>
				<FindArt id={cameBack.findId} size={ART_SIZE.glyph} />
				<View style={styles.handWords}>
					<T role="cardTitle">{got?.withArticle ?? "a find"}</T>
					<Hand tone="secondary">{sub}</Hand>
				</View>
				<Glyph name="sparkle" size={ART_SIZE.glyphSm} />
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	him: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	bubble: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	tallyRow: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
	// A hand line between him and the offers sits closer to him than to them.
	count: { marginTop: SPACE.xs },
	bagHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginTop: SPACE.lg,
	},
	offers: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.sm },
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
	// The ×N badge: an ink pill pinned in the tile's corner (A2).
	countBadge: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		backgroundColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.xxs,
	},
	hand: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginTop: SPACE.md,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
	},
	handArt: { flexDirection: "row", alignItems: "center" },
	// The second find tucks behind the first, like two in a palm.
	handArtOverlap: { marginLeft: -SPACE.card },
	handWords: { flex: 1, minWidth: 0 },
	hint: { marginTop: SPACE.xs },
	confirm: { gap: SPACE.sm, marginTop: SPACE.md },
	upRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
	upGive: { flexDirection: "row", gap: SPACE.xs, flexShrink: 1 },
	upTile: {
		flexShrink: 1,
		minWidth: 0,
		width: ART_SIZE.thumb,
		alignItems: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.xs,
	},
	upGet: {
		minWidth: ART_SIZE.thumb,
		flexShrink: 0,
		alignItems: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.xs,
	},
	cameBack: { marginTop: SPACE.md },
	cameBackRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
});
