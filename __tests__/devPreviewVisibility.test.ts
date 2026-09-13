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

		expect(account).toContain(
			"onTogglePreview={__DEV__ ? () => setDevWallowPreview",
		);
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

describe("Me-page Wallow progression", () => {
	test("shows only the current and next incremental step", () => {
		const account = source("components/Account.tsx");

		expect(account).toContain("CURRENT");
		expect(account).toContain("NEXT WALLOW");
		expect(account).toContain("Reach W{nextRank}");
		expect(account).toContain("currentBaseInterval");
		expect(account).toContain("nextBaseInterval");
		expect(account).not.toContain("const rows = Array.from");
	});
});
