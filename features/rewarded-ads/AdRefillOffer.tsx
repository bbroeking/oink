import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Sticker } from "@/components/ui/Sticker";
import {
	MODAL_BACKDROP_BG,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import type {
	RewardedAdBackend,
	RewardedAdProvider,
} from "./rewardedAdFlow";
import { runRewardedAdFlow } from "./rewardedAdFlow";
import type {
	RewardedAdOfferBackend,
	RewardedAdOfferStatus,
} from "./rewardedAdsBackend";
import { trackRewardedAdInteraction } from "./analytics";

export function AdRefillOffer({
	homeBalance,
	backend,
	provider,
	onBalanceChanged,
	analyticsEnabled = true,
}: {
	homeBalance: number;
	onBalanceChanged: () => void | Promise<void>;
	backend: RewardedAdBackend & RewardedAdOfferBackend;
	provider: RewardedAdProvider;
	analyticsEnabled?: boolean;
}) {
	const [offer, setOffer] = useState<RewardedAdOfferStatus>({ kind: "hidden" });
	const [sheetOpen, setSheetOpen] = useState(false);
	const [ageOpen, setAgeOpen] = useState(false);
	const [ageSubmitting, setAgeSubmitting] = useState(false);
	const [flowState, setFlowState] = useState<
		"idle" | "loading" | "granted" | "pending" | "closed" | "unavailable"
	>("idle");

	useEffect(() => {
		let active = true;
		if (homeBalance !== 0 && !sheetOpen) {
			setOffer({ kind: "hidden" });
			return () => {
				active = false;
			};
		}
		backend.offerStatus().then((next) => {
			if (active) setOffer(next);
		});
		return () => {
			active = false;
		};
	}, [backend, homeBalance, sheetOpen]);

	if (offer.kind === "age_required") {
		return (
			<>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Set up ad refill"
					onPress={() => setAgeOpen(true)}
				>
					<Sticker color="sun" rotate={0.4} shadow={false} style={styles.offer}>
						<Text style={styles.kicker}>OPTIONAL AD REFILL</Text>
						<Text style={styles.title}>Set up age eligibility</Text>
					</Sticker>
				</Pressable>
				<Modal
					visible={ageOpen}
					transparent
					animationType="fade"
					onRequestClose={() => !ageSubmitting && setAgeOpen(false)}
				>
					<View style={styles.backdrop}>
						<Sticker color="paper" rotate={-0.5} style={styles.sheet}>
							<Text style={styles.kicker}>BEFORE SHOWING ADS</Text>
							<Text style={styles.sheetTitle}>Are you 13 or older?</Text>
							<Text style={styles.body}>
								Ad refills are optional. If you are under 13, Tickle the Pig will
								not show you ads.
							</Text>
							<View style={styles.actions}>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="I am 13 or older"
									disabled={ageSubmitting}
									onPress={async () => {
										setAgeSubmitting(true);
										const result = await backend.confirmAgeEligibility(true);
										if (result.ok) {
											setOffer({
												kind: "available",
												rewardAmount: offer.rewardAmount,
											});
											setAgeOpen(false);
										}
										setAgeSubmitting(false);
									}}
									style={styles.primaryButton}
								>
									<Text style={styles.primaryText}>Yes, I am 13+</Text>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									disabled={ageSubmitting}
									onPress={async () => {
										setAgeSubmitting(true);
										await backend.confirmAgeEligibility(false);
										setAgeSubmitting(false);
										setAgeOpen(false);
										setOffer({ kind: "hidden" });
									}}
									style={styles.secondaryButton}
								>
									<Text style={styles.secondaryText}>No / not now</Text>
								</Pressable>
							</View>
						</Sticker>
					</View>
				</Modal>
			</>
		);
	}

	if (offer.kind !== "available") return null;

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Watch an ad for ${offer.rewardAmount} personal tickles`}
				onPress={() => {
					setFlowState("idle");
					setSheetOpen(true);
					if (analyticsEnabled) {
						void trackRewardedAdInteraction("rewarded_ad_offer_opened");
					}
				}}
			>
				<Sticker color="sun" rotate={0.4} shadow={false} style={styles.offer}>
					<Text style={styles.kicker}>AD REFILL</Text>
					<Text style={styles.title}>
						Watch an ad for {offer.rewardAmount} personal tickles
					</Text>
				</Sticker>
			</Pressable>

			<Modal
				visible={sheetOpen}
				transparent
				animationType="fade"
				onRequestClose={() => flowState !== "loading" && setSheetOpen(false)}
			>
				<View style={styles.backdrop}>
					<Sticker color="paper" rotate={-0.5} style={styles.sheet}>
						{flowState === "granted" ? (
							<View accessibilityLabel="Reward verified">
								<Text style={styles.sheetTitle}>Refill delivered</Text>
								<Text style={styles.body}>
									{offer.rewardAmount} personal tickles are ready for Rosie.
								</Text>
								<Pressable
									accessibilityRole="button"
									onPress={() => setSheetOpen(false)}
									style={styles.primaryButton}
								>
									<Text style={styles.primaryText}>Tickle Rosie</Text>
								</Pressable>
							</View>
						) : (
							<>
								<Text style={styles.kicker}>ONE OPTIONAL AD</Text>
								<Text style={styles.sheetTitle}>
									Watch an ad for {offer.rewardAmount} personal tickles
								</Text>
								<Text style={styles.body}>
									For Rosie only—these can't answer tickle trades. Your normal
									regen keeps running either way.
								</Text>

								{flowState === "loading" ? (
									<View style={styles.loadingRow}>
										<ActivityIndicator color={WHIMSY.accent} />
										<Text style={styles.body}>Finding an ad…</Text>
									</View>
								) : flowState === "pending" ? (
									<Text style={styles.notice}>Reward pending verification.</Text>
								) : flowState === "closed" ? (
									<Text style={styles.notice}>No ad finished, so nothing was used.</Text>
								) : flowState === "unavailable" ? (
									<Text style={styles.notice}>No ad is available right now.</Text>
								) : null}

								<View style={styles.actions}>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel="Confirm watch ad"
										disabled={flowState === "loading"}
									onPress={async () => {
										setFlowState("loading");
										if (analyticsEnabled) {
											void trackRewardedAdInteraction("rewarded_ad_started");
										}
										const result = await runRewardedAdFlow({ backend, provider });
										if (result.kind === "granted") {
											setFlowState("granted");
											if (analyticsEnabled) {
												void trackRewardedAdInteraction("rewarded_ad_finished", "succeeded");
											}
											await onBalanceChanged();
										} else if (result.kind === "pending") {
											setFlowState("pending");
										} else if (result.kind === "closed") {
											setFlowState("closed");
											if (analyticsEnabled) {
												void trackRewardedAdInteraction("rewarded_ad_finished", "cancelled");
											}
										} else {
											setFlowState("unavailable");
											if (analyticsEnabled) {
												void trackRewardedAdInteraction("rewarded_ad_finished", "unavailable");
											}
											}
										}}
										style={styles.primaryButton}
									>
										<Text style={styles.primaryText}>Watch ad</Text>
									</Pressable>
									<Pressable
										accessibilityRole="button"
										disabled={flowState === "loading"}
										onPress={() => setSheetOpen(false)}
										style={styles.secondaryButton}
									>
										<Text style={styles.secondaryText}>Not now</Text>
									</Pressable>
								</View>
							</>
						)}
					</Sticker>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	offer: {
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		...SHADOW_SM,
	},
	kicker: {
		...TYPE.kickerPillSm,
		color: WHIMSY.mute,
		marginBottom: SPACE.xs,
	},
	title: {
		...TYPE.bodySm,
		color: WHIMSY.ink,
	},
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		padding: SPACE.xl,
	},
	sheet: {
		padding: SPACE.lg,
		maxWidth: 420,
		width: "100%",
		alignSelf: "center",
	},
	sheetTitle: {
		...TYPE.cardTitle,
		color: WHIMSY.ink,
		marginBottom: SPACE.sm,
	},
	body: {
		...TYPE.body,
		color: WHIMSY.mute,
	},
	notice: {
		...TYPE.bodySm,
		color: WHIMSY.accent,
		marginTop: SPACE.md,
	},
	loadingRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	actions: {
		gap: SPACE.sm,
		marginTop: SPACE.lg,
	},
	primaryButton: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.lg,
		alignItems: "center",
		...SHADOW_SM,
	},
	primaryText: {
		...TYPE.label,
		color: WHIMSY.ink,
	},
	secondaryButton: {
		paddingVertical: SPACE.sm,
		alignItems: "center",
	},
	secondaryText: {
		...TYPE.bodySm,
		color: WHIMSY.mute,
	},
});
