import {
	runRewardedAdFlow,
	type RewardedAdBackend,
	type RewardedAdProvider,
} from "@/features/rewarded-ads/rewardedAdFlow";

describe("rewarded ad flow", () => {
	test("a completed, server-verified ad grants the reserved personal tickles", async () => {
		const backend: RewardedAdBackend = {
			reserve: async () => ({
				ok: true,
				attemptId: "00000000-0000-4000-8000-000000000001",
				rewardAmount: 3,
			}),
			markStarted: async () => ({ ok: true }),
			cancel: async () => {},
			waitForVerification: async () => ({
				kind: "verified",
				rewardAmount: 3,
				balance: 3,
			}),
		};
		const provider: RewardedAdProvider = {
			load: async () => ({ responseId: "test-response" }),
			show: async () => ({ kind: "earned" }),
		};

		await expect(runRewardedAdFlow({ backend, provider })).resolves.toEqual({
			kind: "granted",
			rewardAmount: 3,
			balance: 3,
		});
	});

	test("an ad load failure leaves the player with a recoverable unavailable result", async () => {
		const backend: RewardedAdBackend = {
			reserve: async () => ({
				ok: true,
				attemptId: "00000000-0000-4000-8000-000000000002",
				rewardAmount: 3,
			}),
			markStarted: async () => ({ ok: true }),
			cancel: async () => {},
			waitForVerification: async () => ({ kind: "pending" }),
		};
		const provider: RewardedAdProvider = {
			load: async () => {
				throw new Error("no fill");
			},
			show: async () => ({ kind: "closed" }),
		};

		await expect(runRewardedAdFlow({ backend, provider })).resolves.toEqual({
			kind: "unavailable",
			reason: "ad_unavailable",
		});
	});

	test("a provider show error releases the reservation and stays recoverable", async () => {
		const cancel = jest.fn().mockResolvedValue(undefined);
		const backend: RewardedAdBackend = {
			reserve: async () => ({
				ok: true,
				attemptId: "00000000-0000-4000-8000-000000000004",
				rewardAmount: 3,
			}),
			markStarted: async () => ({ ok: true }),
			cancel,
			waitForVerification: async () => ({ kind: "pending" }),
		};
		const provider: RewardedAdProvider = {
			load: async () => ({}),
			show: async () => {
				throw new Error("presentation failed");
			},
		};

		await expect(runRewardedAdFlow({ backend, provider })).resolves.toEqual({
			kind: "unavailable",
			reason: "ad_unavailable",
		});
		expect(cancel).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000004");
	});
});
