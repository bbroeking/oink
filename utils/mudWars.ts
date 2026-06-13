// Sounder Mud Fights — client RPC layer + pure helpers.
//
// Mirrors utils/activeEffects.ts: typed wrappers concentrate the RPC
// names + result shapes for the new crew/war RPCs (see
// supabase/migrations/20260647000000_mud_fights.sql). Query RPCs use
// rpc<T>(); action RPCs use rpcAction<T>() so every caller branches on
// the same { ok, reason } shape. Pure helpers (perCapita, formatCountdown)
// live here so they're trivially unit-testable; the stateful hooks
// (useCrew, useMudWar) compose them in hooks/.

import { rpc, rpcAction, RpcResult } from "./rpc";
import { DAILY_ALLOTMENT } from "@/constants/mudFights";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Crew {
	id: string;
	name: string;
	leader_id: string | null;
	is_bot: boolean;
}

export interface CrewMember {
	user_id: string;
	username: string | null;
	role: "leader" | "member";
	active_title: string | null;
}

export interface InviteIn {
	id: string;
	crew_id: string;
	crew_name: string;
	inviter_id: string;
	inviter_name: string | null;
}

export interface InviteOut {
	id: string;
	invitee_id: string;
	invitee_name: string | null;
}

export interface CrewState {
	crew: Crew | null;
	members: CrewMember[];
	invitesIn: InviteIn[];
	invitesOut: InviteOut[];
	inWar: boolean;
	warId: string | null;
}

export interface WarSideMember {
	user_id: string;
	username: string | null;
	slings: number;
}

export interface WarSide {
	crew: { id: string; name: string; is_bot: boolean } | null;
	members: WarSideMember[];
	total: number;
	active: number | null;
	perCapita: number;
	quorumMet: boolean;
}

export type WarStatus = "pending" | "active" | "resolved" | "declined";

export interface WarState {
	warId: string;
	status: WarStatus;
	endsAt: string | null;
	isBotWar: boolean;
	winnerCrew: string | null;
	iAmChallenger: boolean;
	myRemainingToday: number;
	mine: WarSide;
	them: WarSide;
}

export interface ChallengeableCrew {
	id: string;
	name: string;
	memberCount: number;
}

// ── Query wrappers (rpc<T>) ──────────────────────────────────────────────────
// Each always resolves to a usable rest-state value (null/empty on error),
// matching fetchActiveEffects' "no useful distinction at the render layer".

const EMPTY_CREW_STATE: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	inWar: false,
	warId: null,
};

export async function fetchCrewState(): Promise<CrewState> {
	const s = await rpc<Partial<CrewState>>("crew_state");
	if (!s) return EMPTY_CREW_STATE;
	return { ...EMPTY_CREW_STATE, ...s };
}

export async function fetchWarState(warId?: string): Promise<WarState | null> {
	// my_war() finds the caller's current war; war_state(id) targets one.
	return warId
		? await rpc<WarState>("war_state", { p_war: warId })
		: await rpc<WarState>("my_war");
}

export async function fetchChallengeable(): Promise<ChallengeableCrew[]> {
	return (await rpc<ChallengeableCrew[]>("find_challengeable_crews")) ?? [];
}

// ── Action wrappers (rpcAction<T>) ───────────────────────────────────────────

export function createCrew(name: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("create_crew", { p_name: name });
}
export function inviteToCrew(inviteeId: string): Promise<RpcResult<{}>> {
	return rpcAction("invite_to_crew", { p_invitee: inviteeId });
}
export function acceptInvite(inviteId: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("accept_crew_invite", { p_invite: inviteId });
}
export function declineInvite(inviteId: string): Promise<RpcResult<{}>> {
	return rpcAction("decline_crew_invite", { p_invite: inviteId });
}
export function leaveCrew(): Promise<RpcResult<{}>> {
	return rpcAction("leave_crew");
}
export function challengeCrew(targetCrewId: string): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("challenge_crew", { p_target: targetCrewId });
}
export function challengeHouse(): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("challenge_house");
}
export function acceptChallenge(warId: string): Promise<RpcResult<{ war_id: string }>> {
	return rpcAction<{ war_id: string }>("accept_challenge", { p_war: warId });
}
export function declineChallenge(warId: string): Promise<RpcResult<{}>> {
	return rpcAction("decline_challenge", { p_war: warId });
}
export function slingMud(
	warId: string
): Promise<RpcResult<{ slings_today: number; remaining: number }>> {
	return rpcAction<{ slings_today: number; remaining: number }>("sling_mud", { p_war: warId });
}
export function resolveWar(warId: string): Promise<RpcResult<{ winner: string | null }>> {
	return rpcAction<{ winner: string | null }>("resolve_war", { p_war: warId });
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function perCapita(total: number, active: number | null): number {
	if (!active || active <= 0) return 0;
	return Math.round((total / active) * 10) / 10;
}

// Rope position 0..1 for the tug-of-war bar — my share of the combined
// per-capita score. 0.5 when even; clamps to [0,1]. Both-zero → centered.
export function ropePosition(mine: number, theirs: number): number {
	const sum = mine + theirs;
	if (sum <= 0) return 0.5;
	return Math.min(1, Math.max(0, mine / sum));
}

// Coarse countdown to war end ("2d 3h", "5h", "12m", "ended").
export function formatCountdown(iso: string | null): string {
	if (!iso) return "";
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "ended";
	const mins = Math.floor(ms / 60000);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) {
		const m = mins % 60;
		return m ? `${hrs}h ${m}m` : `${hrs}h`;
	}
	const days = Math.floor(hrs / 24);
	const h = hrs % 24;
	return h ? `${days}d ${h}h` : `${days}d`;
}

export function remainingToday(slingsToday: number): number {
	return Math.max(0, DAILY_ALLOTMENT - slingsToday);
}
