// A hanging sign — the storefront's doors (Storefront build 2, 2026-09-16,
// taste-standard ruling 3: "Closet and Furnish hang as signs so the counter
// front belongs to the pigs"). A paper sign on a short string, icon over
// label, in the same language as the hanging-signs tab bar: the current one
// wears the peach wash and a lean, the rest hang straight.
import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import {
	ART_SIZE,
	BORDER,
	CHROME_TYPE_CAP,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	TILT,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Icon, type IconName } from "../ui/Icon";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

/** The string a sign hangs from. */
const STRING_H = SPACE.lg;
/** The sign's own face: a 44pt tap plus the string above it. */
const SIGN_MIN_H = TAP_MIN;
/** The active sign's lean — the tab bar's, and no more. */
const ACTIVE_TILT = TILT.reveal;
/** The count badge on a sign's corner ("Closet" with 12 owned). */
const BADGE_MIN_W = 22;
const BADGE_H = 22;
/**
 * A sign's own width. Fixed, not `flex: 1`: the doorway row is a chalkboard
 * that shrinks beside signs that do not, so the signs state their footprint and
 * the board takes what is left. Three of these plus their gaps is the rail's
 * whole width. (2026-09-17 — the row used to overlap the card above it because
 * nothing in it could give.)
 */
export const SIGN_W = 60;
/**
 * The sign once the system text is larger than default. "Furnish" in `label`
 * measures 44.4pt at 1.0x, inside the 48pt a 60pt sign leaves it, but 48.6pt a
 * step up and 57pt at CHROME_TYPE_CAP, where it truncated to "Furn…". At this
 * width the word fits to the cap (57 + the sign's 12pt of pad and border), and
 * the chalkboard beside two of them still holds its caps line on a 375pt phone
 * (183pt left for a 174pt board). (polish pass, 2026-10-04)
 */
export const SIGN_W_LARGE_TYPE = 70;

export function HangingSign({
	label,
	count,
	icon,
	glyph,
	art,
	active = false,
	labelHidden = false,
	onPress,
	accessibilityLabel,
	accessibilityHint,
	testID,
}: {
	label: string;
	/** A count pinned to the sign's corner, so the word stays whole. */
	count?: number;
	icon?: IconName;
	glyph?: GlyphName;
	/** Bespoke art in the icon slot (the barn door), sized by the caller. */
	art?: ReactNode;
	active?: boolean;
	/**
	 * Drop the word and keep the glyph — the narrow-phone tier for the signs
	 * that are only doors (Pen, Furnish). The screen reader keeps the name.
	 */
	labelHidden?: boolean;
	onPress: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
}) {
	const { fontScale } = useWindowDimensions();
	return (
		<View style={[styles.hanger, fontScale > 1 && styles.hangerLargeType]}>
			<View style={styles.string} pointerEvents="none" />
			<Sticker
				color={active ? "peach" : "paper"}
				radius={RADII.md}
				shadow="sm"
				rotate={active ? ACTIVE_TILT : 0}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityHint={accessibilityHint}
				accessibilityState={{ selected: active }}
				testID={testID}
				style={styles.sign}
			>
				{art ? (
					art
				) : glyph ? (
					// A painted sign glyph sits at the fan-mark size, not the row size.
					<Glyph name={glyph} size={ART_SIZE.glyphMd} />
				) : icon ? (
					<Icon
						name={icon}
						size={ART_SIZE.glyphSm}
						color={UI_COLORS.textPrimary}
					/>
				) : null}
				{labelHidden ? null : (
					<T
						role="label"
						numberOfLines={1}
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
					>
						{label}
					</T>
				)}
				{count !== undefined && count > 0 ? (
					<View style={styles.badge} pointerEvents="none">
						<T role="numeral" style={styles.badgeText}>
							{count.toLocaleString()}
						</T>
					</View>
				) : null}
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	hanger: {
		width: SIGN_W,
		minWidth: 0,
		alignItems: "stretch",
	},
	hangerLargeType: { width: SIGN_W_LARGE_TYPE },
	string: {
		alignSelf: "center",
		width: BORDER.ink,
		height: STRING_H,
		backgroundColor: UI_COLORS.border,
	},
	badge: {
		position: "absolute",
		top: -SPACE.sm,
		right: -SPACE.xs,
		minWidth: BADGE_MIN_W,
		height: BADGE_H,
		paddingHorizontal: SPACE.xs,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	badgeText: { fontSize: TYPE.kicker.fontSize, lineHeight: TYPE.kicker.lineHeight },
	sign: {
		minHeight: SIGN_MIN_H,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
});
