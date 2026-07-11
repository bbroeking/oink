// Sounder (crew) client RPC layer + types.
//
// A Sounder is a co-op roster: join-first membership, invites, leader handoff,
// leave/kick. It gates the Truffle Patch dig (crew_state minus the retired
// war/league fields). Query RPCs use rpc<T>(); action RPCs use rpcAction<T>()
// so every caller branches on the same { ok, reason } shape.

import { rpc, rpcAction, RpcResult } from "./rpc";
import { supabase } from "./supabase";

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
	// Herd milestones: cumulative credited finds for the whole Sounder + which
	// milestone thresholds it has already claimed (server-granted, idempotent).
	// crew_state() now carries these; default 0/[] when the caller has no crew.
	lifetime_finds: number;
	milestones_claimed: number[];
}

// An open Sounder the caller could join without an invite: has a free slot and
// at least one member (find_joinable_crews mirrors these).
export interface JoinableCrew {
	id: string;
	name: string;
	memberCount: number;
	leaderName: string | null;
}

// Which Sounder a friend of the caller is in (friends_crews). Friends with
// no crew simply don't appear.
export interface FriendCrew {
	friend_id: string;
	crew_id: string;
	crew_name: string;
	memberCount: number;
}

// ── Query wrappers (rpc<T>) ──────────────────────────────────────────────────
// Each always resolves to a usable rest-state value (null/empty on error).

const EMPTY_CREW_STATE: CrewState = {
	crew: null,
	members: [],
	invitesIn: [],
	invitesOut: [],
	lifetime_finds: 0,
	milestones_claimed: [],
};

// crew_state() nests `lifetime_finds` / `milestones_claimed` UNDER the `crew`
// object, but the flat CrewState contract every consumer reads puts them at the
// top level. Hoist them here at the single fetch chokepoint so callers stay on
// the flat shape (this is why the milestone bar read 0/150 while the server said
// 4 — the spread never lifted the nested values).
function coerceNonNegInt(v: unknown): number {
	const n = Math.floor(Number(v));
	return Number.isFinite(n) && n > 0 ? n : 0;
}
function coerceIntArray(v: unknown): number[] {
	if (!Array.isArray(v)) return [];
	return v.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n));
}

export async function fetchCrewState(): Promise<CrewState> {
	const s = await rpc<Partial<CrewState>>("crew_state");
	if (!s) return EMPTY_CREW_STATE;
	const nested = (s.crew ?? null) as Record<string, unknown> | null;
	return {
		...EMPTY_CREW_STATE,
		...s,
		lifetime_finds: coerceNonNegInt(nested?.lifetime_finds ?? s.lifetime_finds),
		milestones_claimed: coerceIntArray(
			nested?.milestones_claimed ?? s.milestones_claimed
		),
	};
}

export async function fetchJoinable(): Promise<JoinableCrew[]> {
	return (await rpc<JoinableCrew[]>("find_joinable_crews")) ?? [];
}

export async function fetchFriendsCrews(): Promise<FriendCrew[]> {
	return (await rpc<FriendCrew[]>("friends_crews")) ?? [];
}

// crew_state's member payload carries no avatar fields, so this fills that gap:
// one profiles read keyed by member id → a map of user_id → equipped hat, so
// crew surfaces render the SAME PigAvatar look a Leaderboard row does.
export async function fetchMemberHats(
	userIds: string[]
): Promise<Map<string, string | null>> {
	if (userIds.length === 0) return new Map();
	const { data } = await supabase
		.from("profiles")
		.select("id, active_hat_id")
		.in("id", userIds);
	const rows = (data as { id: string; active_hat_id: string | null }[] | null) ?? [];
	return new Map(rows.map((r) => [r.id, r.active_hat_id]));
}

// ── Action wrappers (rpcAction<T>) ───────────────────────────────────────────

export function createCrew(name: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("create_crew", { p_name: name });
}
// Leader-only rename. Server envelope: { ok:true } | { ok:false, reason:
// 'bad_name'|'not_leader'|'unauthenticated' }. Degrades gracefully (r.ok false)
// when the migration isn't pushed yet.
export function renameCrew(name: string): Promise<RpcResult<{}>> {
	return rpcAction<{}>("rename_crew", { p_name: name });
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
export function joinCrew(crewId: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("join_crew", { p_crew: crewId });
}
export function transferCrewLeadership(newLeaderId: string): Promise<RpcResult<{}>> {
	return rpcAction("transfer_crew_leadership", { p_new_leader: newLeaderId });
}
export function kickCrewMember(memberId: string): Promise<RpcResult<{}>> {
	return rpcAction("kick_crew_member", { p_member: memberId });
}

// ── The Chorus / echo — a crewmate's lucky pig you can catch (co-op) ─────────
export function claimEcho(): Promise<RpcResult<{ tickles: number }>> {
	return rpcAction<{ tickles: number }>("claim_echo");
}

// The caller's currently catchable echo (crewmate's lucky pig, <10 min,
// unclaimed) — null when the bog is quiet.
export interface EchoState {
	id: number;
	sourceName: string | null;
	expiresAt: string;
}
export async function fetchActiveEcho(): Promise<EchoState | null> {
	return (await rpc<EchoState | null>("active_echo")) ?? null;
}
