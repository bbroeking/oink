// Truffle Patch dig / feeding-window server reads.
//
// Digging is crew-gated, purely co-op vs the Great Hungerer. This is the cheap
// poll RPC that backs the feeding strip's window state (countdown + who in your
// crew has already dug this feeding). The dig session itself (open/submit) lives
// in hooks/useRooting.ts; the pure board math in utils/rooting.ts.
//
// The global-race half of this module — standings reads, cycle math, and the
// pinned-row selectors — now lives in utils/race.ts (this file was ~90% race).

import { rpc } from "./rpc";
import { MILESTONE_THRESHOLDS } from "@/constants/dig";

// A crewmate who has already dug this feeding (feeding_state / open_rooting).
export interface CrewDug {
	user_id: string;
	display_name: string;
}

export interface FeedingState {
	window_index: number;
	window_ends_at: string;
	dug: boolean;
	crew_dug: CrewDug[];
}

export async function fetchFeedingState(): Promise<FeedingState | null> {
	return await rpc<FeedingState>("feeding_state");
}

// ── Herd milestones (lifetime herd finds → re-themed dig titles) ──────────────
// Server-granted at 150 / 600 / 1800 lifetime herd finds; every current member
// earns the title + a snout purse. This is the display side: a pure mapper the
// herd-milestones row and the SounderCard summary both read so the copy can
// never drift between them. Titles mirror the migration's milestone table.
export const MILESTONE_TITLES: Record<number, string> = {
	150: "Root Rustler",
	600: "Truffle Baron",
	1800: "Hunger's Bane",
};

export interface MilestoneProgress {
	lifetimeFinds: number;
	/** Highest milestone the herd has crossed (title + threshold), or null. */
	earnedTitle: string | null;
	earnedThreshold: number | null;
	/** The next milestone still to reach; null once all are earned. */
	nextTitle: string | null;
	nextThreshold: number | null;
	/** Within-band progress toward the next milestone, 0..1 (1 when all done). */
	pct: number;
	allDone: boolean;
}

// Pure — exported for tests + every milestone surface. Thresholds come from
// MILESTONE_THRESHOLDS (client mirror of the server table); `lifetimeFinds` is
// the herd's cumulative credited finds (crew_state.lifetime_finds).
export function milestoneProgress(lifetimeFinds: number): MilestoneProgress {
	const finds = Math.max(0, Math.floor(lifetimeFinds || 0));
	let earnedThreshold: number | null = null;
	let nextThreshold: number | null = null;
	for (const t of MILESTONE_THRESHOLDS) {
		if (finds >= t) earnedThreshold = t;
		else {
			nextThreshold = t;
			break;
		}
	}
	const allDone = nextThreshold == null;
	const floor = earnedThreshold ?? 0;
	const span = allDone ? 0 : nextThreshold! - floor;
	const pct = allDone
		? 1
		: span <= 0
			? 0
			: Math.max(0, Math.min(1, (finds - floor) / span));
	return {
		lifetimeFinds: finds,
		earnedTitle:
			earnedThreshold != null ? MILESTONE_TITLES[earnedThreshold] : null,
		earnedThreshold,
		nextTitle: nextThreshold != null ? MILESTONE_TITLES[nextThreshold] : null,
		nextThreshold,
		pct,
		allDone,
	};
}
