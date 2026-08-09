import { createSupabaseRewardedAdBackend } from "@/features/rewarded-ads/supabaseAdapter";

describe("Supabase rewarded-ad adapter", () => {
	it("maps the server offer and waits for signed verification", async () => {
		const call = jest
			.fn()
			.mockResolvedValueOnce({ ok: true, kind: "available", reward_amount: 3 })
			.mockResolvedValueOnce({ ok: true, kind: "pending" })
			.mockResolvedValueOnce({
				ok: true,
				kind: "verified",
				reward_amount: 3,
				balance: 3,
			});
		const delay = jest.fn().mockResolvedValue(undefined);
		const backend = createSupabaseRewardedAdBackend({
			call: call as never,
			delay,
			pollAttempts: 2,
		});

		expect(await backend.offerStatus()).toEqual({
			kind: "available",
			rewardAmount: 3,
		});
		expect(
			await backend.waitForVerification("00000000-0000-4000-8000-0000000000ad")
		).toEqual({ kind: "verified", rewardAmount: 3, balance: 3 });
		expect(delay).toHaveBeenCalledTimes(1);
	});

	it("fails closed when the offer RPC is unavailable", async () => {
		const backend = createSupabaseRewardedAdBackend({
			call: jest.fn().mockResolvedValue({ ok: false, reason: "network" }) as never,
		});
		expect(await backend.offerStatus()).toEqual({ kind: "hidden" });
	});
});
