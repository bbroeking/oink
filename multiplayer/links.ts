// Invite links. One canonical shape, two transports:
//   https://ticklethepig.com/play/<CODE>   (universal link; AASA path /play/*)
//   ticklethepig://play/<CODE>             (custom scheme; always routes)
// Expo Router maps both onto app/play/[code].tsx with no handler code, the same
// way /i/<code> reaches app/i/[code].tsx for referrals.

import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH, isInviteCode } from "./protocol";

export const INVITE_HOST = "ticklethepig.com";
export const INVITE_PATH = "play";

export function inviteUrl(code: string): string {
	return `https://${INVITE_HOST}/${INVITE_PATH}/${code}`;
}

export function inviteSchemeUrl(code: string): string {
	return `ticklethepig://${INVITE_PATH}/${code}`;
}

/** Pulls an invite code out of a URL, a scheme link, or a bare typed code.
 *  Case-insensitive; returns null for anything that isn't a valid code. */
export function parseInviteCode(input: string | null | undefined): string | null {
	if (!input) return null;
	const trimmed = input.trim();
	const match = trimmed.match(/(?:^|\/)play\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/);
	const candidate = (match ? match[1] : trimmed).toUpperCase();
	return isInviteCode(candidate) ? candidate : null;
}

/** A fresh invite code from a caller-supplied entropy source (the server
 *  passes crypto.randomInt). 30^8 ≈ 6.6e11, ~39 bits; invites expire in
 *  minutes and code lookups are rate-limited, so guessing is not a strategy. */
export function makeInviteCode(randomInt: (maxExclusive: number) => number): string {
	let out = "";
	for (let i = 0; i < INVITE_CODE_LENGTH; i++) out += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
	return out;
}
