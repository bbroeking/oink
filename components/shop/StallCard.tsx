// The Pop-up Stall's card at the top of the shop wall (canvas board B1,
// 2026-10-29). A painted sticker: the set's backdrop with Rosie in one of its
// pieces and a lilac "leaving in N days" tag, then the stall's name and a bark
// "Step in" tag. A tap leaves the page for the stall's own route (a card that
// opens a place, like the hanging signs).
//
// After the window it is a boarded sign for three days: planks across the
// backdrop, "closed Nov 9 · back next year", and the way in to "Your haul".
// Then it unmounts. No stall open, no card: the caller renders nothing.
import { Image, StyleSheet, View } from "react-native";
import { Sticker, T, Tag } from "@/components/ui";
import { HAT_IMAGES } from "@/constants/hats";
import {
	BORDER,
	CHROME_TYPE_CAP,
	RADII,
	SPACE,
	TILT,
	TINT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { countWord } from "@/utils/shopShelves";
import type { SeasonalShelf, ShelfItem } from "@/utils/seasonalShelf";
import { heroItem } from "@/utils/seasonalShelf";
import { closedLabel, leavingLabel, type ShelfPhase } from "@/utils/shelfCountdown";
import { StallPig } from "./StallPig";

// ── Drawing constants ───────────────────────────────────────────────────────
/** The painted hero band's height (B1). */
const HERO_H = 128;
/** Rosie on the card: she stands in the band's corner, feet past its floor. */
const HERO_PIG = 104;
/** How far her feet sink past the band's bottom edge. */
const HERO_PIG_SINK = 6;
/** The boards' lean across the packed-up stall. */
const PLANK_TILT = 7;
/** A board's thickness. */
const PLANK_H = 26;
/** The card's inner corner, inside its RADII.xl outline (the ShopCard rule). */
const INNER_RADIUS = RADII.lg;
/** The "new here?" tag's lean, a stuck-on note (B1). */
const NEW_HERE_TILT = -4;

export interface StallCardProps {
	shelf: SeasonalShelf;
	/** The pieces this binary can draw. */
	items: readonly ShelfItem[];
	phase: "open" | "boarded";
	now: number;
	/** How many of the stall's pieces are yours (the boarded sign's haul). */
	ownedCount: number;
	/** The "new here?" tag (B1): an open stall this account has not stepped
	 *  into yet. Comes down for good on the first stall page visit. */
	newHere?: boolean;
	onPress: () => void;
}

export function StallCard({
	shelf,
	items,
	phase,
	now,
	ownedCount,
	newHere = false,
	onPress,
}: StallCardProps) {
	const backdrop = shelf.backdropHatId ? HAT_IMAGES[shelf.backdropHatId] : undefined;
	const boarded = phase === "boarded";
	const leaving = leavingLabel(shelf.closesAt, now);
	const pieces = `${countWord(items.length)} ${items.length === 1 ? "piece" : "pieces"}`;
	const kicker = boarded
		? closedLabel(shelf.closesAt, shelf.theme.back_line)
		: `seasonal stall · ${pieces}`;
	const hero = heroItem(shelf, items);
	const showNewHere = newHere && !boarded;
	const a11yLabel = boarded
		? `${shelf.title} stall, packed up. ${countWord(ownedCount)} in your haul`
		: `${showNewHere ? "New here. " : ""}${shelf.title} stall, ${pieces}${leaving ? `, ${leaving}` : ""}`;
	return (
		<Sticker
			color="paper"
			rotate={TILT.card}
			radius={RADII.xl}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={a11yLabel}
			accessibilityHint={boarded ? "Opens what you took home from the stall" : "Opens the seasonal stall"}
			testID={boarded ? "stall-card-boarded" : "stall-card-open"}
		>
			<View style={[styles.hero, !backdrop && styles.heroBare]}>
				{backdrop ? (
					<Image source={backdrop} style={styles.backdrop} resizeMode="cover" accessible={false} />
				) : null}
				<View style={styles.pig} pointerEvents="none">
					<StallPig item={boarded ? null : hero} size={HERO_PIG} />
				</View>
				{boarded ? (
					<View style={styles.boards} pointerEvents="none">
						<View style={[styles.plank, styles.plankUp]} />
						<View style={[styles.plank, styles.plankDown]} />
					</View>
				) : null}
				{showNewHere ? (
					<View style={styles.newHere} pointerEvents="none" testID="stall-card-new-here">
						<Tag tone="sun" label="new here? ★" maxFontSizeMultiplier={CHROME_TYPE_CAP} />
					</View>
				) : null}
				<View style={styles.heroTag} pointerEvents="none">
					{boarded ? (
						<Tag tone="paper" label="packed up" maxFontSizeMultiplier={CHROME_TYPE_CAP} />
					) : leaving ? (
						<Tag tone="lilac" label={leaving} maxFontSizeMultiplier={CHROME_TYPE_CAP} />
					) : null}
				</View>
			</View>
			<View style={styles.foot}>
				<View style={styles.names}>
					<T role="kicker" tone="accent" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{kicker}
					</T>
					<T role="sectionTitle" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{shelf.title}
					</T>
				</View>
				<Tag
					tone={boarded ? "sun" : "bark"}
					label={boarded ? "Your haul ›" : "Step in ›"}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
				/>
			</View>
		</Sticker>
	);
}

/**
 * The wall's stall slot: the card while a stall is open or boarded, nothing
 * otherwise (no stall row, a dark one, or past its three boarded days). The
 * shop tab mounts this, so "no shelf open = no card" lives in one place.
 */
export function StallCardSlot({
	shelf,
	phase,
	...rest
}: Omit<StallCardProps, "shelf" | "phase"> & {
	shelf: SeasonalShelf | null;
	phase: ShelfPhase | null;
}) {
	if (!shelf || (phase !== "open" && phase !== "boarded")) return null;
	return <StallCard shelf={shelf} phase={phase} {...rest} />;
}

const styles = StyleSheet.create({
	// The band clips its own top corners (the card never clips: an
	// `overflow: hidden` card loses its hard shadow on iOS).
	hero: {
		height: HERO_H,
		borderBottomWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderTopLeftRadius: INNER_RADIUS,
		borderTopRightRadius: INNER_RADIUS,
		overflow: "hidden",
		position: "relative",
		backgroundColor: WHIMSY.lilac,
	},
	heroBare: { backgroundColor: WHIMSY.cream2 },
	backdrop: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
	pig: {
		position: "absolute",
		left: SPACE.card,
		bottom: -HERO_PIG_SINK,
	},
	boards: {
		...StyleSheet.absoluteFill,
		justifyContent: "center",
		gap: SPACE.sm,
		backgroundColor: TINT.paperWash,
	},
	plank: {
		height: PLANK_H,
		marginHorizontal: -SPACE.lg,
		backgroundColor: WHIMSY.barkMute,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	plankUp: { transform: [{ rotate: `-${PLANK_TILT}deg` }] },
	plankDown: { transform: [{ rotate: `${PLANK_TILT}deg` }] },
	heroTag: {
		position: "absolute",
		top: SPACE.sm,
		right: SPACE.sm,
	},
	newHere: {
		position: "absolute",
		top: SPACE.sm,
		left: SPACE.sm,
		transform: [{ rotate: `${NEW_HERE_TILT}deg` }],
	},
	foot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.card,
	},
	names: { flex: 1, flexShrink: 1 },
});
