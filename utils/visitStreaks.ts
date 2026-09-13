import { rpcAction, type RpcResult } from "@/utils/rpc";

export interface FriendVisitStreak {
  target_id: string;
  current_streak: number;
  longest_streak: number;
  last_credit_at: string | null;
  active: boolean;
}

interface FriendVisitStreakResponse {
  streaks: FriendVisitStreak[];
}

export async function fetchFriendVisitStreaks(
  targetIds: string[],
): Promise<RpcResult<FriendVisitStreakResponse>> {
  if (targetIds.length === 0) return { ok: true, streaks: [] };
  return rpcAction<FriendVisitStreakResponse>("friend_visit_streaks", {
    p_targets: targetIds,
  });
}
