import { rpc } from "@/utils/rpc";

// The public, lifetime Truffle Patch record for one pig. These totals come from
// submitted war_rootings only; an opened-but-abandoned patch never becomes a
// dig (and therefore never contributes finds, motes, or echoes).
export interface PlayerDigStats {
	ok: true;
	user_id: string;
	digs: number;
	finds: number;
	motes: number;
	echoes: number;
}

interface PlayerDigStatsFailure {
	ok: false;
	reason?: string;
}

export async function fetchPlayerDigStats(
	userId: string,
): Promise<PlayerDigStats | null> {
	const result = await rpc<PlayerDigStats | PlayerDigStatsFailure>(
		"player_dig_stats",
		{ p_user_id: userId },
	);
	return result?.ok ? result : null;
}
