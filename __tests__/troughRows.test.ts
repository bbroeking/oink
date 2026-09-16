// The Trough's rows in the store: the chip a row offers never exceeds the gap
// or the giver's remaining quarter, the row names its opener in the hand
// voice, and the pill counts open drives before it counts receipts.

import {
	troughPillLabel,
	troughRowState,
	troughRowTitle,
} from "@/utils/troughRows";

describe("troughRowState", () => {
	it("offers the default chip when both the gap and the quarter allow it", () => {
		const s = troughRowState({ target: 200, raised: 140, my_contribution: 0 });
		expect(s).toEqual({
			gap: 60,
			cap: 50,
			headroom: 50,
			chip: 25,
			quarterFilled: false,
		});
	});

	it("clamps the chip to what is left of the giver's quarter", () => {
		const s = troughRowState({ target: 200, raised: 100, my_contribution: 40 });
		expect(s.headroom).toBe(10);
		expect(s.chip).toBe(10);
	});

	it("clamps the chip to the gap on a nearly-full Trough", () => {
		expect(
			troughRowState({ target: 200, raised: 195, my_contribution: 0 }).chip,
		).toBe(5);
	});

	it("reads a filled quarter as no chip, but not as a full Trough", () => {
		const s = troughRowState({ target: 200, raised: 100, my_contribution: 50 });
		expect(s.chip).toBe(0);
		expect(s.quarterFilled).toBe(true);
		expect(
			troughRowState({ target: 200, raised: 200, my_contribution: 50 })
				.quarterFilled,
		).toBe(false);
	});
});

describe("troughRowTitle", () => {
	it("names the opener and the item in the hand voice", () => {
		expect(
			troughRowTitle({
				is_mine: false,
				opener_name: "Sam",
				item_name: "Top Hat",
				item_id: "top_hat",
			}),
		).toBe("Sam's Top Hat");
	});

	it("says Your for the drive you opened, and falls back to the id", () => {
		expect(
			troughRowTitle({
				is_mine: true,
				opener_name: "Me",
				item_name: null,
				item_id: "halo",
			}),
		).toBe("Your halo");
		expect(
			troughRowTitle({
				is_mine: false,
				opener_name: null,
				item_name: "Halo",
				item_id: "halo",
			}),
		).toBe("A friend's Halo");
	});
});

describe("troughPillLabel", () => {
	it("counts open drives first, then receipts", () => {
		expect(troughPillLabel(2, 1)).toBe("2 open");
		expect(troughPillLabel(0, 1)).toBe("1 update");
		expect(troughPillLabel(0, 3)).toBe("3 updates");
	});
});
