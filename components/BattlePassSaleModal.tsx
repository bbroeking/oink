// DORMANT (2026-07-13). The standalone paid Season-Pass upsell. Its wiring in
// season.tsx (handleBuySeasonPass + the sale-modal render) was removed because it
// was unreachable — the premium track now unlocks via Slop Club membership
// (season.tsx's handleUnlockPremium → the Slop Club paywall), not a separate
// one-off pass purchase. This component is intentionally KEPT, unmounted, pending
// the paid-pass decision: if a standalone pass ever ships, re-wire it here rather
// than rebuilding the modal. No live caller today.
import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Kicker,
	Sticker,
	T,
	Tape,
	TicketButton,
} from "./ui";
import { SPACE, RADII } from "@/constants/theme";
import { restorePurchases } from "../utils/iap";

interface Props {
	visible: boolean;
	onClose: () => void;
	onUnlock: () => void;
	priceCents: number;
	currentTier: number;
	totalTiers: number;
	busy?: boolean;
}

// Our own Terms of Service, hosted on ticklethepig.com (replaces Apple's stock
// EULA placeholder). Source: landing/terms.html.
const TC_URL = "https://ticklethepig.com/terms";
// Privacy policy URL — env-overridable (EXPO_PUBLIC_PRIVACY_URL, set in
// eas.json) so the host can change without a code edit; falls back to the
// canonical page. Source: landing/privacy.html.
const PRIVACY_URL =
	process.env.EXPO_PUBLIC_PRIVACY_URL || "https://ticklethepig.com/privacy";

// The strip of tape that pins the sheet to the page — drawing geometry.
const TAPE_W = 80;
const TAPE_H = 20;

const PASS_PERKS = [
	"All 30 premium-track rewards",
	"Exclusive hats, props, auras, and scenes",
	"Collectible rewards only — no gameplay advantage",
];

// The Season Pass — a one-time, per-season unlock of the premium
// reward track. Separate from the Slop Club membership (see
// docs/pass-and-slop-club-spec.md).
export function BattlePassSaleModal({
	visible,
	onClose,
	onUnlock,
	priceCents,
	currentTier,
	totalTiers,
	busy,
}: Props) {
	const price = `$${(priceCents / 100).toFixed(2)}`;
	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onClose}
			bare
			contentContainerStyle={styles.content}
		>
			<View style={styles.sheetWrap}>
				<Tape
					color="rose"
					rotate={-8}
					width={TAPE_W}
					height={TAPE_H}
					style={styles.tapeTop}
				/>
				<Sticker color="paper" rotate={-0.6} radius={RADII.xxl} style={styles.sheet}>
					<DialogCloseRow
						onPress={onClose}
						label="Close season pass"
						style={styles.closeRow}
					/>

					<View style={styles.body}>
						<Kicker>season pass</Kicker>
						<T role="pageTitle" style={styles.title}>
							Unlock the premium track
						</T>
						<T role="hand" tone="secondary" style={styles.subtitle}>
							You're at tier {currentTier} of {totalTiers}. The Season
							Pass opens 30 extra rewards along the way.
						</T>

						<Sticker color="rose" rotate={-1.2} radius={RADII.lg} pad style={styles.tierCard}>
							<View style={styles.tierTop}>
								<View style={styles.tierCopy}>
									<T role="sectionTitle">Season Pass</T>
									<T role="hand" tone="secondary" style={styles.tierTagline}>
										The premium reward track, all season.
									</T>
								</View>
								<T role="sectionTitle">{price}</T>
							</View>
							<View style={styles.perks}>
								{PASS_PERKS.map((p) => (
									<View key={p} style={styles.perk}>
										<T role="hand" style={styles.perkBullet}>✦</T>
										<T role="hand" style={styles.perkText}>{p}</T>
									</View>
								))}
							</View>
							<TicketButton
								label="Unlock Season Pass"
								stub={price}
								tone="season"
								loading={busy}
								loadingLabel="Unlocking…"
								onPress={onUnlock}
								style={styles.ticket}
							/>
						</Sticker>

						<View style={styles.footer}>
							<Button
								variant="handLink"
								size="sm"
								onPress={() => restorePurchases().catch(() => {})}
								accessibilityLabel="Restore purchases"
								accessibilityHint="Re-applies a Season Pass bought on another device"
							>
								Restore purchases
							</Button>
							<T role="hand" tone="secondary" align="center" style={styles.legalLine}>
								One-time purchase. The Season Pass lasts this season.
							</T>
							<View style={styles.legalRow}>
								<Button
									variant="link"
									size="xs"
									onPress={() => Linking.openURL(TC_URL)}
									accessibilityLabel="Terms of service"
									accessibilityHint="Opens the terms in your browser"
								>
									Terms
								</Button>
								{PRIVACY_URL && (
									<>
										<T role="hand" tone="secondary">·</T>
										<Button
											variant="link"
											size="xs"
											onPress={() => Linking.openURL(PRIVACY_URL)}
											accessibilityLabel="Privacy policy"
											accessibilityHint="Opens the privacy policy in your browser"
										>
											Privacy
										</Button>
									</>
								)}
							</View>
						</View>
					</View>
				</Sticker>
			</View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	content: { justifyContent: "center" },
	sheetWrap: { position: "relative", paddingTop: SPACE.md },
	tapeTop: { position: "absolute", top: 0, alignSelf: "center", zIndex: 2 },
	sheet: { overflow: "hidden" },
	closeRow: {
		marginBottom: -SPACE.md,
	},
	body: { padding: SPACE.lg, paddingTop: SPACE.xl },
	title: { marginBottom: SPACE.xs },
	subtitle: { marginBottom: SPACE.lg },
	tierCard: { marginBottom: SPACE.card },
	tierTop: { flexDirection: "row", alignItems: "flex-start" },
	tierCopy: { flex: 1 },
	tierTagline: { marginTop: SPACE.xxs },
	perks: { marginTop: SPACE.sm, gap: SPACE.xs },
	perk: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
	perkBullet: { marginTop: 1 },
	perkText: { flex: 1 },
	ticket: { marginTop: SPACE.md },
	footer: { alignItems: "center", marginTop: SPACE.sm, gap: SPACE.xs },
	legalLine: { paddingHorizontal: SPACE.sm },
	legalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.xxs,
	},
});
