// The shelves (Storefront build 2, 2026-09-16). Today's drop sits three to a
// wooden plank on rarity coasters; the card grammar's states carry over whole —
// the rarity dot, the sage owned check, the gold lock, the price as the
// action's face — and a tap opens the same preview sheet a grid card opens.
// The members' shelf is the same shelf under the Slop Club sign, on the band
// tint. Everything here is a token; the painted plank wall is build 3.
import { useRef, type ReactNode } from "react";
import {
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { HatRow } from "@/constants/hats";
import { cosmeticAccessibility } from "@/utils/cosmetics";
import { cardBadge, cardTag, cardTagFace } from "@/utils/shopShelves";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	RARITY_BG_SOLID,
	RARITY_STRIPE,
	SHADOW_SM,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
	WOOD,
} from "@/constants/theme";
import { Glyph } from "../ui/Glyph";
import { Icon } from "../ui/Icon";
import { Sticker } from "../ui/Sticker";
import { Tag } from "../ui/Chip";
import { T } from "../ui/Text";
import { HatThumb } from "./HatThumb";

// ── Drawing constants ───────────────────────────────────────────────────────
/** A plank's thickness, seen edge-on. */
const PLANK_H = 14;
/** The rarity coaster an item stands on, and the art it holds. */
const COASTER = 66;
const COASTER_ART = 50;
/** The rarity dot on the coaster's foot and the round badge on its shoulder. */
const RARITY_DOT = 14;
const BADGE = 26;
const BADGE_MARK = 14;
/** The crown on the Slop Club sign. */
const SIGN_MARK = 12;
/** How far the price tag climbs onto its coaster, and the plank under the tags. */
const TAG_CLIMB = -SPACE.sm;
const PLANK_TUCK = -SPACE.xs;

/** A wooden plank — the shelf itself, and the counter's lip. */
export function Plank({ style }: { style?: StyleProp<ViewStyle> }) {
	return (
		<LinearGradient
			colors={[WOOD.top, WOOD.bottom]}
			style={[styles.plank, style]}
			pointerEvents="none"
		/>
	);
}

export function ShelfItem({
	item,
	owned,
	active,
	canAfford,
	inDrop = true,
	locked,
	index,
	onPress,
	onLongPress,
	onCenter,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	// On today's shelf — the only day it can be bought. A coaster IS today's
	// shelf, so it defaults true; the catalog tile below the store says no.
	inDrop?: boolean;
	// Members-only item + caller isn't a Slop Club member: the lock rides the
	// coaster and the price wears the muted fill.
	locked?: boolean;
	// Position on the shelf — drives the price tag's alternating lean.
	index: number;
	// A tap on an OWNED card wears / takes off the item right on the shelf
	// (utils/shopShelves cardTapAction); an unowned card opens the sheet.
	onPress: () => void;
	// The sheet for an owned card — see it on the pig before deciding.
	onLongPress?: () => void;
	// Reports the coaster's window-space centre (the buy celebration anchor).
	onCenter?: (x: number, y: number) => void;
}) {
	const rarity = item.rarity ?? "common";
	const ref = useRef<View>(null);
	const a11y = cosmeticAccessibility(
		{ name: item.name, rarity, cost: item.cost },
		{ owned, active, locked, canAfford, action: owned ? "equip" : "preview" },
	);
	const lean = TILT.row[index % TILT.row.length];
	// One grammar for every card in the store (utils/shopShelves).
	const state = { owned, active, inDrop, canAfford, locked: !!locked };
	const face = cardTagFace(cardTag(item, state));
	const badge = cardBadge(state);
	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			accessibilityRole="button"
			accessibilityLabel={a11y.accessibilityLabel}
			accessibilityHint={a11y.accessibilityHint}
			accessibilityState={a11y.accessibilityState}
			style={({ pressed }) => [styles.slot, pressed && PRESSED_FLAT]}
		>
			<View
				ref={ref}
				onLayout={() => {
					ref.current?.measureInWindow?.((x, y, w, h) =>
						onCenter?.(x + w / 2, y + h / 2),
					);
				}}
				style={styles.coasterWrap}
			>
				<View
					style={[
						styles.coaster,
						{ backgroundColor: RARITY_BG_SOLID[rarity] },
					]}
				>
					<HatThumb item={item} size={COASTER_ART} />
				</View>
				<View
					pointerEvents="none"
					style={[styles.rdot, { backgroundColor: RARITY_STRIPE[rarity] }]}
				/>
				{badge === "check" ? (
					<View pointerEvents="none" style={[styles.badge, styles.ownedBadge]}>
						<Icon
							name="check"
							size={BADGE_MARK}
							color={UI_COLORS.textPrimary}
							strokeWidth={2.6}
						/>
					</View>
				) : badge === "lock" ? (
					<View pointerEvents="none" style={[styles.badge, styles.lockBadge]}>
						<Glyph name="lock" size={BADGE_MARK} />
					</View>
				) : null}
			</View>
			<View style={[styles.tagWrap, { transform: [{ rotate: `${lean}deg` }] }]}>
				{/* The tag IS the action's face — "Wear", "Wearing", or the price,
				    sun when you can pay it today. One function decides it for the
				    coaster, the fallback card and the closet tile alike. */}
				<Tag
					tone={face.tone}
					icon={face.icon}
					coin={face.coin}
					label={face.label}
					style={styles.tag}
				/>
			</View>
		</Pressable>
	);
}

/** One plank with up to three items standing on it. */
export function Shelf({ children }: { children: ReactNode }) {
	return (
		<View style={styles.shelf}>
			<View style={styles.row}>{children}</View>
			<Plank style={styles.shelfPlank} />
		</View>
	);
}

/**
 * The members' shelf: the same plank on the Slop Club band, with the sign
 * pinned to its corner. The sign is a door to the Pen, where joining lives.
 */
export function SlopClubShelf({
	children,
	onPressSign,
}: {
	children: ReactNode;
	onPressSign: () => void;
}) {
	return (
		<View style={styles.band}>
			<Sticker
				color={WHIMSY.slopGold}
				radius={RADII.pill}
				shadow="sm"
				rotate={-TILT.reveal}
				onPress={onPressSign}
				hitSlop={SPACE.sm}
				accessibilityRole="button"
				accessibilityLabel="Slop Club shelf"
				accessibilityHint="Opens the Pen, where you can join the Slop Club"
				style={styles.sign}
			>
				<Glyph name="crown" size={SIGN_MARK} />
				<T role="kickerPillSm">Slop Club</T>
			</Sticker>
			<Shelf>{children}</Shelf>
		</View>
	);
}

const styles = StyleSheet.create({
	plank: {
		height: PLANK_H,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.hair,
		...SHADOW_SM,
	},
	shelf: { position: "relative" },
	row: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-around",
		paddingHorizontal: SPACE.xs,
		zIndex: 1,
	},
	shelfPlank: { marginTop: PLANK_TUCK },
	slot: {
		flex: 1,
		minWidth: 0,
		alignItems: "center",
	},
	coasterWrap: { position: "relative" },
	coaster: {
		width: COASTER,
		height: COASTER,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	rdot: {
		position: "absolute",
		left: 0,
		bottom: SPACE.xs,
		width: RARITY_DOT,
		height: RARITY_DOT,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		...SHADOW_SM,
	},
	badge: {
		position: "absolute",
		top: -SPACE.xxs,
		right: -SPACE.xxs,
		width: BADGE,
		height: BADGE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
		...SHADOW_SM,
	},
	ownedBadge: { backgroundColor: WHIMSY.sage },
	lockBadge: { backgroundColor: WHIMSY.slopGold },
	// The tag climbs onto the coaster's foot so the two read as one object.
	tagWrap: { marginTop: TAG_CLIMB, zIndex: 2, maxWidth: "100%" },
	tag: { alignSelf: "center" },
	band: {
		position: "relative",
		backgroundColor: WHIMSY.slopBand,
		borderRadius: RADII.md,
		marginHorizontal: -SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingTop: SPACE.sm,
	},
	sign: {
		position: "absolute",
		top: -SPACE.md,
		right: SPACE.sm,
		zIndex: 3,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.xxs,
		paddingHorizontal: SPACE.sm,
	},
});
