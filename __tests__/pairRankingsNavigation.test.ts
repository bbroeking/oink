import fs from "node:fs";
import path from "node:path";

const leaderboard = fs.readFileSync(
	path.resolve(__dirname, "../components/Leaderboard.tsx"),
	"utf8",
);
const enemyBreakdown = fs.readFileSync(
	path.resolve(__dirname, "../components/EnemyBreakdownSheet.tsx"),
	"utf8",
);

describe("pair rankings navigation", () => {
	it("keeps enemies inside the Pairs scope instead of adding a fourth top-level segment", () => {
		expect(leaderboard).toContain('? ["global", "friends", "pairs"]');
		expect(leaderboard).not.toContain(
			'? ["global", "friends", "pairs", "enemies"]',
		);
	});

	it("offers an accessible Pairs/Enemies toggle on the pairs page", () => {
		expect(leaderboard).toContain('label="Pair ranking"');
		expect(leaderboard).toContain('{ value: "pairs", label: "Pairs"');
		expect(leaderboard).toContain('{ value: "enemies", label: "Enemies"');
	});

	it("aligns the nested toggle to the primary scope track", () => {
		expect(leaderboard).toMatch(
			/pairToggleWrap:\s*\{[\s\S]*?paddingHorizontal: 14,/,
		);
	});

	it("opens directional details from an enemy row instead of expanding every row", () => {
		expect(leaderboard).toContain("setSelectedEnemy");
		expect(leaderboard).toContain("<EnemyBreakdownSheet");
		expect(leaderboard).toContain("tap to see who cursed whom");
		expect(enemyBreakdown).toContain('kicker="the rivalry receipt"');
		expect(enemyBreakdown).toContain("enemy.curses_a_to_b");
		expect(enemyBreakdown).toContain("enemy.curses_b_to_a");
	});
});
