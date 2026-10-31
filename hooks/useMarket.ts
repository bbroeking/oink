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
	newMarketNonce,
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
	refresh: () => Promise<MarketState | null>;
	loadFind: (id: SatchelFindId) => Promise<MarketFindView | null>;
	counter: (findId: SatchelFindId, side: "buy" | "sell", limit: number | null) => Promise<MarketOutcome>;
	post: (spec: PostSpec) => Promise<MarketOutcome>;
	take: (offerId: number, limit: number | null) => Promise<MarketOutcome>;
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

	const refresh = useCallback((): Promise<MarketState | null> => {
		if (inFlight.current) return inFlight.current;
		const run = (async () => {
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
		})();
		inFlight.current = run;
		void run.finally(() => {
			inFlight.current = null;
		});
		return run;
	}, []);

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
			await refresh();
			return out;
		},
		[refresh],
	);

	const counter = useCallback(
		(findId: SatchelFindId, side: "buy" | "sell", limit: number | null) =>
			after(marketCounter(findId, side, limit, newMarketNonce())),
		[after],
	);
	const post = useCallback((spec: PostSpec) => after(marketPost(spec, newMarketNonce())), [after]);
	const take = useCallback(
		(offerId: number, limit: number | null) => after(marketTake(offerId, limit, newMarketNonce())),
		[after],
	);
	const cancel = useCallback((offerId: number) => after(marketCancel(offerId)), [after]);

	return { state, available, loading, error, refresh, loadFind, counter, post, take, cancel };
}
