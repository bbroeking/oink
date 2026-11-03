// Bullion's Market — one price, two ways to trade (2026-10-31).
// Design: the round-4 playable prototype (https://claude.ai/artifact/P1zcYweBHJbd4XYJtUi9dA);
// spec docs/design/market-2026-10-31/bullions-market.md. Reached from the
// Barn button's fan.
//
// Four places inside one route (a small stack of its own, so the back
// affordance walks Find → Counter → Market → out): the market home, the
// Counter (Part 1, chalk), a find up close, and the Noticeboard (Part 2,
// cork). A bar pinned at the bottom carries the place's actions: on a find,
// Buy / Sell at Bullion's prices and "put it on the noticeboard instead"; on
// the board, Post a listing. Every trade goes through a confirm sheet that
// shows where the price goes before the tap; its receipt lands as Bullion's
// card at the top. New pigs get three onboarding cards on the first visit,
// then a nudge to their first sale at the counter (or, with no full set yet,
// a card that says what to do first).
//
// A lost answer (the write went out, nothing came back) may have traded: the
// open sheet says so in place and keeps that exact trade's nonce until a
// definite answer arrives, so the retry, even after closing and reopening the
// sheet on the same find, side and price, replays it instead of trading twice.
//
// Reached from the Barn's fan and from a market push ("an offer for you",
// "your listing sold"); a push can open it cold with nothing behind it, so
// the way out with no history goes to the Barn.
//
// With the market's switch off, the screen is one card: Bullion has packed up,
// and your own listings stay below it with Take down, so nothing you pinned is
// stranded while he is away.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import type { SatchelFindId } from "@/constants/satchel";
import { BORDER, PAGE_PAD, SPACE, WHIMSY } from "@/constants/theme";
import {
	Button,
	EmptyState,
	LoadingBeat,
	PageHeader,
	STACK_SCROLL_EDGES,
	StackPage,
	T,
	TickleIcon,
	useStackScrollPad,
} from "@/components/ui";
import { BoardView, CounterView, FindView, MarketHome, MyListings, type BoardFilter } from "@/components/market/MarketViews";
import {
	BagSheet,
	ConfirmSheet,
	OnboardSheet,
	PostSheet,
	newDraft,
	type ConfirmTarget,
	type PostDraft,
} from "@/components/market/MarketSheets";
import { ReceiptStack, keepReceipt, useReceipts, type PushOpts } from "@/components/market/ReceiptStack";
import { MARKET_MOMENT_KEYS, MARKET_ONBOARDED_KEY, MARKET_TUNING, wanderingHome } from "@/constants/market";
import {
	LOST_ANSWER,
	firstStepsCard,
	movedMoment,
	noticeReceipt,
	pinnedReceipt,
	quietMoment,
	refusalReceipt,
	setOf,
	soldHighMoment,
	takeDownReceipt,
	tradeReceipt,
	type MarketReceipt,
} from "@/components/market/marketCopy";
import { draftSpec } from "@/components/market/MarketSheets";
import { useMarket } from "@/hooks/useMarket";
import { useTrader } from "@/hooks/useTrader";
import {
	createNonceBook,
	findOf,
	holdingOf,
	isIndefinite,
	marketWriteKey,
	setsOf,
	type BoardCard,
	type MarketFindView,
	type MarketNotice,
	type MarketOutcome,
	type MarketState,
	type PostSpec,
} from "@/utils/market";

type Place = "home" | "counter" | "find" | "board";

const SAY_TURN_MS = 12_000;
// The confirm sheet's slide-out, before the post sheet slides in.
const POST_AFTER_CONFIRM_MS = 350;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The exact trade a confirm sheet would make, as the nonce book keys it. */
function confirmKeyOf(t: ConfirmTarget, s: MarketState): string | null {
	if (t.via === "board") return marketWriteKey({ via: "take", offerId: t.card.id, limit: t.card.side === "sell" ? t.card.price : null });
	const f = findOf(s, t.findId);
	return f ? marketWriteKey({ via: "counter", findId: f.id, side: t.side, limit: t.side === "buy" ? f.ask : f.bid }) : null;
}

type PendingMoment = { timer: ReturnType<typeof setTimeout> | null; id: number | null; findId: SatchelFindId | null };

export default function MarketScreen() {
	const insets = useSafeAreaInsets();
	const scrollPad = useStackScrollPad();
	// Notices arrive from the hook's read; the receipt queue is declared below
	// (it holds while a sheet is open), so they reach it through a ref. Until
	// it is wired, a kept notice still goes to the device (restored below).
	const pushRef = useRef<(r: MarketReceipt, opts?: PushOpts) => number | null>((r, opts) => {
		if (opts?.keep) void keepReceipt(opts.keep, r);
		return null;
	});
	// The one-time moments: once per install (a device flag, written when the
	// card is actually on screen) and once per visit (this ref, so two
	// triggers in one breath can't both play one).
	const momentsRef = useRef(new Set<string>());
	// Moments waiting to show: their delay timer, then their queued card. The
	// quiet drift belongs to one find and is taken back if the pig leaves it.
	const pendingMoments = useRef(new Map<string, PendingMoment>());
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		const pending = pendingMoments.current;
		return () => {
			mountedRef.current = false;
			for (const m of pending.values()) if (m.timer) clearTimeout(m.timer);
			pending.clear();
		};
	}, []);
	const playMoment = useCallback(async (key: string, r: MarketReceipt | null, delayMs: number, findId: SatchelFindId | null = null) => {
		if (!r || momentsRef.current.has(key)) return;
		momentsRef.current.add(key);
		const flag = await AsyncStorage.getItem(key).catch(() => null);
		if (flag === "1" || !mountedRef.current) return;
		const m: PendingMoment = { timer: null, id: null, findId };
		m.timer = setTimeout(() => {
			m.timer = null;
			m.id = pushRef.current(r, {
				urgent: true,
				onShow: () => {
					pendingMoments.current.delete(key);
					void AsyncStorage.setItem(key, "1");
				},
			});
		}, delayMs);
		pendingMoments.current.set(key, m);
	}, []);
	// Notice ids already queued this visit (a late read and a fresh one may
	// overlap); each is kept on the device until its card has been on screen.
	const noticeIds = useRef(new Set<number>());
	const onNotices = useCallback((ns: MarketNotice[], s: MarketState) => {
		for (const n of ns) {
			if (noticeIds.current.has(n.id)) continue;
			noticeIds.current.add(n.id);
			const r = noticeReceipt(n, s.tuning, s.friends);
			if (r) pushRef.current(r, { keep: `${s.me.id}:${n.id}` });
			// A listing a pig bought for more than Bullion would have paid.
			if (n.trade) void playMoment(MARKET_MOMENT_KEYS.soldHigh, soldHighMoment(n.trade), 1400);
		}
	}, [playMoment]);
	const market = useMarket({ onNotices });
	const trader = useTrader();
	const state = market.state;
	const closed = market.closed;
	const closedRef = useRef(false);
	useEffect(() => {
		closedRef.current = closed != null;
	}, [closed]);

	const [stack, setStack] = useState<Place[]>(["home"]);
	const place = stack[stack.length - 1];
	const [findId, setFindId] = useState<SatchelFindId>("pinecone");
	const [findView, setFindView] = useState<MarketFindView | null>(null);
	const [boardF, setBoardF] = useState<BoardFilter>("all");
	const [boardShown, setBoardShown] = useState<number>(BoardView.PAGE);
	const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
	const [draft, setDraft] = useState<PostDraft | null>(null);
	const [postError, setPostError] = useState<string | null>(null);
	const [bagOpen, setBagOpen] = useState(false);
	const [obOpen, setObOpen] = useState(false);
	const [onboarded, setOnboarded] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [busyId, setBusyId] = useState<number | null>(null);
	// The open sheet's write went out and never heard back (cleared when a
	// sheet opens; the nonce book remembers it per target past that).
	const [sheetLost, setSheetLost] = useState(false);
	const [lostKeys, setLostKeys] = useState<ReadonlySet<string>>(() => new Set());
	const [findFailed, setFindFailed] = useState(false);
	const [findTry, setFindTry] = useState(0);
	const [sayTurn, setSayTurn] = useState(0);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [barH, setBarH] = useState(0);
	const scrollRef = useRef<ScrollView>(null);
	// The in-route stack, readable outside a state updater (navigation side
	// effects must never run inside one).
	const stackRef = useRef(stack);
	useEffect(() => {
		stackRef.current = stack;
	}, [stack]);
	// One nonce per exact trade until it has a definite answer: a double tap,
	// or a retry after a lost answer (even from a reopened sheet), is the
	// same trade. A second tap while one is out is dropped outright.
	const [nonces] = useState(createNonceBook);
	const writingRef = useRef(false);

	// First visit: the three cards.
	useEffect(() => {
		let cancelled = false;
		void AsyncStorage.getItem(MARKET_ONBOARDED_KEY).then((v) => {
			if (cancelled) return;
			setOnboarded(v === "1");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	// Shown on its own the first time (until finished or put off with "Not
	// now" for this visit), and again from "How does the market work?".
	const [obSkipped, setObSkipped] = useState(false);
	const showOb = obOpen || (onboarded === false && state != null && !obSkipped);

	// Receipts wait while any sheet covers the screen (or is about to: the
	// post sheet's short wait for the confirm sheet to leave).
	const [postPending, setPostPending] = useState(false);
	const postTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => {
		if (postTimer.current) clearTimeout(postTimer.current);
	}, []);
	const sheetOpen = confirm != null || draft != null || bagOpen || showOb || postPending;
	// Shut, no sheet draws, so nothing holds the receipts (a take-down's answer).
	const receipts = useReceipts(sheetOpen && !closed);
	useEffect(() => {
		pushRef.current = receipts.push;
	}, [receipts.push]);
	// This pig's notices that never made it on screen last time.
	const uid = state?.me.id;
	const restoreReceipts = receipts.restore;
	useEffect(() => {
		if (uid) void restoreReceipts(`${uid}:`);
	}, [uid, restoreReceipts]);
	// A queued moment that belongs to one find is taken back once the pig has
	// left that find (unless it is already on screen: then it plays out).
	const withdrawReceipt = receipts.withdraw;
	useEffect(() => {
		for (const [key, m] of pendingMoments.current) {
			if (!m.findId || (place === "find" && findId === m.findId)) continue;
			if (m.timer) clearTimeout(m.timer);
			else if (m.id != null && !withdrawReceipt(m.id)) continue;
			pendingMoments.current.delete(key);
			// Never seen, so it may play another time.
			momentsRef.current.delete(key);
		}
	}, [place, findId, withdrawReceipt]);

	// Bullion turns his line, and the board's clocks tick.
	useEffect(() => {
		const id = setInterval(() => {
			setSayTurn((t) => t + 1);
			setNowMs(Date.now());
		}, SAY_TURN_MS);
		return () => clearInterval(id);
	}, []);

	// A find's chart: on open, and again whenever the market re-reads. A read
	// that fails keeps the chart already drawn; with none, it says so with a retry.
	const loadFind = market.loadFind;
	const stateTick = state?.tick;
	const tapeHead = state?.tape[0]?.id;
	useEffect(() => {
		if (place !== "find") return;
		let cancelled = false;
		void loadFind(findId).then((v) => {
			if (cancelled) return;
			if (v) setFindView(v);
			setFindFailed(!v);
		});
		return () => {
			cancelled = true;
		};
	}, [place, findId, loadFind, stateTick, tapeHead, findTry]);
	const retryFind = useCallback(() => {
		setFindFailed(false);
		setFindTry((n) => n + 1);
	}, []);

	const go = useCallback((p: Place) => {
		setStack((s) => (s[s.length - 1] === p ? s : [...s, p]));
		scrollRef.current?.scrollTo({ y: 0, animated: false });
	}, []);
	// Out of the market: back where the pig came from, or to the Barn when a
	// push or a link opened the market cold with nothing behind it.
	const leave = useCallback(() => {
		if (router.canGoBack()) router.back();
		else router.replace("/(tabs)");
	}, []);
	const back = useCallback(() => {
		if (stackRef.current.length <= 1 || closedRef.current) leave();
		else setStack((s) => s.slice(0, -1));
	}, [leave]);
	// Deeper than the market home, the iOS edge swipe is off (the native
	// stack would remove the whole route behind JS's back; the header's back
	// walks the in-route stack) and Android's back pops one place; at the
	// market home with no history it goes to the Barn instead of closing the
	// app. Nothing else is intercepted, so a sign-out, a deep link or a
	// replace still leaves.
	const navigation = useNavigation();
	// Shut, the screen is one place whatever the stack held: back leaves.
	const deep = stack.length > 1 && closed == null;
	useEffect(() => {
		navigation.setOptions({ gestureEnabled: !deep });
	}, [navigation, deep]);
	useEffect(() => {
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			if (stackRef.current.length > 1 && !closedRef.current) {
				setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
				return true;
			}
			if (router.canGoBack()) return false;
			router.replace("/(tabs)");
			return true;
		});
		return () => sub.remove();
	}, []);
	const openFind = useCallback(
		(id: SatchelFindId) => {
			setFindId(id);
			setFindView(null);
			setFindFailed(false);
			setBagOpen(false);
			go("find");
		},
		[go],
	);

	// The Ghost Sheep: what he fancies (only once he is here) and what he pays.
	const fancy = trader.present ? (trader.status.visit?.wantFindId ?? null) : null;
	const sheepEachFor = useCallback(
		(id: SatchelFindId): number | null => {
			const f = state?.finds.find((x) => x.id === id);
			if (!f || !trader.available) return null;
			const base = trader.status.tuning.prices[f.rarity];
			return fancy === f.id ? Math.floor(base * trader.status.tuning.wantMultiplier) : base;
		},
		[state, trader.available, trader.status, fancy],
	);
	const sheepEach = useMemo(() => sheepEachFor(findId), [sheepEachFor, findId]);

	// The quiet-drift moment: the first time a pig, past the cards, looks at a
	// find whose price nobody has traded for a while and is wandering home.
	useEffect(() => {
		if (place !== "find" || !state || onboarded !== true) return;
		const f = state.finds.find((x) => x.id === findId);
		if (f && wanderingHome(f)) void playMoment(MARKET_MOMENT_KEYS.quiet, quietMoment(f.id, f.price, f.usual), 900, f.id);
	}, [place, findId, state, onboarded, playMoment]);

	// ── Writes ──
	const answer = useCallback(
		(res: MarketOutcome, refusalFind: SatchelFindId | null) => {
			if (!state) return;
			if (!res.ok) {
				void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
				receipts.push(refusalReceipt(res, refusalFind, state.tuning.openOffers, state.tuning.dailyPosts), { urgent: true });
				return;
			}
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			if (res.trade) {
				const each = sheepEachFor(res.trade.findId);
				const sheepPays =
					trader.present && fancy === res.trade.findId && res.trade.buyer?.you && each != null ? each * res.trade.qty : null;
				receipts.push(tradeReceipt(res.trade, sheepPays), { urgent: true });
				if (res.trade.kind === "counter" || res.trade.kind === "pig") {
					void playMoment(MARKET_MOMENT_KEYS.moved, movedMoment(res.trade, state.tuning), 700);
				}
				void playMoment(MARKET_MOMENT_KEYS.soldHigh, soldHighMoment(res.trade), 1400);
			} else if (res.offer) {
				receipts.push(pinnedReceipt(res.offer, findOf(state, res.offer.findId), state.tuning), { urgent: true });
			}
		},
		[state, receipts, trader.present, fancy, sheepEachFor, playMoment],
	);

	// Every trade goes through here: the nonce for its exact target, one write
	// at a time, `busy` released whatever happens, and the lost-answer mark
	// kept per target for as long as the answer is missing.
	const write = useCallback(
		async (key: string, run: (nonce: string) => Promise<MarketOutcome>): Promise<MarketOutcome | null> => {
			if (writingRef.current) return null;
			writingRef.current = true;
			setBusy(true);
			try {
				const res = await run(nonces.nonceFor(key));
				nonces.settle(key, res);
				const lostNow = nonces.isLost(key);
				setLostKeys((prev) => {
					if (prev.has(key) === lostNow) return prev;
					const next = new Set(prev);
					if (lostNow) next.add(key);
					else next.delete(key);
					return next;
				});
				if (isIndefinite(res)) {
					// It may have traded: say so in the open sheet, never "it didn't".
					setSheetLost(true);
					void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
					AccessibilityInfo.announceForAccessibility(`${LOST_ANSWER.title}. ${LOST_ANSWER.line}`);
				} else setSheetLost(false);
				return res;
			} finally {
				writingRef.current = false;
				setBusy(false);
			}
		},
		[nonces],
	);

	const doCounter = useCallback(
		async (id: SatchelFindId, side: "buy" | "sell", limit: number) => {
			const res = await write(marketWriteKey({ via: "counter", findId: id, side, limit }), (nonce) =>
				market.counter(id, side, limit, nonce),
			);
			// A lost answer keeps the sheet (and its nonce) for the retry.
			if (!res || isIndefinite(res)) return;
			setConfirm(null);
			answer(res, id);
		},
		[market, write, answer],
	);
	const doTake = useCallback(
		async (card: BoardCard) => {
			const limit = card.side === "sell" ? card.price : null;
			const res = await write(marketWriteKey({ via: "take", offerId: card.id, limit }), (nonce) => market.take(card.id, limit, nonce));
			if (!res || isIndefinite(res)) return;
			setConfirm(null);
			answer(res, card.side === "swap" ? card.wantFindId : card.findId);
		},
		[market, write, answer],
	);
	const doCancel = useCallback(
		async (id: number) => {
			setBusyId(id);
			try {
				const r = await market.cancel(id);
				if (!r.ok) receipts.push(takeDownReceipt(r.reason), { urgent: true });
			} finally {
				setBusyId(null);
			}
		},
		[market, receipts],
	);
	const cancelPendingPost = useCallback(() => {
		if (postTimer.current) clearTimeout(postTimer.current);
		postTimer.current = null;
		setPostPending(false);
	}, []);
	const openConfirm = useCallback(
		(t: ConfirmTarget) => {
			cancelPendingPost();
			setSheetLost(false);
			setConfirm(t);
		},
		[cancelPendingPost],
	);
	const openPost = useCallback(
		(side: "sell" | "buy" | "swap", id: SatchelFindId) => {
			if (!state) return;
			const next = newDraft(state, side, id, draft);
			cancelPendingPost();
			const show = () => {
				postTimer.current = null;
				setPostPending(false);
				setSheetLost(false);
				setPostError(null);
				setDraft(next);
			};
			// From the confirm sheet: let its native Modal finish leaving before
			// the post sheet's presents (iOS drops a Modal shown mid-dismiss).
			if (confirm) {
				setConfirm(null);
				setPostPending(true);
				postTimer.current = setTimeout(show, POST_AFTER_CONFIRM_MS);
			} else show();
		},
		[state, draft, confirm, cancelPendingPost],
	);
	const doPost = useCallback(
		async (spec: PostSpec) => {
			if (!state) return;
			const res = await write(marketWriteKey({ via: "post", spec }), (nonce) => market.post(spec, nonce));
			if (!res) return;
			if (isIndefinite(res)) {
				setPostError(null);
				return;
			}
			if (!res.ok) {
				const r = refusalReceipt(res, spec.findId, state.tuning.openOffers, state.tuning.dailyPosts);
				setPostError(r.line ? `${r.title}. ${r.line}` : r.title);
				void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
				return;
			}
			setDraft(null);
			answer(res, spec.findId);
		},
		[market, state, write, answer],
	);
	const finishOnboarding = useCallback(() => {
		const firstTime = onboarded !== true;
		void AsyncStorage.setItem(MARKET_ONBOARDED_KEY, "1");
		setOnboarded(true);
		setObOpen(false);
		// The guided first trade (first time only; a replay just closes): a set
		// you already hold, at the counter.
		if (state && firstTime) {
			const held = state.finds.find((f) => f.id === "pinecone" && setsOf(holdingOf(state, f.id), f.size).sets > 0) ??
				state.finds.find((f) => setsOf(holdingOf(state, f.id), f.size).sets > 0);
			if (held) {
				setFindId(held.id);
				setStack(["home", "counter", "find"]);
				receipts.push({
					pose: "counter",
					title: `You've got a set of ${held.size}. Sell it to me for ${held.bid}?`,
					line: "Or put it on the noticeboard for more. Tap Sell, or Put it on the noticeboard instead.",
					tone: "moment",
				}, { urgent: true });
			} else {
				// No full set yet: Bullion says what to do first.
				setStack(["home", "counter"]);
				receipts.push(firstStepsCard(state.tuning, state.finds.some((f) => f.ask <= state.me.coin)), { urgent: true });
			}
		}
	}, [state, receipts, onboarded]);

	// The chart's clock, stable between re-reads so the chart can skip a redraw.
	const tickMinutes = state?.tuning.tickMinutes ?? MARKET_TUNING.tickMinutes;
	const weekdayOf = useCallback((tick: number) => WEEKDAYS[new Date(tick * tickMinutes * 60_000).getDay()], [tickMinutes]);
	const isDayStart = useCallback(
		(tick: number) => {
			const d = new Date(tick * tickMinutes * 60_000);
			return d.getHours() === 0 && d.getMinutes() < tickMinutes;
		},
		[tickMinutes],
	);
	// The exact trades the open sheets would make, for the lost-answer note.
	const confirmKey = confirm && state ? confirmKeyOf(confirm, state) : null;
	const draftSpecNow = draft && state ? draftSpec(state, draft) : null;
	const draftKey = draftSpecNow ? marketWriteKey({ via: "post", spec: draftSpecNow }) : null;

	// ── Render ──
	const shown: Place = closed ? "home" : place;
	const title = shown === "counter" ? "The Counter" : shown === "find" ? "A set up close" : shown === "board" ? "The Noticeboard" : "Bullion's Market";
	const header = (
		<PageHeader
			kicker={shown === "home" ? "one price, two ways to trade" : "Bullion's Market"}
			title={title}
			onBack={back}
			backLabel={
				shown === "home"
					? undefined
					: stack[stack.length - 2] === "counter"
						? "back to the counter"
						: stack[stack.length - 2] === "board"
							? "back to the board"
							: "back to the market"
			}
			right={
				state && !closed ? (
					<View style={styles.coin} accessible accessibilityLabel={`${state.me.coin} tickles ready`}>
						<TickleIcon size={18} />
						<T role="numeral">{String(state.me.coin)}</T>
						<T role="kicker" tone="secondary">ready</T>
					</View>
				) : undefined
			}
		/>
	);

	// Shut: Bullion's card, and your own listings to take home.
	if (closed) {
		const pinned = closed.me.offers;
		return (
			<StackPage edges={STACK_SCROLL_EDGES} testID="market-screen">
				{header}
				<ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]} showsVerticalScrollIndicator={false}>
					<EmptyState
						glyph="market"
						flush
						title="The market's shut"
						sub={pinned.length > 0 ? "Bullion's packed up for now. Take anything you've pinned home." : "He's packed up for now. Back soon."}
					/>
					<MyListings
						offers={pinned}
						state={{ friends: state?.friends ?? [], finds: state?.finds ?? [], tuning: state?.tuning ?? MARKET_TUNING }}
						nowMs={nowMs}
						onCancel={doCancel}
						busyId={busyId}
					/>
				</ScrollView>
				<ReceiptStack shown={receipts.shown} onDismiss={receipts.dismiss} top={insets.top + SPACE.xxl * 2} />
			</StackPage>
		);
	}

	if (!state) {
		return (
			<StackPage edges={STACK_SCROLL_EDGES} testID="market-screen">
				{header}
				<View style={styles.loading}>
					{market.error && !market.loading ? (
						<EmptyState
							kind="error"
							title="Bullion isn't open yet"
							sub="Couldn't reach the market. Try again in a moment."
							action={<Button variant="ghost" onPress={() => void market.refresh()}>Try again</Button>}
						/>
					) : (
						<LoadingBeat label="Bullion is opening up" />
					)}
				</View>
			</StackPage>
		);
	}

	const f = state.finds.find((x) => x.id === findId) ?? state.finds[0];
	const ticksPerDay = Math.round((24 * 60) / state.tuning.tickMinutes);
	const h = f ? holdingOf(state, f.id) : null;
	const sets = f && h ? setsOf(h, f.size).sets : 0;

	let bar: React.ReactNode = null;
	if (place === "find" && f) {
		const canBuy = state.me.coin >= f.ask;
		bar = (
			<View style={styles.bar}>
				<View style={styles.two}>
					<Button
						variant={canBuy ? "gold" : "locked"}
						disabled={!canBuy}
						onPress={() => openConfirm({ via: "counter", findId: f.id, side: "buy" })}
						accessibilityLabel={`Buy ${setOf(f.id, f.size)} from Bullion for ${f.ask}`}
						style={styles.flex}
					>
						{canBuy ? `Buy for ${f.ask}` : `Buy for ${f.ask} · ${state.me.coin} ready`}
					</Button>
					<Button
						variant={sets ? "success" : "locked"}
						disabled={!sets}
						onPress={() => openConfirm({ via: "counter", findId: f.id, side: "sell" })}
						accessibilityLabel={`Sell ${setOf(f.id, f.size)} to Bullion for ${f.bid}`}
						style={styles.flex}
					>
						{sets ? `Sell for ${f.bid}` : `Sell for ${f.bid} · ${h?.held ?? 0} of ${f.size}`}
					</Button>
				</View>
				<Button variant="ghost" size="sm" onPress={() => openPost(sets ? "sell" : "buy", f.id)}>
					Put it on the noticeboard instead
				</Button>
			</View>
		);
	} else if (place === "board") {
		bar = (
			<View style={styles.bar}>
				<Button variant="gold" full onPress={() => openPost("sell", findId)}>
					Post a listing
				</Button>
			</View>
		);
	}

	return (
		<StackPage edges={STACK_SCROLL_EDGES} testID="market-screen">
			{header}
			<ScrollView
				ref={scrollRef}
				contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad + (bar ? barH : 0) }]}
				showsVerticalScrollIndicator={false}
			>
				{place === "home" ? (
					<MarketHome
						state={state}
						sayTurn={sayTurn}
						nowMs={nowMs}
						onCounter={() => go("counter")}
						onBoard={() => go("board")}
						onBag={() => setBagOpen(true)}
						onCancel={doCancel}
						onReplayIntro={() => setObOpen(true)}
						busyId={busyId}
					/>
				) : place === "counter" ? (
					<CounterView state={state} fancy={fancy} onOpen={openFind} />
				) : place === "find" && f ? (
					<FindView
						state={state}
						find={f}
						view={findView && findView.findId === f.id ? findView : null}
						viewFailed={findFailed && !(findView && findView.findId === f.id)}
						onRetryView={retryFind}
						fancy={fancy}
						sheepEach={sheepEach}
						sheepHere={trader.present}
						nowMs={nowMs}
						weekdayOf={weekdayOf}
						isDayStart={isDayStart}
						ticksPerDay={ticksPerDay}
						onTake={(card) => openConfirm({ via: "board", card })}
						onOpen={openFind}
						onCancel={doCancel}
						busyId={busyId}
					/>
				) : (
					<BoardView
						state={state}
						filter={boardF}
						onFilter={(x) => {
							setBoardF(x);
							setBoardShown(BoardView.PAGE);
						}}
						shown={boardShown}
						onMore={() => setBoardShown((n) => n + BoardView.PAGE)}
						nowMs={nowMs}
						onTake={(card) => openConfirm({ via: "board", card })}
						onCancel={doCancel}
						busyId={busyId}
					/>
				)}
			</ScrollView>
			{bar ? (
				<View style={[styles.barWrap, { paddingBottom: insets.bottom }]} onLayout={(e) => setBarH(e.nativeEvent.layout.height)}>
					{bar}
				</View>
			) : null}

			<ReceiptStack shown={receipts.shown} onDismiss={receipts.dismiss} top={insets.top + SPACE.xxl * 2} />

			<ConfirmSheet
				open={confirm != null}
				target={confirm}
				state={state}
				busy={busy}
				lost={sheetLost || (confirmKey != null && lostKeys.has(confirmKey))}
				onClose={() => setConfirm(null)}
				onCounter={doCounter}
				onTake={doTake}
				onSwitchToCard={(card) => openConfirm({ via: "board", card })}
				onPostHere={(id) => openPost("sell", id)}
			/>
			{draft ? (
				<PostSheet
					open
					draft={draft}
					setDraft={(d) => {
						setPostError(null);
						setDraft(d);
					}}
					state={state}
					busy={busy}
					error={postError}
					lost={sheetLost || (draftKey != null && lostKeys.has(draftKey))}
					onClose={() => setDraft(null)}
					onPost={doPost}
				/>
			) : null}
			<BagSheet open={bagOpen} state={state} onClose={() => setBagOpen(false)} onOpen={openFind} />
			<OnboardSheet
				open={showOb}
				state={state}
				replay={onboarded === true}
				ticksPerDay={ticksPerDay}
				onClose={() => {
					setObOpen(false);
					setObSkipped(true);
				}}
				onDone={finishOnboarding}
			/>
		</StackPage>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	two: { flexDirection: "row", gap: SPACE.md },
	scroll: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.md },
	loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: PAGE_PAD },
	coin: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	barWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		paddingTop: SPACE.sm,
		paddingHorizontal: PAGE_PAD,
		backgroundColor: WHIMSY.cream,
		borderTopWidth: BORDER.ink,
		borderTopColor: WHIMSY.ink,
	},
	bar: { gap: SPACE.xs, marginBottom: SPACE.sm },
});
