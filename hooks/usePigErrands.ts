// The Errand's read path for the Pen and the yard — who is out, who is back,
// what waits on the corkboard — plus the three mutations (send, claim,
// recall) and the dev summon. One fetch per focus, then a timer to the next
// return so a pig past its hour comes home while the screen is on, without
// polling. `send` is optimistic: the pig walks out on the tap, and a refusal
// walks it back with the roster-message toast.
//
// FAIL-SOFT: an un-pushed server (pig_errands missing) leaves `available`
// false and the state EMPTY; no surface draws the errand.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import type { ErrandRow } from "@/constants/errands";
import type { SatchelFindId } from "@/constants/satchel";
import {
	EMPTY_ERRANDS,
	claimErrand,
	devSummonReturn,
	errandDurationMs,
	errandTuning,
	fetchPigErrands,
	newErrandNonce,
	recallPig,
	sendPig,
	type ClaimOutcome,
	type ErrandState,
	type SendOutcome,
} from "@/utils/errands";
import type { PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

// Never re-ask sooner than this, whatever the clocks say.
const MIN_RECHECK_MS = 15_000;
// An errand is hours long; cap the timer so a wildly wrong clock can't park
// the screen forever (the next focus re-reads anyway).
const MAX_RECHECK_MS = 6 * 60 * 60_000;
// Optimistic rows carry a negative id until the server names the real one.
let optimisticSeq = -1;

export interface UsePigErrands {
	state: ErrandState;
	/** False until the first successful read — the server has the feature. */
	available: boolean;
	loading: boolean;
	/** The last read never came back (after at least one success). */
	error: boolean;
	/** The errand a mutation is in flight for, or the pig being sent. */
	busyId: number | null;
	busyPig: PigId | null;
	refresh: () => Promise<ErrandState | null>;
	send: (pig: PigId, target: SatchelFindId | null, forUserId: string | null) => Promise<SendOutcome>;
	claim: (id: number, action: "give" | "keep") => Promise<ClaimOutcome>;
	recall: (id: number) => Promise<RpcResult<{ errand: ErrandRow }>>;
	/** DEV ONLY — bring an out pig home now (server-gated on is_test). */
	summon: (id: number) => Promise<boolean>;
}

export function usePigErrands({ enabled = true }: { enabled?: boolean } = {}): UsePigErrands {
	const [state, setState] = useState<ErrandState>(EMPTY_ERRANDS);
	const [available, setAvailable] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [busyId, setBusyId] = useState<number | null>(null);
	const [busyPig, setBusyPig] = useState<PigId | null>(null);
	const everOk = useRef(false);

	const refresh = useCallback(async (): Promise<ErrandState | null> => {
		if (!enabled) return null;
		setLoading(true);
		const r = await fetchPigErrands();
		setLoading(false);
		if (!r.ok) {
			setError(everOk.current);
			return null;
		}
		everOk.current = true;
		setError(false);
		setAvailable(true);
		setState(r.state);
		return r.state;
	}, [enabled]);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	// The timer to the next return. Re-armed after every read.
	useEffect(() => {
		if (!available || !enabled) return;
		const next = state.out.reduce<number | null>((soonest, row) => {
			const t = Date.parse(row.ends_at);
			if (!Number.isFinite(t)) return soonest;
			return soonest == null || t < soonest ? t : soonest;
		}, null);
		if (next == null) return;
		const wait = next - Date.now() + 1_000;
		const id = setTimeout(() => void refresh(), Math.min(MAX_RECHECK_MS, Math.max(MIN_RECHECK_MS, wait)));
		return () => clearTimeout(id);
	}, [available, enabled, state.out, refresh]);

	const send = useCallback(
		async (pig: PigId, target: SatchelFindId | null, forUserId: string | null): Promise<SendOutcome> => {
			const previous = state;
			const nonce = newErrandNonce();
			const now = Date.now();
			const optimistic: ErrandRow = {
				id: optimisticSeq--,
				pig_id: pig,
				target_find_id: target,
				for_user_id: forUserId,
				for_wish_no: null,
				started_at: new Date(now).toISOString(),
				ends_at: new Date(now + errandDurationMs(pig, state.tuning ?? errandTuning())).toISOString(),
				status: "out",
				result_find_ids: [],
			};
			setBusyPig(pig);
			// The pig walks out on the tap.
			setState((s) => ({
				...s,
				out: [...s.out, optimistic],
				today: { ...s.today, [pig]: true },
			}));
			const r = await sendPig(pig, target, forUserId, nonce);
			if (!r.ok) {
				// …and turns round at the gate.
				setState(previous);
				setBusyPig(null);
				return r;
			}
			setState((s) => ({
				...s,
				out: s.out.map((row) => (row.id === optimistic.id ? r.errand : row)),
			}));
			setBusyPig(null);
			void refresh();
			return r;
		},
		[state, refresh],
	);

	const claim = useCallback(
		async (id: number, action: "give" | "keep"): Promise<ClaimOutcome> => {
			setBusyId(id);
			const r = await claimErrand(id, action, newErrandNonce());
			setBusyId(null);
			// Any answer that settled the row (kept / given, or a refused give
			// that kept) takes it off the board.
			if (r.ok || r.status === "kept" || r.status === "given") {
				setState((s) => ({ ...s, board: s.board.filter((row) => row.id !== id) }));
			}
			void refresh();
			return r;
		},
		[refresh],
	);

	const recall = useCallback(
		async (id: number) => {
			setBusyId(id);
			const r = await recallPig(id);
			setBusyId(null);
			if (r.ok) {
				setState((s) => ({
					...s,
					out: s.out.filter((row) => row.id !== id),
					away: s.out.some((row) => row.id === id && row.pig_id === s.away) ? null : s.away,
				}));
			}
			void refresh();
			return r;
		},
		[refresh],
	);

	const summon = useCallback(
		async (id: number) => {
			const r = await devSummonReturn(id);
			if (!r.ok) return false;
			await refresh();
			return true;
		},
		[refresh],
	);

	return { state, available, loading, error, busyId, busyPig, refresh, send, claim, recall, summon };
}
