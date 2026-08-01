import {
	AccessibilityInfo,
	Animated,
	type EmitterSubscription,
} from "react-native";
import {
	createContext,
	useContext,
	useMemo,
	useSyncExternalStore,
	type ReactNode,
} from "react";

export const MOTION_DURATION = {
	feedback: 120,
	state: 220,
	modal: 300,
	celebration: 450,
	crossfade: 150,
} as const;

export interface MotionPolicy {
	reduceMotion: boolean;
	allowDecorativeMotion: boolean;
	largeTransition: "motion" | "crossfade";
	duration: (standardMs: number, reducedMs?: number) => number;
}

let systemReduceMotion = false;
let systemSubscription: EmitterSubscription | null = null;
const listeners = new Set<() => void>();

function publishSystemPreference(value: boolean) {
	if (systemReduceMotion === value) return;
	systemReduceMotion = value;
	listeners.forEach((listener) => listener());
}

function subscribeToSystemPreference(listener: () => void) {
	listeners.add(listener);
	if (!systemSubscription) {
		AccessibilityInfo.isReduceMotionEnabled()
			.then(publishSystemPreference)
			.catch(() => {});
		systemSubscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			publishSystemPreference
		);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			systemSubscription?.remove();
			systemSubscription = null;
		}
	};
}

function getSystemPreference() {
	return systemReduceMotion;
}

const MotionOverrideContext = createContext<boolean | undefined>(undefined);

export function MotionPolicyProvider({
	reduceMotion,
	children,
}: {
	reduceMotion?: boolean;
	children: ReactNode;
}) {
	return (
		<MotionOverrideContext.Provider value={reduceMotion}>
			{children}
		</MotionOverrideContext.Provider>
	);
}

export function useMotionPolicy(): MotionPolicy {
	const systemPreference = useSyncExternalStore(
		subscribeToSystemPreference,
		getSystemPreference,
		getSystemPreference
	);
	const override = useContext(MotionOverrideContext);
	const reduceMotion = override ?? systemPreference;

	return useMemo(
		() => ({
			reduceMotion,
			allowDecorativeMotion: !reduceMotion,
			largeTransition: reduceMotion ? "crossfade" : "motion",
			duration: (standardMs: number, reducedMs = MOTION_DURATION.crossfade) =>
				reduceMotion ? reducedMs : standardMs,
		}),
		[reduceMotion]
	);
}

export function startDecorativeLoop({
	policy,
	animation,
	rest,
}: {
	policy: MotionPolicy;
	animation: Animated.CompositeAnimation;
	rest?: () => void;
}) {
	if (!policy.allowDecorativeMotion) {
		rest?.();
		return () => {};
	}
	animation.start();
	return () => {
		animation.stop();
		rest?.();
	};
}
