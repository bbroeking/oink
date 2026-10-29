// Which profiles column the Board ranks by: app_settings.board_sort_column,
// read through the shared server-config lifecycle (utils/configCell.ts, the
// build-151 "config over constants" contract).
//
// WHY: Season 2 (The Feast) baselines the Board at the flip. The lifetime
// number (profiles.tickles_earned, the Exterior's earned stamp) is never
// zeroed; the migration 20261029190000_season_2_the_feast adds
// profiles.season_tickles_earned (tickles_earned minus a per-pig baseline the
// flip writes) and flips this row to it. Until then the row says
// "tickles_earned", and so does the compiled fallback, so this binary ranks
// exactly as before on a server that has not pushed the migration (the column
// would not exist yet) and on one that has but has not flipped.
//
// FAIL-SOFT: no row / RPC missing / offline / an unknown column name keeps
// what the cell has (ultimately the lifetime column). Cached across launches
// so a flipped Board does not open on lifetime numbers for one fetch.

import { createConfigCell } from "@/utils/configCell";

export type BoardColumn = "tickles_earned" | "season_tickles_earned";

export interface BoardColumnConfig {
	column: BoardColumn;
}

export const DEFAULT_BOARD_COLUMN: BoardColumnConfig = Object.freeze({
	column: "tickles_earned" as const,
});

const BOARD_COLUMNS: readonly BoardColumn[] = ["tickles_earned", "season_tickles_earned"];

/** Accept only a known column; anything else is rejected (the cell keeps its value). Test seam. */
export function sanitizeBoardColumn(raw: unknown): BoardColumnConfig | null {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
	const column = (raw as Record<string, unknown>).column;
	return typeof column === "string" && (BOARD_COLUMNS as readonly string[]).includes(column)
		? { column: column as BoardColumn }
		: null;
}

const cell = createConfigCell<BoardColumnConfig>({
	key: "board_sort_column",
	fallback: DEFAULT_BOARD_COLUMN,
	sanitize: sanitizeBoardColumn,
	cacheKey: "board_sort_column_v1",
	minRefreshMs: 60_000,
});

/** The column the Board ranks by right now. Synchronous. */
export function boardColumn(): BoardColumn {
	return cell.read().column;
}

/** True once the server has season-scoped the Board. */
export function boardIsSeasonal(): boolean {
	return boardColumn() === "season_tickles_earned";
}

let hydrated = false;

/** Hydrate from the cache once, then fetch (debounced). Resolves true when the column moved. */
export async function refreshBoardColumn(): Promise<boolean> {
	if (!hydrated) {
		hydrated = true;
		await cell.hydrate();
	}
	return cell.refresh();
}

/** Test seam: install a value as if the server sent it. */
export const applyBoardColumnForTests = (next: BoardColumnConfig): boolean => cell.apply(next);
/** Test seam: back to the compiled fallback. */
export const resetBoardColumnForTests = (): void => {
	hydrated = false;
	cell.resetForTests();
};
