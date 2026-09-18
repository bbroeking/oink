// The Ghost Sheep Trader's read path for the yard — is he here, until when,
// what he pays — plus the one mutation (hand a find over). One fetch per
// focus, then a timer to the next edge (his arrival when he is on his way,
// his leaving when he is here) so he pops up and packs up on the minute while
// the yard is on screen, without polling.
//
// FAIL-SOFT: an un-pushed server (trader_status missing) leaves `available`
// false and `status` at NO_TRADER; no surface draws him.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	NO_TRADER,
	devSummonTrader,
	fetchTraderStatus,
	newTraderNonce,
	tradeWithTrader,
	traderNextCheckMs,
	type TraderSaleOutcome,
	type TraderStatus,
} from "@/utils/trader";

// Never re-ask sooner than this, whatever the clocks say.
const MIN_RECHECK_MS = 15_000;
// A visit can be hours long; a timer that far out is fine, but cap it so a
// wildly wrong clock can't park the yard forever (the next focus re-reads anyway).
const MAX_RECHECK_MS = 6 * 60 * 60_000;

export interface UseTrader {
	status: TraderStatus;
	/** False until the first successful read — the server has the feature. */
	available: boolean;
	present: boolean;
	loading: boolean;
	/** When `status` was read (ms) — the clock the stay line counts from. */
	readAt: number;
	refresh: () => Promise<TraderStatus | null>;
	/** Hand one find over. The caller applies the answered bag. */
	sell: (itemId: number) => Promise<TraderSaleOutcome>;
	/** DEV ONLY — start a visit now (server-gated on is_test). Resolves false
	 *  when the server refused (a normal account, an un-pushed server). */
	summon: () => Promise<boolean>;
}

export function useTrader({
	enabled = true,
	onArrive,
}: {
	enabled?: boolean;
	/** He was not here on the last read and is now — fired once per arrival
	 *  the yard witnesses, never on the first read of a session. */
	onArrive?: () => void;
} = {}): UseTrader {
	const [status, setStatus] = useState<TraderStatus>(NO_TRADER);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);
	const [readAt, setReadAt] = useState(0);
	const lastPresent = useRef<boolean | null>(null);
	const onArriveRef = useRef(onArrive);
	useEffect(() => {
		onArriveRef.current = onArrive;
	}, [onArrive]);

	const refresh = useCallback(async (): Promise<TraderStatus | null> => {
		if (!enabled) return null;
		setLoading(true);
		const r = await fetchTraderStatus();
		setLoading(false);
		if (!r.ok) return null;
		setAvailable(true);
		setStatus(r.status);
		setReadAt(Date.now());
		if (lastPresent.current === false && r.status.present) onArriveRef.current?.();
		lastPresent.current = r.status.present;
		return r.status;
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	// The timer to the next edge. Re-armed after every read.
	useEffect(() => {
		if (!available || !enabled) return;
		const wait = traderNextCheckMs(status, readAt);
		if (wait == null) return;
		const id = setTimeout(
			() => void refresh(),
			Math.min(MAX_RECHECK_MS, Math.max(MIN_RECHECK_MS, wait)),
		);
		return () => clearTimeout(id);
	}, [available, enabled, status, readAt, refresh]);

	const sell = useCallback(async (itemId: number): Promise<TraderSaleOutcome> => {
		const r = await tradeWithTrader(itemId, newTraderNonce());
		if (r.ok) {
			setStatus((s) =>
				s.visit
					? {
							...s,
							met: true,
							sales: r.replay ? s.sales : s.sales + 1,
							visit: { ...s.visit, findsLeft: r.findsLeft, tickles: r.visitTickles, sold: s.visit.sold + (r.replay ? 0 : 1) },
						}
					: s,
			);
		} else if (r.reason === "not_here" || r.reason === "had_enough") {
			// He has moved on: re-read so the fan row and the sheet agree.
			void refresh();
		}
		return r;
	}, [refresh]);

	const summon = useCallback(async () => {
		const r = await devSummonTrader();
		if (!r.ok) return false;
		setAvailable(true);
		setStatus(r.status);
		setReadAt(Date.now());
		lastPresent.current = r.status.present;
		return true;
	}, []);

	return { status, available, present: available && status.present, loading, readAt, refresh, sell, summon };
}
