import { useSyncExternalStore } from "react";

export type DevFeedingPhase = "open" | "guarded";
export type DevCeremony = "podium" | "mid" | "subquorum";
export type DevFunnelStep = "taste" | "join" | "first_dig";

export interface DevSeasonOverrides {
	phase?: DevFeedingPhase;
	ceremony?: DevCeremony;
	step?: DevFunnelStep;
	hungerStage?: number;
}

let snapshot: DevSeasonOverrides = {};
const EMPTY_SNAPSHOT: DevSeasonOverrides = {};
const listeners = new Set<() => void>();

export function getDevSeasonOverrides(): DevSeasonOverrides {
	return __DEV__ ? snapshot : EMPTY_SNAPSHOT;
}

export function setDevSeasonOverrides(next: DevSeasonOverrides): void {
	if (!__DEV__) return;
	snapshot = next;
	listeners.forEach((listener) => listener());
}

export function patchDevSeasonOverrides(
	patch: Partial<DevSeasonOverrides>,
): void {
	setDevSeasonOverrides({ ...snapshot, ...patch });
}

export function resetDevSeasonOverrides(): void {
	setDevSeasonOverrides({});
}

export function useDevSeasonOverrides(): DevSeasonOverrides {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getDevSeasonOverrides,
		() => EMPTY_SNAPSHOT,
	);
}

export function devCeremonyFixture(kind: DevCeremony) {
	if (kind === "podium") {
		return {
			cycle_key: "dev-podium",
			rank: 1,
			of: 7,
			truffles_paid: 6,
			tickles_paid: 50,
			cosmetic_hat_id: null,
		};
	}
	if (kind === "mid") {
		return {
			cycle_key: "dev-mid",
			rank: 4,
			of: 7,
			truffles_paid: 3,
			tickles_paid: 12,
			cosmetic_hat_id: null,
		};
	}
	return {
		cycle_key: "dev-subquorum",
		rank: 0,
		of: 7,
		truffles_paid: 0,
		tickles_paid: 5,
		cosmetic_hat_id: null,
	};
}
