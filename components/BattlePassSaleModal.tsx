import React from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	ScrollView,
	Linking,
} from "react-native";
import { Sticker, Tape } from "./ui/Sticker";
import { Icon } from "./ui/Icon";
import { FONTS, KICKER_TEXT, MODAL_BACKDROP_BG, WHIMSY } from "@/constants/theme";
import { restorePurchases } from "../utils/iap";

interface Props {
	visible: boolean;
	onClose: () => void;
	onUnlock: (plus: boolean) => void;
	premiumPriceCents: number;
	premiumPlusPriceCents: number;
	currentTier: number;
	totalTiers: number;
	busy?: boolean;
}

// Apple's standard EULA — fine for the shipping app until we write our own.
const TC_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
// Privacy policy URL — wired via env so we don't ship a 404 placeholder. Host
// the page (legal/privacy-policy.html) and set EXPO_PUBLIC_PRIVACY_URL before
// TestFlight submission. Until then the link is hidden.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || null;

const PREMIUM_PERKS = [
	"All 30 premium-track rewards",
	"Exclusive premium-only hat",
	"Boosts and snout bundles",
];

const PLUS_PERKS = [
	"Everything in Premium",
	"+600 snouts immediately",
	"Exclusive Premium Plus title",
	"Skip first 5 tiers",
];

export function BattlePassSaleModal({
	visible,
	onClose,
	onUnlock,
	premiumPriceCents,
	premiumPlusPriceCents,
	currentTier,
	totalTiers,
	busy,
}: Props) {
	const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
		>
			<View style={styles.backdrop}>
				<View style={styles.sheetWrap}>
					<Tape
						color="rose"
						rotate={-8}
						width={80}
						height={20}
						style={styles.tapeTop}
					/>
					<Sticker color="paper" rotate={-0.6} radius={20} style={styles.sheet}>
						<Pressable
							onPress={onClose}
							style={styles.closeBtn}
							accessibilityLabel="Close"
						>
							<Text style={styles.closeText}>✕</Text>
						</Pressable>

						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={styles.body}
						>
							<Text style={styles.kicker}>★ snout season 1</Text>
							<Text style={styles.title}>Unlock the full path</Text>
							<Text style={styles.subtitle}>
								You're at tier {currentTier} of {totalTiers}. Premium opens 30
								extra rewards along the way.
							</Text>

							{/* Premium card */}
							<Sticker color="rose" rotate={-1.2} radius={16} style={styles.tierCard}>
								<View style={styles.tierTop}>
									<View style={{ flex: 1 }}>
										<Text style={styles.tierName}>Premium</Text>
										<Text style={styles.tierTagline}>
											The full season pass.
										</Text>
									</View>
									<Text style={styles.tierPrice}>{fmt(premiumPriceCents)}</Text>
								</View>
								<View style={styles.perks}>
									{PREMIUM_PERKS.map((p) => (
										<View key={p} style={styles.perk}>
											<Text style={styles.perkBullet}>✦</Text>
											<Text style={styles.perkText}>{p}</Text>
										</View>
									))}
								</View>
								<Pressable
									disabled={busy}
									onPress={() => onUnlock(false)}
									style={styles.buyBtn}
								>
									<Text style={styles.buyBtnText}>
										Unlock Premium · {fmt(premiumPriceCents)}
									</Text>
								</Pressable>
							</Sticker>

							{/* Plus card */}
							<Sticker color="lilac" rotate={1} radius={16} style={styles.tierCard}>
								<View style={styles.tierTop}>
									<View style={{ flex: 1 }}>
										<View style={styles.bestRow}>
											<Text style={styles.bestTag}>★ BEST VALUE</Text>
										</View>
										<Text style={styles.tierName}>Premium Plus</Text>
										<Text style={styles.tierTagline}>
											Premium + a fast-track boost.
										</Text>
									</View>
									<Text style={styles.tierPrice}>
										{fmt(premiumPlusPriceCents)}
									</Text>
								</View>
								<View style={styles.perks}>
									{PLUS_PERKS.map((p) => (
										<View key={p} style={styles.perk}>
											<Text style={styles.perkBullet}>✦</Text>
											<Text style={styles.perkText}>{p}</Text>
										</View>
									))}
								</View>
								<Pressable
									disabled={busy}
									onPress={() => onUnlock(true)}
									style={[styles.buyBtn, { backgroundColor: WHIMSY.lilacDeep }]}
								>
									<Text style={[styles.buyBtnText, { color: WHIMSY.paper }]}>
										Unlock Plus · {fmt(premiumPlusPriceCents)}
									</Text>
								</Pressable>
							</Sticker>

							<View style={styles.footer}>
								<Pressable onPress={() => restorePurchases().catch(() => {})}>
									<Text style={styles.restoreLink}>Restore purchases</Text>
								</Pressable>
								<Text style={styles.legalLine}>
									One-time purchase. Premium lasts the season.
								</Text>
								<View style={styles.legalRow}>
									<Pressable onPress={() => Linking.openURL(TC_URL)}>
										<Text style={styles.legalLink}>Terms</Text>
									</Pressable>
									{PRIVACY_URL && (
										<>
											<Text style={styles.legalDot}>·</Text>
											<Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
												<Text style={styles.legalLink}>Privacy</Text>
											</Pressable>
										</>
									)}
								</View>
							</View>
						</ScrollView>
					</Sticker>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	sheetWrap: {
		position: "relative",
		paddingTop: 12,
	},
	tapeTop: {
		position: "absolute",
		top: 0,
		alignSelf: "center",
		zIndex: 2,
	},
	sheet: {
		maxHeight: "92%",
		overflow: "hidden",
	},
	closeBtn: {
		position: "absolute",
		top: 8,
		right: 10,
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 3,
	},
	closeText: {
		fontSize: 22,
		color: WHIMSY.ink,
	},
	body: {
		padding: 18,
		paddingTop: 22,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		lineHeight: 30,
		marginBottom: 6,
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		lineHeight: 18,
		marginBottom: 16,
	},
	tierCard: {
		padding: 14,
		marginBottom: 14,
	},
	tierTop: {
		flexDirection: "row",
		alignItems: "flex-start",
	},
	bestRow: { marginBottom: 4 },
	bestTag: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
		letterSpacing: 0.6,
	},
	tierName: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		lineHeight: 24,
	},
	tierTagline: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	tierPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	perks: {
		marginTop: 10,
		gap: 4,
	},
	perk: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 8,
	},
	perkBullet: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		marginTop: 1,
	},
	perkText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		lineHeight: 18,
		flex: 1,
	},
	buyBtn: {
		marginTop: 12,
		paddingVertical: 11,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
	},
	buyBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	footer: {
		alignItems: "center",
		marginTop: 8,
		gap: 6,
	},
	restoreLink: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	legalLine: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingHorizontal: 8,
	},
	legalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 2,
	},
	legalLink: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	legalDot: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.muteSoft,
	},
});
