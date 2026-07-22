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

// ── Storybook-seen (the first-run cinematic) ─────────────────────────────────
// The storybook Onboarding is DISTINCT from the checklist milestones above:
// it's the one-time "Hi, I'm Rosie!" walkthrough gated on the local
// `seen_onboarding` AsyncStorage flag. AsyncStorage is wiped on reinstall, so a
// veteran with a real account used to replay the whole storybook (issue #11).
// These mirror the flag server-side (profiles.storybook_seen, migration
// 20260747000000). BOTH fail SOFT: the client must keep working against today's
// prod schema, where the column + RPCs don't exist yet.

// Read the server mirror. Returns false when unknown — the RPC errored, the
// migration isn't pushed (rpc() maps PGRST202 → null), or the caller genuinely
// hasn't seen it. Callers treat false as "consult the local flag", so an
// unknown never wrongly suppresses the storybook for a true fresh install.
export async function getStorybookSeenServer(): Promise<boolean> {
	return (await rpc<boolean>("get_storybook_seen")) === true;
}

// Stamp the server mirror on storybook completion. Fire-and-forget / fail-soft:
// a swallowed miss just leaves the mirror unset, and the local flag alone still
// satisfies the gate this session.
export async function markStorybookSeenServer(): Promise<void> {
	await rpc("mark_storybook_seen");
}

// Gate decision for whether the storybook must run, given the local
// AsyncStorage flag, the server mirror, and whether a session exists to consult
// the server at all. Local "seen" ALWAYS wins (never re-storybook a current
// veteran, even offline — the rollout rule). With no local flag: consult the
// server when signed in; with no session we can't know yet, so keep the
// storybook armed (the common no-flag/no-session case is a genuine fresh
// install). Part A's fix means a server-suppressed veteran still gets their
// launch popups on that same fresh-install sign-in.
export function needsStorybook(input: {
	localSeen: boolean;
	serverSeen: boolean;
	hasSession: boolean;
}): boolean {
	if (input.localSeen) return false;
	if (!input.hasSession) return true;
	return !input.serverSeen;
}
