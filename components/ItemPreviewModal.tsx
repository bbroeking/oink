import React, { useEffect, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	Image,
	ImageBackground,
	Animated,
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

// Tickle-particle preview — loops the same burst the Barn would
// fire on a tap (per-particle dx / rise / scale / tilt / duration
// jitter) so the player sees the actual cosmetic, not a still
// image. Bursts every ~900ms while the modal is mounted; clears
// its interval + in-flight animations on unmount.
function TickleParticlePreview({ source }: { source: number }) {
	type Float = {
		id: number;
		dx: number;
		rise: number;
		rot: number;
		scaleMax: number;
		duration: number;
		anim: Animated.Value;
	};
	const [floats, setFloats] = useState<Float[]>([]);
	const nextId = useRef(0);

	useEffect(() => {
		let cancelled = false;
		const burst = () => {
			if (cancelled) return;
			const n = 6 + Math.floor(Math.random() * 3); // 6–8 per cycle
			for (let i = 0; i < n; i++) {
				const stagger = i === 0 ? 0 : Math.floor(Math.random() * 140);
				setTimeout(() => {
					if (cancelled) return;
					const id = nextId.current++;
					const dx = Math.random() * 180 - 90;
					const rise = -(150 + Math.random() * 70);
					const rot = Math.random() * 50 - 25;
					const scaleMax = 0.9 + Math.random() * 0.5;
					const duration = 1200 + Math.floor(Math.random() * 400);
					const anim = new Animated.Value(0);
					setFloats((f) => [
						...f,
						{ id, dx, rise, rot, scaleMax, duration, anim },
					]);
					Animated.timing(anim, {
						toValue: 1,
						duration,
						useNativeDriver: true,
					}).start(() => {
						setFloats((f) => f.filter((x) => x.id !== id));
					});
				}, stagger);
			}
		};
		burst();
		const t = setInterval(burst, 1100);
		return () => {
			cancelled = true;
			clearInterval(t);
		};
	}, []);

	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{floats.map((f) => {
				const translateY = f.anim.interpolate({
					inputRange: [0, 0.12, 1],
					outputRange: [0, -10, f.rise],
				});
				const translateX = f.anim.interpolate({
					inputRange: [0, 1],
					outputRange: [0, f.dx],
				});
				const opacity = f.anim.interpolate({
					inputRange: [0, 0.15, 0.85, 1],
					outputRange: [0, 1, 1, 0],
				});
				const scale = f.anim.interpolate({
					inputRange: [0, 0.15, 1],
					outputRange: [0.55, f.scaleMax, f.scaleMax * 0.9],
				});
				return (
					<Animated.Image
						key={f.id}
						source={source}
						resizeMode="contain"
						style={[
							particleStyles.particle,
							{
								opacity,
								transform: [
									{ translateX },
									{ translateY },
									{ rotate: `${f.rot}deg` },
									{ scale },
								],
							},
						]}
					/>
				);
			})}
		</View>
	);
}

const particleStyles = StyleSheet.create({
	particle: {
		position: "absolute",
		left: "50%",
		bottom: 36,
		width: 56,
		height: 56,
		marginLeft: -28,
	},
});

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
	// Tickle particles preview as JUST the looping burst animation —
	// no pig, no static overlay. They're animation-only cosmetics
	// (drift up + fade on tickle), so a still pig with a frozen
	// particle on top misrepresents what you'd actually see.
	const isTickleParticle = item.category === "tickle_particle";

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
						{isTickleParticle && itemSrc ? (
							<TickleParticlePreview source={itemSrc} />
						) : isBackgroundItem && itemSrc ? (
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
