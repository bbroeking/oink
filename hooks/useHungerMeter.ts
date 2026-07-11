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

// ── Hunger CREDIT — the obfuscation layer ────────────────────────────
// Players see named LEVELS and big "hunger credit" numbers, never the raw
// server totals: credit = raw × HUNGER_CREDIT_SCALE. The real thresholds
// stay tiny and server-tunable while the season is live — we retune the
// server array freely and nothing players saw is contradicted, because
// every displayed number derives from what the server reports.
export const HUNGER_CREDIT_SCALE = 1000;

export const HUNGER_LEVEL_NAME: Record<HungerStage, string> = {
	gorged: "Gorged",
	stuffed: "Stuffed",
	full: "Full",
	peckish: "Peckish",
	hungry: "Hungry",
	famished: "Famished",
};

// PROVISIONAL display ladder for the season guide — mirrors the server's
// current thresholds ([40,100,200,340,520], 20260704200000) × the credit
// scale. These are placeholder magnitudes: we tune the real numbers
// server-side while the season runs; this mirror is display-only and only
// used where the live nextThreshold isn't available per-level.
export const HUNGER_LEVEL_CREDIT_PREVIEW: number[] = [
	0, 40, 100, 200, 340, 520,
].map((t) => t * HUNGER_CREDIT_SCALE);

export function hungerCredit(rawTotal: number): number {
	return rawTotal * HUNGER_CREDIT_SCALE;
}

export function formatCredit(n: number): string {
	return n.toLocaleString("en-US");
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

// Within-stage progress (0..1) — how far the herd has drained him toward the
// NEXT stage. The ceiling is the live next_threshold; the floor comes from the
// display-preview ladder (the server owns real boundaries, so a retune can
// briefly skew the floor — clamping keeps the bar honest-looking either way).
// 1 when he's famished (no next threshold left), 0 while the meter is dark.
export function stageProgress(
	m: Pick<HungerMeter, "stageIndex" | "total" | "nextThreshold" | "available">
): number {
	if (!m.available) return 0;
	if (m.nextThreshold == null) return 1;
	const floor = (HUNGER_LEVEL_CREDIT_PREVIEW[m.stageIndex] ?? 0) / HUNGER_CREDIT_SCALE;
	const span = m.nextThreshold - floor;
	if (span <= 0) return 0;
	return Math.max(0, Math.min(1, (m.total - floor) / span));
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
