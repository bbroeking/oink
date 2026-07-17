import {
	buildDigShareText,
	digShareData,
	type DigShareData,
} from "@/utils/digShare";
import { generateBoard, type Find, type PatchBoard } from "@/utils/rooting";

describe("buildDigShareText", () => {
	it("renders the header · grid · count · footer block (spec 09 shape)", () => {
		const data: DigShareData = {
			feedingNumber: 402,
			cells: ["mud", "mud", "shimmer", "truffle", "mud", "shimmer", "mud", "unique", "mud", "mud"],
			digs: 19,
			finds: 4,
		};
		expect(buildDigShareText(data)).toBe(
			[
				"tickle the pig · feeding #402",
				"🟫🟫✨🍄🟫", // first 5 cells
				"✨🟫👑🟫🟫", // next 5 cells
				"4 finds in 19 digs",
				"ticklethepig.com",
			].join("\n")
		);
	});

	it("singularizes the count line for one find in one dig", () => {
		const text = buildDigShareText({
			feedingNumber: 7,
			cells: ["truffle"],
			digs: 1,
			finds: 1,
		});
		expect(text).toContain("1 find in 1 dig");
		expect(text).not.toContain("finds");
		expect(text).not.toContain("digs");
	});

	it("omits the grid line entirely when no tiles were dug", () => {
		const text = buildDigShareText({
			feedingNumber: 3,
			cells: [],
			digs: 0,
			finds: 0,
		});
		expect(text).toBe(
			["tickle the pig · feeding #3", "0 finds in 0 digs", "ticklethepig.com"].join("\n")
		);
	});
});

describe("digShareData", () => {
	// A hand-built 10-tile board: stone, junk, shimmer, a 2-tile truffle_l
	// cluster (3,4), a 2-tile truffle_d cluster (5,6), a relic (8), and two
	// empty-mud tiles (7,9).
	const board: PatchBoard = {
		layers: [], // set per-case
		cells: [
			{ kind: "stone" },
			{ kind: "junk_boot" },
			{ kind: "shimmer" },
			{ kind: "truffle_l" },
			{ kind: "truffle_l" },
			{ kind: "truffle_d" },
			{ kind: "truffle_d" },
			null,
			{ kind: "unique" },
			null,
		],
		finds: ["truffle_l", "truffle_d", "shimmer", "junk_boot", "unique"],
		truffleL: [3, 4],
		truffleD: [5, 6],
		unique: { id: "milk_tooth", idx: 8 },
	};

	it("collapses clusters, folds duds to mud, and omits undug tiles", () => {
		// Dug: 0,2,3,4,5,8,9. Undug: 1,6,7 (layers > 0). truffle_d is only
		// half-dug (5 dug, 6 undug) and NOT claimed → its dug cell reads as mud.
		const layers = [0, 2, 0, 0, 0, 0, 2, 2, 0, 0];
		const collected: Find[] = ["stone", "shimmer", "truffle_l", "unique"];
		const data = digShareData({ ...board, layers }, layers, collected, 402);

		expect(data.digs).toBe(7); // dug tiles (undug 1,6,7 omitted)
		expect(data.finds).toBe(3); // truffle_l + shimmer + unique
		// One 🍄 for the whole truffle_l cluster (idx 4 collapsed away); the lone
		// dug truffle_d cell + stone + empty mud all read 🟫.
		expect(data.cells).toEqual([
			"mud", // 0 stone
			"shimmer", // 2
			"truffle", // 3 (cluster head)
			// 4 collapsed
			"mud", // 5 unclaimed truffle_d piece
			"unique", // 8
			"mud", // 9 empty
		]);
		// find-emoji count in the grid equals the "finds" stat
		const shaped = data.cells.filter((c) => c !== "mud").length;
		expect(shaped).toBe(data.finds);
	});

	it("produces the full block from a real generated board with everything dug", () => {
		const real = generateBoard(123456, "milk_tooth");
		const layers = real.layers.map(() => 0); // dig every tile
		const collected: Find[] = [
			"truffle_l",
			"truffle_d",
			"shimmer",
			"unique",
			"junk_boot",
			"junk_wrap",
			"stone",
		];
		const data = digShareData(real, layers, collected, 500);
		const text = buildDigShareText(data);

		expect(data.digs).toBe(real.layers.length); // all 30 tiles dug
		expect(text.startsWith("tickle the pig · feeding #500\n")).toBe(true);
		expect(text.endsWith("\nticklethepig.com")).toBe(true);
		expect(text).toContain(`${data.finds} finds in ${data.digs} digs`);
	});
});
