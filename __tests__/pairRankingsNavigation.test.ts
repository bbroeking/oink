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

	it("offers an accessible Bonds/Enemies toggle on the pairs page", () => {
		expect(leaderboard).toContain('label="Pair ranking"');
		// The first view is "Bonds" (the unit its rows count), so "Pairs" is no
		// longer both the scope and one of its views. (2026-10-04)
		expect(leaderboard).toContain('{ value: "pairs", label: "Bonds"');
		expect(leaderboard).toContain('{ value: "enemies", label: "Enemies"');
	});

	it("aligns the nested toggle to the primary scope track", () => {
		// The scope track and the list the nested toggle now heads read the same
		// token — PAGE_PAD, the hub's one edge (2026-10-04; SPACE.card before,
		// which jogged 4pt against the nav and the crown). The assertion follows
		// the token, not the pixel.
		expect(leaderboard).toMatch(
			/toggleWrap:\s*\{[\s\S]*?paddingHorizontal: PAGE_PAD,/,
		);
		expect(leaderboard).toMatch(
			/listContent:\s*\{[\s\S]*?paddingHorizontal: PAGE_PAD,/,
		);
	});

	it("gives each ranking its own list, so a switch opens at the top", () => {
		// Pairs and Enemies used to share one element slot, and the native
		// scroll view (with its offset) carried across: Enemies opened at its
		// bottom. A key per list remounts it. (2026-10-04)
		expect(leaderboard).toContain('key="pairs"');
		expect(leaderboard).toContain('key="enemies"');
		expect(leaderboard).toContain("key={scope}");
	});

	it("marks the caller's own name in a pair, not whichever name comes last", () => {
		// "DemoPig × FunnelWalker (you)" pinned the caller's word on the other
		// pig. The mark rides the name whose id is the caller's. (2026-10-04)
		expect(leaderboard).toContain("row.user_a === myId");
		expect(leaderboard).toContain("row.user_b === myId");
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
