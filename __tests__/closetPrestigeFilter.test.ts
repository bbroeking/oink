import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const shop = fs.readFileSync(
	path.join(ROOT, "app/(tabs)/shop.tsx"),
	"utf8",
);
const closet = fs.readFileSync(
	path.join(ROOT, "components/ClosetView.tsx"),
	"utf8",
);

describe("Closet prestige deep link", () => {
	test("consumes the one-shot route filter and gives the player a Show all escape", () => {
		expect(shop).toContain(
			'const [prestigeOnly, setPrestigeOnly] = useState(false);',
		);
		expect(shop).toContain(
			"router.setParams({ view: undefined, filter: undefined });",
		);
		expect(shop).toContain(
			"onClearPrestigeFilter={() => setPrestigeOnly(false)}",
		);
		expect(closet).toContain("onClearPrestigeFilter");
		expect(closet).toContain("Show all");
	});
});

describe("Closet section density", () => {
	test("uses compact BG copy, removes the redundant header, and exposes collapsible sections", () => {
		expect(closet).toContain('background: "BG"');
		expect(closet).toContain('s === "background" ? "BG"');
		expect(closet).not.toContain(">dress up rosie<");
		expect(closet).not.toContain("<SnoutCoin");
		expect(closet).toContain("collapsedCategories");
		expect(closet).toContain("toggleCategory(row.category)");
		expect(closet).toContain(
			"accessibilityState={{ expanded: !collapsed }}",
		);
	});
});

describe("merged collectible Closet", () => {
	test("removes the Collectibles destination and defaults the unified catalog to All", () => {
		expect(shop).toContain(
			'(["daily", "wardrobe", "pen"] as const)',
		);
		expect(shop).not.toContain('? "Collectibles"');
		expect(shop).toContain('params.view === "browse"');
		expect(shop).toContain('setView("wardrobe")');

		expect(closet).toContain(
			'type ClosetFilter = "all" | "owned" | "unowned" | "member" | "non-member"',
		);
		expect(closet).toContain(
			'const [filter, setFilter] = useState<ClosetFilter>("all")',
		);
		expect(closet).toContain('{ value: "owned", label: "Owned" }');
		expect(closet).toContain('{ value: "unowned", label: "Unowned" }');
		expect(closet).toContain('{ value: "member", label: "Member" }');
		expect(closet).toContain(
			'{ value: "non-member", label: "Non-member" }',
		);
	});

	test("equips owned items and previews unowned items", () => {
		expect(closet).toContain(
			"if (owned) onEquip(active ? null : item.id, item.category);",
		);
		expect(closet).toContain("else onPreview(item);");
	});

	test("makes owned and missing items visually and semantically distinct", () => {
		expect(closet).toContain("styles.itemCardOwned");
		expect(closet).toContain("styles.itemCardUnowned");
		expect(closet).toContain('name={owned ? "check" : "lock"}');
		expect(closet).toContain('? "Owned"');
		expect(closet).toContain(': "Not owned"');
		expect(closet).toContain(
			"{row.ownedCount} owned · {row.missingCount} missing",
		);
	});
});
