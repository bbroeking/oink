// The Great Hungerer's season energy meter — client read of hunger_meter()
// (supabase/migrations/20260704200000_hunger_meter.sql, read-only derived SUM
// of all war contribution this season).
//
// GRACEFUL FALLBACK: until that migration is applied (it's held for review),
// the RPC doesn't exist and rpc() resolves null — the hook then reports the
// season's opening state (stage "gorged") with available:false so surfaces can
// render the looming, un-dented boss rather than an error or a blank.

import { useCallback, useEffect, useState } from "react";
import { rpc } from "@/utils/rpc";

export type HungerStage =
	| "gorged"
	| "stuffed"
	| "full"
	| "peckish"
	| "hungry"
	| "famished";

export const HUNGER_STAGES: HungerStage[] = [
	"gorged",
	"stuffed",
	"full",
	"peckish",
	"hungry",
	"famished",
];

// Player-facing stage whisper (Patrick-Hand voice; the vignette shows the
// feeling, this line names it — never a number, per the taste standard).
export const HUNGER_STAGE_LINE: Record<HungerStage, string> = {
	gorged: "He's gorged — the whole valley's joy in his belly.",
	stuffed: "Stuffed, and still smug about it.",
	full: "Full — but the hoard is thinning.",
	peckish: "Peckish. He's noticed the missing truffles.",
	hungry: "Hungry — his crown sits crooked.",
	famished: "Famished. One good shove and he's gone.",
};

export interface HungerMeter {
	stage: HungerStage;
	stageIndex: number; // 0 (gorged) … 5 (famished)
	total: number; // cumulative server-wide mud (kept for dev/debug; not rendered)
	nextThreshold: number | null;
	available: boolean; // false until the RPC exists / responds
}

const FALLBACK: HungerMeter = {
	stage: "gorged",
	stageIndex: 0,
	total: 0,
	nextThreshold: null,
	available: false,
};

// Pure mapper — exported for tests and for anywhere that gets a raw index.
export function stageForIndex(index: number): HungerStage {
	const i = Math.max(0, Math.min(HUNGER_STAGES.length - 1, Math.floor(index)));
	return HUNGER_STAGES[i];
}

// Pure threshold mapper (mirrors the server fold; used by tests + any local
// preview). Boundaries are the server's to own — this mirror is display-only.
export function stageIndexForTotal(total: number, thresholds: number[]): number {
	let idx = 0;
	for (let i = 0; i < thresholds.length; i++) {
		if (total >= thresholds[i]) idx = i + 1;
	}
	return Math.min(idx, HUNGER_STAGES.length - 1);
}

interface Wire {
	total?: number;
	stage?: string;
	stage_index?: number;
	next_threshold?: number | null;
}

export function useHungerMeter(): HungerMeter & { refresh: () => Promise<void> } {
	const [meter, setMeter] = useState<HungerMeter>(FALLBACK);

	const refresh = useCallback(async () => {
		const data = await rpc<Wire>("hunger_meter");
		if (!data || typeof data.stage_index !== "number") {
			setMeter(FALLBACK);
			return;
		}
		setMeter({
			stage: stageForIndex(data.stage_index),
			stageIndex: Math.max(0, Math.min(5, data.stage_index)),
			total: data.total ?? 0,
			nextThreshold: data.next_threshold ?? null,
			available: true,
		});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { ...meter, refresh };
}
