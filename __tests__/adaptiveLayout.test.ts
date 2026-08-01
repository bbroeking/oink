import fs from "node:fs";
import path from "node:path";

const read = (relative: string) =>
	fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("native adaptive layout guardrails", () => {
	test.each([
		"components/ui/PageBackground.tsx",
		"components/ui/AnimatedBackground.tsx",
		"components/BarnVisitModal.tsx",
		"components/ClosetView.tsx",
		"app/lounge.tsx",
	])("%s derives geometry from the current window", (file) => {
		const source = read(file);
		expect(source).toContain("useWindowDimensions");
		expect(source).not.toContain('Dimensions.get("window")');
	});

	test.each([
		"components/AlignmentExplainerModal.tsx",
		"components/ItemPreviewModal.tsx",
		"components/PigFriendsLaunchModal.tsx",
	])("%s uses the scrollable safe-area modal scaffold", (file) => {
		const source = read(file);
		expect(source).toContain("AdaptiveModalScaffold");
		expect(source).not.toMatch(/<Modal[\s>]/);
	});

	test("centered dialog close actions use the shared non-overlapping row", () => {
		const closeRow = read("components/ui/DialogCloseRow.tsx");
		expect(closeRow).not.toMatch(/position:\s*["']absolute["']/);

		for (const file of [
			"components/AchievementDigestModal.tsx",
			"components/AllegianceModal.tsx",
			"components/BattlePassSaleModal.tsx",
		]) {
			const source = read(file);
			expect(source).toContain("DialogCloseRow");
			expect(source).not.toMatch(/<Icon[^>]+name=["']x["']/s);
		}
	});
});
