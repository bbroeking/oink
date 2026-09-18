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
		expect(shop).toContain("setPrestigeOnly(target.prestigeOnly);");
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

// The catalog opens on what is yours (the shop-IA pass, 2026-09-17): three
// segments — Owned · All · Members — with Owned first, because "Your closet"
// crowned 13 owned over a section listing 127 items.
describe("merged collectible Closet", () => {
	test("keeps one store and opens the unified catalog on Owned", () => {
		expect(shop).not.toContain('"wardrobe"');
		expect(shop).not.toContain('? "Collectibles"');
		expect(shop).toContain("storeContent={storeWall}");

		expect(closet).toContain(
			'type ClosetFilter = "owned" | "all" | "member"',
		);
		expect(closet).toContain(
			'const [filter, setFilter] = useState<ClosetFilter>("owned")',
		);
		expect(closet).toContain('const CLOSET_FILTER_ORDER: ClosetFilter[] = ["owned", "all", "member"]');
		expect(closet).toContain('owned: "Owned"');
		expect(closet).toContain('all: "All"');
		expect(closet).toContain('member: "Members"');
		// One control, not a rail of chips — and every segment wears its count.
		expect(closet).toContain("<SegmentedControl");
		expect(closet).toContain('label="Catalog filter"');
		expect(closet).toContain(
			"`${CLOSET_FILTER_LABEL[value]} · ${filterCounts[value].toLocaleString()}`",
		);
	});

	test("crowns the catalog Everything, counted by the segment you stand in", () => {
		expect(closet).toContain('kicker="the whole rack"');
		expect(closet).toContain('title="Everything"');
		expect(closet).toContain(
			"right={CLOSET_FILTER_CROWN[filter](filterCounts[filter])}",
		);
	});

	test("sends a bare rack back up to today's drop", () => {
		expect(closet).toContain("Nothing on the rack yet");
		expect(closet).toContain("onPress={scrollToTop}");
		expect(closet).toContain("Today&apos;s drop ›");
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
		// One card grammar: the shelf's tag and the shelf's badge, and the lock
		// means MEMBERS — an unowned non-member item wears no badge at all.
		expect(closet).toContain("const face = cardTagFace(cardTag(item, cardState));");
		expect(closet).toContain("const badge = cardBadge(cardState);");
		expect(closet).toContain("{!active && badge && (");
		expect(closet).not.toContain('name={owned ? "check" : "lock"}');
		expect(closet).not.toContain('? "Owned"');
		expect(closet).not.toContain(': "Not owned"');
		expect(closet).toContain(
			"{row.ownedCount} of {row.totalCount}",
		);
	});

	test("drops the hint sticker the taste standard forbids", () => {
		expect(closet).not.toContain("Owned items dress Rosie");
		expect(closet).not.toContain("styles.hint");
	});
});
