// Player-safety actions shared by UserSheet and the Me-tab block manager.
// Keep the RPC names and blocked-list hydration in one place so every surface
// handles transport/server failures instead of presenting a false success.

import { rpcAction, type RpcResult } from "./rpc";
import { supabase } from "./supabase";

export type BlockedUser = {
	id: string;
	username: string | null;
	discriminator: string | null;
	blockedAt: string;
};

export async function fetchBlockedUsers(
	blockerId: string
): Promise<BlockedUser[]> {
	const { data: blocks, error } = await supabase
		.from("user_blocks")
		.select("blocked_id, created_at")
		.eq("blocker_id", blockerId)
		.order("created_at", { ascending: false });

	if (error) throw error;
	if (!blocks?.length) return [];

	const blockedIds = blocks.map((block) => block.blocked_id);
	const { data: profiles } = await supabase
		.from("profiles")
		.select("id, username, discriminator")
		.in("id", blockedIds);

	// Profile hydration is deliberately fail-soft. A missing/deleted profile
	// must never strand a block that the player still needs to remove.
	const profilesById = new Map(
		(profiles ?? []).map((profile) => [profile.id, profile])
	);
	return blocks.map((block) => {
		const profile = profilesById.get(block.blocked_id);
		return {
			id: block.blocked_id,
			username: profile?.username ?? null,
			discriminator: profile?.discriminator ?? null,
			blockedAt: block.created_at,
		};
	});
}

export function blockUser(
	targetUserId: string
): Promise<RpcResult<Record<string, never>>> {
	return rpcAction("block_user", { target_user_id: targetUserId });
}

export function unblockUser(
	targetUserId: string
): Promise<RpcResult<Record<string, never>>> {
	return rpcAction("unblock_user", { target_user_id: targetUserId });
}

export function reportUser(
	targetUserId: string,
	reason = "user_report"
): Promise<RpcResult<Record<string, never>>> {
	return rpcAction("report_user", {
		target_user_id: targetUserId,
		reason,
	});
}
