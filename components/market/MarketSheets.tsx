// Bullion's Market — the sheets.
//   · ConfirmSheet — a counter trade or a board listing, before the tap: the
//     price you pay or get, and WHERE THE PRICE GOES, drawn on its band. The
//     better deal on the board, when there is one, rides along.
//   · PostSheet — post a listing: For sale / Wanted / Swap, the set, the price
//     on a band that shows Bullion's two prices (the gap between them is where
//     a listing beats his counter both ways), what it would do right now, and
//     who sees it (everyone, or one friend).
//   · BagSheet — what you hold, what you paid, what is pinned up.
//   · OnboardSheet — three cards in Bullion's voice.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import type { SatchelFindId } from "@/constants/satchel";
import {
	counterMove,
	eachWord,
	fmtPrice,
	gainWord,
	middle,
	pigMove,
	postRange,
	previewList,
	priceHi,
	priceLo,
	swapVerdict,
	vsPrice,
	type MarketSide,
} from "@/constants/market";
import { ART_SIZE, BORDER, OPACITY, PRESSED, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { findPlural } from "@/utils/trader";
import {
	boardBest,
	holdingOf,
	pigName,
	previewBoard,
	setsOf,
	type BoardCard,
	type MarketState,
	type PostSpec,
} from "@/utils/market";
import {
	Body,
	BodySm,
	Button,
	CardTitle,
	Hand,
	HandLg,
	IconButton,
	Kicker,
	KickerPill,
	Label,
	PageDots,
	SegmentedControl,
	Sheet,
	Sticker,
	T,
} from "../ui";
import { FindArt } from "../satchel/FindArt";
import { BullionArt, PriceChart } from "./MarketArt";
import { ONBOARDING, SHORT_NAME, qtyOf, setOf } from "./marketCopy";
import { Price, VsChip } from "./MarketViews";

const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const HINT_TILT = -0.6;

// ── The price move, drawn on its band ────────────────────────────────────────
const MOVE_H = 46;
const MOVE_TRACK = 8;
const MOVE_MARK = 12;

function MoveBand({ usual, from, to, lo, hi }: { usual: number; from: number; to: number; lo: number; hi: number }) {
	const pc = (p: number) => ((Math.max(lo, Math.min(hi, p)) - lo) / (hi - lo)) * 100;
	const a = pc(from);
	const b = pc(to);
	return (
		<View style={styles.move} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			<View style={styles.moveTrack} />
			<View style={[styles.moveArrow, { left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }]} />
			<View style={[styles.moveMark, { left: `${a}%` }]} />
			<View style={[styles.moveMark, styles.moveMarkTo, { left: `${b}%` }]} />
			<View style={styles.moveLabels}>
				<Kicker tone="secondary">{fmtPrice(lo)}</Kicker>
				<Kicker tone="secondary">{`usual ${usual}`}</Kicker>
				<Kicker tone="secondary">{fmtPrice(hi)}</Kicker>
			</View>
		</View>
	);
}

// ── Confirm ──────────────────────────────────────────────────────────────────

export type ConfirmTarget = { via: "counter"; findId: SatchelFindId; side: "buy" | "sell" } | { via: "board"; card: BoardCard };

export function ConfirmSheet({
	open,
	target,
	state,
	busy,
	onClose,
	onCounter,
	onTake,
	onSwitchToCard,
	onPostHere,
}: {
	open: boolean;
	target: ConfirmTarget | null;
	state: MarketState;
	busy: boolean;
	onClose: () => void;
	onCounter: (findId: SatchelFindId, side: "buy" | "sell", limit: number) => void;
	onTake: (card: BoardCard) => void;
	onSwitchToCard: (card: BoardCard) => void;
	onPostHere: (findId: SatchelFindId) => void;
}) {
	if (!target) return null;
	const coin = state.me.coin;

	if (target.via === "counter") {
		const f = state.finds.find((x) => x.id === target.findId);
		if (!f) return null;
		const buy = target.side === "buy";
		const price = buy ? f.ask : f.bid;
		const to = counterMove(f.usual, f.price, target.side, state.tuning);
		const h = holdingOf(state, f.id);
		const { sets } = setsOf(h, f.size);
		const best = boardBest(state.board, f.id);
		const blocked = buy ? (coin < price ? `You have ${coin} tickles ready.` : null) : !sets ? `You have ${h.held} of ${f.size}.` : null;
		return (
			<Sheet
				open={open}
				onClose={onClose}
				kicker="Bullion's counter"
				title={`${buy ? "Buy" : "Sell"} ${setOf(f.id, f.size)}`}
				footer={
					<Button variant={buy ? "gold" : "success"} full disabled={!!blocked} loading={busy} loadingLabel={buy ? "Buying" : "Selling"} onPress={() => onCounter(f.id, target.side, price)}>
						{`${buy ? "Buy" : "Sell"} for ${price}`}
					</Button>
				}
			>
				<View style={styles.cfTop}>
					<BullionArt pose="counter" size={ART_SIZE.thumb} />
					<View style={styles.flex}>
						<T role="sectionTitle">{`${buy ? "Buy" : "Sell"} for ${price}.`}</T>
						<HandLg>{`The price goes ${fmtPrice(f.price)} → ${fmtPrice(to)}.`}</HandLg>
						<Kicker tone="secondary">
							{buy ? "Every set bought here pushes it up 3% of the usual price." : "Every set sold here pulls it down 3% of the usual price."}
						</Kicker>
					</View>
				</View>
				<MoveBand usual={f.usual} from={f.price} to={to} lo={priceLo(f.usual, state.tuning)} hi={priceHi(f.usual, state.tuning)} />
				{buy && best.sale && (best.sale.price as number) < price ? (
					<HintBox
						kicker="Cheaper on the noticeboard"
						line={`${cap1(pigName(best.sale.poster))}'s ${best.sale.qty} for ${best.sale.price}`}
						cta="Buy that"
						onPress={() => onSwitchToCard(best.sale as BoardCard)}
					/>
				) : null}
				{!buy && best.wanted && (best.wanted.price as number) > price ? (
					<HintBox
						kicker="Pays more on the noticeboard"
						line={`${cap1(pigName(best.wanted.poster))} wants ${best.wanted.qty} for ${best.wanted.price}`}
						cta="Sell there"
						onPress={() => onSwitchToCard(best.wanted as BoardCard)}
					/>
				) : !buy ? (
					<HintBox
						kicker="Or sell high"
						line={`Pin it on the noticeboard between ${f.bid + 1} and ${f.ask - 1}: a pig pays more than ${f.bid}.`}
						cta="List it"
						onPress={() => onPostHere(f.id)}
					/>
				) : null}
				<Kicker tone="secondary" style={styles.gapT}>
					{`You have ${coin} tickles ready · ${h.held} ${findPlural(f.id)} in your bag`}
				</Kicker>
				{blocked ? <Body tone="danger">{blocked}</Body> : null}
			</Sheet>
		);
	}

	// A listing from the board.
	const live = state.board.find((c) => c.id === target.card.id);
	if (!live) {
		return (
			<Sheet open={open} onClose={onClose} kicker="The noticeboard" title="That listing is gone" footer={<Button variant="ghost" full onPress={onClose}>Back to the board</Button>}>
				<HandLg>Another pig got there first, or it was taken down.</HandLg>
			</Sheet>
		);
	}
	const c = live;
	const f = state.finds.find((x) => x.id === c.findId);
	if (!f) return null;
	const who = cap1(pigName(c.poster));
	let title: string;
	let body: React.ReactNode;
	let cta: string;
	let variant: "primary" | "success" | "lilac";
	let blocked: string | null = null;

	if (c.side === "swap" && c.wantFindId) {
		const wf = state.finds.find((x) => x.id === c.wantFindId);
		const wq = c.wantQty ?? 1;
		const have = holdingOf(state, c.wantFindId).held;
		const gv = f.price;
		const wv = wf ? (wf.price / wf.size) * wq : 0;
		title = `Swap with ${who}`;
		cta = "Swap straight up";
		variant = "lilac";
		if (have < wq) blocked = `You have ${have} of ${wq} ${wq === 1 ? findPlural(c.wantFindId).replace(/s$/, "") : findPlural(c.wantFindId)}.`;
		body = (
			<View style={styles.centered}>
				<View style={styles.row}>
					<FindArt id={c.wantFindId} size={ART_SIZE.glyph} />
					<T role="cardTitle">→</T>
					<FindArt id={c.findId} size={ART_SIZE.glyph} />
				</View>
				<T role="sectionTitle" style={styles.center}>{`Give ${qtyOf(c.wantFindId, wq)}, get ${setOf(c.findId, f.size)}.`}</T>
				<Body style={styles.center}>{`At today's price: ${qtyOf(c.wantFindId, wq)} ≈ ${Math.round(wv)} · ${setOf(c.findId, f.size)} ≈ ${Math.round(gv)}`}</Body>
				<Kicker tone="secondary" style={styles.center}>
					{`Straight up: no tickles change hooves and the price stays put.${c.forYou ? ` ${who} sent this to you.` : ""}`}
				</Kicker>
			</View>
		);
	} else {
		const price = c.price ?? 0;
		const buying = c.side === "sell";
		const to = pigMove(f.usual, f.price, price, state.tuning);
		const vsC = buying ? f.ask - price : price - f.bid;
		title = buying ? `Buy ${who === "A pig" ? "a pig's" : `${who}'s`} ${setOf(f.id, f.size)}` : `Sell ${setOf(f.id, f.size)} to ${pigName(c.poster)}`;
		cta = `${buying ? "Buy" : "Sell"} for ${price}`;
		variant = buying ? "primary" : "success";
		if (buying && coin < price) blocked = `You have ${coin} tickles ready.`;
		if (!buying && holdingOf(state, f.id).held < f.size) blocked = `You have ${holdingOf(state, f.id).held} of ${f.size}.`;
		body = (
			<View>
				<View style={styles.cfTop}>
					<FindArt id={f.id} size={ART_SIZE.thumb} />
					<View style={styles.flex}>
						<T role="sectionTitle">{`${buying ? "Buy" : "Sell"} for ${price}.`}</T>
						<HandLg>
							{buying
								? `Bullion charges ${f.ask}${vsC > 0 ? `: you save ${vsC}.` : "."}`
								: `Bullion would pay ${f.bid}${vsC > 0 ? `: +${vsC} for selling to a pig.` : "."}`}
						</HandLg>
						<Kicker tone="secondary">{`A pig sale nudges the price a third of the way to what was paid: ${fmtPrice(f.price)} → ${fmtPrice(to)}.`}</Kicker>
					</View>
				</View>
				<MoveBand usual={f.usual} from={f.price} to={to} lo={priceLo(f.usual, state.tuning)} hi={priceHi(f.usual, state.tuning)} />
				{c.forYou ? <Kicker tone="secondary" style={styles.gapT}>{`${who} sent this to you; nobody else can see it.`}</Kicker> : null}
			</View>
		);
	}
	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker={c.forYou ? `For you, from ${who}` : "The noticeboard"}
			title={title}
			footer={
				<Button variant={variant} full disabled={!!blocked} loading={busy} loadingLabel="Trading" onPress={() => onTake(c)}>
					{cta}
				</Button>
			}
		>
			{body}
			{blocked ? <Body tone="danger">{blocked}</Body> : null}
		</Sheet>
	);
}

function HintBox({ kicker, line, cta, onPress }: { kicker: string; line: string; cta: string; onPress: () => void }) {
	return (
		<Sticker color={WHIMSY.cream} rotate={HINT_TILT} pad style={styles.hint}>
			<View style={styles.flex}>
				<KickerPill>{kicker}</KickerPill>
				<Hand>{line}</Hand>
			</View>
			<Button variant="ghost" size="sm" onPress={onPress}>
				{cta}
			</Button>
		</Sticker>
	);
}

// ── Post a listing ───────────────────────────────────────────────────────────

export interface PostDraft {
	side: MarketSide;
	findId: SatchelFindId;
	price: number;
	wantFindId: SatchelFindId;
	wantQty: number;
	targetId: string | null;
}

/** A fresh draft: the asked side and find, falling back to a set you hold for sell/swap. */
export function newDraft(state: MarketState, side: MarketSide, findId: SatchelFindId, prev?: PostDraft | null): PostDraft {
	let s = side;
	let id = findId;
	const has = (x: SatchelFindId) => {
		const f = state.finds.find((ff) => ff.id === x);
		return f ? holdingOf(state, x).held >= f.size : false;
	};
	if ((s === "sell" || s === "swap") && !has(id)) {
		const held = state.finds.find((f) => has(f.id));
		if (held) id = held.id;
		else s = "buy";
	}
	const f = state.finds.find((x) => x.id === id);
	const want = prev?.wantFindId && prev.wantFindId !== id ? prev.wantFindId : (state.finds.find((x) => x.id !== id)?.id ?? "old_key");
	return {
		side: s,
		findId: id,
		price: f ? middle(f.bid, f.ask) : 1,
		wantFindId: want,
		wantQty: 1,
		targetId: prev?.targetId ?? null,
	};
}

const BAND_H = 18;
// A find chip: wide enough for its short name under the glyph.
const FIND_CHIP_MIN_W = 68;
const BAND_MARK = 24;

export function PostSheet({
	open,
	draft,
	setDraft,
	state,
	busy,
	error,
	onClose,
	onPost,
}: {
	open: boolean;
	draft: PostDraft;
	setDraft: (d: PostDraft) => void;
	state: MarketState;
	busy: boolean;
	error: string | null;
	onClose: () => void;
	onPost: (spec: PostSpec) => void;
}) {
	const [bandW, setBandW] = useState(1);
	const f = state.finds.find((x) => x.id === draft.findId);
	if (!f) return null;
	const side = draft.side;
	const h = holdingOf(state, f.id);
	const { sets } = setsOf(h, f.size);
	const coin = state.me.coin;
	const range = postRange(f.usual, f.bid, f.ask);
	const price = Math.max(range.min, Math.min(range.max, draft.price));
	const set = (patch: Partial<PostDraft>) => setDraft({ ...draft, ...patch });
	const openFull = state.me.offers.length >= state.tuning.openOffers;

	const order =
		side === "buy"
			? state.finds
			: [...state.finds.filter((x) => holdingOf(state, x.id).held >= x.size), ...state.finds.filter((x) => holdingOf(state, x.id).held < x.size)];

	let verdict = "";
	let verdictTone: "good" | "warn" | "plain" = "plain";
	let label = "";
	let blocked: string | null = null;
	let fills = false;

	if (side === "swap") {
		const wf = state.finds.find((x) => x.id === draft.wantFindId) ?? state.finds.find((x) => x.id !== f.id);
		const maxQ = wf?.size ?? 3;
		const qty = Math.max(1, Math.min(maxQ, draft.wantQty));
		const gv = f.price;
		const wv = wf ? (wf.price / wf.size) * qty : 0;
		const v = swapVerdict(gv, wv);
		verdict =
			v === "asking_more"
				? `You're asking a little more than you give at today's price. A pig who needs ${wf ? findPlural(wf.id) : "them"} may still take it.`
				: v === "giving_more"
					? "You're giving more than you ask at today's price. A pig will snap it up."
					: "Fair at today's price. A swap doesn't move either price.";
		verdictTone = v === "fair" ? "good" : v === "giving_more" ? "warn" : "plain";
		label = wf ? `Pin it: ${setOf(f.id, f.size)} for ${qtyOf(wf.id, qty)}` : "Pin it";
		if (sets < 1) blocked = `You have ${h.held} ${findPlural(f.id)}; a swap gives a set of ${f.size}.`;
		else if (openFull) blocked = `You have ${state.tuning.openOffers} listings up. Take one down to pin another.`;
	} else {
		const pv = previewList(side, f.id, price, f.bid, f.ask, previewBoard(state.board), draft.targetId);
		fills = pv.fills != null;
		if (side === "sell") {
			if (pv.fills === "pig") {
				verdict = `${cap1(pigName(state.board.find((c) => c.id === pv.offer.id)?.poster))}'s wanted ad pays ${pv.at}: it sells now, ${pv.at - f.bid} more than Bullion pays.`;
				verdictTone = "good";
				label = `Sell to ${pigName(state.board.find((c) => c.id === pv.offer.id)?.poster)} for ${pv.at}`;
			} else if (pv.fills === "counter") {
				verdict = `At ${f.bid} or under, Bullion buys it at once for ${f.bid}. You get his price, and the price drops.`;
				verdictTone = "warn";
				label = `Sell to Bullion now for ${f.bid}`;
			} else if (pv.sits) {
				verdict = `At ${f.ask} or over it will just sit: a buyer would go to Bullion for ${f.ask}.`;
				verdictTone = "warn";
				label = `Pin it anyway: ${price}`;
			} else {
				verdict = `Between his prices: you beat Bullion's ${f.bid}, and a buyer beats his ${f.ask}.`;
				verdictTone = "good";
				label = `Pin it: ${setOf(f.id, f.size)} for ${price}`;
			}
			if (sets < 1) blocked = `You have ${h.held} ${findPlural(f.id)}; a set is ${f.size}.`;
		} else {
			const buyTotal = state.me.offers.filter((o) => o.side === "buy").reduce((t, o) => t + (o.price ?? 0), 0);
			const need = buyTotal + price;
			if (pv.fills === "pig") {
				verdict = `${cap1(pigName(state.board.find((c) => c.id === pv.offer.id)?.poster))}'s listing is ${pv.at}: you buy it now, ${f.ask - pv.at} under the counter.`;
				verdictTone = "good";
				label = `Buy from ${pigName(state.board.find((c) => c.id === pv.offer.id)?.poster)} for ${pv.at}`;
			} else if (pv.fills === "counter") {
				verdict = `At ${f.ask} or over, Bullion sells you a set at once for ${f.ask}. You get his price, and the price rises.`;
				verdictTone = "warn";
				label = `Buy from Bullion now for ${f.ask}`;
			} else if (pv.sits) {
				verdict = `At ${f.bid} or under it will just sit: a seller would go to Bullion for ${f.bid}.`;
				verdictTone = "warn";
				label = `Pin it anyway: ${price}`;
			} else {
				verdict = `Between his prices: a seller beats Bullion's ${f.bid}, and you beat his ${f.ask}.`;
				verdictTone = "good";
				label = `Pin it: wanted, ${setOf(f.id, f.size)} for ${price}`;
			}
			if (coin < need) blocked = `Not set aside, but you need ${need} tickles ready for all your wanted ads (you have ${coin}).`;
		}
		if (!blocked && openFull && !fills) blocked = `You have ${state.tuning.openOffers} listings up. Take one down to pin another.`;
	}

	const span = Math.max(1, range.max - range.min);
	const frac = (v: number) => (Math.max(range.min, Math.min(range.max, v)) - range.min) / span;
	const bidF = frac(f.bid);
	const askF = frac(f.ask);
	const crossL = side === "sell" ? [0, bidF] : [askF, 1];
	const sitL = side === "sell" ? [askF, 1] : [0, bidF];
	const onBand = (e: GestureResponderEvent) => {
		const x = e.nativeEvent.locationX;
		set({ price: Math.round(range.min + (Math.max(0, Math.min(bandW, x)) / bandW) * span) });
	};
	const target = state.friends.find((fr) => fr.id === draft.targetId);
	const friendsShown = state.friends.slice(0, 3);
	const info =
		(target ? `Only ${target.name} sees it, on the noticeboard under For you. ` : "") +
		(side === "buy"
			? "Not set aside: paid when a pig fills it, and it lapses if you've tickled the tickles away."
			: "Your set leaves your bag while it's pinned; take it down any time and it comes home.") +
		` Up to ${state.tuning.openOffers} listings, ${state.tuning.offerHours} hours each.`;

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="The noticeboard"
			title="Post a listing"
			footer={
				<Button
					variant={side === "swap" ? "lilac" : "gold"}
					full
					disabled={!!blocked}
					loading={busy}
					loadingLabel="Pinning"
					onPress={() =>
						onPost({
							side,
							findId: f.id,
							price: side === "swap" ? null : price,
							wantFindId: side === "swap" ? draft.wantFindId : null,
							wantQty: side === "swap" ? draft.wantQty : null,
							targetId: draft.targetId,
						})
					}
				>
					{label}
				</Button>
			}
		>
			<SegmentedControl<MarketSide>
				label="What kind of listing"
				value={side}
				onChange={(s) => setDraft(newDraft(state, s, draft.findId, draft))}
				options={[
					{ value: "sell", label: "For sale" },
					{ value: "buy", label: "Wanted" },
					{ value: "swap", label: "Swap" },
				]}
			/>
			<View style={styles.lab}>
				<KickerPill>{side === "buy" ? "A set you want" : "A set you hold"}</KickerPill>
				<Kicker tone="secondary">{side === "buy" ? "any find" : "four of a common, three of the rest"}</Kicker>
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fpick}>
				{order.map((x) => {
					const hx = holdingOf(state, x.id);
					const ok = side === "buy" || hx.held >= x.size;
					const s2 = setsOf(hx, x.size);
					return (
						<FindChip
							key={x.id}
							id={x.id}
							on={x.id === f.id}
							disabled={!ok}
							sub={side === "buy" ? `price ${fmtPrice(x.price)}` : s2.sets ? `${s2.sets} ${s2.sets === 1 ? "set" : "sets"}` : `${hx.held} of ${x.size}`}
							onPress={() => setDraft({ ...newDraft(state, side, x.id, draft), side })}
						/>
					);
				})}
			</ScrollView>

			{side === "swap" ? (
				<SwapPicker state={state} draft={draft} set={set} />
			) : (
				<View>
					<View style={styles.bigPrice}>
						<IconButton name="minus" label="One less" disabled={price <= range.min} onPress={() => set({ price: price - 1 })} />
						<Price n={price} role="numeralLg" />
						<IconButton name="plus" label="One more" disabled={price >= range.max} onPress={() => set({ price: price + 1 })} />
					</View>
					<View style={styles.centerRow}>
						<VsChip vs={vsPrice(price, f.price)} />
						<Kicker tone="secondary">{`a set of ${f.size} · ${eachWord(price, f.size)}`}</Kicker>
					</View>
					<Pressable
						onPress={onBand}
						onLayout={(e) => setBandW(e.nativeEvent.layout.width)}
						accessibilityRole="adjustable"
						accessibilityLabel="Price per set"
						accessibilityValue={{ min: range.min, max: range.max, now: price, text: `${price} tickles, ${vsPrice(price, f.price).word}` }}
						accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
						onAccessibilityAction={(e) => {
							if (e.nativeEvent.actionName === "increment") set({ price: Math.min(range.max, price + 1) });
							if (e.nativeEvent.actionName === "decrement") set({ price: Math.max(range.min, price - 1) });
						}}
						style={styles.band}
					>
						<View style={[styles.zone, { left: `${crossL[0] * 100}%`, width: `${(crossL[1] - crossL[0]) * 100}%`, backgroundColor: WHIMSY.sun }]} />
						<View style={[styles.zone, { left: `${bidF * 100}%`, width: `${(askF - bidF) * 100}%`, backgroundColor: WHIMSY.sage }]} />
						<View style={[styles.zone, { left: `${sitL[0] * 100}%`, width: `${(sitL[1] - sitL[0]) * 100}%`, backgroundColor: WHIMSY.cream2 }]} />
						<View style={[styles.bandMark, { left: `${frac(price) * 100}%` }]} pointerEvents="none" />
					</Pressable>
					<View style={styles.bandLabels}>
						<Kicker tone="secondary">{`I buy ${f.bid}`}</Kicker>
						<Kicker tone="secondary">{`middle ${middle(f.bid, f.ask)}`}</Kicker>
						<Kicker tone="secondary">{`I sell ${f.ask}`}</Kicker>
					</View>
				</View>
			)}

			<Sticker
				color={verdictTone === "good" ? WHIMSY.sage : verdictTone === "warn" ? WHIMSY.sun : WHIMSY.cream}
				rotate={0}
				pad
				shadow="none"
				style={styles.gapT}
				accessibilityRole="text"
			>
				<HandLg>{verdict}</HandLg>
			</Sticker>

			<View style={styles.lab}>
				<KickerPill>Who sees it</KickerPill>
			</View>
			<SegmentedControl<string>
				label="Who sees it"
				value={draft.targetId ?? ""}
				onChange={(v) => set({ targetId: v || null })}
				options={[{ value: "", label: "Everyone" }, ...friendsShown.map((fr) => ({ value: fr.id, label: `Just ${fr.name}` }))]}
			/>
			{state.friends.length > friendsShown.length ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fpick}>
					{state.friends.slice(friendsShown.length).map((fr) => (
						<Button key={fr.id} variant={draft.targetId === fr.id ? "gold" : "ghost"} size="xs" onPress={() => set({ targetId: fr.id })}>
							{`Just ${fr.name}`}
						</Button>
					))}
				</ScrollView>
			) : null}
			<Kicker tone="secondary" style={styles.gapT}>{info}</Kicker>
			{error ? <Body tone="danger">{error}</Body> : blocked ? <Body tone="danger">{blocked}</Body> : null}
		</Sheet>
	);
}

function FindChip({ id, on, disabled, sub, onPress }: { id: SatchelFindId; on: boolean; disabled?: boolean; sub: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityState={{ selected: on, disabled }}
			accessibilityLabel={`${cap1(findPlural(id))}, ${sub}`}
			style={({ pressed }) => [styles.fbtn, on && styles.fbtnOn, disabled && styles.fbtnOff, pressed && styles.pressed]}
		>
			<FindArt id={id} size={ART_SIZE.glyphMd} silhouette={disabled} />
			<Label>{SHORT_NAME[id]}</Label>
			<Kicker tone="secondary">{sub}</Kicker>
		</Pressable>
	);
}

function SwapPicker({ state, draft, set }: { state: MarketState; draft: PostDraft; set: (p: Partial<PostDraft>) => void }) {
	const f = state.finds.find((x) => x.id === draft.findId);
	const want = state.finds.find((x) => x.id === draft.wantFindId && x.id !== draft.findId) ?? state.finds.find((x) => x.id !== draft.findId);
	if (!f || !want) return null;
	const qty = Math.max(1, Math.min(want.size, draft.wantQty));
	return (
		<View>
			<View style={styles.lab}>
				<KickerPill>Ask for</KickerPill>
				<Kicker tone="secondary">{`1 to ${want.size} of one other find`}</Kicker>
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fpick}>
				{state.finds
					.filter((x) => x.id !== f.id)
					.map((x) => (
						<FindChip key={x.id} id={x.id} on={x.id === want.id} sub={`${fmtPrice(x.price / x.size)} each`} onPress={() => set({ wantFindId: x.id, wantQty: Math.min(qty, x.size) })} />
					))}
			</ScrollView>
			<View style={styles.bigPrice}>
				<IconButton name="minus" label="One fewer" disabled={qty <= 1} onPress={() => set({ wantQty: qty - 1, wantFindId: want.id })} />
				<View style={styles.centered}>
					<View style={styles.row}>
						<FindArt id={f.id} size={ART_SIZE.glyphMd} />
						<T role="cardTitle">⇄</T>
						<FindArt id={want.id} size={ART_SIZE.glyphMd} />
					</View>
					<CardTitle>{`${setOf(f.id, f.size)} for ${qtyOf(want.id, qty)}`}</CardTitle>
				</View>
				<IconButton name="plus" label="One more" disabled={qty >= want.size} onPress={() => set({ wantQty: qty + 1, wantFindId: want.id })} />
			</View>
			<Body style={styles.center}>{`Both sides at today's price: ${setOf(f.id, f.size)} ≈ ${Math.round(f.price)} · ${qtyOf(want.id, qty)} ≈ ${Math.round((want.price / want.size) * qty)}`}</Body>
		</View>
	);
}

// ── Your bag ─────────────────────────────────────────────────────────────────

export function BagSheet({ open, state, onClose, onOpen }: { open: boolean; state: MarketState; onClose: () => void; onOpen: (id: SatchelFindId) => void }) {
	const net = state.me.tookIn - state.me.spent;
	return (
		<Sheet open={open} onClose={onClose} kicker="Your bag" title="What you hold">
			<BodySm>
				{`${state.me.coin} tickles ready · spent ${state.me.spent} · took in ${state.me.tookIn} · `}
				<T role="bodySm" tone={net > 0 ? "success" : net < 0 ? "danger" : "secondary"}>{gainWord(net)}</T>
			</BodySm>
			<View style={styles.bagGrid}>
				{state.finds.map((f) => {
					const h = holdingOf(state, f.id);
					const { sets, spare } = setsOf(h, f.size);
					const dug = h.held - h.paidUnits;
					const cost = !h.held ? "none" : h.paidUnits ? `${h.paidUnits} paid ${h.paid}${dug ? `, ${dug} dug` : ""}` : "all dug up";
					const setsLine = h.held ? (sets ? `${sets} ${sets === 1 ? "set" : "sets"}${spare ? ` + ${spare}` : ""}` : `${h.held} of ${f.size}`) : `set of ${f.size}`;
					return (
						<Pressable
							key={f.id}
							onPress={() => onOpen(f.id)}
							accessibilityRole="button"
							accessibilityLabel={`${cap1(findPlural(f.id))}: ${h.held}, ${setsLine}, ${cost}`}
							style={({ pressed }) => [styles.bagT, !h.held && styles.fbtnOff, pressed && styles.pressed]}
						>
							<FindArt id={f.id} size={ART_SIZE.glyph} silhouette={!h.held} />
							<T role="numeral">{String(h.held)}</T>
							<Label>{setsLine}</Label>
							<Kicker tone="secondary">{cost + (h.onOffer ? ` · ${h.onOffer} pinned up` : "")}</Kicker>
						</Pressable>
					);
				})}
			</View>
		</Sheet>
	);
}

// ── Onboarding ───────────────────────────────────────────────────────────────

export function OnboardSheet({
	open,
	state,
	onClose,
	onDone,
	ticksPerDay,
}: {
	open: boolean;
	state: MarketState;
	onClose: () => void;
	onDone: () => void;
	ticksPerDay: number;
}) {
	const [i, setI] = useState(0);
	const { width } = useWindowDimensions();
	const card = ONBOARDING[i];
	const pine = state.finds.find((f) => f.id === "pinecone") ?? state.finds[0];
	const key = state.finds.find((f) => f.id === "old_key") ?? state.finds[0];
	let art: React.ReactNode = <BullionArt pose="counter" size={ART_SIZE.portrait} />;
	if (i === 1 && pine) {
		art = (
			<View style={styles.slate}>
				<View style={styles.row}>
					<BullionArt pose="stand" size={ART_SIZE.glyph} />
					<View>
						<T role="cardTitleSm" tone="onDark">{`${cap1(findPlural(pine.id))}, live`}</T>
						<T role="kicker" tone="onDarkMute">{`the price ${fmtPrice(pine.price)} · I sell ${pine.ask} · I buy ${pine.bid}`}</T>
					</View>
				</View>
				<PriceChart
					width={width - 2 * SPACE.xl - 2 * SPACE.card}
					usual={pine.usual}
					price={pine.price}
					ask={pine.ask}
					bid={pine.bid}
					hist={pine.spark.slice(-ticksPerDay - 1)}
					tuning={state.tuning}
					ticksPerDay={ticksPerDay}
					mini
					accessibilityLabel={`${cap1(findPlural(pine.id))} over the last day: the price ${fmtPrice(pine.price)}, Bullion sells at ${pine.ask} and buys at ${pine.bid}.`}
				/>
			</View>
		);
	}
	if (i === 2 && pine && key) {
		const m = middle(pine.bid, pine.ask);
		art = (
			<View style={[styles.row, styles.miniBoard]}>
				<Sticker color="paper" rotate={-1.2} pad style={styles.flex}>
					<KickerPill>For sale</KickerPill>
					<View style={styles.row}>
						<FindArt id={pine.id} size={ART_SIZE.glyphSm} />
						<Label>{setOf(pine.id, pine.size)}</Label>
					</View>
					<Price n={m} role="numeral" />
					<VsChip vs={vsPrice(m, pine.price)} />
				</Sticker>
				<Sticker color={WHIMSY.lilac} rotate={0.8} pad style={styles.flex}>
					<KickerPill>Swap</KickerPill>
					<View style={styles.row}>
						<FindArt id={pine.id} size={ART_SIZE.glyphSm} />
						<Label>{setOf(pine.id, pine.size)}</Label>
					</View>
					<Kicker>{`for ${qtyOf(key.id, 1)}`}</Kicker>
					<Kicker tone="secondary">{`≈ ${Math.round(pine.price)} · ≈ ${Math.round(key.price / key.size)}`}</Kicker>
				</Sticker>
			</View>
		);
	}
	return (
		<Sheet
			open={open}
			onClose={() => {
				setI(0);
				onClose();
			}}
			kicker="Bullion's Market · new here?"
			title={card.title}
			footer={
				<View style={styles.two}>
					{i === 0 ? (
						<Button variant="ghost" onPress={onClose} style={styles.flex}>Not now</Button>
					) : (
						<Button variant="ghost" onPress={() => setI(i - 1)} style={styles.flex}>Back</Button>
					)}
					{i < ONBOARDING.length - 1 ? (
						<Button variant="gold" onPress={() => setI(i + 1)} style={styles.flex}>Next</Button>
					) : (
						<Button
							variant="gold"
							onPress={() => {
								setI(0);
								onDone();
							}}
							style={styles.flex}
						>
							Step up to the counter
						</Button>
					)}
				</View>
			}
		>
			<PageDots count={ONBOARDING.length} index={i} />
			<View style={styles.obArt}>{art}</View>
			<Sticker color="paper" rotate={HINT_TILT} pad shadow="none">
				<HandLg>{card.say}</HandLg>
			</Sticker>
		</Sheet>
	);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	two: { flexDirection: "row", gap: SPACE.md },
	gapT: { marginTop: SPACE.md },
	center: { textAlign: "center" },
	centered: { alignItems: "center", gap: SPACE.xs },
	centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, flexWrap: "wrap" },
	pressed: PRESSED,

	cfTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	move: { height: MOVE_H, marginTop: SPACE.lg, justifyContent: "flex-start" },
	moveTrack: { height: MOVE_TRACK, borderRadius: RADII.pill, backgroundColor: WHIMSY.cream2, borderWidth: BORDER.hair, borderColor: WHIMSY.ink },
	moveArrow: { position: "absolute", top: 0, height: MOVE_TRACK, backgroundColor: WHIMSY.sun, borderRadius: RADII.pill },
	moveMark: {
		position: "absolute",
		top: (MOVE_TRACK - MOVE_MARK) / 2,
		width: MOVE_MARK,
		height: MOVE_MARK,
		marginLeft: -MOVE_MARK / 2,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
	},
	moveMarkTo: { backgroundColor: WHIMSY.sun },
	moveLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm },
	hint: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginTop: SPACE.md },

	lab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.lg, marginBottom: SPACE.xs },
	fpick: { gap: SPACE.sm, paddingVertical: SPACE.xs },
	fbtn: {
		alignItems: "center",
		minWidth: FIND_CHIP_MIN_W,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
	},
	fbtnOn: { backgroundColor: WHIMSY.sun, borderWidth: BORDER.ink },
	fbtnOff: { opacity: OPACITY.dim },
	bigPrice: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xl, marginTop: SPACE.md },
	band: {
		height: BAND_H,
		marginTop: SPACE.lg,
		marginHorizontal: BAND_MARK / 2,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		overflow: "visible",
	},
	zone: { position: "absolute", top: 0, bottom: 0 },
	bandMark: {
		position: "absolute",
		top: (BAND_H - BAND_MARK) / 2 - BORDER.ink,
		width: BAND_MARK,
		height: BAND_MARK,
		marginLeft: -BAND_MARK / 2,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.ink,
	},
	bandLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm },

	bagGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.md },
	bagT: {
		width: "31%",
		flexGrow: 1,
		alignItems: "center",
		padding: SPACE.sm,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
	},

	obArt: { alignItems: "center", marginVertical: SPACE.md },
	slate: { backgroundColor: WHIMSY.bark, borderRadius: RADII.lg, borderWidth: BORDER.ink, borderColor: WHIMSY.ink, padding: SPACE.card, gap: SPACE.sm },
	miniBoard: { backgroundColor: WHIMSY.cork, borderRadius: RADII.lg, borderWidth: BORDER.ink, borderColor: WHIMSY.ink, padding: SPACE.md, alignItems: "flex-start" },
});
