// Bullion's Market — the screen's read path and its four writes.
//
// One read on focus, then a quiet poll while the market is on screen and the
// app is in the foreground (the price ticks every 30 minutes, but the
// noticeboard moves whenever another pig posts or takes, and the tape is the
// market's heartbeat); coming back to the foreground reads at once. Every
// write hands its answer back the moment it lands (the receipt never waits
// on a read) and refreshes in the background, so the bank, the bag and the
// board catch up without holding the receipt. Notices (your listings filled /
// crossed / expired / lapsed / swapped / reset, and offers sent to you) are
// handed over ONCE by the server; this hook passes each batch to `onNotices`
// and forgets it, including a batch that lands after its read timed out.
//
// Every read and write has a timeout: a hung read never blocks a receipt or
// leaves a spinner, and a hung write answers `timeout` (a lost answer: see
// isIndefinite in utils/market).
//
// CLOSED: with the market's switch off, `closed` carries your own open
// listings (market_cancel works while closed, so they stay in reach) until a
// read finds the market open again.
//
// FAIL-SOFT: an un-pushed server leaves `available` false and `state` null.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import type { SatchelFindId } from "@/constants/satchel";
import {
	MARKET_TIMED_OUT,
	fetchMarketFind,
	fetchMarketState,
	marketCancel,
	marketCounter,
	marketPost,
	marketTake,
	withTimeout,
	type MarketClosed,
	type MarketFindView,
	type MarketNotice,
	type MarketOutcome,
	type MarketState,
	type MarketStateResult,
	type PostSpec,
} from "@/utils/market";

// While the market is on screen. Long enough to be cheap, short enough that a
// friend's listing shows up while you are looking.
const POLL_MS = 20_000;
// A read that has not answered by now lets go of whatever waits on it (its
// late answer still lands, unless a newer one already has).
export const MARKET_READ_TIMEOUT_MS = 12_000;
// A write that has not answered by now is a lost answer: the sheet says so and
// keeps the nonce, so the retry replays it.
export const MARKET_WRITE_TIMEOUT_MS = 20_000;

export interface UseMarket {
	state: MarketState | null;
	/** False until the first successful read — the server has the market. */
	available: boolean;
	loading: boolean;
	/** The last read failed (and why), while `state` keeps the last good one. */
	error: string | null;
	/** The latest read found the market shut: your listings, to take down. */
	closed: MarketClosed | null;
	refresh: (fresh?: boolean) => Promise<MarketState | null>;
	/** Null when the read failed or timed out. */
	loadFind: (id: SatchelFindId) => Promise<MarketFindView | null>;
	/** Every write takes the caller's nonce: one per exact target, kept until
	 *  a definite answer (createNonceBook), so a double tap or a retry after a
	 *  dropped answer is the same trade, never two. */
	counter: (findId: SatchelFindId, side: "buy" | "sell", limit: number | null, nonce: string) => Promise<MarketOutcome>;
	post: (spec: PostSpec, nonce: string) => Promise<MarketOutcome>;
	take: (offerId: number, limit: number | null, nonce: string) => Promise<MarketOutcome>;
	cancel: (offerId: number) => Promise<{ ok: boolean; reason: string | null }>;
}

const appActive = () => AppState.currentState == null || AppState.currentState === "active";

export function useMarket({
	enabled = true,
	poll = true,
	onNotices,
}: {
	enabled?: boolean;
	poll?: boolean;
	/** The notices one read handed over, with the state they came with. */
	onNotices?: (notices: MarketNotice[], state: MarketState) => void;
} = {}): UseMarket {
	const [state, setState] = useState<MarketState | null>(null);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [closed, setClosed] = useState<MarketClosed | null>(null);
	const onNoticesRef = useRef(onNotices);
	useEffect(() => {
		onNoticesRef.current = onNotices;
	}, [onNotices]);
	const inFlight = useRef<Promise<MarketState | null> | null>(null);
	// Reads are numbered as they start; a read's state lands only when it is
	// newer than what is on screen, so a slow older read never rolls the
	// screen back. A write's own answer moves the mark too (see `after`).
	const started = useRef(0);
	const applied = useRef(0);

	const land = useCallback((seq: number, r: MarketStateResult): MarketState | null => {
		if (!r.ok) {
			if (seq <= applied.current) return null;
			setError(r.reason);
			// Shut is an answer, not a failure: it stands until a newer read
			// finds the market open (an older open read can't land over it).
			if (r.closed) {
				applied.current = seq;
				setClosed(r.closed);
			}
			return null;
		}
		// Handed over once: delivered whatever the read's age.
		if (r.state.notices.length > 0) onNoticesRef.current?.(r.state.notices, r.state);
		if (seq <= applied.current) return r.state;
		applied.current = seq;
		setError(null);
		setClosed(null);
		setAvailable(true);
		setState(r.state);
		return r.state;
	}, []);

	const read = useCallback(async (): Promise<MarketState | null> => {
		const seq = ++started.current;
		setLoading(true);
		try {
			const out = await withTimeout(
				fetchMarketState().then((r) => ({ state: land(seq, r) })),
				MARKET_READ_TIMEOUT_MS,
				null,
			);
			if (out) return out.state;
			if (seq > applied.current) setError("timeout");
			return null;
		} finally {
			setLoading(false);
		}
	}, [land]);

	// A read that began before a write can't answer for it: `fresh` chains a
	// new read behind one already in flight instead of reusing its promise.
	const refresh = useCallback(
		(fresh = false): Promise<MarketState | null> => {
			const prior = inFlight.current;
			if (prior && !fresh) return prior;
			const run = (prior ? prior.then(() => read(), () => read()) : read()).finally(() => {
				if (inFlight.current === run) inFlight.current = null;
			});
			inFlight.current = run;
			return run;
		},
		[read],
	);

	// On focus: read, then poll while the app is in the foreground. Leaving
	// for the background stops the poll; coming back reads at once.
	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;
			let timer: ReturnType<typeof setInterval> | null = null;
			const start = () => {
				if (poll && !timer) timer = setInterval(() => void refresh(), POLL_MS);
			};
			const stop = () => {
				if (timer) clearInterval(timer);
				timer = null;
			};
			void refresh();
			if (appActive()) start();
			const sub = AppState.addEventListener("change", (next) => {
				if (next === "active") {
					void refresh();
					start();
				} else stop();
			});
			return () => {
				stop();
				sub.remove();
			};
		}, [enabled, poll, refresh]),
	);

	const loadFind = useCallback(async (id: SatchelFindId) => {
		const r = await withTimeout(fetchMarketFind(id), MARKET_READ_TIMEOUT_MS, null);
		return r && r.ok ? r.view : null;
	}, []);

	// The write's answer goes straight back; the read that catches the screen
	// up runs behind it. A fresh (non-replayed) answer carries the bank as it
	// now stands, so the header's tickles move with the receipt, and any read
	// that began before the write can no longer land over it.
	const after = useCallback(
		async (p: Promise<MarketOutcome>): Promise<MarketOutcome> => {
			const out = await withTimeout(p, MARKET_WRITE_TIMEOUT_MS, MARKET_TIMED_OUT);
			if (out.ok && !out.replay && out.coin != null) {
				const coin = out.coin;
				applied.current = started.current;
				setState((s) => (s ? { ...s, me: { ...s.me, coin } } : s));
			}
			void refresh(true);
			return out;
		},
		[refresh],
	);

	const counter = useCallback(
		(findId: SatchelFindId, side: "buy" | "sell", limit: number | null, nonce: string) =>
			after(marketCounter(findId, side, limit, nonce)),
		[after],
	);
	const post = useCallback((spec: PostSpec, nonce: string) => after(marketPost(spec, nonce)), [after]);
	const take = useCallback(
		(offerId: number, limit: number | null, nonce: string) => after(marketTake(offerId, limit, nonce)),
		[after],
	);
	const cancel = useCallback(
		async (offerId: number) => {
			const out = await withTimeout(marketCancel(offerId), MARKET_WRITE_TIMEOUT_MS, { ok: false, reason: "timeout" });
			// Down is down: the row leaves now, not when the catch-up read lands
			// (a second tap on a lingering row would only hear "already down").
			if (out.ok) {
				applied.current = started.current;
				setState((s) =>
					s
						? { ...s, me: { ...s.me, offers: s.me.offers.filter((o) => o.id !== offerId) }, board: s.board.filter((c) => c.id !== offerId) }
						: s,
				);
				setClosed((c) => (c ? { ...c, me: { ...c.me, offers: c.me.offers.filter((o) => o.id !== offerId) } } : c));
			}
			void refresh(true);
			return out;
		},
		[refresh],
	);

	return { state, available, loading, error, closed, refresh, loadFind, counter, post, take, cancel };
}
