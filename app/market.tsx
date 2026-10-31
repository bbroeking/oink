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
// then a nudge to their first sale at the counter.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
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
import { BoardView, CounterView, FindView, MarketHome, type BoardFilter } from "@/components/market/MarketViews";
import {
	BagSheet,
	ConfirmSheet,
	OnboardSheet,
	PostSheet,
	newDraft,
	type ConfirmTarget,
	type PostDraft,
} from "@/components/market/MarketSheets";
import { ReceiptStack, useReceipts } from "@/components/market/ReceiptStack";
import { movedMoment, noticeReceipt, refusalReceipt, tradeReceipt, type MarketReceipt } from "@/components/market/marketCopy";
import { useMarket } from "@/hooks/useMarket";
import { useTrader } from "@/hooks/useTrader";
import { holdingOf, newMarketNonce, setsOf, type BoardCard, type MarketFindView, type MarketNotice, type MarketOutcome } from "@/utils/market";

type Place = "home" | "counter" | "find" | "board";

const ONBOARDED_KEY = "ttp.market.onboarded";
const MOVED_KEY = "ttp.market.moment.moved";
const SAY_TURN_MS = 12_000;
// The confirm sheet's slide-out, before the post sheet slides in.
const POST_AFTER_CONFIRM_MS = 350;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MarketScreen() {
	const insets = useSafeAreaInsets();
	const scrollPad = useStackScrollPad();
	// Notices arrive from the hook's read; the receipt queue is declared below
	// (it holds while a sheet is open), so they reach it through a ref.
	const pushRef = useRef<(r: MarketReceipt) => void>(() => {});
	const onNotices = useCallback((ns: MarketNotice[]) => {
		for (const n of ns) {
			const r = noticeReceipt(n);
			if (r) pushRef.current(r);
		}
	}, []);
	const market = useMarket({ onNotices });
	const trader = useTrader();
	const state = market.state;

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
	// One nonce per confirm / post sheet: a double tap or a retry is the same trade.
	const nonceRef = useRef<string>(newMarketNonce());

	// First visit: the three cards.
	useEffect(() => {
		let cancelled = false;
		void AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
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
	const receipts = useReceipts(sheetOpen);
	useEffect(() => {
		pushRef.current = receipts.push;
	}, [receipts.push]);

	// Bullion turns his line, and the board's clocks tick.
	useEffect(() => {
		const id = setInterval(() => {
			setSayTurn((t) => t + 1);
			setNowMs(Date.now());
		}, SAY_TURN_MS);
		return () => clearInterval(id);
	}, []);

	// A find's chart: on open, and again whenever the market re-reads.
	const loadFind = market.loadFind;
	const stateTick = state?.tick;
	const tapeHead = state?.tape[0]?.id;
	useEffect(() => {
		if (place !== "find") return;
		let cancelled = false;
		void loadFind(findId).then((v) => {
			if (!cancelled && v) setFindView(v);
		});
		return () => {
			cancelled = true;
		};
	}, [place, findId, loadFind, stateTick, tapeHead]);

	const go = useCallback((p: Place) => {
		setStack((s) => (s[s.length - 1] === p ? s : [...s, p]));
		scrollRef.current?.scrollTo({ y: 0, animated: false });
	}, []);
	const back = useCallback(() => {
		if (stackRef.current.length <= 1) router.back();
		else setStack((s) => s.slice(0, -1));
	}, []);
	// Deeper than the market home, the iOS edge swipe is off (the native
	// stack would remove the whole route behind JS's back; the header's back
	// walks the in-route stack) and Android's back pops one place. Nothing
	// else is intercepted, so a sign-out, a deep link or a replace still leaves.
	const navigation = useNavigation();
	const deep = stack.length > 1;
	useEffect(() => {
		navigation.setOptions({ gestureEnabled: !deep });
	}, [navigation, deep]);
	useEffect(() => {
		if (!deep) return undefined;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
			return true;
		});
		return () => sub.remove();
	}, [deep]);
	const openFind = useCallback(
		(id: SatchelFindId) => {
			setFindId(id);
			setFindView(null);
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

	// ── Writes ──
	const answer = useCallback(
		async (res: MarketOutcome, refusalFind: SatchelFindId | null) => {
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
					const seen = await AsyncStorage.getItem(MOVED_KEY);
					if (seen !== "1") {
						void AsyncStorage.setItem(MOVED_KEY, "1");
						setTimeout(() => receipts.push(movedMoment(res.trade!), { urgent: true }), 700);
					}
				}
			} else if (res.offer) {
				const f = state.finds.find((x) => x.id === res.offer!.findId);
				receipts.push({
					pose: "stand",
					title: "Pinned to the noticeboard",
					line:
						res.offer.side === "swap"
							? "Straight up, for 24 hours. Take it down any time."
							: `${res.offer.side === "sell" ? "For sale" : "Wanted"} at ${res.offer.price}${f ? `: Bullion pays ${f.bid}, charges ${f.ask}` : ""}.`,
					tone: "plain",
				}, { urgent: true });
			}
		},
		[state, receipts, trader.present, fancy, sheepEachFor],
	);

	const doCounter = useCallback(
		async (id: SatchelFindId, side: "buy" | "sell", limit: number) => {
			setBusy(true);
			const res = await market.counter(id, side, limit, nonceRef.current);
			setBusy(false);
			// A lost answer may still have traded: keep the sheet (and its nonce)
			// so the retry replays the original instead of trading twice.
			if (!res.ok && res.reason === "network") {
				receipts.push(refusalReceipt(res, id, 0, 0), { urgent: true });
				return;
			}
			setConfirm(null);
			await answer(res, id);
		},
		[market, answer, receipts],
	);
	const doTake = useCallback(
		async (card: BoardCard) => {
			setBusy(true);
			const res = await market.take(card.id, card.side === "sell" ? card.price : null, nonceRef.current);
			setBusy(false);
			if (!res.ok && res.reason === "network") {
				receipts.push(refusalReceipt(res, card.findId, 0, 0), { urgent: true });
				return;
			}
			setConfirm(null);
			await answer(res, card.side === "swap" ? card.wantFindId : card.findId);
		},
		[market, answer, receipts],
	);
	const doCancel = useCallback(
		async (id: number) => {
			setBusyId(id);
			const r = await market.cancel(id);
			setBusyId(null);
			if (!r.ok) receipts.push({ pose: "shrug", title: "That listing is already down", tone: "meh" });
		},
		[market, receipts],
	);
	// A fresh nonce for every sheet that can trade.
	const cancelPendingPost = useCallback(() => {
		if (postTimer.current) clearTimeout(postTimer.current);
		postTimer.current = null;
		setPostPending(false);
	}, []);
	const openConfirm = useCallback(
		(t: ConfirmTarget) => {
			cancelPendingPost();
			nonceRef.current = newMarketNonce();
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
				nonceRef.current = newMarketNonce();
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
		async (spec: Parameters<typeof market.post>[0]) => {
			if (!state) return;
			setBusy(true);
			const res = await market.post(spec, nonceRef.current);
			setBusy(false);
			if (!res.ok) {
				const r = refusalReceipt(res, spec.findId, state.tuning.openOffers, state.tuning.dailyPosts);
				setPostError(r.line ? `${r.title}. ${r.line}` : r.title);
				void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
				return;
			}
			setDraft(null);
			await answer(res, spec.findId);
		},
		[market, state, answer],
	);
	const finishOnboarding = useCallback(() => {
		const firstTime = onboarded !== true;
		void AsyncStorage.setItem(ONBOARDED_KEY, "1");
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
				setStack(["home", "counter"]);
			}
		}
	}, [state, receipts, onboarded]);

	// ── Render ──
	const title = place === "counter" ? "The Counter" : place === "find" ? "A set up close" : place === "board" ? "The Noticeboard" : "Bullion's Market";
	const header = (
		<PageHeader
			kicker={place === "home" ? "one price, two ways to trade" : "Bullion's Market"}
			title={title}
			onBack={back}
			backLabel={
				place === "home"
					? undefined
					: stack[stack.length - 2] === "counter"
						? "back to the counter"
						: stack[stack.length - 2] === "board"
							? "back to the board"
							: "back to the market"
			}
			right={
				state ? (
					<View style={styles.coin} accessible accessibilityLabel={`${state.me.coin} tickles ready`}>
						<TickleIcon size={18} />
						<T role="numeral">{String(state.me.coin)}</T>
						<T role="kicker" tone="secondary">ready</T>
					</View>
				) : undefined
			}
		/>
	);

	if (!state) {
		return (
			<StackPage edges={STACK_SCROLL_EDGES} testID="market-screen">
				{header}
				<View style={styles.loading}>
					{market.error && !market.loading ? (
						<EmptyState
							kind="error"
							title={market.error === "closed" ? "The market's shut" : "Bullion isn't open yet"}
							sub={market.error === "closed" ? "He's packed up for now. Back soon." : "Couldn't reach the market. Try again in a moment."}
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
	const weekdayOf = (tick: number) => WEEKDAYS[new Date(tick * state.tuning.tickMinutes * 60_000).getDay()];
	const isDayStart = (tick: number) => {
		const d = new Date(tick * state.tuning.tickMinutes * 60_000);
		return d.getHours() === 0 && d.getMinutes() < state.tuning.tickMinutes;
	};
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
						accessibilityLabel={`Buy a set from Bullion for ${f.ask}`}
						style={styles.flex}
					>
						{canBuy ? `Buy for ${f.ask}` : `Buy for ${f.ask} · ${state.me.coin} ready`}
					</Button>
					<Button
						variant={sets ? "success" : "locked"}
						disabled={!sets}
						onPress={() => openConfirm({ via: "counter", findId: f.id, side: "sell" })}
						accessibilityLabel={`Sell a set to Bullion for ${f.bid}`}
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
					onClose={() => setDraft(null)}
					onPost={doPost}
				/>
			) : null}
			<BagSheet open={bagOpen} state={state} onClose={() => setBagOpen(false)} onOpen={openFind} />
			<OnboardSheet
				open={showOb}
				state={state}
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
