// Expedition v0 — the React/AsyncStorage adapter around the pure kernel
// (utils/expedition.ts). This hook owns the clock (Date.now) and persistence
// (AsyncStorage key "expedition_v0"): it loads on mount, settles the elapsed
// away-time on mount + on focus, persists after every action, and exposes the
// dev time-warp. The kernel stays clockless + pure; every number lives there.
//
// v0 is client-local and dev-gated — no RPCs, no real currencies. See
// docs/expedition-v0-playable-spec.md.
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	initialState,
	settle,
	equipGear,
	tuckCard,
	tuckTraining,
	tickle as kTickle,
	playCard as kPlayCard,
	devWarp,
	type ExpeditionState,
	type TripReport,
	type SwingResult,
	type StatKey,
} from "@/utils/expedition";

const KEY = "expedition_v0";

// Fill any fields a persisted (older) save is missing so a partial blob can
// never crash a pure function (fail-soft, the repo's forward-compat posture).
function hydrate(raw: string | null, nowMs: number): ExpeditionState {
	if (!raw) return initialState(nowMs);
	try {
		const parsed = JSON.parse(raw) as Partial<ExpeditionState>;
		const base = initialState(
			typeof parsed.settledAtMs === "number" ? parsed.settledAtMs : nowMs
		);
		return {
			...base,
			...parsed,
			loadout: { ...base.loadout, ...(parsed.loadout ?? {}) },
			bestiary: { ...base.bestiary, ...(parsed.bestiary ?? {}) },
			deck: { ...(parsed.deck ?? base.deck) },
			gearOwned: parsed.gearOwned ?? base.gearOwned,
			training: parsed.training ?? base.training,
		};
	} catch {
		return initialState(nowMs);
	}
}

export function useExpedition() {
	const [state, setState] = useState<ExpeditionState | null>(null);
	const [pendingReport, setPendingReport] = useState<TripReport | null>(null);
	const ref = useRef<ExpeditionState | null>(null);

	const commit = useCallback((next: ExpeditionState) => {
		ref.current = next;
		setState(next);
		AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
	}, []);

	const settleNow = useCallback(
		(from: ExpeditionState) => {
			const { state: settled, report } = settle(from, Date.now());
			commit(settled);
			if (report) setPendingReport(report);
			return settled;
		},
		[commit]
	);

	// Load + settle on mount.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			let raw: string | null = null;
			try {
				raw = await AsyncStorage.getItem(KEY);
			} catch {
				raw = null;
			}
			if (cancelled) return;
			const loaded = hydrate(raw, Date.now());
			ref.current = loaded;
			settleNow(loaded);
		})();
		return () => {
			cancelled = true;
		};
	}, [settleNow]);

	// Re-settle whatever time passed while the screen was away (call on focus).
	const refresh = useCallback(() => {
		if (ref.current) settleNow(ref.current);
	}, [settleNow]);

	const equip = useCallback(
		(gearId: string) => {
			if (ref.current) commit(equipGear(ref.current, gearId));
		},
		[commit]
	);

	const tuck = useCallback(
		(cardId: string) => {
			if (ref.current) commit(tuckCard(ref.current, cardId));
		},
		[commit]
	);

	const train = useCallback(
		(cardId: string, stat: StatKey) => {
			if (ref.current) commit(tuckTraining(ref.current, cardId, stat));
		},
		[commit]
	);

	const tickle = useCallback(
		(opts?: { quiet?: boolean }): SwingResult | null => {
			if (!ref.current) return null;
			const { state: ns, burst } = kTickle(ref.current, opts);
			commit(ns);
			return burst;
		},
		[commit]
	);

	const playCard = useCallback((): SwingResult | null => {
		if (!ref.current) return null;
		const { state: ns, result } = kPlayCard(ref.current);
		commit(ns);
		return result;
	}, [commit]);

	// Dev-only: shift settledAtMs back so the next settle sees `hours` elapsed,
	// then settle immediately (drives the whole loop in the dev slice).
	const warp = useCallback(
		(hours: number) => {
			if (ref.current) settleNow(devWarp(ref.current, hours));
		},
		[settleNow]
	);

	const reset = useCallback(() => {
		setPendingReport(null);
		commit(initialState(Date.now()));
	}, [commit]);

	const dismissReport = useCallback(() => setPendingReport(null), []);

	return {
		state,
		ready: !!state,
		pendingReport,
		dismissReport,
		refresh,
		equip,
		tuck,
		train,
		tickle,
		playCard,
		warp,
		reset,
	};
}
