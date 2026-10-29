// Halloween 2026 catalog registration: every new art file is wired into
// HAT_IMAGES, every id the catalog migration sells has art on the client, and
// no new id collides with an existing catalog or members id.
import fs from "node:fs";
import path from "node:path";

import { HAT_IMAGES, HIDDEN_CATEGORIES } from "../constants/hats";
import { MEMBERS_IMAGES } from "../constants/membersImages.generated";

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const MIGRATION_FILE = "20261029230000_halloween_2026_catalog.sql";
const ART_DIRS = ["assets/images/hats/halloween-2026", "assets/images/backgrounds/halloween-2026"];

const hatsSource = fs.readFileSync(path.join(ROOT, "constants", "hats.ts"), "utf8");
const migration = fs.readFileSync(path.join(MIGRATIONS, MIGRATION_FILE), "utf8");
const content = JSON.parse(
	fs.readFileSync(path.join(ROOT, "docs", "design", "halloween-2026", "content.json"), "utf8"),
) as {
	wearables: { id: string; name: string; category: string; rarity: string }[];
	backgrounds: { id: string; name: string; category: string; rarity: string }[];
};

// id -> require() path for every HAT_IMAGES entry pointing into a halloween-2026 folder.
const registered = new Map<string, string>();
for (const m of hatsSource.matchAll(
	/^\s*([a-z0-9_]+):\s*require\("\.\.\/(assets\/images\/(?:hats|backgrounds)\/halloween-2026\/[^"]+)"\)/gm,
)) {
	registered.set(m[1], m[2]);
}

type Row = {
	id: string;
	name: string;
	cost: number;
	category: string;
	rarity: string;
	shelfKey: string;
	shelfLane: string;
	membersOnly: string;
	passExclusive: string;
};
const unquote = (s: string) => s.replace(/''/g, "'");
const rows: Row[] = [
	...migration.matchAll(
		/^\s*\('([a-z0-9_]+)',\s*'((?:[^']|'')*)',\s*NULL,\s*(\d+),\s*\d+,\s*'([a-z_]+)',\s*'([a-z]+)',\s*'(?:[^']|'')*',\s*(true|false),\s*(true|false),\s*'([a-z0-9_]+)',\s*'([a-z]+)'\)/gm,
	),
].map((m) => ({
	id: m[1],
	name: unquote(m[2]),
	cost: Number(m[3]),
	category: m[4],
	rarity: m[5],
	membersOnly: m[6],
	passExclusive: m[7],
	shelfKey: m[8],
	shelfLane: m[9],
}));
const soldIds = rows.map((r) => r.id);

const RETURNING = ["skull_mask", "pumpkin_patch", "firefly_lantern", "candyland"];
const EXCLUDED = ["high_collar_scarf", "moon_charm", "halloween_2026_little_haunt"];
const BANDS: Record<string, [number, number]> = {
	common: [100, 200],
	uncommon: [200, 400],
	rare: [400, 800],
	epic: [800, 2000],
	legendary: [2000, 5000],
};

describe("Halloween 2026 art registration (constants/hats.ts)", () => {
	const filesOnDisk = ART_DIRS.flatMap((dir) =>
		fs
			.readdirSync(path.join(ROOT, dir))
			.filter((f) => f.endsWith(".png"))
			.map((f) => `${dir}/${f}`),
	);

	it("registers every accessory and background file exactly once", () => {
		expect(filesOnDisk).toHaveLength(38);
		expect(registered.size).toBe(38);
		expect([...registered.values()].sort()).toEqual([...filesOnDisk].sort());
	});

	it("keys each entry by its content.json id, which is also the file stem", () => {
		const contentIds = [...content.wearables, ...content.backgrounds]
			.filter((it) => it.category !== "costume")
			.map((it) => it.id)
			.sort();
		expect([...registered.keys()].sort()).toEqual(contentIds);
		for (const [id, file] of registered) {
			expect(path.basename(file, ".png")).toBe(id);
		}
	});

	it("resolves every new entry through HAT_IMAGES", () => {
		for (const id of registered.keys()) {
			expect(HAT_IMAGES[id]).toBeDefined();
		}
	});

	it("does not collide with members art or a duplicate HAT_IMAGES key", () => {
		for (const id of registered.keys()) {
			expect(MEMBERS_IMAGES[id]).toBeUndefined();
		}
		const block = hatsSource.slice(
			hatsSource.indexOf("export const HAT_IMAGES"),
			hatsSource.indexOf("export const HAT_THUMBNAILS_128"),
		);
		const keys = [...block.matchAll(/^\s*([a-z0-9_]+):\s*require\(/gm)].map((m) => m[1]);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe(`catalog migration ${MIGRATION_FILE}`, () => {
	it("parses all 35 sellable rows", () => {
		const valuesLines = migration.match(/^\s*\('[a-z0-9_]+',/gm) ?? [];
		expect(rows).toHaveLength(35);
		expect(valuesLines).toHaveLength(rows.length); // no row slipped the parser
	});

	it("has art registered for every id it touches", () => {
		for (const id of [...soldIds, ...RETURNING, "lantern_porch_bg"]) {
			expect(HAT_IMAGES[id]).toBeDefined();
		}
	});

	it("sells nothing excluded, hidden or unsellable", () => {
		for (const id of EXCLUDED) expect(soldIds).not.toContain(id);
		for (const r of rows) {
			expect(HIDDEN_CATEGORIES.has(r.category)).toBe(false);
			expect(["necklace", "costume", "cape", "scarf"]).not.toContain(r.category);
		}
	});

	it("matches content.json name, category and rarity", () => {
		const byId = new Map([...content.wearables, ...content.backgrounds].map((it) => [it.id, it]));
		for (const r of rows) {
			const src = byId.get(r.id);
			expect(src).toBeDefined();
			expect({ id: r.id, name: r.name, category: r.category, rarity: r.rarity }).toEqual({
				id: r.id,
				name: src!.name,
				category: src!.category,
				rarity: src!.rarity,
			});
		}
	});

	it("prices inside the rarity band and shelves every row as new", () => {
		for (const r of rows) {
			const [lo, hi] = BANDS[r.rarity];
			expect(r.cost).toBeGreaterThanOrEqual(lo);
			expect(r.cost).toBeLessThanOrEqual(hi);
			expect(r.cost % 50).toBe(0);
			expect(r).toMatchObject({
				shelfKey: "halloween_2026",
				shelfLane: "new",
				membersOnly: "false",
				passExclusive: "false",
			});
		}
	});

	it("introduces no id an earlier migration already used", () => {
		const earlier = fs
			.readdirSync(MIGRATIONS)
			.filter((f) => f.endsWith(".sql") && f < MIGRATION_FILE)
			.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8"))
			.join("\n");
		for (const id of soldIds) {
			expect(earlier.includes(`'${id}'`)).toBe(false);
		}
		expect(new Set(soldIds).size).toBe(soldIds.length);
	});

	it("opens the shelf dark, backs it with a new background and returns the weekend four", () => {
		expect(migration).toMatch(
			/INSERT INTO public\.seasonal_shelves[^;]*VALUES \('halloween_2026', '[^']+', '[^']+', NULL, NULL, NULL\)/,
		);
		const backdrop = migration.match(/SET backdrop_hat_id = '([a-z0-9_]+)'/)?.[1];
		expect(rows.find((r) => r.id === backdrop)?.category).toBe("background");
		expect(migration).toMatch(
			/SET shelf_key = 'halloween_2026', shelf_lane = 'returning'\s+WHERE id IN \('skull_mask', 'pumpkin_patch', 'firefly_lantern', 'candyland'\)/,
		);
		expect(migration).not.toMatch(/—/);
	});
});
