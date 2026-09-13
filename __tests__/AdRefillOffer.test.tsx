import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@/features/rewarded-ads/analytics", () => ({
	trackRewardedAdInteraction: jest.fn().mockResolvedValue(true),
}));

// The offer's dialogs mount AdaptiveModalScaffold, which reads the safe area.
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { AdRefillOffer } from "@/features/rewarded-ads/AdRefillOffer";
import type {
	RewardedAdBackend,
	RewardedAdProvider,
} from "@/features/rewarded-ads/rewardedAdFlow";
import type { RewardedAdOfferBackend } from "@/features/rewarded-ads/rewardedAdsBackend";

describe("AdRefillOffer", () => {
	test("asks for age eligibility before loading any ad", async () => {
		let confirmed = false;
		const load = jest.fn();
		const backend: RewardedAdBackend & RewardedAdOfferBackend = {
			offerStatus: async () =>
				confirmed
					? { kind: "available", rewardAmount: 3 }
					: { kind: "age_required", rewardAmount: 3 },
			confirmAgeEligibility: async (eligible) => {
				confirmed = eligible;
				return { ok: true };
			},
			reserve: async () => ({ ok: false, reason: "not_used" }),
			markStarted: async () => ({ ok: true }),
			cancel: async () => {},
			waitForVerification: async () => ({ kind: "pending" }),
		};
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<AdRefillOffer
					homeBalance={0}
					onBalanceChanged={() => {}}
					backend={backend}
					provider={{ load, show: async () => ({ kind: "closed" }) }}
				/>
			);
			await Promise.resolve();
		});

		act(() =>
			renderer.root.findByProps({ accessibilityLabel: "Set up ad refill" }).props.onPress()
		);
		await act(async () => {
			// The age gate is now AdaptiveModalScaffold + DialogButtonRow; the
			// confirm carries the primitive's testID rather than a hand-rolled label.
			await renderer.root
				.findByProps({ testID: "dialog-confirm" })
				.props.onPress();
		});

		expect(confirmed).toBe(true);
		expect(load).not.toHaveBeenCalled();
		expect(
			renderer.root.findByProps({
				accessibilityLabel: "Watch an ad for 3 personal tickles",
			})
		).toBeTruthy();
		act(() => renderer.unmount());
	});

	test("an eligible empty bank offers the exact personal-tickle reward", async () => {
		const backend: RewardedAdBackend & RewardedAdOfferBackend = {
			offerStatus: async () => ({ kind: "available", rewardAmount: 3 }),
			confirmAgeEligibility: async () => ({ ok: true }),
			reserve: async () => ({ ok: false, reason: "not_used" }),
			markStarted: async () => ({ ok: true }),
			cancel: async () => {},
			waitForVerification: async () => ({ kind: "pending" }),
		};
		const provider: RewardedAdProvider = {
			load: async () => ({}),
			show: async () => ({ kind: "closed" }),
		};
		let renderer!: TestRenderer.ReactTestRenderer;

		await act(async () => {
			renderer = TestRenderer.create(
				<AdRefillOffer
					homeBalance={0}
					onBalanceChanged={async () => {}}
					backend={backend}
					provider={provider}
				/>
			);
			await Promise.resolve();
		});

		const offer = renderer.root.findByProps({
			accessibilityLabel: "Watch an ad for 3 personal tickles",
		});
		expect(offer).toBeTruthy();
		act(() => renderer.unmount());
	});

	test("watching requires confirmation and refreshes the Barn only after verification", async () => {
		let refreshed = false;
		const backend: RewardedAdBackend & RewardedAdOfferBackend = {
			offerStatus: async () => ({ kind: "available", rewardAmount: 3 }),
			confirmAgeEligibility: async () => ({ ok: true }),
			reserve: async () => ({
				ok: true,
				attemptId: "00000000-0000-4000-8000-000000000003",
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
			load: async () => ({}),
			show: async () => ({ kind: "earned" }),
		};
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<AdRefillOffer
					homeBalance={0}
					onBalanceChanged={async () => {
						refreshed = true;
					}}
					backend={backend}
					provider={provider}
				/>
			);
			await Promise.resolve();
		});

		act(() =>
			renderer.root
				.findByProps({ accessibilityRole: "button" })
				.props.onPress()
		);
		expect(refreshed).toBe(false);

		await act(async () => {
			await renderer.root
				.findByProps({ accessibilityLabel: "Confirm watch ad" })
				.props.onPress();
		});

		expect(refreshed).toBe(true);
		expect(renderer.root.findByProps({ accessibilityLabel: "Reward verified" })).toBeTruthy();
		act(() => renderer.unmount());
	});
});
