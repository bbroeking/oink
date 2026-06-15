// First-Week Checklist ("Rosie's chores") — typed wrappers around the
// onboarding RPCs (migration 20260649). Server is authoritative: the client
// renders progress and calls claimOnboarding(), which re-checks done-ness and
// pays at most once per milestone. The client never grants snouts itself.
//
// Spec: docs/onboarding-first-week-checklist-spec.md
import { rpc } from "./rpc";

// One checklist row as returned by onboarding_progress().
export interface OnboardingMilestone {
	id: string;
	name: string;
	description: string;
	icon: string | null;
	reward_snouts: number;
	display_order: number;
	done: boolean;
	claimed: boolean;
}

// One newly-granted milestone in a claim_onboarding() result.
export interface OnboardingClaim {
	id: string;
	name: string;
	icon: string | null;
	reward_snouts: number;
}

export interface OnboardingClaimResult {
	ok: boolean;
	claimed: OnboardingClaim[];
	snouts_granted: number;
}

const EMPTY_CLAIM: OnboardingClaimResult = {
	ok: false,
	claimed: [],
	snouts_granted: 0,
};

// The checklist rows (catalog × this user's done/claimed state). Empty array on
// any failure so callers can render "nothing to show" rather than crash.
export async function getOnboardingProgress(): Promise<OnboardingMilestone[]> {
	const rows = await rpc<OnboardingMilestone[]>("onboarding_progress");
	return rows ?? [];
}

// Grant every done-but-unclaimed milestone (idempotent server-side). Returns the
// newly-claimed rows + total snouts so the caller can celebrate + refresh stats.
export async function claimOnboarding(): Promise<OnboardingClaimResult> {
	const r = await rpc<OnboardingClaimResult>("claim_onboarding");
	return r ?? EMPTY_CLAIM;
}

// True once every milestone is claimed — the checklist can retire itself.
export function allOnboardingDone(rows: OnboardingMilestone[]): boolean {
	return rows.length > 0 && rows.every((m) => m.claimed);
}
