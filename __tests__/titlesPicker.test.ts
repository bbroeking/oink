// The Titles picker's two list rules (the shop-IA pass, 2026-09-17). The
// nameplate opens a searchable sheet now instead of scrolling ~3,000pt to a
// Titles footer, so the order of the list and what the search matches are the
// two things that have to be right.

import fs from "node:fs";
import path from "node:path";
import type { TitleRow } from "@/constants/title_types";
import {
	filterTitles,
	sortTitles,
	unearnedTitles,
} from "@/hooks/useTitles";

const ROOT = path.resolve(__dirname, "..");

const title = (id: string, name: string): TitleRow => ({
	id,
	name,
	placement: "pre",
	description: `earned for ${name}`,
});

const ROWS = [
	title("baron", "Mud Baron"),
	title("apple", "Apple Picker"),
	title("zephyr", "Zephyr"),
];

describe("sortTitles", () => {
	it("puts the worn title first, then goes A–Z", () => {
		expect(sortTitles(ROWS, "zephyr").map((r) => r.id)).toEqual([
			"zephyr",
			"apple",
			"baron",
		]);
	});

	it("is plain A–Z when nothing is worn", () => {
		expect(sortTitles(ROWS, null).map((r) => r.id)).toEqual([
			"apple",
			"baron",
			"zephyr",
		]);
	});

	it("leaves the rows it was handed alone", () => {
		const before = ROWS.map((r) => r.id);
		sortTitles(ROWS, "zephyr");
		expect(ROWS.map((r) => r.id)).toEqual(before);
	});
});

describe("filterTitles", () => {
	it("matches the name, whatever the case", () => {
		expect(filterTitles(ROWS, "mud").map((r) => r.id)).toEqual(["baron"]);
		expect(filterTitles(ROWS, "  BARON ").map((r) => r.id)).toEqual(["baron"]);
	});

	it("does not search the how-earned line", () => {
		expect(filterTitles(ROWS, "earned for")).toEqual([]);
	});

	it("hands everything back for an empty search", () => {
		expect(filterTitles(ROWS, "   ")).toHaveLength(3);
	});
});

describe("unearnedTitles", () => {
	it("is the board minus what is already yours", () => {
		expect(
			unearnedTitles(ROWS, [title("apple", "Apple Picker")]).map((r) => r.id),
		).toEqual(["baron", "zephyr"]);
	});
});

describe("the Closet's nameplate opens the picker", () => {
	const closet = fs.readFileSync(
		path.join(ROOT, "components/ClosetView.tsx"),
		"utf8",
	);

	it("has no Titles footer left to scroll to", () => {
		expect(closet).not.toContain("TitlesSection");
		expect(closet).not.toContain("scrollToTitles");
		expect(fs.existsSync(path.join(ROOT, "components/TitlesSection.tsx"))).toBe(
			false,
		);
	});

	it("opens the sheet from the chip, and says so", () => {
		expect(closet).toContain("onPress={() => setTitlesOpen(true)}");
		expect(closet).toContain('accessibilityHint="Opens your titles"');
		expect(closet).toContain("<TitlesPickerSheet");
	});

	it("keeps titles earned, never sold", () => {
		const picker = fs.readFileSync(
			path.join(ROOT, "components/TitlesPickerSheet.tsx"),
			"utf8",
		);
		// The Sheet draws the star itself; a kicker with its own star read "★ ★".
		expect(picker).toContain('kicker="earned, never sold"');
		expect(picker).toContain("Earned · ");
		expect(picker).toContain("Not yet · ");
		expect(picker).not.toContain("coin");
	});
});
