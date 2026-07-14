// Invite / join client rules for the Sounder surfaces — the pure decisions
// SounderCard and JoinableSounders make about incoming invites and open-crew
// joins, plus the failure copy those decisions surface. Kept free of React
// Native so jest tests the rules directly (the warCopy.ts / stepState.ts
// precedent). The copy lives here too so the two surfaces can never drift on
// the same message.

import { CREW_CAP } from "@/constants/crews";
import type { InviteIn } from "@/utils/crews";

const SEAT_WORDS = ["", "one", "two", "three", "four", "five"];

// An incoming invite is stale — its Join would lie — when the server already
// bounced its accept with crew_full (recorded in staleIds) OR the inviting
// crew is known to be at cap (member counts from friends_crews).
export function isInviteStale(
	inv: Pick<InviteIn, "id" | "crew_id">,
	staleIds: ReadonlySet<string>,
	crewSizes: ReadonlyMap<string, number>,
	cap: number = CREW_CAP
): boolean {
	if (staleIds.has(inv.id)) return true;
	const size = crewSizes.get(inv.crew_id);
	return size != null && size >= cap;
}

// The seat-count subline for a crew ("one seat left…"), or undefined when the
// count is unknown or the crew is already full. A pending outgoing invite
// reserves a seat, so `pendingCount` (default 0) counts against the vacancy —
// members + pending-out fill the roster, matching the server's combined-seat
// cap (open slots = cap - members - pendingOut).
export function seatsLine(
	memberCount: number | undefined,
	pendingCount: number = 0,
	cap: number = CREW_CAP
): string | undefined {
	if (memberCount == null) return undefined;
	const seats = cap - memberCount - pendingCount;
	if (seats === 1) return "one seat left at the trough";
	if (seats > 1) return `room for ${SEAT_WORDS[seats] ?? String(seats)} more snouts`;
	return undefined;
}

// Found-a-Sounder failure copy.
export function createError(reason?: string): string {
	switch (reason) {
		case "already_in_crew":
			return "You're already in a Sounder.";
		case "bad_name":
			return "Pick a name (1–24 characters).";
		default:
			return "Couldn't create your Sounder.";
	}
}

// Accepting an incoming invite: crew_full flips the row stale (no note, the
// seat line already updated); everything else surfaces a note. The one-Sounder
// invariant reads through already_in_crew.
export type AcceptOutcome = { kind: "stale" } | { kind: "note"; note: string };
export function acceptInviteResult(reason?: string): AcceptOutcome {
	if (reason === "crew_full") return { kind: "stale" };
	if (reason === "already_in_crew")
		return {
			kind: "note",
			note: "one Sounder at a time — leave yours to answer an invite.",
		};
	return { kind: "note", note: "Couldn't join — try again." };
}

// Joining an open Sounder (JoinableSounders) failure copy.
export function joinError(reason?: string): string {
	switch (reason) {
		case "crew_full":
			return "Just filled up — the herd moves fast.";
		case "crew_in_war":
			return "They're mid-war — catch them after.";
		case "already_in_crew":
			return "You're already in a Sounder.";
		default:
			return "Couldn't join — try another Sounder.";
	}
}
