import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function source(relativePath: string): string {
	return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("development-only previews", () => {
	test.each([
		["UI audit", "app/ui-audit.tsx", "/"],
		["barn visit", "app/barn-visit-preview.tsx", "/"],
		["barn housing", "app/barn-housing-preview.tsx", "/"],
		["idle battler", "app/idle-battler-prototype.tsx", "/"],
		["member perks", "app/member-perks-prototype.tsx", "/(tabs)/shop"],
	])("%s route redirects production deep links", (_name, route, fallback) => {
		const routeSource = source(route);
		expect(routeSource).toContain(
			`: () => <Redirect href="${fallback}" />;`,
		);
	});

	test("player-facing Wallow preview controls stay behind dev guards", () => {
		const account = source("components/Account.tsx");
		const leaderboard = source("components/Leaderboard.tsx");

		// The Wallow preview chip sits in the rank sheet, inside a __DEV__ branch.
		// It cycles the four shapes the ladder takes rather than one rank.
		expect(account).toMatch(
			/\{__DEV__ && \(\s*<View[^>]*>\s*<Chip[\s\S]*?Preview Wallow rank \$\{nextDevWallowRank\}/,
		);
		expect(account).toContain("const DEV_WALLOW_CYCLE = [0, 1, 6, 11] as const;");
		expect(leaderboard).toMatch(
			/\{__DEV__ && \(\s*<Chip[\s\S]*?Preview Wallow ranks/,
		);
	});

	test("the standalone barn route owns the all-tickled-out fixture", () => {
		const audit = source("components/dev/screens/ui-audit.tsx");
		const preview = source("components/dev/screens/barn-visit-preview.tsx");
		const visit = source("components/BarnVisitModal.tsx");

		expect(audit).not.toContain("BarnVisitModal");
		expect(preview).toContain("<BarnVisitModal");
		expect(preview).toContain('previewState="tickled-out"');
		expect(visit).toContain(
			'__DEV__ && previewState === "tickled-out"',
		);
	});
});

// The rank sheet is the ladder's ONE home (the endless ladder, 2026-09-22):
// the rung you stand on, the next rung and its prize, every later rung locked,
// and how to wallow. The old "current + next step, then a door to the closet"
// card is gone, and so is the closet door.
describe("the Wallow rank sheet is the ladder", () => {
	const account = source("components/Account.tsx");

	test("draws four rungs: here, next, later, and how to wallow", () => {
		expect(account).toContain("you're here");
		expect(account).toContain("W{nextRank} · one pass away");
		expect(account).toContain("then, forever");
		expect(account).toContain("how to wallow");
		expect(account).toContain("XP into this pass");
	});

	test("states the clock as a struck-through delta, never an arrow", () => {
		expect(account).toContain("currentBaseInterval");
		expect(account).toContain("nextBaseInterval");
		expect(account).toContain('struck: { textDecorationLine: "line-through" }');
		expect(account).not.toContain("{currentBaseInterval} → {nextBaseInterval}");
		expect(account).not.toContain("{currentVisitHours}h → {nextVisitHours}h");
	});

	test("says plainly when the clock has capped rather than showing a dead step", () => {
		expect(account).toContain("WALLOW_CLOCK_CAP_NOTE");
		expect(account).toContain("nextRank <= WALLOW_CLOCK_CAP_RANK");
	});

	test("wears the regalia from the sheet, through the Closet's own equip RPC", () => {
		expect(account).toContain('import { equipCosmetic } from "@/utils/cosmetics";');
		expect(account).toContain('label={wearing ? "wearing" : "wear it"}');
	});

	test("keeps no door to a prestige-filtered closet", () => {
		expect(account).not.toContain("prestige gear ·");
		expect(account).not.toContain("onOpenGear");
	});
});
