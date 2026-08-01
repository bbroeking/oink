import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PigAnimation } from "@/components/ui/pigRendererContract";
import type { PigId } from "@/utils/pigs";
import { log } from "@/utils/log";

export const RIVE_PIG_ROLLOUT_KEY = "rive_pig_renderer_v0";

let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
	listeners.forEach((listener) => listener());
}

export async function loadRivePigRollout(): Promise<void> {
	try {
		enabled = (await AsyncStorage.getItem(RIVE_PIG_ROLLOUT_KEY)) === "1";
	} catch {
		enabled = false;
	}
	loaded = true;
	emit();
}

export async function setRivePigRolloutEnabled(next: boolean): Promise<void> {
	enabled = next;
	loaded = true;
	emit();

	try {
		await AsyncStorage.setItem(RIVE_PIG_ROLLOUT_KEY, next ? "1" : "0");
	} catch (error) {
		log.warn("[rive-pig:rollout-persist-failure]", String(error));
	}
}

export function getRivePigRolloutEnabled(): boolean {
	return enabled;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	if (!loaded) {
		loaded = true;
		void loadRivePigRollout();
	}
	return () => {
		listeners.delete(listener);
	};
}

export function useRivePigRolloutEnabled(): boolean {
	return useSyncExternalStore(
		subscribe,
		getRivePigRolloutEnabled,
		() => false,
	);
}

export interface RivePigRendererFailureContext {
	pigId: PigId;
	animation: PigAnimation;
	platform: string;
}

export function recordRivePigRendererFailure(
	error: Error,
	context: RivePigRendererFailureContext,
) {
	log.warn(
		"[rive-pig:renderer-failure]",
		JSON.stringify({
			message: error.message,
			...context,
		}),
	);
}

export function resetRivePigRolloutForTests() {
	enabled = false;
	loaded = false;
}
