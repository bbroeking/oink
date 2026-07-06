// Pure state mapper for the Season-1 Sounder walkthrough stepper — which of
// the three founding steps the player is on, derived from crew + war state.
// Kept free of React/React-Native imports so jest can test it directly.

import type { CrewState } from "@/utils/mudWars";

// The stepper's four states. "join"/"invite"/"march" are the three visible
// steps ("join" covers both joining an open Sounder and founding one — the
// join path leads); "war" collapses the stepper into the compact live-war
// strip.
export type SounderStepKey = "join" | "invite" | "march" | "war";

export interface SounderStepView {
	current: SounderStepKey;
	/** Steps rendered as completed stamps (in display order). */
	done: Exclude<SounderStepKey, "war">[];
}

// no crew            → join
// crew, in a war     → war (regardless of roster size — the war strip leads)
// crew of 1          → invite
// crew of 2+         → march
export function sounderStepFor(crew: CrewState): SounderStepKey {
	if (!crew.crew) return "join";
	if (crew.inWar && crew.warId) return "war";
	if (crew.members.length < 2) return "invite";
	return "march";
}

export function sounderStepView(crew: CrewState): SounderStepView {
	const current = sounderStepFor(crew);
	switch (current) {
		case "join":
			return { current, done: [] };
		case "invite":
			return { current, done: ["join"] };
		case "march":
			return { current, done: ["join", "invite"] };
		case "war":
			return { current, done: ["join", "invite", "march"] };
	}
}

// Which day of the siege we're on, from the end time (mirrors mud-war.tsx's
// siegeDay — duplicated here because that one is module-private).
export function warDay(endsAt: string | null, totalDays: number): number {
	if (!endsAt) return 1;
	const daysLeft = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
	return Math.min(totalDays, Math.max(1, totalDays - daysLeft + 1));
}

// Rope lean → cozy standing copy for the compact war strip.
export function ropeLeanLine(ropeNorm: number | null | undefined): string {
	if (ropeNorm == null || Math.abs(ropeNorm) < 0.08) return "Dead even — every dig counts.";
	if (ropeNorm >= 0.75) return "You're routing them — keep pulling.";
	if (ropeNorm > 0) return "Your Sounder leads the rope.";
	if (ropeNorm <= -0.75) return "They're close to a rout — rally!";
	return "They lead — the bog remembers comebacks.";
}
