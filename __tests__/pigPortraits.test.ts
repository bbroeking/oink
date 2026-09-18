import fs from "fs";
import path from "path";
import { PIG_IDS } from "../utils/pigs";

const ROOT = path.join(__dirname, "..");

describe("approved pig portraits", () => {
	test("every pig has a normalized portrait asset", () => {
		for (const pigId of PIG_IDS) {
			expect(
				fs.existsSync(
					path.join(ROOT, "assets", "images", "pigs", "normalized", `${pigId}.png`)
				)
			).toBe(true);
		}
	});

	test.each([
		// The Pen's character surfaces since the errand board (2026-09-18): the
		// fence row's medallions, the card's portrait, the ticket's picker.
		"components/pen/FenceRow.tsx",
		"components/pen/PigCard.tsx",
		"components/pen/ErrandTicket.tsx",
		"components/PigFriendsLaunchModal.tsx",
	])("%s renders approved portraits on character-selection surfaces", (relative) => {
		const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
		expect(source).toContain("<PigPortrait");
	});
});
