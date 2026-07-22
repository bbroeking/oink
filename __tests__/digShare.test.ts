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
			goldenInDigs: 4,
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
			goldenInDigs: 1,
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
			goldenInDigs: null,
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
		const dugOrder = [0, 2, 3, 4, 5, 8, 9]; // dug in board order here
		const collected: Find[] = ["stone", "shimmer", "truffle_l", "unique"];
		const data = digShareData({ ...board, layers }, layers, collected, 402, dugOrder);

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
		// The truffle_l cluster [3,4] COMPLETED (claimed) when tile 4 cleared —
		// the 4th dig in this order. Temporal ordinal, from the recorded order.
		expect(data.goldenInDigs).toBe(4);
	});

	it("produces the full block from a real generated board with everything dug", () => {
		const real = generateBoard(123456, "milk_tooth");
		const layers = real.layers.map(() => 0); // dig every tile
		const dugOrder = real.layers.map((_, i) => i);
		const collected: Find[] = [
			"truffle_l",
			"truffle_d",
			"shimmer",
			"unique",
			"junk_boot",
			"junk_wrap",
			"stone",
		];
		const data = digShareData(real, layers, collected, 500, dugOrder);
		const text = buildDigShareText(data);

		expect(data.digs).toBe(real.layers.length); // all 30 tiles dug
		expect(text.startsWith("tickle the pig · feeding #500\n")).toBe(true);
		expect(text.endsWith("\nticklethepig.com")).toBe(true);
		expect(text).toContain(`${data.finds} finds in ${data.digs} digs`);
	});
});

describe("digShareData — goldenInDigs (the spec-10 headline number)", () => {
	// Same hand-built board as above: truffle_l cluster at (3,4), truffle_d at
	// (5,6), a relic at 8, duds/mud elsewhere.
	const board: PatchBoard = {
		layers: [],
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
	const allDug = board.cells.map(() => 0);

	it("is null when no truffle was claimed — no golden minted, no headline", () => {
		// Everything dug, but no truffle in the claimed set: no golden.
		const dugOrder = board.cells.map((_, i) => i);
		const collected: Find[] = ["shimmer", "unique", "junk_boot"];
		const data = digShareData({ ...board, layers: allDug }, allDug, collected, 402, dugOrder);
		expect(data.goldenInDigs).toBeNull();
	});

	it("is the TEMPORAL ordinal of the dig that completed the claim, not a board position", () => {
		// Dug back-to-front: 9,8,7,6,5,4,3,2,1,0. truffle_l [3,4] completes when
		// tile 3 clears — the 7th dig — even though tile 3 is early on the board.
		const dugOrder = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
		const collected: Find[] = ["truffle_l", "shimmer", "unique"];
		const data = digShareData({ ...board, layers: allDug }, allDug, collected, 402, dugOrder);
		expect(data.goldenInDigs).toBe(7);
		expect(data.goldenInDigs!).toBeLessThanOrEqual(data.digs); // agrees w/ share
	});

	it("depends on dig order: the same tiles dug in different orders give different Ns", () => {
		const collected: Find[] = ["truffle_l", "truffle_d", "shimmer", "unique"];
		// Front-to-back: truffle_l [3,4] completes 5th, truffle_d [5,6] 7th → 5.
		const forward = digShareData(
			{ ...board, layers: allDug },
			allDug,
			collected,
			402,
			[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
		);
		// Beeline to truffle_d first: it completes on the 2nd dig → 2.
		const beeline = digShareData(
			{ ...board, layers: allDug },
			allDug,
			collected,
			402,
			[5, 6, 3, 4, 0, 1, 2, 7, 8, 9]
		);
		expect(forward.goldenInDigs).toBe(5);
		expect(beeline.goldenInDigs).toBe(2);
		// Grid/counts are order-independent — only the headline N moves.
		expect(beeline.cells).toEqual(forward.cells);
		expect(beeline.digs).toBe(forward.digs);
		expect(beeline.finds).toBe(forward.finds);
	});

	it("takes the FIRST truffle claimed in time regardless of colour", () => {
		// Both truffles claimed; digging order finishes truffle_d (5,6) before
		// truffle_l (3,4) — the golden is the temporally-first claim, the deep one.
		const dugOrder = [6, 5, 4, 3, 0, 1, 2, 7, 8, 9];
		const collected: Find[] = ["truffle_l", "truffle_d"];
		const data = digShareData({ ...board, layers: allDug }, allDug, collected, 402, dugOrder);
		expect(data.goldenInDigs).toBe(2); // truffle_d completed on the 2nd dig
	});
});
