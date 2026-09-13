import type { RewardedAdProvider } from "./rewardedAdFlow";

// Google Mobile Ads is native-only. Keep the web graph free of the native
// codegen package while preserving the provider contract for previews/routes.
export function createAdMobRewardedProvider(): RewardedAdProvider {
	return {
		async load() {
			throw new Error("unsupported_platform");
		},
		async show() {
			throw new Error("unsupported_platform");
		},
	};
}

