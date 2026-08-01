import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function source(relativePath: string): string {
	return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function pngSize(relativePath: string): { width: number; height: number } {
	const bytes = fs.readFileSync(path.join(ROOT, relativePath));
	expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
	return {
		width: bytes.readUInt32BE(16),
		height: bytes.readUInt32BE(20)
	};
}

describe("high-cardinality surfaces", () => {
	it.each([
		["components/Friends.tsx", "FlatList"],
		["components/Leaderboard.tsx", "FlatList"],
		["components/ClosetView.tsx", "FlatList"],
		["components/Inbox.tsx", "FlatList"]
	])("%s uses a virtualized list", (file, primitive) => {
		const text = source(file);
		expect(text).toContain(`<${primitive}`);
		expect(text).toContain("initialNumToRender");
		expect(text).toContain("maxToRenderPerBatch");
		expect(text).toContain("windowSize");
	});

	it("uses independent sections for the alignment board", () => {
		expect(source("components/Leaderboard.tsx")).toContain("<SectionList");
	});

	it("chunks Closet items into virtualized three-up rows", () => {
		const text = source("components/ClosetView.tsx");
		expect(text).toContain("index += 3");
		expect(text).toContain("items.slice(index, index + 3)");
		expect(text).not.toContain("<ScrollView");
	});

	it("virtualizes the Inbox history rather than mapping it into a ScrollView", () => {
		const text = source("components/Inbox.tsx");
		expect(text).toContain("data={passiveShown}");
		expect(text).not.toContain("<ScrollView");
		expect(text).not.toContain("passiveShown.map");
	});
});

describe("held-item image tiers", () => {
	const ids = [
		"balloon",
		"coffee_mug",
		"controller",
		"flowers",
		"ice_cream",
		"magic_wand",
		"magnifier",
		"pencil",
		"pizza_slice",
		"toy_sword"
	];

	it.each([128, 256])("ships a %ipx tier for every oversized held item", (tier) => {
		for (const id of ids) {
			expect(pngSize(`assets/images/hats/thumbs/${tier}/${id}.png`)).toEqual({
				width: tier,
				height: tier
			});
		}
	});

	it("reserves masters for composition and uses tiers in browse surfaces", () => {
		const hats = source("constants/hats.ts");
		const closet = source("components/ClosetView.tsx");
		const shop = source("app/(tabs)/shop.tsx");

		for (const id of ids) {
			expect(hats).toContain(`thumbs/128/${id}.png`);
			expect(hats).toContain(`thumbs/256/${id}.png`);
		}
		expect(closet).toContain("HAT_THUMBNAILS_128[equippedId]");
		expect(closet).toContain("HAT_THUMBNAILS_256[item.id]");
		expect(shop).toContain("HAT_THUMBNAILS_256[item.id]");
	});
});
