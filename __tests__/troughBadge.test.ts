import { troughActiveCount, troughAttentionCount } from "@/hooks/useTroughDrives";

describe("Trough segment badge", () => {
	it("counts live drives and funded receipts", () => {
		expect(
			troughAttentionCount(
				[{ id: "drive" }] as never[],
				[{ donation_id: "receipt" }] as never[],
			),
		).toBe(2);
	});

	it("keeps the collapsed active count about open drives only", () => {
		expect(troughActiveCount([{ id: "drive" }] as never[])).toBe(1);
	});
});
