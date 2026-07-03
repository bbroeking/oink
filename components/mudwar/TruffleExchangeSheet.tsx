// The Truffle Exchange — the war shop. Four shelf slots rotate weekly on the
// ISO week (the same "bog turns over on Monday" clock as Bog Weather): one
// Muddy, one Caked, one Prize, and a marquee alternating Champion/Heirloom.
// Priced ONLY in Golden Truffles (war items stay cost=0 — unbuyable with
// snouts, ever). Server: exchange_rotation()/redeem_war_cosmetic()
// (20260704300000, HELD) via useTruffles; until it's applied the sheet shows
// the cozy "opens with the season" state.
//
// Dressing art routes through EXCHANGE_ART so Batch-7 art (banner/shelf)
// drops in with zero code changes.
import { useState } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	Modal,
	StyleSheet,
	ScrollView,
	Dimensions,
	type ImageSourcePropType,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/ui/Icon";
import { HAT_IMAGES, RARITY_COLORS, type Rarity } from "@/constants/hats";
import {
	RARITY_TO_TIER,
	EXCHANGE_TIER_LABEL,
} from "@/constants/mudFights";
import { restockWhisper } from "@/utils/truffleExchange";
import { WHIMSY, FONTS, SHADOW_SM } from "@/constants/theme";
import { useTruffles } from "@/hooks/useTruffles";

// Batch-7 dressing slots (docs/great-hunger-art-manifest.md → exchange/).
const EXCHANGE_ART: { banner: ImageSourcePropType | null; shelf: ImageSourcePropType | null } = {
	banner: null,
	shelf: null,
};

interface Props {
	open: boolean;
	onClose: () => void;
	truffles: ReturnType<typeof useTruffles>;
}

export function TruffleExchangeSheet({ open, onClose, truffles }: Props) {
	const screenH = Dimensions.get("window").height;
	const [confirming, setConfirming] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (!open) return null;

	const onRedeem = async (hatId: string, price: number) => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await truffles.redeem(hatId);
		setBusy(false);
		setConfirming(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote("Traded. It's yours — wear it muddy.");
		} else {
			setNote(
				r.reason === "insufficient"
					? `Not enough truffles — you have ${r.have ?? 0}, it wants ${r.need ?? price}.`
					: r.reason === "already_owned"
					? "Already in your trunk."
					: r.reason === "heirloom_rested"
					? "The heirloom shelf rests a while after a trade — come back in a few weeks."
					: r.reason === "not_in_stock"
					? "That one's left the shelf — the stock turned over."
					: "The trade didn't go through — try again."
			);
		}
	};

	return (
		<Modal visible transparent animationType="slide" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
				<View style={[styles.sheet, { maxHeight: screenH * 0.85 }]}>
					<View style={styles.grabber} />
					<Text style={styles.kicker}>THE TRUFFLE EXCHANGE</Text>
					<Text style={styles.title}>Spend your golden truffles</Text>

					<View style={styles.pouchRow}>
						<View style={styles.pouchChip}>
							{HAT_IMAGES.golden_truffle ? (
								<Image source={HAT_IMAGES.golden_truffle} style={styles.pouchImg} resizeMode="contain" />
							) : null}
							<Text style={styles.pouchCount}>{truffles.balance}</Text>
						</View>
						{truffles.available && truffles.restockAt ? (
							<Text style={styles.restock}>{restockWhisper(truffles.restockAt)}</Text>
						) : null}
					</View>

					{!truffles.available ? (
						<View style={styles.closed}>
							<Text style={styles.closedTitle}>The stall is still being built.</Text>
							<Text style={styles.closedSub}>
								The Exchange opens with the season — dig truffles at every feeding so your
								pouch is heavy on opening day.
							</Text>
						</View>
					) : (
						<ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
							<View style={styles.shelf}>
								{truffles.items.map((item) => {
									const rarityColor = RARITY_COLORS[item.rarity as Rarity] ?? WHIMSY.muteSoft;
									const tier = RARITY_TO_TIER[item.rarity] ?? "muddy";
									const img = HAT_IMAGES[item.id];
									const isConfirming = confirming === item.id;
									const canAfford = truffles.balance >= item.price;
									return (
										<View
											key={item.id}
											style={[styles.card, { borderColor: rarityColor }, item.owned && styles.cardOwned]}
										>
											<Text style={[styles.tierTag, { color: rarityColor }]}>
												{EXCHANGE_TIER_LABEL[tier]}
											</Text>
											<View style={[styles.thumbWrap, { backgroundColor: rarityColor + "22" }]}>
												{img ? <Image source={img} style={styles.thumb} resizeMode="contain" /> : null}
											</View>
											<Text style={styles.name} numberOfLines={1}>
												{item.name}
											</Text>
											{item.owned ? (
												<View style={styles.ownedBadge}>
													<Icon name="check" size={12} color={WHIMSY.ink} strokeWidth={2.4} />
													<Text style={styles.ownedText}>yours</Text>
												</View>
											) : isConfirming ? (
												<Pressable
													disabled={busy}
													onPress={() => onRedeem(item.id, item.price)}
													style={[styles.buyBtn, styles.confirmBtn]}
												>
													<Text style={styles.buyText}>
														{busy ? "Trading…" : `Trade ${item.price}?`}
													</Text>
												</Pressable>
											) : (
												<Pressable
													onPress={() => {
														Haptics.selectionAsync().catch(() => {});
														setNote(null);
														setConfirming(item.id);
													}}
													style={[styles.buyBtn, !canAfford && styles.buyBtnOff]}
												>
													{HAT_IMAGES.golden_truffle ? (
														<Image
															source={HAT_IMAGES.golden_truffle}
															style={styles.priceImg}
															resizeMode="contain"
														/>
													) : null}
													<Text style={[styles.buyText, !canAfford && styles.buyTextOff]}>
														{item.price}
													</Text>
												</Pressable>
											)}
										</View>
									);
								})}
							</View>
						</ScrollView>
					)}

					{note ? <Text style={styles.note}>{note}</Text> : null}
					<Text style={styles.footnote}>Earned in the bog, never bought.</Text>

					<Pressable onPress={onClose} style={styles.doneBtn}>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	backdrop: { flex: 1, backgroundColor: "rgba(20,16,28,0.5)", justifyContent: "flex-end", padding: 14, paddingBottom: 28 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 22,
		padding: 18,
		paddingTop: 10,
		...SHADOW_SM,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: 12 },
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	title: { fontFamily: FONTS.whimsy, fontSize: 24, color: INK },

	pouchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 12 },
	pouchChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 5,
		...SHADOW_SM,
	},
	pouchImg: { width: 22, height: 22 },
	pouchCount: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
	restock: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },

	closed: {
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: INK,
		borderRadius: 14,
		padding: 16,
		marginBottom: 6,
		transform: [{ rotate: "-0.6deg" }],
	},
	closedTitle: { fontFamily: FONTS.whimsy, fontSize: 17, color: INK },
	closedSub: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute, marginTop: 4, lineHeight: 20 },

	shelf: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
	card: {
		width: "48%",
		borderWidth: 2,
		borderRadius: 14,
		backgroundColor: WHIMSY.cream,
		padding: 8,
		paddingBottom: 10,
		alignItems: "center",
	},
	cardOwned: { opacity: 0.75 },
	tierTag: { fontFamily: FONTS.bodyExtra, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", alignSelf: "flex-start" },
	thumbWrap: { width: "100%", aspectRatio: 1.35, alignItems: "center", justifyContent: "center", borderRadius: 8, marginTop: 4 },
	thumb: { width: "70%", height: "82%" },
	name: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: INK, marginTop: 6, textAlign: "center" },

	ownedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
	ownedText: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },

	buyBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginTop: 6,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: INK,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	buyBtnOff: { backgroundColor: WHIMSY.cream2, opacity: 0.7 },
	confirmBtn: { backgroundColor: WHIMSY.roseDeep },
	priceImg: { width: 16, height: 16 },
	buyText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	buyTextOff: { color: WHIMSY.mute },

	note: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.accent, textAlign: "center", marginTop: 10 },
	footnote: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.muteSoft, textAlign: "center", marginTop: 8 },

	doneBtn: {
		marginTop: 12,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		...SHADOW_SM,
	},
	doneText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
});
