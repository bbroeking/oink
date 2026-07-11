// The Collectibles catalog splits into two collapsible bands: Slop Club
// members-only goods FIRST, then everyone else. These tests lock the ordering
// (members first), the collapse behaviour (a collapsed band hides its rows),
// the lock state (non-members see locked=true on the members band), and the
// graceful degrade (no members items => plain rarity list, no band banners).
import { buildBrowseRows, type ListRow } from "../constants/shopRows";
import type { HatRow } from "../constants/hats";

const item = (id: string, over: Partial<HatRow> = {}): HatRow => ({
	id,
	name: id,
	cost: 100,
	display_order: 1,
	emoji: null,
	image_path: null,
	rarity: "common",
	...over,
});

const OPEN = { members: false, everyone: false };

describe("buildBrowseRows — members band", () => {
	it("puts the members band first, before the everyone band", () => {
		const rows = buildBrowseRows(
			[item("crown", { members_only: true }), item("beanie")],
			OPEN,
			true,
		);
		const sections = rows.filter(
			(r): r is Extract<ListRow, { type: "section" }> => r.type === "section",
		);
		expect(sections.map((s) => s.band)).toEqual(["members", "everyone"]);
		// the very first row is the members band banner
		expect(rows[0]).toMatchObject({ type: "section", band: "members" });
	});

	it("marks the members band locked for non-members, unlocked for members", () => {
		const items = [item("crown", { members_only: true })];
		const asGuest = buildBrowseRows(items, OPEN, false);
		const asMember = buildBrowseRows(items, OPEN, true);
		expect(asGuest.find((r) => r.type === "section")).toMatchObject({ locked: true });
		expect(asMember.find((r) => r.type === "section")).toMatchObject({ locked: false });
	});

	it("a collapsed band shows its banner but none of its item rows", () => {
		const rows = buildBrowseRows(
			[item("crown", { members_only: true }), item("beanie")],
			{ members: true, everyone: false },
			true,
		);
		// members banner present, but no item row carrying the crown
		expect(rows.some((r) => r.type === "section" && r.band === "members")).toBe(true);
		const flat = rows.flatMap((r) => (r.type === "row" ? r.items.map((i) => i.id) : []));
		expect(flat).not.toContain("crown");
		expect(flat).toContain("beanie"); // everyone band still expanded
	});

	it("degrades to a plain rarity list (no band banners) when there are no members items", () => {
		const rows = buildBrowseRows([item("beanie"), item("tophat")], OPEN, false);
		expect(rows.some((r) => r.type === "section")).toBe(false);
		// still grouped by rarity (a header + the items)
		expect(rows.some((r) => r.type === "header")).toBe(true);
		const flat = rows.flatMap((r) => (r.type === "row" ? r.items.map((i) => i.id) : []));
		expect(flat.sort()).toEqual(["beanie", "tophat"]);
	});
});
