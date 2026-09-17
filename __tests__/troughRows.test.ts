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

// ── Home (SKILL.md 2026-09-16): the yard trough and the fan row ─────────────
import { leadingTroughDrive, troughYardOffer } from "@/utils/troughRows";

describe("leadingTroughDrive", () => {
	const d = (id: string, raised: number, target: number, closes_at: string, is_mine = false) => ({ id, raised, target, closes_at, is_mine });
	it("never picks my own Trough — friends only (2026-09-16)", () => {
		const mine = d("mine", 190, 200, "2026-09-20T00:00:00Z", true);
		const theirs = d("theirs", 20, 200, "2026-09-21T00:00:00Z");
		expect(leadingTroughDrive([mine, theirs])?.id).toBe("theirs");
		expect(leadingTroughDrive([mine])).toBeNull();
	});
	it("is null when nothing is open", () => {
		expect(leadingTroughDrive([])).toBeNull();
	});
	it("picks the drive nearest full", () => {
		const a = d("a", 20, 200, "2026-09-20T00:00:00Z");
		const b = d("b", 140, 200, "2026-09-21T00:00:00Z");
		expect(leadingTroughDrive([a, b])?.id).toBe("b");
	});
	it("breaks a tie by the one closing soonest", () => {
		const a = d("a", 50, 100, "2026-09-21T00:00:00Z");
		const b = d("b", 100, 200, "2026-09-20T00:00:00Z");
		expect(leadingTroughDrive([a, b])?.id).toBe("b");
	});
	it("never divides by a zero target", () => {
		expect(leadingTroughDrive([d("z", 0, 0, "2026-09-20T00:00:00Z")])?.id).toBe("z");
	});
});

describe("troughYardOffer", () => {
	it("offers the chip, says when the quarter is in, asks the sounder on mine", () => {
		expect(troughYardOffer({ is_mine: false, target: 200, raised: 140, my_contribution: 0 })).toBe("chip in 25 ›");
		expect(troughYardOffer({ is_mine: false, target: 200, raised: 140, my_contribution: 50 })).toBe("your quarter is in ›");
		expect(troughYardOffer({ is_mine: true, target: 200, raised: 140, my_contribution: 0 })).toBe("ask your Sounder ›");
		expect(troughYardOffer({ is_mine: false, target: 200, raised: 200, my_contribution: 0 })).toBe("landed ›");
	});
});

describe("Home carries the Trough (source scan)", () => {
	const fs = require("node:fs") as typeof import("node:fs");
	const path = require("node:path") as typeof import("node:path");
	const barn = fs.readFileSync(path.join(__dirname, "..", "components", "Barn.tsx"), "utf8");
	it("the fan has a Trough row only while a Trough is open, and it opens the sheet", () => {
		expect(barn).toContain("if (leadingTrough) {");
		expect(barn).toContain('key: "trough",');
		expect(barn).toContain('mark: "trough",');
		expect(barn).toContain("onPress: () => setTroughOpen(true),");
	});
	it("the yard trough is absolute on itself and drawn under the mound", () => {
		const trough = barn.indexOf("<YardTrough");
		const mound = barn.indexOf("<BuriedMound");
		expect(trough).toBeGreaterThan(0);
		expect(trough).toBeLessThan(mound);
		expect(barn).toContain("zIndex: YARD_Z - 1,");
		expect(barn).toContain("marginLeft: YARD_TROUGH_SHIFT,");
	});
	it("Home mounts the same Trough sheet the store opens", () => {
		expect(barn).toContain('import { TroughSheet } from "./shop/TroughSheet";');
		expect(barn).toContain("focusDriveId={leadingTrough?.id ?? null}");
	});
});
