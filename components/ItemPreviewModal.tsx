import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Image, Animated, type LayoutChangeEvent } from "react-native";
import { PigStage, resolveSlot, type EquippedItem } from "./ui/PigStage";
import {
	AdaptiveModalScaffold,
	Button,
	ConfirmDialog,
	DialogCloseRow,
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
import { HAT_IMAGES, HatRow, PIG_CANVAS } from "@/constants/hats";
import {
	BORDER,
	RADII,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";
import { fitStage, type CanvasBox } from "@/utils/previewFit";
import {
	COSTUME_PIG_ID,
	costumeFitFor,
	costumeLayout,
	isCostumeCategory,
	pigCanWearCostume,
} from "@/utils/costumeFit";
import { COSTUME_FITS_ROSIE_LINE, costumeCoverLine } from "@/utils/costumeCopy";
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
	// Whether a Trough can be OPENED for this item. Troughs only open for
	// items in today's drop (open_item_drive refuses `not_in_shop`), while
	// `buyable` also covers the counter (a crewmate's buy from today) — so the
	// two gates split (2026-09-16). Defaults to `buyable` for older callers.
	troughable?: boolean;
	// Members-only item and the caller is not a Slop Club member. The card
	// already wears this lock; the sheet used to fall through to the balance
	// branch ("Not enough") — checked before it now (2026-09-16).
	locked?: boolean;
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
	// The Pop-up Stall (2026-10-29): how long the piece stays, as a lilac tag
	// beside its rarity ("leaving in 6 days"). Omitted everywhere else.
	windowTag?: string | null;
	// Full costumes (Halloween 2026): the viewer's worn columns, so the cover
	// line names only what would wait underneath, and the viewer's active pig
	// (v1 costumes fit Rosie only). Omitted, the line names nothing.
	wornActiveIds?: Readonly<Record<string, string | null>>;
	viewerPigId?: string | null;
	// The stall's buy asks first: Buy now opens this ConfirmDialog (inline, so
	// no second native modal stacks on the sheet) and only its confirm calls
	// onBuy. Omitted, Buy now buys in one tap as it always has.
	buyConfirm?: {
		kicker?: string;
		title: string;
		body: string;
		confirmLabel: string;
	} | null;
}


// The costume's two layers as preview boxes (floor-relative, like the item
// overlays), so the product shot fits the hood instead of cutting it.
function costumeCanvasBoxes(fit: NonNullable<ReturnType<typeof costumeFitFor>>): CanvasBox[] {
	const { hood, romper } = costumeLayout(fit, "idle_1", PIG_CANVAS);
	return [hood, romper].map((box) => ({
		left: box.left,
		bottom: PIG_CANVAS - (box.top + box.height),
		width: box.width,
		height: box.height,
	}));
}

export function ItemPreviewModal({
	item,
	owned,
	active,
	canAfford,
	balance,
	busy,
	buyable = true,
	troughable = buyable,
	locked = false,
	equippedHat = null,
	equippedBow = null,
	onClose,
	onBuy,
	onEquip,
	onUnequip,
	onTroughOpened,
	windowTag = null,
	buyConfirm = null,
	wornActiveIds,
	viewerPigId,
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
	// Keyed by the piece it asks about, so a different piece (or the sheet
	// closing) never inherits an open confirm.
	const [confirmBuyFor, setConfirmBuyFor] = useState<string | null>(null);
	const confirmBuy = !!item && confirmBuyFor === item.id;
	const [troughBusy, setTroughBusy] = useState(false);
	// The frame's inner size, measured: the stage is fitted to it (below)
	// rather than drawn at 1:1 and cut wherever it overhangs.
	const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
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
	// A full costume is the whole outfit: it previews alone, on the pig its art
	// is fitted to (v1: Rosie), whatever pig the viewer keeps.
	const stageCostume = isCostumeCategory(item.category) ? costumeFitFor(COSTUME_PIG_ID, item.id) : null;
	const stageEquippedCostume = stageCostume ? previewSlot : null;

	// The product shot is fitted, never cut (polish pass, 2026-10-04): the
	// Wizard Hat's tip ran ~62pt past the top of a 300pt stage drawn at 1:1 in
	// a frame with ~60pt of headroom, and on a 375pt phone the stage was wider
	// than the frame. Every worn item's box comes from the renderer's own math
	// (`resolveSlot`, frame 0, the frozen rest pose drawn below), and the stage
	// plus whatever overhangs it is scaled into the frame, never up.
	const stageBoxes: CanvasBox[] = [
		stageEquipped,
		stageEquippedBow,
		stageEquippedGlasses,
		stageEquippedMask,
		stageEquippedNeck,
		stageEquippedAura,
		stageEquippedHeld,
	].flatMap((slot) => {
		const overlay = resolveSlot(slot, "idle", 0)?.overlay;
		return overlay ? [overlay] : [];
	}).concat(stageCostume ? costumeCanvasBoxes(stageCostume) : []);
	const fit = frame
		? fitStage(stageBoxes, PIG_CANVAS, frame.w, frame.h, SPACE.sm)
		: null;
	const onFrameLayout = (e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		// The frame's ink border is inside its box; the stage fits inside that.
		const w = width - BORDER.ink * 2;
		const h = height - BORDER.ink * 2;
		if (!frame || frame.w !== w || frame.h !== h) setFrame({ w, h });
	};

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
				text: "Your Sounder can chip in now. Find it in the Shop.",
				cost: seed,
			});
			onTroughOpened?.(seed, r.balance);
			onClose();
			return;
		}
		const msg =
			r.reason === "opener_cooldown"
				? "You opened a Trough recently, one per 3 days."
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
			maxWidth={430}
			contentContainerStyle={styles.modalContent}
			testID="item-preview-modal"
		>
				<Sticker color="paper" radius={RADII.xxl} style={styles.sheet}>
					{/* The ✕ lives on the card it closes. The scaffold's own rail
					    sat in the bare frame ABOVE the card, so the ✕ floated off
					    its top-right corner while the card kept 58pt of empty
					    paper where it was meant to be (063, polish pass
					    2026-10-04). In layout, like every dialog's rail, so a
					    long name can never slide under it. */}
					<DialogCloseRow onPress={onClose} label="Close" style={styles.closeRow} />
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
						onLayout={onFrameLayout}
					>
						{isTickleParticle ? (
							<TickleParticlePreview source={itemSrc ?? null} />
						) : isBackgroundItem && itemSrc ? (
							<Image
								source={itemSrc}
								style={styles.fillImage}
								resizeMode="cover"
							/>
						) : fit ? (
							// The fitted box stands on the frame's floor; the
							// 300pt canvas inside it is scaled about its centre.
							<View style={{ width: fit.width, height: fit.height }}>
								<View
									style={[
										styles.previewCanvas,
										{
											left: fit.canvasLeft,
											top: fit.canvasTop,
											transform: [{ scale: fit.scale }],
										},
									]}
								>
									<PigStage
										pigAnimation="idle"
										pigFrozen
										{...(stageCostume ? { pigId: COSTUME_PIG_ID } : null)}
										equippedCostume={stageEquippedCostume}
										equipped={stageEquipped}
										equippedBow={stageEquippedBow}
										equippedGlasses={stageEquippedGlasses}
										equippedMask={stageEquippedMask}
										equippedNeck={stageEquippedNeck}
										equippedAura={stageEquippedAura}
										equippedHeld={stageEquippedHeld}
									/>
								</View>
							</View>
						) : null}
					</View>

					{/* Rarity tag — the rarity's own dark ink on its own light fill,
					    so "rare" still reads blue. The old saturated badge wrote
					    paper on a mid-tone and failed AA at all five. [D-02] */}
					<View style={styles.tagRow}>
						<Tag
							label={rarityLabel}
							ink={badge.ink}
							accessibilityLabel={`${rarity} rarity`}
							style={{ backgroundColor: badge.bg }}
						/>
						{stageCostume ? <Tag tone="lilac" label="full costume" /> : null}
						{windowTag ? <Tag tone="lilac" label={windowTag} /> : null}
					</View>

					<PageTitle style={styles.itemName}>{item.name}</PageTitle>
					{item.description && (
						<Hand tone="secondary" style={styles.itemDesc}>
							{item.description}
						</Hand>
					)}
					{stageCostume ? (
						<Hand tone="secondary" style={styles.itemDesc}>
							{pigCanWearCostume(viewerPigId)
								? costumeCoverLine(wornActiveIds ?? {})
								: COSTUME_FITS_ROSIE_LINE}
						</Hand>
					) : null}

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
								{stageCostume ? "Take it off" : "Take off"}
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
						) : item.cost <= 0 || item.pass_exclusive ? (
							// Season-pass exclusives + referral milestones carry
							// cost=0 in the catalog. They're earned, not bought —
							// surface that instead of showing "0 snouts" + a
							// misleading "Available in Today's Shop" lock. The
							// premium-track members' cosmetics keep a catalog price
							// but are pass_exclusive (20260727): same answer.
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
								Rotates in soon · not today's pick
							</Button>
						) : locked ? (
							<Button
								size="md"
								variant="locked"
								full
								disabled
								accessibilityHint="Join the Slop Club to buy members' pieces"
							>
								Slop Club members only
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
								Not enough · need {(item.cost - balance).toLocaleString()}
							</Button>
						) : (
							<Button
								size="md"
								variant={rarity === "legendary" ? "gold" : "primary"}
								full
								onPress={buyConfirm ? () => setConfirmBuyFor(item.id) : onBuy}
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
					{!owned && item.cost > 0 && troughable && (
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
								Start it for {seed.toLocaleString()} snouts. Your Sounder
								chips in the rest.
							</T>
						</View>
					)}
				</Sticker>
			{buyConfirm ? (
				<ConfirmDialog
					open={confirmBuy}
					presentation="inline"
					kicker={buyConfirm.kicker}
					title={buyConfirm.title}
					body={buyConfirm.body}
					confirmLabel={buyConfirm.confirmLabel}
					confirmCoin
					confirmHint={`Spends ${item.cost.toLocaleString()} snouts and adds this to your closet`}
					cancelLabel="Not now"
					cancelHint="Closes this without spending"
					busy={busy}
					onCancel={() => setConfirmBuyFor(null)}
					onConfirm={() => {
						setConfirmBuyFor(null);
						onBuy();
					}}
				/>
			) : null}
			<ConfirmDialog
				open={confirmTrough}
				presentation="inline"
				title="Open a Trough for this item?"
				body={`Seeding it costs ${seed.toLocaleString()} snouts. You'll have ${Math.max(
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
		paddingTop: SPACE.md,
		paddingBottom: SPACE.xl,
	},
	// The rail reaches into the card's right pad so the ✕ sits SPACE.md off
	// the card's corner, level with the pad above it.
	closeRow: {
		alignSelf: "stretch",
		width: "auto",
		minHeight: TAP_MIN,
		marginRight: -SPACE.md,
		paddingTop: 0,
		paddingRight: 0,
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
	// The stage at its native canvas size — card-coord overlays land
	// correctly only when the pig is at a known size — placed and scaled
	// inline by the fit.
	previewCanvas: {
		position: "absolute",
		width: PIG_CANVAS,
		height: PIG_CANVAS,
	},
	fillImage: {
		width: "100%",
		height: "100%",
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: SPACE.sm,
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
