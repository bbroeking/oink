import { joinSlopClubAndRecruit } from "../utils/joinSlopClub";

describe("join Slop Club and recruit", () => {
	test("recruits the selected pig after a successful purchase", async () => {
		const recruit = jest.fn().mockResolvedValue({
			ok: true,
			data: { pig_id: "biscuit" },
		});

		const result = await joinSlopClubAndRecruit("biscuit", {
			iapEnabled: true,
			presentPaywall: jest.fn().mockResolvedValue({
				ok: true,
				reason: "purchased",
			}),
			recruit,
			wait: jest.fn(),
		});

		expect(recruit).toHaveBeenCalledWith("biscuit");
		expect(result).toEqual({ kind: "joined", pigId: "biscuit" });
	});

	test("waits for the membership webhook before retrying recruitment", async () => {
		const recruit = jest
			.fn()
			.mockResolvedValueOnce({ ok: false, reason: "membership_required" })
			.mockResolvedValueOnce({ ok: true, data: { pig_id: "pickles" } });
		const wait = jest.fn().mockResolvedValue(undefined);

		const result = await joinSlopClubAndRecruit("pickles", {
			iapEnabled: true,
			presentPaywall: jest.fn().mockResolvedValue({
				ok: true,
				reason: "purchased",
			}),
			recruit,
			wait,
		});

		expect(recruit).toHaveBeenCalledTimes(2);
		expect(wait).toHaveBeenCalled();
		expect(result).toEqual({ kind: "joined", pigId: "pickles" });
	});

	test("reports an unavailable storefront instead of silently doing nothing", async () => {
		const presentPaywall = jest.fn();
		const recruit = jest.fn();

		const result = await joinSlopClubAndRecruit("bandit", {
			iapEnabled: false,
			presentPaywall,
			recruit,
			wait: jest.fn(),
		});

		expect(presentPaywall).not.toHaveBeenCalled();
		expect(recruit).not.toHaveBeenCalled();
		expect(result).toEqual({ kind: "unavailable" });
	});
});
