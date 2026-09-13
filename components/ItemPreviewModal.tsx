import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Image, Animated } from "react-native";
import { PigStage, type EquippedItem } from "./ui/PigStage";
import {
	AdaptiveModalScaffold,
	Button,
	ConfirmDialog,
	Hand,
	PageTitle,
	SectionTitle,
	SnoutCoin,
	Sticker,
	T,
	Tag,
	glyphSource,
} from "./ui";
import { rpcAction } from "@/utils/rpc";
import { showPurchaseToast } from "./PurchaseToast";
import { HAT_IMAGES, HatRow } from "@/constants/hats";
import {
	ART_SIZE,
	BORDER,
	RADII,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useUnmanagedModalHold } from "./ui/PopupQueue";

// ── Drawing constants ───────────────────────────────────────────────────────
// The product shot's own geometry. Sizes of art and the clearance the close
// affordance needs — not spacing steps, so they are named here. (2026-09-11)
/** A single drifting tickle sprite. */
const PARTICLE = 56;
/** How far above the card's floor the burst starts. */
const PARTICLE_FLOOR = 36;
/** Half a sprite — the centring offset for an absolutely-placed particle. */
const PARTICLE_HALF = PARTICLE / 2;
/**
 * Top padding that clears the scaffold's 44pt close affordance, so the preview
 * card — and the pig's ears inside it — can never slide under the dismiss
 * target.
 */
const CLOSE_CLEARANCE = 58;
/** Taller than wide, so a tall item (a hat) has headroom above the pig. */
const PREVIEW_RATIO = 0.85;
/** The coin riding the spend CTAs' labels. */
const COIN_MARK = 16;
/** The fraction of an item's price that seeds a Trough. */
const TROUGH_SEED_FRAC = 0.1;

// Tickle-particle preview — loops the same burst the Barn would
// fire on a tap (per-particle dx / rise / scale / tilt / duration
// jitter) so the player sees the actual cosmetic, not a still
// image. Bursts every ~1100ms while the modal is mounted; clears
// its interval + in-flight animations on unmount.
//
// Under Reduce Motion the loop never starts: the sprite rests in a still ring
// with a line naming what it would do, per the decorative-loop rule. [D-11]
function TickleParticlePreview({ source }: { source: number | null }) {
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
	const { reduceMotion } = useMotionPolicy();
	// No PNG yet (e.g. particle_bubble) → the hand-drawn sparkle stands in, the
	// same placeholder the Closet uses. [D-19]
	const sprite = source ?? glyphSource("sparkle");

	useEffect(() => {
		if (reduceMotion) return;
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
	}, [reduceMotion]);

	// The rest pose: three sprites at rest, and a line that says what the
	// cosmetic does instead of showing it.
	if (reduceMotion) {
		return (
			<View style={particleStyles.rest}>
				<View style={particleStyles.restRow}>
					{[0, 1, 2].map((i) => (
						<Image
							key={i}
							source={sprite}
							style={particleStyles.restSprite}
							resizeMode="contain"
							accessible={false}
						/>
					))}
				</View>
				<Hand tone="secondary" align="center">
					Particles drift up on each tickle.
				</Hand>
			</View>
		);
	}

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
						source={sprite}
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
		bottom: PARTICLE_FLOOR,
		width: PARTICLE,
		height: PARTICLE,
		marginLeft: -PARTICLE_HALF,
	},
	rest: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.lg,
	},
	restRow: { flexDirection: "row", gap: SPACE.sm },
	restSprite: { width: PARTICLE, height: PARTICLE },
});

interface Props {
	item: HatRow | null;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	balance: number;
	busy?: boolean;
	buyable?: boolean;
	equippedHat?: EquippedItem | null;
	equippedBow?: EquippedItem | null;
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
	equippedHat = null,
	equippedBow = null,
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
	// Opening a Trough carries a 3-day opener cooldown — a mis-tap costs the
	// player three days — so the seed spend is a DECISION, not a one-tap.
	// [D-09] (2026-09-11)
	const [confirmTrough, setConfirmTrough] = useState(false);
	const [troughBusy, setTroughBusy] = useState(false);
	if (!item) return null;
	const rarity = item.rarity ?? "common";
	const badge = RARITY_BADGE[rarity] ?? RARITY_BADGE.common;
	// Sentence case: UPPERCASE is reserved for kicker-pill typography. [D-17]
	const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
	const itemSrc = HAT_IMAGES[item.id] ?? null;
	const seed = Math.ceil(item.cost * TROUGH_SEED_FRAC);
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

	// Route the previewed item into its exact PigStage slot. Keep the currently
	// worn Hat/Bow counterpart visible so a player can judge the combination
	// before equipping it.
	const previewSlot = { id: item.id, category: item.category ?? null, emoji: item.emoji ?? null };
	const stageEquipped = item.category === "hat" ? previewSlot : equippedHat;
	const stageEquippedBow = item.category === "bow" ? previewSlot : equippedBow;
	const stageEquippedGlasses = item.category === "glasses" ? previewSlot : null;
	const stageEquippedMask = item.category === "mask" ? previewSlot : null;
	const stageEquippedNeck = item.category === "scarf" || item.category === "necklace"
		? previewSlot
		: null;
	const stageEquippedAura = item.category === "aura" ? previewSlot : null;
	const stageEquippedHeld = item.category === "held" ? previewSlot : null;

	const openTrough = async () => {
		if (troughBusy) return;
		setTroughBusy(true);
		// The RPC says WHY it refused (3-day opener cooldown, seed too low,
		// can't afford). Discarding it made this CTA silently fail AND
		// silently charge on success (#7).
		const r = await rpcAction<{ drive_id?: string; balance?: number }>(
			"open_item_drive",
			{ target_item_id: item.id, seed_snouts: seed },
		);
		setTroughBusy(false);
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
	};

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
				<Sticker color="paper" radius={RADII.xxl} style={styles.sheet}>
					{/* Big preview. Two modes:
					    • Backgrounds → render the image filling the
					      preview card (no pig). The user will see it
					      fullscreen at runtime, so we want the preview
					      to match that "wallpaper" feel.
					    • Everything else → the pig stage with the item
					      overlaid on the right anatomy point, frozen at
					      rest (the 2026-07-16 product-shot ruling). */}
					<View
						style={[
							styles.previewCard,
							{ backgroundColor: RARITY_BG_SOLID[rarity] },
						]}
					>
						{isTickleParticle ? (
							<TickleParticlePreview source={itemSrc ?? null} />
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
									equippedBow={stageEquippedBow}
									equippedGlasses={stageEquippedGlasses}
									equippedMask={stageEquippedMask}
									equippedNeck={stageEquippedNeck}
									equippedAura={stageEquippedAura}
									equippedHeld={stageEquippedHeld}
								/>
							</View>
						)}
					</View>

					{/* Rarity tag — the rarity's own dark ink on its own light fill,
					    so "rare" still reads blue. The old saturated badge wrote
					    paper on a mid-tone and failed AA at all five. [D-02] */}
					<Tag
						label={rarityLabel}
						ink={badge.ink}
						accessibilityLabel={`${rarity} rarity`}
						style={[styles.rarityBadge, { backgroundColor: badge.bg }]}
					/>

					<PageTitle style={styles.itemName}>{item.name}</PageTitle>
					{item.description && (
						<Hand tone="secondary" style={styles.itemDesc}>
							{item.description}
						</Hand>
					)}

					{/* Price + CTA row */}
					<View style={styles.ctaRow}>
						{!owned && item.cost > 0 && (
							<View style={styles.priceWrap}>
								<SnoutCoin size={COIN_MARK} />
								<SectionTitle>{item.cost.toLocaleString()}</SectionTitle>
								<Hand tone="secondary">snouts</Hand>
							</View>
						)}
						{active ? (
							<Button
								size="md"
								variant="ghost"
								full
								onPress={onUnequip}
								accessibilityLabel={`Take off ${item.name}`}
								accessibilityHint="Removes this item from your pig"
							>
								Take off
							</Button>
						) : owned ? (
							<Button
								size="md"
								variant="primary"
								full
								onPress={onEquip}
								accessibilityLabel={`Wear ${item.name}`}
								accessibilityHint="Puts this item on your pig"
							>
								Wear
							</Button>
						) : item.cost <= 0 ? (
							// Season-pass exclusives + referral milestones carry
							// cost=0 in the catalog. They're earned, not bought —
							// surface that instead of showing "0 snouts" + a
							// misleading "Available in Today's Shop" lock.
							<Button
								size="md"
								variant="locked"
								full
								disabled
								accessibilityHint="Unlock this from the Season Pass or a referral milestone"
							>
								Earned, not sold
							</Button>
						) : !buyable ? (
							<Button
								size="md"
								variant="locked"
								full
								disabled
								accessibilityHint="This item isn't in today's shop"
							>
								Rotates in soon — not today's pick
							</Button>
						) : !canAfford ? (
							<Button
								size="md"
								variant="locked"
								full
								disabled
								accessibilityLabel={`Not enough snouts, ${item.cost.toLocaleString()} needed`}
								accessibilityHint={`Earn ${(item.cost - balance).toLocaleString()} more snouts to buy this`}
							>
								Not enough · need {item.cost - balance}
							</Button>
						) : (
							<Button
								size="md"
								variant={rarity === "legendary" ? "gold" : "primary"}
								full
								onPress={onBuy}
								disabled={busy}
								loading={busy}
								accessibilityLabel={`Buy ${item.name} for ${item.cost.toLocaleString()} snouts`}
								accessibilityHint={`Spends ${item.cost.toLocaleString()} snouts and adds this to your closet`}
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
							{/* A control that spends states its cost on its own face.
							    This one used to be `ghost` — the quietest fill in the
							    palette — with the price only in the caption. [D-09] */}
							<Button
								size="md"
								variant="lilac"
								full
								icon={<SnoutCoin size={COIN_MARK} />}
								onPress={() => setConfirmTrough(true)}
								disabled={troughBusy}
								loading={troughBusy}
								accessibilityLabel={`Open a Trough for ${seed.toLocaleString()} snouts`}
								accessibilityHint="Asks before spending; your Sounder chips in the rest"
							>
								Open a Trough · {seed.toLocaleString()}
							</Button>
							<T role="hand" tone="accent" align="center" style={styles.troughHint}>
								Start it for {seed.toLocaleString()} snouts — your Sounder
								chips in the rest.
							</T>
						</View>
					)}
				</Sticker>
			<ConfirmDialog
				open={confirmTrough}
				presentation="inline"
				title="Open a Trough for this item?"
				body={`Seeding it costs ${seed.toLocaleString()} snouts — you'll have ${Math.max(
					0,
					balance - seed,
				).toLocaleString()} left. You can only open one Trough every 3 days.`}
				confirmLabel={`Open · ${seed.toLocaleString()}`}
				confirmCoin
				confirmHint={`Spends ${seed.toLocaleString()} snouts and starts a 3-day Trough`}
				cancelLabel="Not now"
				cancelHint="Closes this without spending"
				busy={troughBusy}
				onCancel={() => setConfirmTrough(false)}
				onConfirm={() => {
					setConfirmTrough(false);
					void openTrough();
				}}
			/>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	troughCtaWrap: { marginTop: SPACE.md, alignSelf: "stretch" },
	troughHint: {
		marginTop: SPACE.sm,
	},
	modalContent: {
		flexGrow: 1,
		justifyContent: "center",
		padding: SPACE.sm,
	},
	sheet: {
		paddingHorizontal: SPACE.xl,
		paddingTop: CLOSE_CLEARANCE,
		paddingBottom: SPACE.xl,
	},
	previewCard: {
		width: "100%",
		aspectRatio: PREVIEW_RATIO,
		borderRadius: RADII.xl,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
		marginBottom: SPACE.card,
	},
	// Fixed-size inner stage. Card-coord overlays land correctly only
	// when the pig is at a known native size. Centered inside the
	// (sometimes larger) preview card. Items position relative to
	// THIS box, not the card.
	previewStage: {
		width: ART_SIZE.stage,
		height: ART_SIZE.stage,
		position: "relative",
	},
	fillImage: {
		width: "100%",
		height: "100%",
	},
	rarityBadge: {
		alignSelf: "flex-start",
		marginBottom: SPACE.sm,
	},
	itemName: {
		marginBottom: SPACE.xs,
	},
	itemDesc: {
		marginBottom: SPACE.card,
	},
	ctaRow: {
		flexDirection: "column",
		gap: SPACE.md,
	},
	priceWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
});
