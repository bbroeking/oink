// F5 — the Satchel catalog's three-way mirror, locked.
//
// The twelve find ids live in THREE places: the migration's `satchel_finds`
// INSERT (what the server can roll), `SATCHEL_FIND_IDS` (what this build can
// name), and `FindArt`'s glyph map (what it can draw). A find that exists in
// one and not the others is a silent hole — dropped by `isSatchelFindId` on
// the way in, or a blank square on the way out. The swap makes that worse: a
// find can now arrive from a friend's bag, not only from your own dig.
//
// Same shape as findMark's asset lock: read the real files, assert the sets.
jest.mock("../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import fs from "node:fs";
import path from "node:path";
import { SATCHEL_FINDS, SATCHEL_FIND_IDS } from "@/constants/satchel";
import { findArtGlyph } from "@/components/satchel/FindArt";

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(ROOT, "supabase/migrations/20260915010000_satchel.sql");

/** The id column of the migration's `satchel_finds` INSERT, in file order. */
function idsFromMigration(): string[] {
	const sql = fs.readFileSync(MIGRATION, "utf8");
	const start = sql.indexOf("INSERT INTO public.satchel_finds");
	expect(start).toBeGreaterThan(-1);
	const body = sql.slice(start, sql.indexOf(";", start));
	return [...body.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]);
}

describe("the Satchel catalog mirror", () => {
	it("every id the binary knows has a painted glyph registered in Glyph", () => {
		const registry = fs.readFileSync(path.join(ROOT, "components/ui/Glyph.tsx"), "utf8");
		for (const id of SATCHEL_FIND_IDS) {
			const glyph = findArtGlyph(id);
			expect(glyph).toBeTruthy();
			expect(registry).toContain(`${glyph}: require(`);
			expect(fs.existsSync(path.join(ROOT, "assets/images/glyphs/finds", `${id}.png`))).toBe(true);
		}
	});

	it("the client's ids are exactly the migration's INSERT list", () => {
		expect([...SATCHEL_FIND_IDS].sort()).toEqual(idsFromMigration().sort());
	});

	it("every id has a catalog row with a name and an article, and no duplicates", () => {
		expect(SATCHEL_FINDS.map((f) => f.id).sort()).toEqual([...SATCHEL_FIND_IDS].sort());
		expect(new Set(SATCHEL_FIND_IDS).size).toBe(SATCHEL_FIND_IDS.length);
		for (const f of SATCHEL_FINDS) {
			expect(f.name.length).toBeGreaterThan(0);
			// The article form is a phrase, not a prefix ("a chip of honeycomb"),
			// so what it must carry is the noun, not the whole name.
			expect(f.withArticle).toMatch(/^(a|an|some) /);
			expect(["common", "uncommon", "rare"]).toContain(f.rarity);
		}
	});

	it("no find's art is an emoji — the catalog is painted", () => {
		const art = fs.readFileSync(path.join(ROOT, "components/satchel/FindArt.tsx"), "utf8");
		expect(art).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
	});
});
