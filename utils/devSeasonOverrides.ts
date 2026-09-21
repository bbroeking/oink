import { useSyncExternalStore } from "react";

export type DevFeedingPhase = "open" | "guarded";
export type DevFunnelStep = "taste" | "join" | "first_dig";

export interface DevSeasonOverrides {
	phase?: DevFeedingPhase;
	step?: DevFunnelStep;
	hungerStage?: number;
}

let snapshot: DevSeasonOverrides = {};
const EMPTY_SNAPSHOT: DevSeasonOverrides = {};
const listeners = new Set<() => void>();

export function getDevSeasonOverrides(): DevSeasonOverrides {
	return __DEV__ ? snapshot : EMPTY_SNAPSHOT;
}

function setDevSeasonOverrides(next: DevSeasonOverrides): void {
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
