// Sounder (crew) client RPC layer + types.
//
// A Sounder is a co-op roster: join-first membership, invites, leader handoff,
// leave/kick. It gates the Truffle Patch dig (crew_state minus the retired
// war/league fields). Query RPCs use rpc<T>(); action RPCs use rpcAction<T>()
// so every caller branches on the same { ok, reason } shape.

import { rpc, rpcAction, RpcResult } from "./rpc";
import { supabase } from "./supabase";
import { nonneg, coerceIntArray } from "./jsonb";

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

// A knock ON the caller's crew — a crewless pig asking to dig with the herd.
// Shown to every current member (any member may let them in / turn them away).
export interface JoinRequestIn {
	id: string;
	requester_id: string;
	username: string | null;
}

// A knock the caller (crewless) has out on an open Sounder, awaiting an answer.
export interface JoinRequestOut {
	id: string;
	crew_id: string;
	crew_name: string;
}

export interface CrewState {
	crew: Crew | null;
	members: CrewMember[];
	invitesIn: InviteIn[];
	invitesOut: InviteOut[];
	// Knock-to-join: incoming asks on the caller's crew (crewed), the caller's
	// own outgoing asks (crewless). crew_state() carries these; default [] when
	// the field is missing (so the client ships before the migration is pushed).
	joinRequestsIn: JoinRequestIn[];
	joinRequestsOut: JoinRequestOut[];
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
	joinRequestsIn: [],
	joinRequestsOut: [],
	lifetime_finds: 0,
	milestones_claimed: [],
};

// crew_state() nests `lifetime_finds` / `milestones_claimed` UNDER the `crew`
// object, but the flat CrewState contract every consumer reads puts them at the
// top level. Hoist them here at the single fetch chokepoint so callers stay on
// the flat shape (this is why the milestone bar read 0/150 while the server said
// 4 — the spread never lifted the nested values). The defensive coercers live in
// utils/jsonb.ts so the "never trust the wire" rules stay in one place.
export async function fetchCrewState(): Promise<CrewState> {
	// The wire uses snake_case for the two join-request arrays (the RPC nests
	// them as join_requests_in / join_requests_out) while the flat CrewState is
	// camelCase — map them here, fail-soft to [] so the client is safe against an
	// older server that predates the migration.
	const s = await rpc<Partial<CrewState> & {
		join_requests_in?: JoinRequestIn[];
		join_requests_out?: JoinRequestOut[];
	}>("crew_state");
	if (!s) return EMPTY_CREW_STATE;
	const nested = (s.crew ?? null) as Record<string, unknown> | null;
	return {
		...EMPTY_CREW_STATE,
		...s,
		joinRequestsIn: Array.isArray(s.join_requests_in) ? s.join_requests_in : [],
		joinRequestsOut: Array.isArray(s.join_requests_out) ? s.join_requests_out : [],
		lifetime_finds: nonneg(nested?.lifetime_finds ?? s.lifetime_finds),
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

// Founding takes no name — the server assigns a random one at birth
// (create_crew ignores p_name; see 20260738600000). We still send p_name: null
// to satisfy the RPC signature. (Sounder renaming is retired on the client for
// now — the server rename_crew RPC stays, just unwired.)
export function createCrew(): Promise<RpcResult<{ crew_id: string; name: string }>> {
	return rpcAction<{ crew_id: string; name: string }>("create_crew", { p_name: null });
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
// Take back an OUTGOING pending invite (frees the reserved seat). Any crew
// member may cancel. Envelope: { ok:true } | { ok:false, reason:
// 'not_authed'|'not_found'|'not_pending'|'not_your_crew' }.
export function cancelInvite(inviteId: string): Promise<RpcResult<{}>> {
	return rpcAction("cancel_crew_invite", { p_invite: inviteId });
}
export function leaveCrew(): Promise<RpcResult<{}>> {
	return rpcAction("leave_crew");
}
// Knock on an open Sounder — you ASK to join, a member answers (you don't force
// your way in). Envelope: { ok:true } | { ok:false, reason:
// 'unauthenticated'|'already_in_crew'|'not_found'|'crew_full'|'already_asked'|
// 'too_many_asks' }.
export function requestToJoin(crewId: string): Promise<RpcResult<{}>> {
	return rpcAction("request_to_join", { p_crew: crewId });
}
// Take back your OWN outgoing knock (only the requester may).
export function cancelJoinRequest(requestId: string): Promise<RpcResult<{}>> {
	return rpcAction("cancel_join_request", { p_request: requestId });
}
// Let a knocker in — any member of the request's crew may accept. On success the
// roster grows; { ok:false, reason:'crew_full' } means the door filled first.
export function acceptJoinRequest(requestId: string): Promise<RpcResult<{ crew_id: string }>> {
	return rpcAction<{ crew_id: string }>("accept_join_request", { p_request: requestId });
}
// A quiet no — any member turns a knock away (the requester isn't told).
export function declineJoinRequest(requestId: string): Promise<RpcResult<{}>> {
	return rpcAction("decline_join_request", { p_request: requestId });
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
