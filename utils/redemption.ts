// Golden-Ticket redemption — client helpers for the /scan-code screen and the
// deep-link handler. The SERVER (redeem_code RPC) is the single normalization
// chokepoint and the sole grant authority; everything here is convenience only
// (prefill, display), so a sloppy parse can never mis-grant — it just fails the
// server lookup with `unknown`.

// AsyncStorage key for a code that landed via deep link before the user was
// signed in. scan-code reads + clears it once a session exists (mirror of
// PENDING_REFERRAL_CODE_KEY in utils/referrals.ts).
export const PENDING_REDEMPTION_CODE_KEY = "pending_redemption_code";

// Display format: PIG-XXXX-XXXX over the mint alphabet (Crockford base32 minus
// 0/1/I/L/O/U — i.e. 2-9 and A-Z without I/L/O/U). The server stores the
// NORMALIZED form (UPPER, no dashes); this regex validates the dashed display
// form for the QR/deep-link path. Kept in sync with the ALPHABET in
// scripts/mint-redemption-codes.mjs.
export const REDEMPTION_CODE_PATTERN = /^PIG-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;

// Normalize a code the way the server does (upper, strip non-alphanumerics),
// so client-side display/echo matches what redeem_code() will look up. This is
// the SAME transform as the SQL chokepoint: upper(regexp_replace(p, '[^A-Za-z0-9]','','g')).
export function normalizeRedemptionCode(raw: string): string {
	return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// Re-add the display dashes to a normalized code: PIGXXXXXXXX → PIG-XXXX-XXXX.
// Falls back to the input unchanged if it isn't the expected 11-char shape.
export function formatRedemptionCode(normalized: string): string {
	const n = normalizeRedemptionCode(normalized);
	if (!/^PIG[0-9A-Z]{8}$/.test(n)) return normalized;
	return `PIG-${n.slice(3, 7)}-${n.slice(7, 11)}`;
}

// Pull a redemption code out of a scanned QR payload OR a deep link.
// Accepts, in order (spec §2.3):
//   1. a URL whose path matches `/redeem/<tail>` → the last path segment;
//   2. otherwise the raw string treated as a bare code.
// Returns the NORMALIZED code (UPPER, no dashes) or null if the input is empty.
// The host is NOT enforced: a typed/pasted bare code has no host, and the server
// re-normalizes + validates regardless, so accepting any host is safe and keeps
// the manual-entry path working.
export function parseRedemptionPayload(input: string | null | undefined): string | null {
	if (!input) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;

	// Try URL form first: take the last path segment after a `/redeem/` marker.
	// Match against host+pathname so BOTH the universal link
	// (https://ticklethepig.com/redeem/CODE — "redeem" is the first path segment)
	// AND the custom scheme (ticklethepig://redeem/CODE — "redeem" is the host)
	// resolve the same way.
	try {
		const parsed = new URL(trimmed);
		const hostPath = `/${parsed.host}${parsed.pathname}`;
		const match = hostPath.match(/\/redeem\/([^/?#]+)\/?$/i);
		if (match) {
			const code = normalizeRedemptionCode(match[1]);
			return code || null;
		}
	} catch {
		// Not a URL — fall through to bare-code handling.
	}

	// Bare code (typed off a poster, or a non-URL QR body).
	const code = normalizeRedemptionCode(trimmed);
	return code || null;
}

// Turns a redeem_code refusal reason into player-facing copy (spec §2.5).
// "Golden Ticket" / "code" is the chosen player word; no emoji.
export function redemptionErrorMessage(reason: string | undefined): string {
	switch (reason) {
		case "unknown":
			return "That code doesn't match anything in the barn.";
		case "expired":
			return "This code has gone stale.";
		case "exhausted":
			return "This code's all snuffled up.";
		case "already_redeemed":
			return "You've already claimed this one.";
		case "not_signed_in":
			return "Sign in to claim a code.";
		case "bad_grant":
			return "Something's off with this code — try another.";
		case "pouch_full":
			return "Your pouch is bursting — spend a little, then come back for this.";
		case "network":
		case "no_data":
		default:
			return "Couldn't check the code — try again in a bit.";
	}
}
