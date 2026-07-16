// The Sounder onboarding path — a DERIVED state machine (never a stored flag, so
// it can't desync from what actually happened). It reports which of five steps a
// player is on, and the three onboarding surfaces (season-tab step card, Barn
// chip, launch modal) render off it. All three retire automatically at DONE.
//
// The steps, and exactly what each is derived from:
//
//   hook   — the tale hasn't been seen. Evidence: `s2_intro_seen:{uid}` absent
//            (the same stamp app/_layout.tsx sets when the intro modal closes).
//   taste  — tale seen, no practice dig logged. Evidence: intro stamp present,
//            `beginners_snout_tried_v1` absent (useRooting stamps it on the first
//            practice dig, so "practiced" == "snout tried" — one event).
//   join   — practiced, no crew. Folds the plan's VALUE + JOIN into one card
//            (benefits + join door). Evidence: practiced stamp present, no crew.
//            Also re-entered by a LEAVER: someone who was in a Sounder and left
//            (`sounder_left:{uid}` present) lands back here — with the `leaver`
//            flag set for encouragement copy — until they dismiss the nudge
//            (`rejoin_nudge_dismissed:{uid}`), after which this card retires to DONE.
//   first_dig — crewed, no real dig yet. Evidence: crew present,
//            `first_real_dig_done:{uid}` absent (useRooting stamps it on the first
//            real submit).
//   done   — crewed + a real dig logged. All surfaces render nothing/normal.
//
// Ordering note: the boundaries are checked top-down, so a player who somehow
// joined a crew before seeing the tale still reads `first_dig`/`done` (crew +
// real-dig evidence dominates) — the machine tracks the real terminal state, not
// a rigid tutorial order.

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
import { fetchCrewState } from "@/utils/crews";
import {
	introSeenKey,
	PRACTICED_KEY,
	firstRealDigKey,
	sounderLeftKey,
	rejoinDismissedKey,
} from "@/utils/sounderPath";

export type SounderStep = "hook" | "taste" | "join" | "first_dig" | "done";

// The evidence the step is derived from — all booleans (each is "stamp present").
export interface SounderEvidence {
	introSeen: boolean;
	practiced: boolean;
	firstDig: boolean;
	hasCrew: boolean;
	/** `sounder_left:{uid}` present — the player has left a Sounder at least once. */
	left: boolean;
	/** `rejoin_nudge_dismissed:{uid}` present — the leaver dismissed the nudge. */
	rejoinDismissed: boolean;
}

// The PURE boundary logic, split out so it's unit-testable without the hook's
// focus/AsyncStorage/RPC plumbing. Checked in terminal-state-dominant order: crew
// + real dig is DONE no matter the earlier stamps; then crewed-but-no-real-dig;
// then the crewless taste/join ladder. A LEAVER (practiced + crewless + has-left)
// lands back on `join` with `leaver:true` until they dismiss the nudge, after
// which the card retires to DONE. A re-joiner flows through the crewed branches.
export function deriveSounderStep(e: SounderEvidence): {
	step: SounderStep;
	leaver: boolean;
} {
	if (e.hasCrew) {
		return { step: e.firstDig ? "done" : "first_dig", leaver: false };
	}
	if (!e.introSeen) return { step: "hook", leaver: false };
	if (!e.practiced) return { step: "taste", leaver: false };
	if (e.left) {
		if (e.rejoinDismissed) return { step: "done", leaver: false };
		return { step: "join", leaver: true };
	}
	return { step: "join", leaver: false };
}

export interface SounderPath {
	/** The derived step, or null until the first read lands (no flash pre-confirm). */
	step: SounderStep | null;
	/**
	 * How many focus-sessions this player has been sitting on the CURRENT step
	 * (1 on the first session it's seen). Surfaces compress to a single-line
	 * variant once this passes the stall threshold — persistence without shouting.
	 */
	sessionsOnStep: number;
	/** True once sessionsOnStep crosses SOUNDER_STALL_SESSIONS — show the compact line. */
	stalled: boolean;
	/**
	 * True only on the `join` step reached BECAUSE the player left a Sounder (and
	 * hasn't dismissed the rejoin nudge). Swaps the join card's copy for
	 * leaver-specific encouragement + a quiet dismiss control. False everywhere else.
	 */
	leaver: boolean;
	/** Re-read the step (e.g. after a dig / join). */
	refresh: () => void;
}

// After this many sessions parked on the same step, the inline card compresses to
// its single-line "still herdless — join a Sounder ›" variant (escape valve so
// persistence never curdles into nagging).
export const SOUNDER_STALL_SESSIONS = 3;

// Per-step session counter — remembers which step we last counted a session for,
// and how many sessions have accrued on it. Resets to 1 whenever the step changes.
const STALL_KEY = "sounder_path_stall_v1";
type StallRecord = { step: SounderStep; count: number };

async function readUid(): Promise<string | null> {
	const { data } = await supabase.auth.getSession();
	return data.session?.user?.id ?? null;
}

// Bump (or reset) the session counter for the resolved step, returning the new
// count. A change of step resets to 1; the same step increments. Fail-soft: any
// storage hiccup reports 1 (never stalls a fresh reader into the compact variant).
async function bumpSessionCounter(step: SounderStep): Promise<number> {
	try {
		const raw = await AsyncStorage.getItem(STALL_KEY);
		const prev = raw ? (JSON.parse(raw) as StallRecord) : null;
		const count = prev && prev.step === step ? prev.count + 1 : 1;
		await AsyncStorage.setItem(
			STALL_KEY,
			JSON.stringify({ step, count } satisfies StallRecord)
		);
		return count;
	} catch {
		return 1;
	}
}

/**
 * Derive the onboarding step from real state. Reads on focus (cheap: one
 * getSession + one crew_state RPC + a few AsyncStorage reads, mirroring the Barn
 * chip's one-shot crew read). Never subscribes — the step is a snapshot, refreshed
 * on focus and via refresh().
 */
export function useSounderPath(enabled = true): SounderPath {
	const [step, setStep] = useState<SounderStep | null>(null);
	const [sessionsOnStep, setSessionsOnStep] = useState(1);
	const [leaver, setLeaver] = useState(false);

	const derive = useCallback(async () => {
		const uid = await readUid();
		if (!uid) {
			setStep(null);
			setLeaver(false);
			return;
		}
		// The evidence, read in parallel — the crew RPC is the only network hop.
		const [introSeen, practiced, firstDig, left, rejoinDismissed, crewState] =
			await Promise.all([
				AsyncStorage.getItem(introSeenKey(uid)),
				AsyncStorage.getItem(PRACTICED_KEY),
				AsyncStorage.getItem(firstRealDigKey(uid)),
				AsyncStorage.getItem(sounderLeftKey(uid)),
				AsyncStorage.getItem(rejoinDismissedKey(uid)),
				fetchCrewState(),
			]);
		const hasCrew = !!crewState.crew;

		// Back in a herd — clear the dismissed stamp so leaving AGAIN later re-arms
		// the nudge. Fire-and-forget; a miss just lingers a session.
		if (hasCrew && rejoinDismissed) {
			AsyncStorage.removeItem(rejoinDismissedKey(uid)).catch(() => {});
		}

		const { step: next, leaver: isLeaver } = deriveSounderStep({
			introSeen: !!introSeen,
			practiced: !!practiced,
			firstDig: !!firstDig,
			hasCrew,
			left: !!left,
			rejoinDismissed: !!rejoinDismissed,
		});

		setStep(next);
		setLeaver(isLeaver);
		// Count this session on the resolved step (skip DONE — nothing to stall on).
		if (next === "done") {
			setSessionsOnStep(1);
		} else {
			setSessionsOnStep(await bumpSessionCounter(next));
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			if (!enabled) return;
			let cancelled = false;
			derive().catch(() => {
				if (!cancelled) {
					setStep(null);
					setLeaver(false);
				}
			});
			return () => {
				cancelled = true;
			};
		}, [enabled, derive])
	);

	return {
		step,
		sessionsOnStep,
		stalled: sessionsOnStep >= SOUNDER_STALL_SESSIONS,
		leaver,
		refresh: () => {
			derive().catch(() => {});
		},
	};
}
