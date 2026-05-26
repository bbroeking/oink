// Receiver-side counterpart to utils/activeEffects: owns the
// friendship contract — the FriendshipStatus type, the friend cap,
// the reason→copy mapping, and typed wrappers around the six
// friendship RPCs. Render surfaces (Friends, UserSheet, Leaderboard)
// consume this; no other module reaches into the friendship state.
//
// Block / report stay outside this module (they're moderation, not
// friendship). public_user_stats stays at its call site (it's a
// profile fetch that happens to carry friendship_status; not a
// friendship-specific RPC).

import { rpc } from "./rpc";

// Hard cap on a user's friend count — must match the server-side
// limit enforced in send_friend_request + accept_friend_request
// (see supabase/migrations/20260541000000_friend_cap.sql).
export const FRIEND_CAP_LIMIT = 100;

export type FriendshipStatus =
	| "self"
	| "none"
	| "pending_outgoing"
	| "pending_incoming"
	| "friends";

// Basic profile shape returned by the friendship RPCs that surface
// candidates (suggested_users, search_users) and by the friend-list
// hydration in Friends.tsx (extras filled by a join in that query).
// Extras are optional so the same type covers both shapes.
export interface Profile {
	id: string;
	username: string | null;
	tickles_earned?: number;
	discriminator?: string | null;
	alignment_score?: number | null;
	active_hat_id?: string | null;
	// Joined-through name of the equipped hat — only present when the
	// Friends-list join query fills it. PostgREST returns 1:1 joins
	// as either an object or a length-1 array.
	active_hat?: { name: string } | { name: string }[] | null;
}

// Raw shape returned by send/accept_friend_request. `ok` is the
// success flag; on failure `reason` carries the server-side code and
// `cap` is included when the failure was an at-cap rejection.
export interface FriendActionResult {
	ok?: boolean;
	reason?: string;
	cap?: number;
}

// Maps a friendship-RPC failure reason to a human-readable line for
// the UI feedback strip. Single source of truth for the cap copy so
// at-cap messaging reads identically across the surfaces.
export function friendActionMessage(
	reason: string | undefined,
	cap: number | undefined,
	otherName: string | null
): string {
	const otherLabel = otherName ?? "this player";
	switch (reason) {
		case "at_cap":
			return `You're at the ${cap ?? FRIEND_CAP_LIMIT}-friend cap. Remove someone to add new friends.`;
		case "target_at_cap":
			return `${otherLabel} is at the friend cap.`;
		case "already_friends":
			return `You and ${otherLabel} are already friends.`;
		case "pending":
			return "A request is already pending.";
		case "self":
			return "That's you.";
		case "no_pending_request":
			return "No pending request to accept.";
		case "no_such_user":
		case "not_found":
			return "User not found.";
		default:
			return reason ?? "Couldn't complete that.";
	}
}

// Typed wrappers — each is a 1-2 line pass-through to rpc<T>() that
// concentrates the RPC name + return shape in one place. Call sites
// import the verb and forget the RPC name exists.

export function getFriendIds() {
	return rpc<string[]>("friend_ids");
}

export function sendFriendRequest(
	targetUsername: string | null,
	targetDiscriminator: string | null = null
) {
	return rpc<FriendActionResult>("send_friend_request", {
		target_username: targetUsername,
		target_discriminator: targetDiscriminator,
	});
}

export function acceptFriendRequest(otherUserId: string) {
	return rpc<FriendActionResult>("accept_friend_request", {
		other_user_id: otherUserId,
	});
}

export function cancelFriendRequest(targetUserId: string) {
	return rpc("cancel_friend_request", { target_user_id: targetUserId });
}

export function getSuggestedUsers(limit: number = 3) {
	return rpc<Profile[]>("suggested_users", { limit_n: limit });
}

export function searchUsers(prefix: string, maxResults: number = 10) {
	return rpc<Profile[]>("search_users", {
		prefix,
		max_results: maxResults,
	});
}
