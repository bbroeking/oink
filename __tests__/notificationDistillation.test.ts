import fs from "fs";
import path from "path";
import { POPUP_PRIORITIES } from "../constants/popupPriorities";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) =>
	fs.readFileSync(path.join(ROOT, file), "utf8");

describe("notification distillation", () => {
	it("keeps removed interruptions out of the global popup registry", () => {
		for (const id of [
			"fieldGuide",
			"releaseNotes",
			"luckyTitle",
			"sixSeven",
			"sounderLaunch",
			"feedbackNudge",
		]) {
			expect(POPUP_PRIORITIES).not.toHaveProperty(id);
		}
	});

	it("keeps release notes and feedback behind explicit Me actions", () => {
		const account = read("components/Account.tsx");
		const barn = read("components/Barn.tsx");
		expect(account).toContain('label="What\'s new"');
		expect(account).toContain("Found a bug or have an idea? Report it");
		expect(account).toContain("onPress={openFeedback}");
		expect(barn).not.toContain("ReleaseNotesModal");
		expect(barn).not.toContain("shouldShowReleaseNotes");
	});

	it("uses one Lucky Pig surface for the title reward", () => {
		const barn = read("components/Barn.tsx");
		const lucky = read("components/LuckyPigModal.tsx");
		expect(barn).not.toContain("LuckyTitleUnlockModal");
		expect(lucky).toContain("unlockedTitle");
		expect(lucky).toContain("bonus title");
	});

	it("celebrates six-seven without a confirmation dialog", () => {
		const barn = read("components/Barn.tsx");
		expect(barn).not.toContain("sixSevenDialog");
		expect(barn).not.toContain('title="6 7!"');
		expect(barn).toContain("setSixSevenTick");
	});

	it("renders one post-visit scrim for hoofprints and kindness", () => {
		const visit = read("components/BarnVisitModal.tsx");
		expect(
			visit.match(/style=\{styles\.stampScrim\}/g) ?? []
		).toHaveLength(1);
		expect(visit).toContain("kindnessOffer ?");
		expect(visit).toContain("The hoofprint says plenty");
	});

	it("shows unseen achievements in one digest instead of a carousel", () => {
		const layout = read("app/_layout.tsx");
		expect(layout).toContain("<AchievementDigestModal");
		expect(layout).toContain("achievements={achievements}");
		expect(layout).not.toContain("<AchievementUnlockModal");
		expect(layout).not.toContain("setAchievements((q) => q.slice(1))");
	});
});
