import { useMemo, useState } from "react";
import { Redirect, Stack } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { AdRefillOffer } from "@/features/rewarded-ads/AdRefillOffer";
import { createAdMobRewardedProvider } from "@/features/rewarded-ads/admobAdapter";
import type { RewardedAdBackend } from "@/features/rewarded-ads/rewardedAdFlow";
import type { RewardedAdOfferBackend } from "@/features/rewarded-ads/rewardedAdsBackend";
import {
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

type PreviewBackend = RewardedAdBackend & RewardedAdOfferBackend;

function createPreviewBackend(): PreviewBackend {
	return {
		offerStatus: async () => ({ kind: "available", rewardAmount: 3 }),
		confirmAgeEligibility: async () => ({ ok: true }),
		reserve: async () => ({
			ok: true,
			attemptId: "00000000-0000-4000-8000-0000000000ad",
			rewardAmount: 3,
		}),
		markStarted: async () => ({ ok: true }),
		cancel: async () => {},
		waitForVerification: async () => {
			await new Promise((resolve) => setTimeout(resolve, 650));
			return { kind: "verified", rewardAmount: 3, balance: 3 };
		},
	};
}

export default function AdRefillPreviewScreen() {
	if (!__DEV__) return <Redirect href="/" />;
	return <AdRefillPreview />;
}

function AdRefillPreview() {
	const [balance, setBalance] = useState(0);
	const backend = useMemo(createPreviewBackend, []);
	const provider = useMemo(createAdMobRewardedProvider, []);

	return (
		<SafeAreaView style={styles.page}>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.header}>
				<Text style={styles.kicker}>DEVELOPMENT PREVIEW</Text>
				<Text style={styles.title}>Ad refill</Text>
				<Text style={styles.body}>
					This uses Google's rewarded test inventory and a local-only fake reward
					verification. It cannot grant anything to the production account.
				</Text>
			</View>

			<View style={styles.bank}>
				<Text style={styles.bankLabel}>PERSONAL TICKLES</Text>
				<Text style={styles.bankCount}>{balance}</Text>
			</View>

			{balance === 0 ? (
				<AdRefillOffer
					homeBalance={balance}
					onBalanceChanged={() => setBalance(3)}
					backend={backend}
					provider={provider}
					analyticsEnabled={false}
				/>
			) : (
				<Pressable
					accessibilityRole="button"
					onPress={() => setBalance(0)}
					style={styles.reset}
				>
					<Text style={styles.resetText}>Reset to empty bank</Text>
				</Pressable>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	page: {
		flex: 1,
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: PAGE_PAD,
		paddingTop: 56,
		gap: SPACE.xl,
	},
	header: { gap: SPACE.sm },
	kicker: { ...TYPE.kickerPill, color: WHIMSY.accent },
	title: { ...TYPE.pageTitle, color: WHIMSY.ink },
	body: { ...TYPE.body, color: WHIMSY.mute },
	bank: {
		backgroundColor: WHIMSY.rose,
		borderColor: WHIMSY.ink,
		borderWidth: 2,
		borderRadius: RADII.xl,
		padding: SPACE.xl,
		alignItems: "center",
		...SHADOW_SM,
	},
	bankLabel: { ...TYPE.kickerPillSm, color: WHIMSY.mute },
	bankCount: { ...TYPE.display, color: WHIMSY.ink, marginTop: SPACE.sm },
	reset: {
		alignSelf: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream,
		borderColor: WHIMSY.ink,
		borderWidth: 2,
	},
	resetText: { ...TYPE.label, color: WHIMSY.ink },
});
