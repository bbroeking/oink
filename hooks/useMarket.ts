// Bullion's Market — the screen's read path and its four writes.
//
// One read on focus, then a quiet poll while the market is on screen (the
// price ticks every 30 minutes, but the noticeboard moves whenever another pig
// posts or takes, and the tape is the market's heartbeat). Every write answers
// its receipt and is followed by a fresh read, so the bank, the bag and the
// board never drift from the server. Notices (your listings filled / crossed /
// expired / lapsed / swapped, and offers sent to you) are handed over ONCE by
// the server; this hook passes each batch to `onNotices` and forgets it.
//
// FAIL-SOFT: an un-pushed server leaves `available` false and `state` null.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import type { SatchelFindId } from "@/constants/satchel";
import {
	fetchMarketFind,
	fetchMarketState,
	marketCancel,
	marketCounter,
	marketPost,
	marketTake,
	type MarketFindView,
	type MarketNotice,
	type MarketOutcome,
	type MarketState,
	type PostSpec,
} from "@/utils/market";

// While the market is on screen. Long enough to be cheap, short enough that a
// friend's listing shows up while you are looking.
const POLL_MS = 20_000;

export interface UseMarket {
	state: MarketState | null;
	/** False until the first successful read — the server has the market. */
	available: boolean;
	loading: boolean;
	/** The last read failed (and why), while `state` keeps the last good one. */
	error: string | null;
	refresh: (fresh?: boolean) => Promise<MarketState | null>;
	loadFind: (id: SatchelFindId) => Promise<MarketFindView | null>;
	/** Every write takes the caller's nonce: mint ONE per confirm/post sheet
	 *  (newMarketNonce) and reuse it for that target, so a double tap or a
	 *  retry after a dropped answer is the same trade, never two. */
	counter: (findId: SatchelFindId, side: "buy" | "sell", limit: number | null, nonce: string) => Promise<MarketOutcome>;
	post: (spec: PostSpec, nonce: string) => Promise<MarketOutcome>;
	take: (offerId: number, limit: number | null, nonce: string) => Promise<MarketOutcome>;
	cancel: (offerId: number) => Promise<{ ok: boolean; reason: string | null }>;
}

export function useMarket({
	enabled = true,
	poll = true,
	onNotices,
}: {
	enabled?: boolean;
	poll?: boolean;
	onNotices?: (notices: MarketNotice[]) => void;
} = {}): UseMarket {
	const [state, setState] = useState<MarketState | null>(null);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const onNoticesRef = useRef(onNotices);
	useEffect(() => {
		onNoticesRef.current = onNotices;
	}, [onNotices]);
	const inFlight = useRef<Promise<MarketState | null> | null>(null);

	// A read that began before a write can't answer for it: `fresh` chains a
	// new read behind one already in flight instead of reusing its promise.
	const read = useCallback(async (): Promise<MarketState | null> => {
		setLoading(true);
		const r = await fetchMarketState();
		setLoading(false);
		if (!r.ok) {
			setError(r.reason);
			return null;
		}
		setError(null);
		setAvailable(true);
		setState(r.state);
		if (r.state.notices.length > 0) onNoticesRef.current?.(r.state.notices);
		return r.state;
	}, []);

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

	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;
			void refresh();
			if (!poll) return undefined;
			const id = setInterval(() => void refresh(), POLL_MS);
			return () => clearInterval(id);
		}, [enabled, poll, refresh]),
	);

	const loadFind = useCallback(async (id: SatchelFindId) => {
		const r = await fetchMarketFind(id);
		return r.ok ? r.view : null;
	}, []);

	const after = useCallback(
		async <T>(p: Promise<T>): Promise<T> => {
			const out = await p;
			await refresh(true);
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
	const cancel = useCallback((offerId: number) => after(marketCancel(offerId)), [after]);

	return { state, available, loading, error, refresh, loadFind, counter, post, take, cancel };
}
