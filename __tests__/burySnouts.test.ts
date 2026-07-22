import { maxBuryStake, maxTopUp, MIN_STAKE, POT_CAP } from "@/utils/burySnouts";

describe("maxBuryStake — fill the pot, bounded by balance", () => {
	it("returns the balance when it's below the cap", () => {
		expect(maxBuryStake(37)).toBe(37);
	});

	it("clamps to the 50-snout pot cap when the balance is richer", () => {
		expect(maxBuryStake(80)).toBe(POT_CAP);
		expect(maxBuryStake(POT_CAP)).toBe(POT_CAP);
	});

	it("resolves to exactly the min stake at the boundary (still valid)", () => {
		expect(maxBuryStake(MIN_STAKE)).toBe(10);
		expect(maxBuryStake(MIN_STAKE)).toBeGreaterThanOrEqual(MIN_STAKE);
	});

	it("falls below the min stake for a too-poor host (caller dims the chip)", () => {
		expect(maxBuryStake(9)).toBe(9);
		expect(maxBuryStake(9)).toBeLessThan(MIN_STAKE);
	});

	it("guards zero / negative / fractional balances", () => {
		expect(maxBuryStake(0)).toBe(0);
		expect(maxBuryStake(-5)).toBe(0);
		expect(maxBuryStake(23.9)).toBe(23); // floors to a whole snout
	});
});

describe("maxTopUp — fill the headroom, bounded by balance", () => {
	it("returns the headroom when the balance covers it (43/50 pot tops to 7)", () => {
		expect(maxTopUp(100, 43)).toBe(7); // 50 - 43, and 7 <= balance
	});

	it("returns the balance when it's the tighter bound", () => {
		expect(maxTopUp(4, 20)).toBe(4); // headroom 30, but only 4 in the bank
	});

	it("tops a 49/50 pot to exactly 1 at the boundary (still valid)", () => {
		expect(maxTopUp(100, 49)).toBe(1);
		expect(maxTopUp(100, 49)).toBeGreaterThanOrEqual(1);
	});

	it("is 0 for a full pot — nothing to add (caller dims the chip)", () => {
		expect(maxTopUp(100, POT_CAP)).toBe(0);
		expect(maxTopUp(100, 60)).toBe(0); // over-cap remaining never goes negative
	});

	it("guards zero / negative / fractional balances", () => {
		expect(maxTopUp(0, 20)).toBe(0);
		expect(maxTopUp(-5, 20)).toBe(0);
		expect(maxTopUp(6.9, 40)).toBe(6); // floors; headroom 10, balance the bound
	});
});
