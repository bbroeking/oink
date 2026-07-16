// The feedback nudge — a RARE, cozy invitation to whisper an idea to the den.
// A SIBLING of the Sounder launch nudge (utils/popupSession.ts): the same
// "fallback popup that fills the quiet and never competes" mechanism, at an
// even LOWER priority (onboarding beats feedback). It routes the player to the
// same "send an idea to the den" whisper dialog the Account settings row opens.
//
// The covenant (SKILL.md): "this game only ever pays you for showing up —
// nothing is ever taken." A feedback prompt is the easiest thing to turn into a
// review-nag, so the gates here are deliberately conservative. Rosie tilts her
// head and asks ONCE in a long while, only on a genuinely empty login, only
// after the player has real history, and never again for a long time after any
// showing — or ever, if the player asked us to stop.
//
// This module owns ONLY the pure AND-gate (shouldShowFeedbackNudge) and the
// per-user AsyncStorage stamp keys/writers. The arming/settle/queue-slot wiring
// lives in app/_layout.tsx (mirroring the Sounder nudge); the in-session
// fire-at-most-once latch lives in utils/popupSession.ts.

import AsyncStorage from "@react-native-async-storage/async-storage";

// The soft-dismiss / any-presentation cooldown: after the nudge is shown OR the
// player taps "not now", do not prompt again for at least this long. This is the
// real cross-session frequency ceiling (the session latch handles within-session).
export const FEEDBACK_NUDGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Someone who has EVER whispered to the den doesn't need prompting — back off
// hard. A player who already talks to us is the opposite of the player this
// nudge is for. Far longer than the base cooldown.
export const FEEDBACK_EVER_SENT_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

// Earned, not immediate: a brand-new player is NEVER prompted. Gate on distinct
// active days (an existing lifetime investment signal on the profiles row —
// `distinct_active_days`), matching the "real history" bar the referral gate
// uses. Three separate days of showing up is enough history to have an opinion.
export const FEEDBACK_NUDGE_MIN_ACTIVE_DAYS = 3;

// Per-user AsyncStorage stamp keys — namespaced by uid like the Sounder path's
// leaver/rejoin stamps, so switching accounts on one device can't cross wires.
/** Timestamp (ms, as a string) of the last time the nudge presented or was softly dismissed. */
export const feedbackNudgeLastKey = (uid: string) => `feedback_nudge_last_v1:${uid}`;
/** Present ("1") once the player taps "don't ask again" — a long/permanent opt-out. */
export const feedbackNudgeOffKey = (uid: string) => `feedback_nudge_off_v1:${uid}`;
/** Present ("1") once the player has EVER submitted feedback (stamped from the Account submit path). */
export const feedbackEverSentKey = (uid: string) => `feedback_ever_sent_v1:${uid}`;

// The evidence the gate is derived from — all cheap-to-read signals (one
// profiles field already fetched by the arming effect + three AsyncStorage
// stamps). Timestamps are ms epoch (or null when never stamped).
export interface FeedbackNudgeSignals {
	/** distinct_active_days off the player's profiles row — the "real history" signal. */
	activeDays: number;
	/** ms epoch of the last presentation / soft dismiss, or null if never. */
	lastStampMs: number | null;
	/** ms epoch the player first submitted feedback, or null if never. */
	everSentMs: number | null;
	/** True once the player tapped "don't ask again" — a hard opt-out. */
	optedOff: boolean;
	/** The current time in ms epoch (injected for testability). */
	nowMs: number;
}

// The PURE AND-gate, split out so it's unit-testable without the queue/settle/
// AsyncStorage plumbing — exactly the kind of layered condition that rots
// silently. Every layer is a reason to STAY QUIET; the nudge shows only when all
// pass. Ordered cheapest-and-most-decisive first.
export function shouldShowFeedbackNudge(s: FeedbackNudgeSignals): boolean {
	// 5. Hard opt-out — the player asked us to stop. Forever-ish.
	if (s.optedOff) return false;
	// 1. Earned, not immediate — a brand-new player is never prompted.
	if (s.activeDays < FEEDBACK_NUDGE_MIN_ACTIVE_DAYS) return false;
	// 4. Respect a submission — someone who already talks to us gets a much
	//    longer back-off after their last whisper.
	if (
		s.everSentMs !== null &&
		s.nowMs - s.everSentMs < FEEDBACK_EVER_SENT_COOLDOWN_MS
	) {
		return false;
	}
	// 3. Long cooldown — never within 14 days of any prior presentation / soft
	//    dismiss. This is the real cross-session ceiling.
	if (
		s.lastStampMs !== null &&
		s.nowMs - s.lastStampMs < FEEDBACK_NUDGE_COOLDOWN_MS
	) {
		return false;
	}
	return true;
}

// ---- Fail-soft AsyncStorage readers/writers ----
// Every one swallows its error: a storage hiccup must never nag (a failed READ
// resolves to "we don't know → stay quiet-safe by treating stamps as present is
// wrong; instead we treat a read miss as null and let the OTHER gates carry it).
// A failed WRITE at worst lets the nudge re-arm a session later — never a crash.

/** Parse a stored ms-timestamp stamp; null on absent/garbage. */
function parseStamp(raw: string | null): number | null {
	if (!raw) return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

/** Read all three per-user stamps in parallel. Fail-soft: any miss → null/false. */
export async function readFeedbackNudgeStamps(uid: string): Promise<{
	lastStampMs: number | null;
	everSentMs: number | null;
	optedOff: boolean;
}> {
	try {
		const [last, ever, off] = await Promise.all([
			AsyncStorage.getItem(feedbackNudgeLastKey(uid)),
			AsyncStorage.getItem(feedbackEverSentKey(uid)),
			AsyncStorage.getItem(feedbackNudgeOffKey(uid)),
		]);
		return {
			lastStampMs: parseStamp(last),
			everSentMs: parseStamp(ever),
			optedOff: off === "1",
		};
	} catch {
		// Total storage failure — don't nag. Treat as "opted off" for this read so
		// the gate stays quiet rather than firing blind.
		return { lastStampMs: null, everSentMs: null, optedOff: true };
	}
}

/** Stamp "the nudge just showed / was softly dismissed" — arms the 14-day cooldown. */
export async function stampFeedbackNudgeShown(uid: string): Promise<void> {
	try {
		await AsyncStorage.setItem(feedbackNudgeLastKey(uid), String(Date.now()));
	} catch {
		/* fail-soft: at worst it re-arms a session later */
	}
}

/** Stamp the hard opt-out — "don't ask again". */
export async function stampFeedbackNudgeOff(uid: string): Promise<void> {
	try {
		await AsyncStorage.setItem(feedbackNudgeOffKey(uid), "1");
	} catch {
		/* fail-soft */
	}
}

/** Stamp "the player has whispered to the den" — the 60-day respectful back-off. */
export async function stampFeedbackEverSent(uid: string): Promise<void> {
	try {
		await AsyncStorage.setItem(feedbackEverSentKey(uid), String(Date.now()));
	} catch {
		/* fail-soft */
	}
}
