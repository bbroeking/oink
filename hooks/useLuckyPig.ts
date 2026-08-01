// Lucky Pig — the surprise +X tickle window mechanic. Owns:
//  • luckyTicklesLeft (how many tickles into the window we are)
//  • the trigger / double decision rolled on every tap
//  • the single Lucky Pig reward-modal lifecycle
//  • AsyncStorage persistence for window state, ever-triggered flag,
//    and pre-first tickle count (for the first-time guarantee)
//
// Pure roll math lives in utils/luckyPig.ts and is unit-tested
// without React. The hook layers React state + side-effects on top.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpc } from "@/utils/rpc";
import { log } from "@/utils/log";
import type { TitleRow } from "@/constants/title_types";

// Lazy-required so the app boots on dev binaries that pre-date the
// expo-store-review install (the native module ships with the iOS
// binary, not the JS bundle — a stale .app on the simulator throws
// "Cannot find native module 'ExpoStoreReview'" without this guard).
// Production / TestFlight builds rebuild the native side, so this
// require() succeeds and the prompt fires normally.
let StoreReview: typeof import("expo-store-review") | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	StoreReview = require("expo-store-review");
} catch {
	// native module not in this build; maybeAskForReview() bails below
}
import {
	LUCKY_DOUBLE_CHANCE,
	LUCKY_EVER_KEY,
	LUCKY_PRE_FIRST_KEY,
	LUCKY_STORAGE_KEY,
	LUCKY_TITLE_UNLOCK_CHANCE,
	LUCKY_WINDOW_SIZE,
	rollLucky,
} from "@/utils/luckyPig";

// Review prompt — fires the native iOS App Store review dialog ONCE
// per user, at the end of the first Lucky Pig flow. Pre-store-review
// the rating was organic; this is the explicit "ask at a value moment"
// timing (the burst modal + optional title unlock is the highest-
// emotion beat in the early experience). Apple silently rate-limits
// to 3 prompts/year per user so our AsyncStorage flag below mainly
// stops US from re-asking the same person.
//
// TestFlight caveat: Apple intentionally suppresses requestReview()
// on TestFlight + Ad Hoc + Xcode-installed builds; the prompt only
// actually displays on App Store-distributed installs. We CAN'T
// reliably distinguish TestFlight from App Store at runtime without
// a native receipt-URL check (which we don't have). So on TestFlight:
//   - The path executes, breadcrumbs log to Sentry (so timing is
//     verifiable), AsyncStorage flag gets set, dialog silently no-ops.
//   - Internal testers who later install from App Store will NOT see
//     the prompt because their AsyncStorage carries the flag.
//   - This is acceptable: testers aren't the rating audience.
//
// Sentry breadcrumbs at each branch let you confirm in TestFlight
// that the trigger fires at the right moment — when you see
// "[review] would fire (Apple may suppress on TestFlight)" in Sentry,
// the timing is verified even if no dialog appeared on-device.
const REVIEW_PROMPTED_KEY = "review_prompted_v1";

async function maybeAskForReview() {
	if (Platform.OS !== "ios") {
		log.info("[review] skipped — non-iOS");
		return;
	}
	if (__DEV__) {
		log.info("[review] skipped — __DEV__ build (Expo Go / dev client)");
		return;
	}
	if (!StoreReview) {
		log.info("[review] skipped — native module not available in this build");
		return;
	}
	try {
		const seen = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
		if (seen === "1") {
			log.info("[review] skipped — already prompted (review_prompted_v1=1)");
			return;
		}
		const hasAction = await StoreReview.hasAction();
		if (!hasAction) {
			log.info("[review] skipped — StoreReview.hasAction() returned false");
			return;
		}
		// Mark BEFORE prompting — if the prompt or app crashes mid-flow
		// we'd rather lose a prompt than badger the user.
		await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, "1");
		log.info("[review] would fire (Apple may suppress on TestFlight)");
		await StoreReview.requestReview();
	} catch (e) {
		log.error("[review] requestReview:", e);
	}
}

export interface LuckyTickleOutcome {
	// True if THIS tap triggered a fresh lucky window. The burst
	// modal will be open as a side-effect.
	triggered: boolean;
	// True if THIS tap (inside an existing window) rolled the double.
	// Caller is expected to fire the lucky_bonus_tickle RPC + the
	// "Lucky double!" toast.
	doubleEarned: boolean;
}

export interface UseLuckyPigOptions {
	// Used by the inline title-grant flow for
	// "Couldn't unlock" + "Lucky title sweep!" feedback toasts.
	showToast: (title: string, body: string) => void;
}

export interface UseLuckyPig {
	luckyTicklesLeft: number;
	luckyModalOpen: boolean;
	unlockedTitle: TitleRow | null;
	rollOnTickle: (sunBeamActive: boolean) => LuckyTickleOutcome;
	onBurstDismiss: () => void;
	// Constants surfaced for UI (LuckyPigModal needs window size +
	// the double percentage to render its "X tickles, 30% double" copy).
	windowSize: number;
	doublePercent: number;
}

export function useLuckyPig(opts: UseLuckyPigOptions): UseLuckyPig {
	const [luckyTicklesLeft, setLuckyTicklesLeft] = useState(0);
	const [luckyModalOpen, setLuckyModalOpen] = useState(false);
	const luckyModalOpenRef = useRef(false);
	// A lucky title, when granted, is folded into the same reward modal.
	const [unlockedTitle, setUnlockedTitle] = useState<TitleRow | null>(null);
	// Lifetime onboarding state — has the user ever triggered a lucky
	// pig? If not, count their tickles so we can force-fire on the Nth
	// to guarantee they see the feature. Refs so reads inside
	// rollOnTickle see the latest value without rerender churn.
	const everTriggeredRef = useRef(false);
	const preFirstTicklesRef = useRef(0);

	const showToastRef = useRef(opts.showToast);
	showToastRef.current = opts.showToast;

	// Hydrate from AsyncStorage on mount so state survives reload + cold start.
	useEffect(() => {
		AsyncStorage.getItem(LUCKY_STORAGE_KEY).then((raw) => {
			const n = raw ? parseInt(raw, 10) : 0;
			if (!Number.isNaN(n) && n > 0) setLuckyTicklesLeft(n);
		});
		AsyncStorage.getItem(LUCKY_EVER_KEY).then((raw) => {
			everTriggeredRef.current = raw === "1";
		});
		AsyncStorage.getItem(LUCKY_PRE_FIRST_KEY).then((raw) => {
			const n = raw ? parseInt(raw, 10) : 0;
			if (!Number.isNaN(n) && n > 0) preFirstTicklesRef.current = n;
		});
	}, []);

	const persistLucky = useCallback((n: number) => {
		setLuckyTicklesLeft(n);
		AsyncStorage.setItem(LUCKY_STORAGE_KEY, String(n)).catch(() => {});
	}, []);

	const markFirstLucky = useCallback(() => {
		everTriggeredRef.current = true;
		AsyncStorage.setItem(LUCKY_EVER_KEY, "1").catch(() => {});
	}, []);

	const bumpPreFirstTickles = useCallback(() => {
		preFirstTicklesRef.current += 1;
		AsyncStorage.setItem(
			LUCKY_PRE_FIRST_KEY,
			String(preFirstTicklesRef.current)
		).catch(() => {});
	}, []);

	const rollOnTickle = useCallback(
		(sunBeamActive: boolean): LuckyTickleOutcome => {
			// Already in a window — roll the double die instead.
			if (luckyTicklesLeft > 0) {
				const doubleEarned = Math.random() < LUCKY_DOUBLE_CHANCE;
				persistLucky(Math.max(0, luckyTicklesLeft - 1));
				return { triggered: false, doubleEarned };
			}

			// Not in a window — check the trigger.
			const isFirstTimeUser = !everTriggeredRef.current;
			if (isFirstTimeUser) bumpPreFirstTickles();
			const decision = rollLucky({
				isFirstTimeUser,
				preFirstTicklesIncludingThis: preFirstTicklesRef.current,
				sunBeamActive,
			});
			if (!decision.triggerNow) {
				return { triggered: false, doubleEarned: false };
			}

			if (isFirstTimeUser) markFirstLucky();
			persistLucky(LUCKY_WINDOW_SIZE);
			setUnlockedTitle(null);
			luckyModalOpenRef.current = true;
			setLuckyModalOpen(true);
			// Resolve the title sub-roll while the Lucky Pig surface is already
			// open. A grant appears inline; it never creates a second popup.
			if (Math.random() < LUCKY_TITLE_UNLOCK_CHANCE) {
				void Promise.resolve(
					rpc<{
						ok?: boolean;
						granted?: TitleRow | null;
					}>("unlock_random_lucky_title")
				)
					.then((r) => {
						if (!r) {
							showToastRef.current(
								"Couldn't unlock",
								"Title grant failed — try again next time."
							);
							return;
						}
						if (!r.granted) {
							showToastRef.current(
								"Lucky title sweep!",
								"You already own every lucky-drop title."
							);
							return;
						}
						if (luckyModalOpenRef.current) {
							setUnlockedTitle(r.granted);
						} else {
							showToastRef.current(
								`Title unlocked: ${r.granted.name}`,
								"Find it with your other titles in Me."
							);
						}
					})
					.catch(() => {
						showToastRef.current(
							"Couldn't unlock",
							"Title grant failed — try again next time."
						);
					});
			}
			return { triggered: true, doubleEarned: false };
		},
		[luckyTicklesLeft, bumpPreFirstTickles, markFirstLucky, persistLucky]
	);

	// Fires the review prompt ~1.2s after the lucky-pig modal chain
	// finishes — gives the burst/title animations time to settle so
	// the native dialog doesn't interrupt a transition. Only the
	// first lucky pig per user reaches this code path (the modal
	// only opens when triggered=true).
	const scheduleReviewPrompt = () => {
		setTimeout(() => { void maybeAskForReview(); }, 1200);
	};

	const onBurstDismiss = useCallback(() => {
		luckyModalOpenRef.current = false;
		setLuckyModalOpen(false);
		setUnlockedTitle(null);
		scheduleReviewPrompt();
	}, []);

	return {
		luckyTicklesLeft,
		luckyModalOpen,
		unlockedTitle,
		rollOnTickle,
		onBurstDismiss,
		windowSize: LUCKY_WINDOW_SIZE,
		doublePercent: Math.round(LUCKY_DOUBLE_CHANCE * 100),
	};
}
