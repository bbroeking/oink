// Referrals module — code-based invite flow. Single owner of the
// referral contract: the persistent code format, the typed wrappers
// around the two client-callable RPCs (redeem_referral_code,
// my_referral_summary), the server-reason → user-copy mapping, and
// the URL/clipboard parsers used by the deep-link handler and the
// onboarding code-entry step.
//
// Same wrapper-shape pattern as utils/friendships.ts: pure helpers
// + thin RPC pass-throughs, no React, no AsyncStorage. The deep
// link handler in app/_layout.tsx and the onboarding screen
// compose these.

import { rpc } from "./rpc";

// Format of a shareable code: 5-char prefix (uppercase letters,
// X-padded if username was shorter), a dash, then 4 random
// alphanumeric chars. Matches what generate_referral_code() emits
// server-side. The pattern intentionally accepts 0-9 in the suffix
// only; the prefix is letters-only because the server strips
// non-alpha from the username before padding.
export const REFERRAL_CODE_PATTERN = /^[A-Z]{5}-[A-Z0-9]{4}$/;

// Universal Link host. The /i/<code> route is the canonical invite
// link we listen for in app/_layout.tsx; the apex landing page
// (hosted separately) renders code lookup + an App Store badge for
// uninstalled users. The legacy /r/<code> path is still accepted by
// the parser for links shared before the rename.
export const REFERRAL_URL_HOST = "ticklethepig.com";

// AsyncStorage key for a code that landed via deep link before the
// user was signed in. The onboarding code-entry step reads + clears
// it on mount so a tap-from-link install pre-fills the input.
export const PENDING_REFERRAL_CODE_KEY = "pending_referral_code";

// Caller's referral state for the Account "Refer friends" card.
// Shape mirrors the server-side jsonb returned by my_referral_summary.
// One invited friend's progress toward counting as a completed referral.
// `tickles` is server-capped at the 100-tickle completion gate.
export interface ReferralFriend {
	username: string | null;
	tickles: number;
	completed?: boolean; // present on recent_friends
	redeemed_at: string | null;
}

export interface ReferralSummary {
	ok: true;
	code: string;
	referrals_completed: number;
	referrals_pending: number;
	// The next ladder rung not yet reached (3/5/10/25/100/500/1000), or null
	// once all are earned.
	next_milestone_at: number | null;
	// ISO timestamp the referral-granted free month/period of Slop Club
	// expires, or null. Set at the 5/100/500/1000 milestones.
	slop_club_grant_until: string | null;
	// Invited friends who've redeemed but not yet completed (with progress).
	pending_friends: ReferralFriend[];
	// The 3 most recently referred friends (any status), for the card.
	recent_friends: ReferralFriend[];
}

// The referral reward ladder — completed-referral count → reward. Mirrors the
// server grants in 20260683_referral_reward_ladder.sql.
export const REFERRAL_LADDER: { count: number; reward: string }[] = [
	{ count: 3, reward: "Messenger Hat" },
	{ count: 5, reward: "Free month of Slop Club" },
	{ count: 10, reward: "Sounder Caller title + 500 snouts" },
	{ count: 25, reward: "Pen Marshal title + 1,500 snouts" },
	{ count: 100, reward: "Pied Piper title + 90 days Slop Club + 5,000 snouts" },
	{ count: 500, reward: "Patron of the Pen title + 180 days Slop Club + 20,000 snouts" },
	{ count: 1000, reward: "Worldbringer title + 1 year Slop Club + 100,000 snouts" },
];

// Short, inline reward name for the "{n} more for X" milestone foot line.
export function rewardNameForMilestone(count: number | null): string {
	switch (count) {
		case 3: return "the Messenger Hat";
		case 5: return "a free month of Slop Club";
		case 10: return "the Sounder Caller title";
		case 25: return "the Pen Marshal title";
		case 100: return "Pied Piper + 90 days of Slop Club";
		case 500: return "Patron of the Pen + 180 days of Slop Club";
		case 1000: return "Worldbringer + a year of Slop Club";
		default: return "the next reward";
	}
}

// Discriminated result from redeem_referral_code. `reason` carries
// the typed server-side check that failed so the onboarding step
// can render specific copy via referralErrorMessage.
export type ReferralRedeemReason =
	| "code_not_found"
	| "self_referral"
	| "already_redeemed"
	| "too_old"
	| "too_active"
	| "unauthenticated";

export type ReferralRedeemResult =
	| { ok: true; inviter_username: string | null }
	| { ok: false; reason: ReferralRedeemReason | string };

// Maps a redeem-RPC failure reason to a human-readable line for the
// onboarding error state. Single source of truth so the same copy
// reads identically across the onboarding code-entry step and any
// future re-prompt. Same shape as friendActionMessage().
export function referralErrorMessage(
	reason: string | undefined
): string {
	switch (reason) {
		case "code_not_found":
			return "Not a real code. Check with your friend?";
		case "self_referral":
			return "You can't use your own code.";
		case "already_redeemed":
			return "Already used — codes are one-per-pig.";
		case "too_old":
			return "Codes are for new players only — you're past the welcome window.";
		case "too_active":
			return "Codes are for new players only — you've already tickled a few times.";
		case "unauthenticated":
			return "Sign in to apply a code.";
		default:
			return reason ?? "Couldn't apply that code.";
	}
}

// Pulls a referral code out of a deep link. Returns the upper-cased
// code if the URL matches `https://<host>/i/<code>` (canonical) or
// the legacy `https://<host>/r/<code>` and the code passes the
// format regex; otherwise null. Tolerates trailing slashes, query
// strings, and case differences in the path tail.
export function parseReferralCodeFromUrl(url: string | null): string | null {
	if (!url) return null;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.hostname.toLowerCase() !== REFERRAL_URL_HOST) return null;
	// Match /i/<something> (canonical) or /r/<something> (legacy) at the
	// start of the path. Trim trailing slash.
	const match = parsed.pathname.match(/^\/[ir]\/([^/?#]+)\/?$/i);
	if (!match) return null;
	const candidate = match[1].toUpperCase();
	if (!REFERRAL_CODE_PATTERN.test(candidate)) return null;
	return candidate;
}

// Best-effort clipboard sniff: returns the matched code if the
// clipboard's string body matches the format regex (case-insensitive
// for resilience), otherwise null. Caller is expected to pull the
// clipboard contents itself via expo-clipboard and pass the string.
export function parseReferralCodeFromClipboard(
	contents: string | null | undefined
): string | null {
	if (!contents) return null;
	const trimmed = contents.trim().toUpperCase();
	if (!REFERRAL_CODE_PATTERN.test(trimmed)) return null;
	return trimmed;
}

// Pre-filled share message body for the Account card's Share
// button. Format matches the spec; the share sheet appends whatever
// the user's chosen transport prepends (mail subject, etc.).
export function shareMessageForCode(code: string): string {
	return `Come tickle a pig with me. My code:
${code}

https://${REFERRAL_URL_HOST}/i/${code}`;
}

// ── Typed RPC wrappers ──────────────────────────────────────────
// Each is a 1-2 line pass-through to rpc<T>() that concentrates the
// RPC name + return shape in one place. Call sites import the verb
// and forget the RPC name exists. generate_referral_code is server-
// only (called from handle_new_user + my_referral_summary), so no
// client wrapper is exported.

export function redeemReferralCode(code: string) {
	return rpc<ReferralRedeemResult>("redeem_referral_code", { p_code: code });
}

export function myReferralSummary() {
	return rpc<ReferralSummary | { ok: false; reason: string }>(
		"my_referral_summary"
	);
}
