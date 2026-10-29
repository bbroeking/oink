// The Board's rank column (utils/boardColumn.ts): lifetime until the server's
// Season 2 flip says otherwise, and every Board read follows the one cell.
import { readFileSync } from "fs";
import { join } from "path";
import {
	DEFAULT_BOARD_COLUMN,
	applyBoardColumnForTests,
	boardColumn,
	boardIsSeasonal,
	resetBoardColumnForTests,
	sanitizeBoardColumn,
} from "@/utils/boardColumn";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("board column cell", () => {
	afterEach(() => resetBoardColumnForTests());

	it("boots on the lifetime column, so an unflipped server ranks exactly as before", () => {
		expect(DEFAULT_BOARD_COLUMN.column).toBe("tickles_earned");
		expect(boardColumn()).toBe("tickles_earned");
		expect(boardIsSeasonal()).toBe(false);
	});

	it("accepts only the two known columns", () => {
		expect(sanitizeBoardColumn({ column: "tickles_earned" })).toEqual({ column: "tickles_earned" });
		expect(sanitizeBoardColumn({ column: "season_tickles_earned" })).toEqual({
			column: "season_tickles_earned",
		});
		for (const bad of [null, undefined, "season_tickles_earned", [], {}, { column: "counter" }, { column: 3 }]) {
			expect(sanitizeBoardColumn(bad)).toBeNull();
		}
	});

	it("reads the season column once the server flips it", () => {
		expect(applyBoardColumnForTests({ column: "season_tickles_earned" })).toBe(true);
		expect(boardColumn()).toBe("season_tickles_earned");
		expect(boardIsSeasonal()).toBe(true);
	});
});

describe("the Board follows the cell", () => {
	const hook = read("hooks/useLeaderboard.ts");
	const board = read("components/Leaderboard.tsx");
	const friends = read("app/(tabs)/friends.tsx");

	it("orders and counts by the cell's column, never a hard-coded one", () => {
		expect(hook).not.toMatch(/\.order\("tickles_earned"/);
		expect(hook).toMatch(/\.order\(col, \{ ascending: false \}\)/);
		expect(hook).toContain("`${col}.gt.${tickles},and(${col}.eq.${tickles},id.lt.${uid})`");
		expect(hook).toContain("await refreshBoardColumn()");
	});

	it("names the season leader and the season's tickles once seasonal", () => {
		expect(board).toContain('seasonal ? "★ season leader ★" : "★ all-time leader ★"');
		expect(friends).toContain(`"this season's tickles"`);
		expect(friends).toContain("onSeasonalChange={setBoardSeasonal}");
	});
});
