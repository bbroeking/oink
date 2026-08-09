import { Platform } from "react-native";
import mobileAds, {
	AdEventType,
	AdsConsent,
	MaxAdContentRating,
	RewardedAd,
	RewardedAdEventType,
	TestIds,
} from "react-native-google-mobile-ads";
import type { RewardedAdProvider } from "./rewardedAdFlow";

const IOS_PRODUCTION_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID;

let initialized = false;

async function initializeAds() {
	if (initialized) return;

	const consent = await AdsConsent.gatherConsent({
		tagForUnderAgeOfConsent: false,
	});
	if (!consent.canRequestAds) {
		throw new Error("consent_required");
	}

	await mobileAds().setRequestConfiguration({
		maxAdContentRating: MaxAdContentRating.G,
		tagForChildDirectedTreatment: false,
		tagForUnderAgeOfConsent: false,
	});
	await mobileAds().initialize();
	initialized = true;
}

export function createAdMobRewardedProvider(): RewardedAdProvider {
	let currentAd: RewardedAd | null = null;

	return {
		async load(attemptId) {
			if (Platform.OS !== "ios") throw new Error("unsupported_platform");
			await initializeAds();
			const unitId = __DEV__ ? TestIds.REWARDED : IOS_PRODUCTION_UNIT_ID;
			if (!unitId) throw new Error("missing_ad_unit");

			const ad = RewardedAd.createForAdRequest(unitId, {
				requestNonPersonalizedAdsOnly: true,
				serverSideVerificationOptions: { customData: attemptId },
			});
			currentAd = ad;

			await new Promise<void>((resolve, reject) => {
				const unsubLoaded = ad.addAdEventListener(
					RewardedAdEventType.LOADED,
					() => {
						unsubLoaded();
						unsubError();
						resolve();
					}
				);
				const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
					unsubLoaded();
					unsubError();
					reject(error);
				});
				ad.load();
			});

			return {};
		},

		async show() {
			const ad = currentAd;
			if (!ad) throw new Error("ad_not_loaded");

			return new Promise<{ kind: "earned" } | { kind: "closed" }>(
				(resolve, reject) => {
					let earned = false;
					const unsubEarned = ad.addAdEventListener(
						RewardedAdEventType.EARNED_REWARD,
						() => {
							earned = true;
						}
					);
					const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
						cleanup();
						currentAd = null;
						resolve({ kind: earned ? "earned" : "closed" });
					});
					const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
						cleanup();
						currentAd = null;
						reject(error);
					});
					const cleanup = () => {
						unsubEarned();
						unsubClosed();
						unsubError();
					};

					ad.show().catch((error) => {
						cleanup();
						currentAd = null;
						reject(error);
					});
				}
			);
		},
	};
}
