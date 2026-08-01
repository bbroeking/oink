import { rpc, rpcAction } from "./rpc";

export interface PorchStop {
	id: number;
	pageNumber: number;
	stopNumber: number;
	targetUserId: string;
	targetName: string;
	visitedAt: string;
	activeHatId: string | null;
	wallowCount: number;
}

export interface PorchPage {
	pageNumber: number;
	stops: PorchStop[];
	complete: boolean;
}

interface PorchRoundResult {
	ok?: boolean;
	stops?: unknown;
}

export function parsePorchStops(value: unknown): PorchStop[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const row = entry as Record<string, unknown>;
		if (
			typeof row.id !== "number" ||
			typeof row.page_number !== "number" ||
			typeof row.stop_number !== "number" ||
			typeof row.target_user_id !== "string" ||
			typeof row.visited_at !== "string"
		) {
			return [];
		}
		return [{
			id: row.id,
			pageNumber: row.page_number,
			stopNumber: row.stop_number,
			targetUserId: row.target_user_id,
			targetName:
				typeof row.target_name === "string" && row.target_name.trim()
					? row.target_name.trim()
					: "A friendly pig",
			visitedAt: row.visited_at,
			activeHatId: typeof row.active_hat_id === "string" ? row.active_hat_id : null,
			wallowCount:
				typeof row.wallow_count === "number" && row.wallow_count >= 0
					? row.wallow_count
					: 0,
		}];
	});
}

export function groupPorchPages(stops: PorchStop[]): PorchPage[] {
	const pages = new Map<number, PorchStop[]>();
	for (const stop of stops) {
		const page = pages.get(stop.pageNumber) ?? [];
		page.push(stop);
		pages.set(stop.pageNumber, page);
	}
	return [...pages.entries()]
		.sort(([a], [b]) => b - a)
		.map(([pageNumber, pageStops]) => ({
			pageNumber,
			stops: pageStops.sort((a, b) => a.stopNumber - b.stopNumber),
			complete: pageStops.length === 3,
		}));
}

export async function fetchPorchRound(): Promise<PorchStop[] | null> {
	const result = await rpc<PorchRoundResult>("my_porch_round", { p_limit: 60 });
	return result?.ok ? parsePorchStops(result.stops) : null;
}

export async function recordPorchStop(targetUserId: string) {
	return rpcAction<{
		created?: boolean;
		page_number?: number;
		stop_number?: number;
	}>("record_porch_stop", { p_target: targetUserId });
}
