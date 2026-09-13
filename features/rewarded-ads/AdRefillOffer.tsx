import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
	AdaptiveModalScaffold,
	Body,
	BodySm,
	Button,
	CardTitle,
	DialogButtonRow,
	EmptyState,
	Hand,
	Sticker,
	T,
} from "@/components/ui";
import { RADII, SPACE, TILT } from "@/constants/theme";
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
				<Sticker
					color="sun"
					rotate={0.4}
					shadow="sm"
					pad
					style={styles.offer}
				>
					<T role="kickerPillSm" tone="secondary">
						Optional ad refill
					</T>
					<CardTitle>Set up age eligibility</CardTitle>
					<Hand tone="secondary">
						One question, asked once. No snouts, no trades.
					</Hand>
					<Button
						variant="gold"
						size="sm"
						full
						onPress={() => setAgeOpen(true)}
						accessibilityLabel="Set up ad refill"
						accessibilityHint="Asks one age question. Nothing is spent."
						style={styles.cta}
					>
						Set this up
					</Button>
				</Sticker>
				<AdaptiveModalScaffold
					visible={ageOpen}
					onRequestClose={() => {
						if (!ageSubmitting) setAgeOpen(false);
					}}
					animationType="fade"
					bare
					contentContainerStyle={styles.dialogContent}
				>
					<Sticker
						color="paper"
						rotate={TILT.dialog}
						radius={RADII.xl}
						style={styles.dialog}
					>
						<T role="kickerPillSm" tone="secondary" align="center">
							Before showing ads
						</T>
						<CardTitle accessibilityRole="header" align="center">
							Are you 13 or older?
						</CardTitle>
						<BodySm tone="secondary" align="center">
							Ad refills are optional. If you are under 13, Tickle the Pig will
							not show you ads.
						</BodySm>
						<DialogButtonRow
							confirmLabel="Yes, I am 13+"
							cancelLabel="No / not now"
							busy={ageSubmitting}
							confirmHint="Turns on optional ad refills. Nothing is spent."
							cancelHint="Keeps ads off. Nothing is spent."
							onConfirm={async () => {
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
							onCancel={async () => {
								setAgeSubmitting(true);
								await backend.confirmAgeEligibility(false);
								setAgeSubmitting(false);
								setAgeOpen(false);
								setOffer({ kind: "hidden" });
							}}
						/>
					</Sticker>
				</AdaptiveModalScaffold>
			</>
		);
	}

	if (offer.kind !== "available") return null;

	const loading = flowState === "loading";

	return (
		<>
			<Sticker color="sun" rotate={0.4} shadow="sm" pad style={styles.offer}>
				<T role="kickerPillSm" tone="secondary">
					Ad refill
				</T>
				<CardTitle>
					Watch an ad for {offer.rewardAmount} personal tickles
				</CardTitle>
				<Hand tone="secondary">
					One short ad. No snouts, and your regen keeps running.
				</Hand>
				<Button
					variant="gold"
					size="sm"
					full
					onPress={() => {
						setFlowState("idle");
						setSheetOpen(true);
						if (analyticsEnabled) {
							void trackRewardedAdInteraction("rewarded_ad_offer_opened");
						}
					}}
					accessibilityLabel={`Watch an ad for ${offer.rewardAmount} personal tickles`}
					accessibilityHint="Opens the offer. Nothing starts until you confirm."
					style={styles.cta}
				>
					Watch an ad
				</Button>
			</Sticker>

			<AdaptiveModalScaffold
				visible={sheetOpen}
				onRequestClose={() => {
					if (!loading) setSheetOpen(false);
				}}
				animationType="fade"
				bare
				contentContainerStyle={styles.dialogContent}
			>
				<Sticker
					color="paper"
					rotate={TILT.dialog}
					radius={RADII.xl}
					style={styles.dialog}
				>
					{flowState === "granted" ? (
						<View accessibilityLabel="Reward verified" style={styles.granted}>
							<CardTitle align="center">Refill delivered</CardTitle>
							<Body tone="secondary" align="center">
								{offer.rewardAmount} personal tickles are ready for Rosie.
							</Body>
							<Button
								variant="gold"
								full
								onPress={() => setSheetOpen(false)}
								accessibilityLabel="Tickle Rosie"
								accessibilityHint="Closes this and takes you back to the Barn."
								style={styles.cta}
							>
								Tickle Rosie
							</Button>
						</View>
					) : (
						<>
							<T role="kickerPillSm" tone="secondary" align="center">
								One optional ad
							</T>
							<CardTitle accessibilityRole="header" align="center">
								Watch an ad for {offer.rewardAmount} personal tickles
							</CardTitle>
							<Body tone="secondary" align="center">
								For Rosie only—these can&apos;t answer tickle trades. Your normal
								regen keeps running either way.
							</Body>

							{loading ? (
								<Hand tone="secondary" align="center" style={styles.notice}>
									Finding an ad…
								</Hand>
							) : flowState === "pending" ? (
								<Hand tone="accent" align="center" style={styles.notice}>
									Reward pending verification.
								</Hand>
							) : flowState === "closed" ? (
								<Hand tone="accent" align="center" style={styles.notice}>
									No ad finished, so nothing was used.
								</Hand>
							) : flowState === "unavailable" ? (
								<EmptyState
									kind="error"
									glyph="zzz"
									title="No ad right now"
									sub="Nothing was used. Try again in a little while."
									style={styles.notice}
								/>
							) : null}

							<View style={styles.actions}>
								<Button
									variant="gold"
									full
									loading={loading}
									accessibilityLabel="Confirm watch ad"
									accessibilityHint={`Plays one ad, then adds ${offer.rewardAmount} personal tickles. No snouts are spent.`}
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
								>
									Watch ad
								</Button>
								<Button
									variant="handLink"
									full
									disabled={loading}
									onPress={() => setSheetOpen(false)}
									accessibilityLabel="Not now"
									accessibilityHint="Closes the offer. Nothing is used."
								>
									Not now
								</Button>
							</View>
						</>
					)}
				</Sticker>
			</AdaptiveModalScaffold>
		</>
	);
}

const styles = StyleSheet.create({
	offer: {
		gap: SPACE.xs,
	},
	cta: {
		marginTop: SPACE.sm,
	},
	dialogContent: {
		alignItems: "center",
	},
	dialog: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		gap: SPACE.sm,
	},
	granted: {
		gap: SPACE.sm,
	},
	notice: {
		marginTop: SPACE.sm,
	},
	actions: {
		gap: SPACE.xs,
		marginTop: SPACE.md,
	},
});
