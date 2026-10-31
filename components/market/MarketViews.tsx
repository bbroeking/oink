// Bullion's Market — the four places (the round-4 prototype's screens):
//   · MarketHome — Bullion and his line, your ledger, the ticker (one tape for
//     the counter, the board and the town), the two places as big tiles, and
//     your listings.
//   · CounterView — Part 1, on chalk: every find's price, its day as a
//     sparkline, the change since yesterday, what you hold. A row opens the find.
//   · FindView — one find up close: the chart, Bullion's quote, the better deal
//     on the board when there is one, your holding and its cost, your Ghost
//     Sheep's price, your listings of it, the last trades.
//   · BoardView — Part 2, on cork: the pinned cards (for you first), filters,
//     and your listings.
// Every number comes off market_state / market_find; the rules in
// constants/market only phrase what the server already decided.
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { SatchelFindId } from "@/constants/satchel";
import {
	changeWords,
	fmtPrice,
	gainWord,
	haveWords,
	hoursLeftWord,
	vsPrice,
	type Trend,
	type VsPrice,
} from "@/constants/market";
import {
	ART_SIZE,
	BORDER,
	PAGE_PAD,
	PRESSED,
	RADII,
	SPACE,
	WHIMSY,
	inkAlpha,
} from "@/constants/theme";
import { findPlural } from "@/utils/trader";
import {
	boardBest,
	holdingOf,
	pigName,
	setsOf,
	type BoardCard,
	type MarketFind,
	type MarketFindView,
	type MarketOffer,
	type MarketState,
	type MarketTrade,
} from "@/utils/market";
import {
	Body,
	BodySm,
	Button,
	CardTitle,
	EmptyState,
	Glyph,
	Hand,
	HandLg,
	Kicker,
	KickerPill,
	Label,
	LoadingBeat,
	SegmentedControl,
	Sticker,
	T,
	Tag,
	TickleIcon,
} from "../ui";
import { FindArt } from "../satchel/FindArt";
import { BullionArt, CorkboardArt, PriceChart, Sparkline, chartStyles } from "./MarketArt";
import { bullionSays, qtyOf, setOf, tickerLine, tradeLine } from "./marketCopy";

const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Art boxes, in points — pictures, not spacing decisions.
const BULL_SAY = 96;
const PLACE_ART = 84;
const ROW_GLYPH = 42;
const CARD_GLYPH = 34;
const FIND_HERO = 64;
// The stuck-on lean of paper on the board and the market home.
const TILT_L = -1.2;
const TILT_R = 0.8;
const CARD_TILTS = [-1.2, 0.8, -0.6, 1, -0.4, 0.6];
// The counter's columns: a price wide enough for "13.8" and "3.5 each", a
// sparkline's box plus its change word; the last-trades clock and price.
const COL_PRICE = 64;
const COL_SPARK = 84;
const COL_TIME = 44;
const COL_TRADE_PRICE = 28;
// A counter row is a full tap target plus the glyph's breathing room; the
// key line indents past the glyph and its gap.
const CROW_MIN_H = 60;
const KEY_INDENT = 54;
// The ticker's find mark, a hair over an inline mark.
const TICKER_GLYPH = 16;

// ── Small shared pieces ──────────────────────────────────────────────────────

/** A price with the tickle mark. */
export function Price({ n, role = "numeral", tone = "primary" }: { n: number | string; role?: "numeral" | "numeralLg" | "cardTitle"; tone?: "primary" | "onDark" }) {
	return (
		<View style={styles.price}>
			<T role={role} tone={tone}>
				{String(n)}
			</T>
			<TickleIcon size={role === "numeralLg" ? 20 : 14} />
		</View>
	);
}

const TREND_TONE_DARK: Record<Trend, "onDarkAccent" | "onDark" | "onDarkMute"> = { up: "onDarkAccent", down: "onDark", flat: "onDarkMute" };

export function VsChip({ vs }: { vs: VsPrice }) {
	return <Tag label={vs.word} tone={vs.diff < 0 ? "sage" : vs.diff > 0 ? "rose" : "paper"} />;
}

/** Your listings: what is pinned up, how long it has, and a way to take it down. */
export function MyListings({
	offers,
	state,
	nowMs,
	onCancel,
	busyId,
}: {
	offers: MarketOffer[];
	state: MarketState;
	nowMs: number;
	onCancel: (id: number) => void;
	busyId: number | null;
}) {
	if (offers.length === 0) return null;
	const friendName = (id: string | null) => state.friends.find((f) => f.id === id)?.name ?? "a friend";
	return (
		<Sticker color="paper" rotate={0} pad title="Your listings" right={<Hand tone="secondary">{`${offers.length} of ${state.tuning.openOffers} up · ${state.tuning.offerHours} hours each`}</Hand>} style={styles.gapT}>
			{offers.map((o) => {
				const f = state.finds.find((x) => x.id === o.findId);
				const size = f?.size ?? o.qty;
				const what =
					o.side === "sell"
						? `Selling ${setOf(o.findId, size)} for ${o.price}`
						: o.side === "buy"
							? `Wanted: ${setOf(o.findId, size)} for ${o.price}`
							: `Swapping ${setOf(o.findId, size)} for ${o.wantFindId ? qtyOf(o.wantFindId, o.wantQty ?? 1) : "a find"}`;
				return (
					<View key={o.id} style={styles.mineRow}>
						<FindArt id={o.findId} size={ART_SIZE.glyphMd} />
						<View style={styles.flex}>
							<BodySm>{what}</BodySm>
							<View style={styles.rowWrap}>
								{o.price != null && f ? <VsChip vs={vsPrice(o.price, f.price)} /> : null}
								<Kicker tone="secondary">
									{(o.targetId ? `to ${friendName(o.targetId)} only · ` : "") + hoursLeftWord(Date.parse(o.expiresAt), nowMs)}
								</Kicker>
							</View>
						</View>
						<Button
							variant="ghost"
							size="xs"
							onPress={() => onCancel(o.id)}
							loading={busyId === o.id}
							loadingLabel="Taking down"
							accessibilityLabel={`Take down: ${what}`}
						>
							Take down
						</Button>
					</View>
				);
			})}
		</Sticker>
	);
}

// ── The market home ──────────────────────────────────────────────────────────

const TAG_TONE: Record<string, "sun" | "paper" | "rose" | "lilac" | "sky"> = {
	you: "sun",
	counter: "sky",
	board: "rose",
	town: "paper",
	swap: "lilac",
};
const TAG_FILL: Record<string, string> = {
	you: WHIMSY.sun,
	counter: WHIMSY.sky,
	board: WHIMSY.rose,
	town: WHIMSY.paper,
	swap: WHIMSY.lilac,
};

export function MarketHome({
	state,
	sayTurn,
	nowMs,
	onCounter,
	onBoard,
	onBag,
	onCancel,
	onReplayIntro,
	busyId,
}: {
	state: MarketState;
	sayTurn: number;
	nowMs: number;
	onCounter: () => void;
	onBoard: () => void;
	onBag: () => void;
	onCancel: (id: number) => void;
	onReplayIntro: () => void;
	busyId: number | null;
}) {
	const net = state.me.tookIn - state.me.spent;
	const ups = state.finds.filter((f) => f.price - f.prev >= 0.05).length;
	const downs = state.finds.filter((f) => f.price - f.prev <= -0.05).length;
	const forYou = state.board.filter((c) => c.forYou).length;
	const sizeOf = (id: SatchelFindId) => state.finds.find((f) => f.id === id)?.size ?? 4;
	const ticker = state.tape.filter((t) => t.kind !== "print" || state.tape.length < 6).slice(0, 14);

	return (
		<View>
			<View style={styles.bullRow}>
				<BullionArt pose="stand" size={BULL_SAY} />
				<Sticker color="paper" rotate={TILT_L} radius={RADII.lg} border={BORDER.thin} shadow="none" style={styles.say}>
					<HandLg>{bullionSays(sayTurn, state.yesterday)}</HandLg>
				</Sticker>
			</View>

			<Sticker color="paper" rotate={0} pad style={styles.ledger}>
				<View style={styles.flex}>
					<KickerPill>Your ledger</KickerPill>
					<Body>
						{`spent ${state.me.spent} · took in ${state.me.tookIn} · `}
						<T role="body" tone={net > 0 ? "success" : net < 0 ? "danger" : "secondary"}>
							{gainWord(net)}
						</T>
					</Body>
				</View>
				<Button variant="gold" size="sm" onPress={onBag} accessibilityLabel="Your bag: what you hold and what you paid">
					Your bag
				</Button>
			</Sticker>

			{ticker.length > 0 ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.ticker}
					accessibilityLabel="Recent trades, one tape for the counter and the noticeboard"
				>
					{ticker.map((tr) => {
						const line = tickerLine(tr, sizeOf(tr.findId));
						return (
							<View key={tr.id} style={styles.tk}>
								<FindArt id={tr.findId} size={TICKER_GLYPH} />
								<View style={[styles.tkTag, { backgroundColor: TAG_FILL[line.tag] }]}>
									<Label>{line.tag}</Label>
								</View>
								<BodySm numberOfLines={1}>{line.text}</BodySm>
							</View>
						);
					})}
				</ScrollView>
			) : null}

			<View style={styles.places}>
				<Sticker
					color={WHIMSY.bark}
					rotate={TILT_L}
					pad
					onPress={onCounter}
					accessibilityRole="button"
					accessibilityLabel="The Counter: buy or sell any set right now"
					style={styles.place}
				>
					<BullionArt pose="counter" size={PLACE_ART} />
					<T role="kickerPillSm" tone="onDarkAccent">Part 1 · instant</T>
					<T role="cardTitle" tone="onDark">The Counter</T>
					<T role="hand" tone="onDarkMute">Buy or sell any set, right now. Bullion takes a small cut.</T>
					<T role="label" tone="onDark">{`${ups} up · ${downs} down since yesterday`}</T>
				</Sticker>
				<Sticker
					color={WHIMSY.cork}
					rotate={TILT_R}
					pad
					onPress={onBoard}
					accessibilityRole="button"
					accessibilityLabel={`The Noticeboard: trade with pigs, ${state.board.length} listings${forYou ? `, ${forYou} for you` : ""}`}
					style={styles.place}
				>
					<CorkboardArt size={PLACE_ART} />
					<KickerPill>Part 2 · with pigs</KickerPill>
					<CardTitle>The Noticeboard</CardTitle>
					<Hand>Sell high, buy cheap, swap straight up. No cut.</Hand>
					<View style={styles.rowWrap}>
						<Label>{`${state.board.length} pinned`}</Label>
						{forYou ? <Tag label={`${forYou} for you`} tone="sun" /> : null}
					</View>
				</Sticker>
			</View>

			<MyListings offers={state.me.offers} state={state} nowMs={nowMs} onCancel={onCancel} busyId={busyId} />

			<Hand tone="secondary" style={styles.foot}>
				Every find has one price. Trade it at the counter now, or with a pig for a better deal.
			</Hand>
			<Button variant="handLink" onPress={onReplayIntro} accessibilityLabel="How the market works">
				How does the market work?
			</Button>
		</View>
	);
}

// ── Part 1: the Counter ──────────────────────────────────────────────────────

export function CounterView({
	state,
	fancy,
	onOpen,
}: {
	state: MarketState;
	/** What your Ghost Sheep fancies today, when he has said. */
	fancy: SatchelFindId | null;
	onOpen: (id: SatchelFindId) => void;
}) {
	return (
		<View style={styles.chalk}>
			<View style={styles.placeHead}>
				<BullionArt pose="counter" size={PLACE_ART} />
				<View style={styles.flex}>
					<T role="kickerPillSm" tone="onDarkAccent">★ Part 1 · instant</T>
					<T role="pageTitle" tone="onDark">The Counter</T>
					<T role="hand" tone="onDarkMute">
						I always buy and always sell. A little under the price, a little over: that&apos;s my cut.
					</T>
				</View>
			</View>
			<View style={styles.boardKey} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
				<T role="label" tone="onDarkMute" style={styles.keyName}>a set of</T>
				<T role="label" tone="onDarkMute" style={styles.keyPrice}>price</T>
				<T role="label" tone="onDarkMute" style={styles.keySpark}>since yesterday</T>
			</View>
			{state.finds.map((f) => (
				<CounterRow key={f.id} f={f} state={state} fancy={fancy === f.id} onOpen={onOpen} />
			))}
			<T role="hand" tone="onDarkMute" style={styles.foot}>
				Every set bought here pushes its price up; every set sold pulls it down. When it&apos;s quiet the price wiggles and wanders home.
			</T>
		</View>
	);
}

function CounterRow({ f, state, fancy, onOpen }: { f: MarketFind; state: MarketState; fancy: boolean; onOpen: (id: SatchelFindId) => void }) {
	const h = holdingOf(state, f.id);
	const { sets } = setsOf(h, f.size);
	const c = changeWords(f.price - f.prev);
	const aria = `${cap1(findPlural(f.id))}, a set of ${f.size}. The price is ${fmtPrice(f.price)}, ${c.word} since yesterday. Bullion sells at ${f.ask} and buys at ${f.bid}. ${cap1(haveWords({ held: h.held, size: f.size }))}.${fancy ? " Your Ghost Sheep fancies these today." : ""}`;
	return (
		<Pressable
			onPress={() => onOpen(f.id)}
			accessibilityRole="button"
			accessibilityLabel={aria}
			style={({ pressed }) => [styles.crow, fancy && styles.crowFancy, pressed && styles.pressed]}
		>
			<View>
				<FindArt id={f.id} size={ROW_GLYPH} />
				{fancy ? (
					<View style={styles.fancyStar}>
						<Glyph name="star" size={ART_SIZE.mark} />
					</View>
				) : null}
			</View>
			<View style={styles.flex}>
				<T role="cardTitleSm" tone="onDark">{cap1(findPlural(f.id))}</T>
				<T role="kicker" tone={sets ? "onDarkAccent" : "onDarkMute"}>
					{`${f.size}${sets ? ` · you have ${sets} ${sets === 1 ? "set" : "sets"}` : h.held ? ` · you have ${h.held}` : ""}`}
				</T>
			</View>
			<View style={styles.crPrice}>
				<T role="numeral" tone="onDark">{fmtPrice(f.price)}</T>
				<T role="kicker" tone="onDarkMute">{`${fmtPrice(f.price / f.size)} each`}</T>
			</View>
			<View style={styles.crSpark}>
				<Sparkline points={f.spark} usual={f.usual} />
				<T role="kicker" tone={TREND_TONE_DARK[c.trend]}>{c.word}</T>
			</View>
		</Pressable>
	);
}

// ── One find up close ────────────────────────────────────────────────────────

export function FindView({
	state,
	find,
	view,
	fancy,
	sheepEach,
	sheepHere,
	nowMs,
	weekdayOf,
	ticksPerDay,
	onTake,
	onOpen,
	onCancel,
	busyId,
}: {
	state: MarketState;
	find: MarketFind;
	view: MarketFindView | null;
	fancy: SatchelFindId | null;
	/** What your Ghost Sheep pays for one of these today (null when unknown). */
	sheepEach: number | null;
	sheepHere: boolean;
	nowMs: number;
	weekdayOf: (tick: number) => string;
	ticksPerDay: number;
	onTake: (card: BoardCard) => void;
	onOpen: (id: SatchelFindId) => void;
	onCancel: (id: number) => void;
	busyId: number | null;
}) {
	const { width } = useWindowDimensions();
	const f = find;
	const h = holdingOf(state, f.id);
	const { sets } = setsOf(h, f.size);
	const c = changeWords(f.price - f.prev);
	const best = boardBest(state.board, f.id);
	const dug = h.held - h.paidUnits;
	const paidLine = h.held
		? h.paidUnits
			? `${h.paidUnits} bought for ${h.paid}${dug ? ` · ${dug} dug up` : ""}`
			: "all dug up, so a sale is all gain"
		: "none in your bag";
	const mine = state.me.offers.filter((o) => o.findId === f.id || o.wantFindId === f.id);
	const sizeOf = (id: SatchelFindId) => state.finds.find((x) => x.id === id)?.size ?? 4;

	return (
		<View>
			<View style={styles.chalk}>
				<View style={styles.fHead}>
					<FindArt id={f.id} size={FIND_HERO} />
					<View style={styles.flex}>
						<T role="kickerPillSm" tone="onDarkAccent">{`★ A set of ${f.size}`}</T>
						<T role="display" tone="onDark">{cap1(findPlural(f.id))}</T>
						<T role="kicker" tone="onDarkMute">{`usual price ${f.usual} · ${fmtPrice(f.price / f.size)} each`}</T>
					</View>
					<View style={styles.fPrice}>
						<T role="kicker" tone="onDarkMute">the price</T>
						<T role="numeralLg" tone="onDark">{fmtPrice(f.price)}</T>
						<T role="kicker" tone={TREND_TONE_DARK[c.trend]}>{`${c.word} since yesterday`}</T>
					</View>
				</View>
				{view ? (
					<PriceChart
						width={width - 2 * PAGE_PAD - 2 * SPACE.card}
						usual={f.usual}
						price={f.price}
						ask={f.ask}
						bid={f.bid}
						hist={view.hist}
						marks={view.marks}
						tuning={state.tuning}
						ticksPerDay={ticksPerDay}
						weekdayOf={weekdayOf}
						accessibilityLabel={`The price of ${findPlural(f.id)} over the last two days, now ${fmtPrice(f.price)}. Bullion sells at ${f.ask} and buys at ${f.bid}.`}
					/>
				) : (
					<LoadingBeat label="Bullion is chalking the board" />
				)}
				<View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
					<LegendDot color={WHIMSY.barkText} label="the price" />
					<LegendDot color={WHIMSY.sun} label="Bullion's counter" />
					<LegendDot color={WHIMSY.roseDeep} label="a pig sale" />
					<LegendDot color={inkAlpha(0)} label="the townsfolk" />
				</View>
			</View>

			<Sticker color="paper" rotate={0} pad style={styles.quote}>
				<BullionArt pose="counter" size={ART_SIZE.badge} />
				<View style={styles.flex}>
					<CardTitle>{`“I'll sell for ${f.ask} · I'll buy for ${f.bid}”`}</CardTitle>
					<Kicker tone="secondary">{`The price is ${fmtPrice(f.price)}. My cut is the gap. Buy or sell below.`}</Kicker>
				</View>
			</Sticker>

			{best.sale && (best.sale.price as number) < f.ask ? (
				<Sticker color="paper" rotate={TILT_L} pad onPress={() => onTake(best.sale as BoardCard)} accessibilityRole="button" accessibilityLabel={`Cheaper on the noticeboard: ${pigName(best.sale.poster)}'s ${best.sale.qty} for ${best.sale.price}. Tap to buy.`} style={styles.gapT}>
					<KickerPill>Cheaper on the noticeboard</KickerPill>
					<View style={styles.row}>
						<FindArt id={f.id} size={ART_SIZE.glyphMd} />
						<HandLg>{`${cap1(pigName(best.sale.poster))}'s ${best.sale.qty} for ${best.sale.price}`}</HandLg>
					</View>
					<Kicker tone="secondary">{`${f.ask - (best.sale.price as number)} under what Bullion charges${best.sale.forYou ? " · sent to you" : ""} · tap to buy`}</Kicker>
				</Sticker>
			) : null}
			{best.wanted && (best.wanted.price as number) > f.bid ? (
				<Sticker color={WHIMSY.sage} rotate={TILT_R} pad onPress={sets ? () => onTake(best.wanted as BoardCard) : undefined} accessibilityRole="button" accessibilityState={{ disabled: !sets }} accessibilityLabel={`Pays more on the noticeboard: ${pigName(best.wanted.poster)} wants ${best.wanted.qty} for ${best.wanted.price}.`} style={styles.gapT}>
					<KickerPill>Pays more on the noticeboard</KickerPill>
					<View style={styles.row}>
						<FindArt id={f.id} size={ART_SIZE.glyphMd} />
						<HandLg>{`${cap1(pigName(best.wanted.poster))} wants ${best.wanted.qty} for ${best.wanted.price}`}</HandLg>
					</View>
					<Kicker tone="secondary">{`${(best.wanted.price as number) - f.bid} more than Bullion pays · ${sets ? "tap to sell" : `you'd need a set of ${f.size}`}`}</Kicker>
				</Sticker>
			) : null}

			<Sticker color="paper" rotate={0} pad title={`Your ${findPlural(f.id)}`} right={<Kicker tone="secondary">{paidLine}</Kicker>} style={styles.gapT}>
				<View style={styles.holdNums}>
					<HoldNum n={h.held} label="in your bag" />
					<HoldNum n={sets} label={`${sets === 1 ? "set" : "sets"} of ${f.size}`} />
					{h.onOffer ? <HoldNum n={h.onOffer} label="pinned up" /> : null}
				</View>
			</Sticker>

			<Sticker color={WHIMSY.cream2} rotate={TILT_R} pad style={styles.gapT}>
				<View style={styles.row}>
					<Glyph name="trader" size={ART_SIZE.badge} />
					<View style={styles.flex}>
						<CardTitle>Your Ghost Sheep</CardTitle>
						<BodySm>
							{sheepEach == null
								? `He buys ${findPlural(f.id)} one at a time when he's at the hedge.`
								: fancy === f.id
									? `He fancies ${findPlural(f.id)} today: ${sheepEach} each, ${sheepEach * f.size} a set.`
									: `He pays ${sheepEach} each for ${findPlural(f.id)} (${sheepEach * f.size} a set).${fancy ? ` Today he fancies ${findPlural(fancy)}.` : ""}`}
						</BodySm>
						<Kicker tone="secondary">
							{sheepHere ? "He's at the hedge now: open him from the Barn button." : "An outlet, outside the market: he visits once a day."}
						</Kicker>
					</View>
				</View>
				{fancy && fancy !== f.id ? (
					<Button variant="ghost" size="sm" onPress={() => onOpen(fancy)} accessibilityLabel={`See ${findPlural(fancy)}`}>
						{`See ${findPlural(fancy)}`}
					</Button>
				) : null}
			</Sticker>

			<MyListings offers={mine} state={state} nowMs={nowMs} onCancel={onCancel} busyId={busyId} />

			<Sticker color="paper" rotate={0} pad title="Last trades" right={<Kicker tone="secondary">counter, board and town on one tape</Kicker>} style={styles.gapT}>
				{view && view.recent.length > 0 ? (
					view.recent.map((tr) => <RecentRow key={tr.id} tr={tr} viewing={f.id} size={sizeOf(tr.findId)} ticksPerDay={ticksPerDay} state={state} />)
				) : (
					<BodySm tone="secondary">No trades yet.</BodySm>
				)}
			</Sticker>
		</View>
	);
}

function LegendDot({ color, label }: { color: string; label: string }) {
	return (
		<View style={styles.row}>
			<View style={[chartStyles.legendDot, { backgroundColor: color, borderColor: WHIMSY.barkMute }]} />
			<T role="kicker" tone="onDarkMute">{label}</T>
		</View>
	);
}

function HoldNum({ n, label }: { n: number; label: string }) {
	return (
		<View style={styles.holdNum}>
			<T role="numeralLg">{String(n)}</T>
			<Kicker tone="secondary">{label}</Kicker>
		</View>
	);
}

function clockOf(tick: number, tickMinutes: number): string {
	const m = (((tick * tickMinutes) % 1440) + 1440) % 1440;
	const hh = Math.floor(m / 60);
	const mm = m % 60;
	return `${hh < 10 ? "0" : ""}${hh}:${mm < 10 ? "0" : ""}${mm}`;
}

function RecentRow({ tr, viewing, size, state }: { tr: MarketTrade; viewing: SatchelFindId; size: number; ticksPerDay: number; state: MarketState }) {
	const line = tradeLine(tr, viewing, size);
	return (
		<View style={styles.recent}>
			<Kicker tone="secondary" style={styles.recentTime}>{clockOf(tr.tick, state.tuning.tickMinutes)}</Kicker>
			<BodySm style={styles.flex}>{line.text}</BodySm>
			<Tag label={line.tag} tone={TAG_TONE[line.tag] ?? "paper"} />
			<Label style={styles.recentPrice}>{tr.price != null ? String(tr.price) : ""}</Label>
		</View>
	);
}

// ── Part 2: the Noticeboard ──────────────────────────────────────────────────

export type BoardFilter = "all" | "sell" | "buy" | "swap" | "you";
const KIND_LABEL: Record<string, string> = { sell: "For sale", buy: "Wanted", swap: "Swap" };
const SIDE_RANK: Record<string, number> = { sell: 0, buy: 1, swap: 2 };
const BOARD_PAGE = 24;

export function BoardView({
	state,
	filter,
	onFilter,
	shown,
	onMore,
	nowMs,
	onTake,
	onCancel,
	busyId,
}: {
	state: MarketState;
	filter: BoardFilter;
	onFilter: (f: BoardFilter) => void;
	shown: number;
	onMore: () => void;
	nowMs: number;
	onTake: (card: BoardCard) => void;
	onCancel: (id: number) => void;
	busyId: number | null;
}) {
	const all = state.board;
	const n = { all: all.length, sell: 0, buy: 0, swap: 0, you: 0 };
	for (const c of all) {
		n[c.side] += 1;
		if (c.forYou) n.you += 1;
	}
	const order = new Map(state.finds.map((f, i) => [f.id, i]));
	const cards = all
		.filter((c) => filter === "all" || (filter === "you" ? c.forYou : c.side === filter))
		.sort(
			(a, b) =>
				Number(b.forYou) - Number(a.forYou) ||
				(order.get(a.findId) ?? 0) - (order.get(b.findId) ?? 0) ||
				SIDE_RANK[a.side] - SIDE_RANK[b.side] ||
				(a.side === "buy" ? (b.price ?? 0) - (a.price ?? 0) : (a.price ?? 0) - (b.price ?? 0)) ||
				a.id - b.id,
		);
	const page = cards.slice(0, shown);

	return (
		<View>
			<Sticker color="paper" rotate={0} pad style={styles.boardHead}>
				<View style={styles.flex}>
					<KickerPill>★ Part 2 · with pigs</KickerPill>
					<T role="pageTitle">The Noticeboard</T>
					<Hand tone="secondary">No cut. Price it between Bullion&apos;s two prices and you both beat his counter.</Hand>
				</View>
				<CorkboardArt size={ART_SIZE.thumb} />
			</Sticker>

			<MyListings offers={state.me.offers} state={state} nowMs={nowMs} onCancel={onCancel} busyId={busyId} />

			<SegmentedControl<BoardFilter>
				label="Show"
				value={filter}
				onChange={onFilter}
				options={[
					{ value: "all", label: "All" },
					{ value: "sell", label: "For sale" },
					{ value: "buy", label: "Wanted" },
					{ value: "swap", label: "Swaps" },
					{ value: "you", label: "For you", badge: n.you ? <Tag label={String(n.you)} tone="sun" /> : undefined },
				]}
				style={styles.gapT}
			/>

			{page.length === 0 ? (
				<View style={styles.gapT}>
					<EmptyState
						kind="empty"
						title={filter === "you" ? "Nothing sent to you yet" : "Nothing pinned here right now"}
						sub={filter === "you" ? "Your friends can send a listing to just you." : "Be the first: post a listing."}
					/>
				</View>
			) : (
				<View style={styles.pcards}>
					{page.map((c, i) => (
						<PinCard key={c.id} c={c} state={state} nowMs={nowMs} tilt={CARD_TILTS[i % CARD_TILTS.length]} onTake={onTake} />
					))}
				</View>
			)}
			{cards.length > page.length ? (
				<Button variant="ghost" onPress={onMore} style={styles.gapT}>
					{`${cards.length - page.length} more pinned below`}
				</Button>
			) : null}
		</View>
	);
}
BoardView.PAGE = BOARD_PAGE;

function PinCard({ c, state, nowMs, tilt, onTake }: { c: BoardCard; state: MarketState; nowMs: number; tilt: number; onTake: (card: BoardCard) => void }) {
	const f = state.finds.find((x) => x.id === c.findId);
	const size = f?.size ?? c.qty;
	const coin = state.me.coin;
	const who = cap1(pigName(c.poster));
	let action: { label: string; ok: boolean; variant: "primary" | "success" | "lilac" };
	let body: React.ReactNode;
	if (c.side === "swap" && c.wantFindId) {
		const have = holdingOf(state, c.wantFindId).held;
		const wq = c.wantQty ?? 1;
		const wf = state.finds.find((x) => x.id === c.wantFindId);
		const giveVal = f?.price ?? 0;
		const wantVal = wf ? (wf.price / wf.size) * wq : 0;
		action = have >= wq ? { label: "Swap", ok: true, variant: "lilac" } : { label: `you have ${have} of ${wq}`, ok: false, variant: "lilac" };
		body = (
			<View>
				<View style={styles.row}>
					<BodySm>Swap for</BodySm>
					<FindArt id={c.wantFindId} size={ART_SIZE.glyphSm} />
					<BodySm>{qtyOf(c.wantFindId, wq)}</BodySm>
				</View>
				<Kicker tone="secondary">{`${setOf(c.findId, size)} ≈ ${Math.round(giveVal)} · ${qtyOf(c.wantFindId, wq)} ≈ ${Math.round(wantVal)}`}</Kicker>
			</View>
		);
	} else {
		const price = c.price ?? 0;
		body = (
			<View>
				<View style={styles.rowWrap}>
					<Price n={price} role="numeralLg" />
					{f ? <VsChip vs={vsPrice(price, f.price)} /> : null}
				</View>
				{f ? <Kicker tone="secondary">{`Bullion would pay ${f.bid} / charge ${f.ask}`}</Kicker> : null}
			</View>
		);
		if (c.side === "sell") {
			action = coin >= price ? { label: `Buy for ${price}`, ok: true, variant: "primary" } : { label: `you have ${coin} ready`, ok: false, variant: "primary" };
		} else {
			const held = holdingOf(state, c.findId).held;
			action = held >= size ? { label: `Sell for ${price}`, ok: true, variant: "success" } : { label: `you have ${held} of ${size}`, ok: false, variant: "success" };
		}
	}
	return (
		<Sticker
			color={c.forYou ? WHIMSY.sun : c.side === "buy" ? WHIMSY.sky : c.side === "swap" ? WHIMSY.lilac : WHIMSY.paper}
			rotate={tilt}
			pad
			style={styles.pcard}
			accessibilityLabel={`${c.forYou ? "For you" : KIND_LABEL[c.side]}: ${setOf(c.findId, size)}${c.price != null ? ` for ${c.price}` : ""}, from ${who}`}
		>
			<View style={styles.rowBetween}>
				<KickerPill>{c.forYou ? "For you" : KIND_LABEL[c.side]}</KickerPill>
				<Kicker tone="secondary">{hoursLeftWord(Date.parse(c.expiresAt), nowMs).replace(" left", "")}</Kicker>
			</View>
			<View style={styles.row}>
				<FindArt id={c.findId} size={CARD_GLYPH} />
				<CardTitle style={styles.flex}>{setOf(c.findId, size)}</CardTitle>
			</View>
			{body}
			<View style={styles.row}>
				<Glyph name="pigface" size={ART_SIZE.glyphSm} />
				<BodySm>{who}</BodySm>
			</View>
			<Button variant={action.ok ? action.variant : "locked"} size="sm" disabled={!action.ok} onPress={() => onTake(c)} full>
				{action.label}
			</Button>
		</Sticker>
	);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	rowWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACE.sm },
	rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
	gapT: { marginTop: SPACE.md },
	pressed: PRESSED,
	price: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs },
	foot: { marginTop: SPACE.lg, textAlign: "center" },

	bullRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.md },
	say: { flex: 1, padding: SPACE.md },
	ledger: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	ticker: { gap: SPACE.sm, paddingVertical: SPACE.md },
	tk: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		maxWidth: 300,
	},
	tkTag: { paddingHorizontal: SPACE.xs, borderRadius: RADII.sm, borderWidth: BORDER.hair, borderColor: WHIMSY.ink },
	places: { flexDirection: "row", gap: SPACE.md },
	place: { flex: 1, gap: SPACE.xs },

	chalk: {
		backgroundColor: WHIMSY.bark,
		borderRadius: RADII.xl,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		padding: SPACE.card,
	},
	placeHead: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md },
	boardKey: { flexDirection: "row", paddingLeft: KEY_INDENT, marginBottom: SPACE.xs },
	keyName: { flex: 1 },
	keyPrice: { width: COL_PRICE, textAlign: "right" },
	keySpark: { width: COL_SPARK, textAlign: "right" },
	crow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		minHeight: CROW_MIN_H,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
		borderTopWidth: BORDER.hair,
		borderTopColor: WHIMSY.barkMute,
		borderRadius: RADII.sm,
	},
	crowFancy: { backgroundColor: inkAlpha(0.25) },
	fancyStar: {
		position: "absolute",
		right: -SPACE.xs,
		top: -SPACE.xs,
		backgroundColor: WHIMSY.sun,
		borderRadius: RADII.pill,
		borderWidth: BORDER.hair,
		borderColor: WHIMSY.ink,
		padding: SPACE.xxs,
	},
	crPrice: { width: COL_PRICE, alignItems: "flex-end" },
	crSpark: { width: COL_SPARK, alignItems: "flex-end" },

	fHead: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md },
	fPrice: { alignItems: "flex-end" },
	legend: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, marginTop: SPACE.sm },
	quote: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginTop: SPACE.md },
	holdNums: { flexDirection: "row", gap: SPACE.xl },
	holdNum: { alignItems: "flex-start" },
	recent: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.xs },
	recentTime: { width: COL_TIME },
	recentPrice: { width: COL_TRADE_PRICE, textAlign: "right" },

	mineRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.xs },

	boardHead: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	pcards: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, marginTop: SPACE.md },
	pcard: { width: "47%", flexGrow: 1, gap: SPACE.xs },
});
