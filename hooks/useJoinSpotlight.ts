// The "join a Sounder" spotlight gate — decides whether to light the coach-mark
// over the join affordance, and remembers (per install) that it's been shown so
// it fires exactly once. Kept tiny and dependency-free (AsyncStorage + the path
// step) so the Spotlight primitive stays wiring-agnostic: this hook owns the ONE
// product decision of "should THIS spotlight show right now."
//
// Show conditions, all of which must hold:
//   • the master flag is on (SPOTLIGHT_ENABLED — __DEV__ for now, ships dark),
//   • the Sounder path is on the `join` step (crewless, past the taste dig),
//   • the seen-stamp is absent (never shown on this install).
//
// It self-arms once the step + stamp read lands (no flash), and `dismiss()`
// writes the stamp so it can't re-fire — call it the moment the player taps
// through the hole (or skips).

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SPOTLIGHT_ENABLED } from "@/constants/featureFlags";
import type { SounderStep } from "@/hooks/useSounderPath";

// Per-install stamp — versioned so a future copy/target revision can re-arm the
// spotlight for everyone by bumping the suffix.
export const JOIN_SPOTLIGHT_SEEN_KEY = "spotlight_seen_join_v1";

// The registry id the SpotlightTarget wrapping the join affordance uses. Exported
// so the target and the overlay reference one constant, never a loose string.
export const JOIN_SPOTLIGHT_TARGET_ID = "join-sounder";

export interface JoinSpotlight {
	/** True only when all show conditions hold — drive the overlay's activeId off this. */
	show: boolean;
	/** Stamp it seen (writes the gate) and hide it. Idempotent, fail-soft. */
	dismiss: () => void;
}

export function useJoinSpotlight(step: SounderStep | null): JoinSpotlight {
	// null until the seen-stamp read lands, so the overlay never flashes before we
	// know whether it's already been shown.
	const [seen, setSeen] = useState<boolean | null>(null);

	useEffect(() => {
		if (!SPOTLIGHT_ENABLED) {
			setSeen(true); // short-circuit: nothing to read, never shows.
			return;
		}
		let alive = true;
		AsyncStorage.getItem(JOIN_SPOTLIGHT_SEEN_KEY)
			.then((v) => alive && setSeen(!!v))
			.catch(() => alive && setSeen(true)); // fail-soft: a read hiccup hides it.
		return () => {
			alive = false;
		};
	}, []);

	const dismiss = useCallback(() => {
		setSeen(true);
		AsyncStorage.setItem(JOIN_SPOTLIGHT_SEEN_KEY, "1").catch(() => {
			// A missed stamp just means it may show once more next session — never
			// throws into the tap path.
		});
	}, []);

	const show = SPOTLIGHT_ENABLED && step === "join" && seen === false;

	return { show, dismiss };
}
