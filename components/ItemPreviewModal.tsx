import React from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	Image,
	ImageBackground,
} from "react-native";
import { Sticker } from "./ui/Sticker";
import { SpritePig } from "./ui/SpritePig";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Button } from "./ui";
import {
	HAT_IMAGES,
	HAT_OVERLAYS,
	CATEGORY_OVERLAYS,
	DEFAULT_HAT_OVERLAY,
	Z_BEHIND_PIG,
	HatRow,
	RARITY_COLORS,
} from "@/constants/hats";
import { ITEM_PREBAKED, isPrebaked } from "@/constants/prebaked";
import { FONTS, MODAL_BACKDROP_BG, WHIMSY, STICKER_SHADOW } from "@/constants/theme";

const RARITY_GRADIENT: Record<string, string> = {
	common: WHIMSY.cream,
	uncommon: WHIMSY.sage,
	rare: WHIMSY.sky,
	epic: WHIMSY.lilac,
	legendary: WHIMSY.sun,
};

interface Props {
	item: HatRow | null;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	balance: number;
	busy?: boolean;
	buyable?: boolean;
	onClose: () => void;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
}

export function ItemPreviewModal({
	item,
	owned,
	active,
	canAfford,
	balance,
	busy,
	buyable = true,
	onClose,
	onBuy,
	onEquip,
	onUnequip,
}: Props) {
	if (!item) return null;
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	const itemSrc = HAT_IMAGES[item.id] ?? null;
	// Same precedence as SwipeElement → matches what you see in the
	// real Barn render. Earlier this modal used a different/looser
	// chain that produced wrong positions for items with no manual
	// entry in HAT_OVERLAYS.
	const overlay =
		HAT_OVERLAYS[item.id] ??
		(item.category && CATEGORY_OVERLAYS[item.category]) ??
		DEFAULT_HAT_OVERLAY;
	const isBehind = item.category && Z_BEHIND_PIG[item.category];
	const prebaked = isPrebaked(item.id) ? ITEM_PREBAKED[item.id] : null;
	// Backgrounds preview as the FULL image (no pig in the card). They
	// fill the screen at runtime, so showing a scaled pig over them
	// in the preview misrepresents what the player will see when
	// equipped.
	const isBackgroundItem = item.category === "background";

	return (
		<Modal visible={!!item} animationType="fade" transparent onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<Sticker color="paper" rotate={-0.5} radius={20} style={styles.sheet}>
					<Pressable
						onPress={onClose}
						style={styles.closeBtn}
						hitSlop={12}
					>
						<Text style={styles.closeText}>✕</Text>
					</Pressable>

					{/* Big preview. Two modes:
					    • Backgrounds → render the image filling the
					      preview card (no pig). The user will see it
					      fullscreen at runtime, so we want the preview
					      to match that "wallpaper" feel.
					    • Everything else → the 300×300 pig stage with
					      the item overlaid on the right anatomy point. */}
					<View
						style={[
							styles.previewCard,
							{ backgroundColor: RARITY_GRADIENT[rarity] },
						]}
					>
						{isBackgroundItem && itemSrc ? (
							<Image
								source={itemSrc}
								style={styles.fillImage}
								resizeMode="cover"
							/>
						) : (
							<View style={styles.previewStage}>
								{/* Behind pig: auras, capes (NOT backgrounds — those
								    use the no-pig branch above). */}
								{isBehind && itemSrc && (
									<View style={[styles.overlayBox, overlay, { zIndex: 1 }]}>
										<Image
											source={itemSrc}
											style={styles.fillImage}
											resizeMode="contain"
										/>
									</View>
								)}
								<View style={[styles.previewPig, { zIndex: 2 }]}>
									<SpritePig
										animation="idle"
										size={300}
										customFrames={prebaked ?? undefined}
									/>
								</View>
								{/* In front of pig */}
								{!isBehind && itemSrc && !prebaked && (
									<View style={[styles.overlayBox, overlay, { zIndex: 10 }]}>
										<Image
											source={itemSrc}
											style={styles.fillImage}
											resizeMode="contain"
										/>
									</View>
								)}
								{!itemSrc && item.emoji && (
									<View style={[styles.overlayBox, overlay, { zIndex: 10 }]}>
										<Text style={styles.emojiPlaceholder}>{item.emoji}</Text>
									</View>
								)}
							</View>
						)}
					</View>

					{/* Rarity tag */}
					<View
						style={[
							styles.rarityBadge,
							{ backgroundColor: rarityColor },
						]}
					>
						<Text style={styles.rarityText}>{rarity.toUpperCase()}</Text>
					</View>

					<Text style={styles.itemName}>{item.name}</Text>
					{item.description && (
						<Text style={styles.itemDesc}>{item.description}</Text>
					)}

					{/* Price + CTA row */}
					<View style={styles.ctaRow}>
						{!owned && (
							<View style={styles.priceWrap}>
								<SnoutCoin size={18} />
								<Text style={styles.price}>
									{item.cost.toLocaleString()}
								</Text>
								<Text style={styles.priceLabel}>tickles</Text>
							</View>
						)}
						{active ? (
							<Button size="md" variant="ghost" full onPress={onUnequip}>
								Take off
							</Button>
						) : owned ? (
							<Button size="md" variant="primary" full onPress={onEquip}>
								Wear
							</Button>
						) : !buyable ? (
							<Button size="md" variant="locked" full disabled>
								Available in Today's Shop
							</Button>
						) : !canAfford ? (
							<Button size="md" variant="locked" full disabled>
								Not enough · need {item.cost - balance}
							</Button>
						) : (
							<Button
								size="md"
								variant={rarity === "legendary" ? "gold" : "primary"}
								full
								onPress={onBuy}
								disabled={busy}
							>
								Buy now
							</Button>
						)}
					</View>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		paddingHorizontal: 18,
	},
	sheet: {
		paddingHorizontal: 22,
		paddingTop: 22,
		paddingBottom: 24,
	},
	closeBtn: {
		position: "absolute",
		// Push the X a bit further from the corner so it doesn't
		// crowd the sticker border or rarity content beside it.
		top: 12,
		right: 16,
		width: 36,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 30,
	},
	closeText: {
		fontSize: 24,
		color: WHIMSY.ink,
	},
	previewCard: {
		width: "100%",
		aspectRatio: 1,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 14,
	},
	// Fixed-size inner stage. Card-coord overlays land correctly only
	// when the pig is at a known native size. Centered inside the
	// (sometimes larger) preview card. Items position relative to
	// THIS box, not the card.
	previewStage: {
		width: 300,
		height: 300,
		position: "relative",
	},
	previewPig: {
		position: "absolute",
		left: 0,
		top: 0,
		width: 300,
		height: 300,
	},
	overlayBox: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
	},
	fillImage: {
		width: "100%",
		height: "100%",
	},
	emojiPlaceholder: {
		fontSize: 80,
	},
	rarityBadge: {
		alignSelf: "flex-start",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		marginBottom: 8,
	},
	rarityText: {
		fontSize: 10,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.paper,
		letterSpacing: 1.2,
	},
	itemName: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		lineHeight: 28,
		marginBottom: 4,
	},
	itemDesc: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		lineHeight: 19,
		marginBottom: 14,
	},
	ctaRow: {
		flexDirection: "column",
		gap: 10,
	},
	priceWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	price: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	priceLabel: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		marginLeft: 2,
	},
});
