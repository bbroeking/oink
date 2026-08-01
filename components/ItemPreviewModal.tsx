import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	Image,
	Animated,
} from "react-native";
import { Sticker } from "./ui/Sticker";
import { PigStage } from "./ui/PigStage";
import { SnoutCoin } from "./ui/SnoutCoin";
import { AdaptiveModalScaffold, Button } from "./ui";
import { rpcAction } from "@/utils/rpc";
import { showPurchaseToast } from "./PurchaseToast";
import { HAT_IMAGES, HatRow, RARITY_COLORS } from "@/constants/hats";
import { FONTS, RARITY_BG_SOLID, WHIMSY, RADII } from "@/constants/theme";
import { useUnmanagedModalHold } from "./ui/PopupQueue";

// Tickle-particle preview — loops the same burst the Barn would
// fire on a tap (per-particle dx / rise / scale / tilt / duration
// jitter) so the player sees the actual cosmetic, not a still
// image. Bursts every ~900ms while the modal is mounted; clears
// its interval + in-flight animations on unmount.
function TickleParticlePreview({
	source,
	glyph,
}: {
	source: number | null;
	glyph?: string;
}) {
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
				const animStyle = {
					opacity,
					transform: [
						{ translateX },
						{ translateY },
						{ rotate: `${f.rot}deg` },
						{ scale },
					],
				};
				// No PNG yet (e.g. particle_bubble) → fall back to the item's
				// emoji glyph so the burst still previews.
				return source != null ? (
					<Animated.Image
						key={f.id}
						source={source}
						resizeMode="contain"
						style={[particleStyles.particle, animStyle]}
					/>
				) : (
					<Animated.Text key={f.id} style={[particleStyles.glyph, animStyle]}>
						{glyph || "✦"}
					</Animated.Text>
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
	glyph: {
		position: "absolute",
		left: "50%",
		bottom: 36,
		width: 56,
		marginLeft: -28,
		fontSize: 38,
		lineHeight: 56,
		textAlign: "center",
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
	// Fired when the Trough CTA successfully spends the seed, BEFORE
	// onClose — lets the shop snap its balance chip immediately instead
	// of waiting for the next focus refetch ("delay when we spend
	// snouts"). `newBalance` comes from the RPC when the server is on
	// 20260639+; `spent` is the seed for the optimistic fallback.
	onTroughOpened?: (spent: number, newBalance?: number) => void;
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
	onTroughOpened,
}: Props) {
	// Unmanaged native Modal (direct-tap from the shop, outside the popup queue):
	// hold the queue while an item is previewed so a foreground poll can't present
	// a queued popup over it — the #50152 wedge (issue #4). Keyed on `!!item` (the
	// modal stays mounted with visible={false} when item is null).
	useUnmanagedModalHold(!!item);
	if (!item) return null;
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	const itemSrc = HAT_IMAGES[item.id] ?? null;
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

	// Route the previewed item into the appropriate equip slot for
	// PigStage. Auras go behind the pig; held items anchor to the
	// right hand; everything else (hats, glasses, masks, scarves)
	// is the main slot. PigStage handles z-order + HAT_REL anchor
	// math from there — same code path the Barn uses, so re-tuning
	// via the /item-anchor tool flows here automatically.
	const previewSlot = { id: item.id, category: item.category ?? null, emoji: item.emoji ?? null };
	const stageEquipped = item.category === "aura" || item.category === "held"
		? null
		: previewSlot;
	const stageEquippedAura = item.category === "aura" ? previewSlot : null;
	const stageEquippedHeld = item.category === "held" ? previewSlot : null;

	return (
		<AdaptiveModalScaffold
			visible={!!item}
			onRequestClose={onClose}
			bare
			showCloseButton
			closeLabel="Close item preview"
			maxWidth={430}
			contentContainerStyle={styles.modalContent}
			testID="item-preview-modal"
		>
				<Sticker color="paper" rotate={-0.5} radius={RADII.xxl} style={styles.sheet}>
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
							{ backgroundColor: RARITY_BG_SOLID[rarity] },
						]}
					>
						{isTickleParticle ? (
							// No `glyph` override — when there's no PNG art the
							// preview falls back to the print glyph ✦, never a
							// raw item emoji.
							<TickleParticlePreview
								source={itemSrc ?? null}
							/>
						) : isBackgroundItem && itemSrc ? (
							<Image
								source={itemSrc}
								style={styles.fillImage}
								resizeMode="cover"
							/>
						) : (
							<View style={styles.previewStage}>
								<PigStage
									pigAnimation="idle"
									pigFrozen
									equipped={stageEquipped}
									equippedAura={stageEquippedAura}
									equippedHeld={stageEquippedHeld}
								/>
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
						{!owned && item.cost > 0 && (
							<View style={styles.priceWrap}>
								<SnoutCoin size={18} />
								<Text style={styles.price}>
									{item.cost.toLocaleString()}
								</Text>
								<Text style={styles.priceLabel}>snouts</Text>
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
						) : item.cost <= 0 ? (
							// Season-pass exclusives + referral milestones carry
							// cost=0 in the catalog. They're earned, not bought —
							// surface that instead of showing "0 snouts" + a
							// misleading "Available in Today's Shop" lock.
							<Button size="md" variant="locked" full disabled>
								Earned, not sold
							</Button>
						) : !buyable ? (
							<Button size="md" variant="locked" full disabled>
								Rotates in soon — not today's pick
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
					{/* Troughs only open for items currently IN the shop
					    (today's rotation or an always-stocked flag) — gated
					    here AND server-side (20260639's `not_in_shop`), so
					    out-of-rotation items just show the locked Buy row. */}
					{!owned && item.cost > 0 && buyable && (
						<View style={styles.troughCtaWrap}>
							<Button
								size="md"
								variant="ghost"
								full
								onPress={async () => {
									// The RPC says WHY it refused (3-day opener cooldown,
									// seed too low, can't afford). Discarding it made this
									// CTA silently fail AND silently charge on success (#7).
									const seed = Math.ceil(item.cost * 0.1);
									const r = await rpcAction<{
										drive_id?: string;
										balance?: number;
									}>("open_item_drive", {
										target_item_id: item.id,
										seed_snouts: seed,
									});
									if (r.ok) {
										showPurchaseToast({
											type: "success",
											title: "Trough opened!",
											text: "Your Sounder can chip in now — find it in the Shop.",
											cost: seed,
										});
										onTroughOpened?.(seed, r.balance);
										onClose();
										return;
									}
									const msg =
										r.reason === "opener_cooldown"
											? "You opened a Trough recently — one per 3 days."
											: r.reason === "insufficient"
												? "Not enough snouts for the seed."
												: r.reason === "seed_too_low"
													? "Seed too small for this item."
													: r.reason === "not_in_shop"
														? "Troughs only open for items in today's shop."
														: r.reason === "not_eligible"
															? "This item can't be Trough-funded."
															: "Couldn't open the Trough. Try again.";
									showPurchaseToast({ type: "fail", title: "No Trough", text: msg });
								}}
							>
								Or open a Trough — friends chip in
							</Button>
							<Text style={styles.troughHint}>
								Start it for {Math.ceil(item.cost * 0.1).toLocaleString()} snouts
								— your Sounder chips in the rest.
							</Text>
						</View>
					)}
				</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	troughCtaWrap: { marginTop: 12, alignSelf: "stretch" },
	troughHint: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 6,
	},
	modalContent: {
		flexGrow: 1,
		justifyContent: "center",
		padding: 6,
	},
	sheet: {
		paddingHorizontal: 22,
		// Top padding clears the scaffold's 44pt close affordance so the
		// preview card — and the pig's ears inside it — can never
		// slide under the dismiss target.
		paddingTop: 58,
		paddingBottom: 24,
	},
	previewCard: {
		width: "100%",
		// Taller than wide + pig anchored to the bottom, so tall items (hats)
		// have headroom above and don't clip at the card's top edge.
		aspectRatio: 0.85,
		borderRadius: RADII.xl,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
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
		fontSize: 11,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.paper,
		letterSpacing: 1.2,
	},
	itemName: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		marginBottom: 4,
	},
	itemDesc: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
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
