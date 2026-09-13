import React from "react";
import { DynamicTypeText as Text } from "./DynamicTypeText";
import {
	Image,
	type ImageSourcePropType,
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	BORDER,
	DISABLED,
	DISABLED_TEXT,
	PRESSED_FLAT,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { Glyph, type GlyphName } from "./Glyph";
import { SnoutCoin } from "./SnoutCoin";
import { Hand } from "./Text";

export type ChipTone =
	| "paper"
	| "sun"
	| "rose"
	| "roseDeep"
	| "sky"
	| "sage"
	| "lilac"
	| "bark"
	// The locked / spent capsule: DISABLED chrome as a tone, so a LOCKED tag
	// never needs a style override. (2026-09-11)
	| "muted";

const TONE_FILL: Record<ChipTone, string> = {
	paper: UI_COLORS.surface,
	sun: WHIMSY.sun,
	rose: WHIMSY.rose,
	roseDeep: WHIMSY.roseDeep,
	sky: WHIMSY.sky,
	sage: WHIMSY.sage,
	lilac: WHIMSY.lilac,
	bark: WHIMSY.bark,
	muted: UI_COLORS.surfaceStrong,
};

// Bark is the one dark fill, so it is the one tone whose ink flips.
const TONE_INK: Record<ChipTone, string> = {
	paper: UI_COLORS.textPrimary,
	sun: UI_COLORS.textPrimary,
	rose: UI_COLORS.textPrimary,
	roseDeep: UI_COLORS.textPrimary,
	sky: UI_COLORS.textPrimary,
	sage: UI_COLORS.textPrimary,
	lilac: UI_COLORS.textPrimary,
	bark: UI_COLORS.textOnDark,
	muted: UI_COLORS.textDisabled,
};

// The capsule's own height stays small — `SPACE.xl` of visual, `SPACE.xs` of
// inset — and the 44pt frame is restored with hitSlop instead of by inflating
// the pill: the IconButton visual/frame split, generalised. [C-04, E4]
// (2026-09-11)
const CAPSULE_VISUAL_H = SPACE.xl;
// Not a spacing decision — the arithmetic that makes a 24pt capsule reach the
// 44pt floor. Lives here, in the primitive, so no screen has to do it.
const HIT_GROW = (TAP_MIN - CAPSULE_VISUAL_H) / 2;
const CHIP_HIT_SLOP = {
	top: HIT_GROW,
	bottom: HIT_GROW,
	left: SPACE.sm,
	right: SPACE.sm,
};

// The glyph/icon riding a capsule — one step below the 12pt label so the mark
// reads as a companion to the word rather than competing with it.
const CAPSULE_MARK = 14;

function CapsuleMark({
	icon,
	glyph,
	coin,
	art,
	color,
}: {
	icon?: IconName;
	glyph?: GlyphName;
	coin?: boolean;
	art?: ImageSourcePropType;
	color: string;
}) {
	if (coin) return <SnoutCoin size={CAPSULE_MARK} />;
	// A product image (a golden truffle, a hat thumb) in the mark slot — the
	// capsule stays a capsule; the art is just its mark. (2026-09-11)
	if (art)
		return (
			<Image
				source={art}
				style={{ width: CAPSULE_MARK, height: CAPSULE_MARK }}
				resizeMode="contain"
				accessible={false}
			/>
		);
	if (icon) return <Icon name={icon} size={CAPSULE_MARK} color={color} />;
	if (glyph) return <Glyph name={glyph} size={CAPSULE_MARK} />;
	return null;
}

export interface ChipProps {
	label: string;
	// A quiet hand line UNDER the label, for a capsule whose label needs a
	// qualifier it cannot carry inline — the Titles chips say where the title
	// sits ("before name"). The capsule becomes a two-line block; the pill
	// shape, the selection border and the 44pt frame are unchanged. [wave 4]
	sub?: string;
	selected?: boolean;
	disabled?: boolean;
	onPress: () => void;
	icon?: IconName;
	glyph?: GlyphName;
	art?: ImageSourcePropType;
	// Prefix with the Snout Coin — the stake chips state an amount.
	coin?: boolean;
	// A node pinned to the capsule's top-right corner, overhanging it (the
	// achievements Ready count). Taps pass straight through to the chip, and the
	// count belongs in `accessibilityLabel` — a badge is never the only place a
	// number is said. Same slot `SegmentedControl` carries. [wave 4]
	badge?: React.ReactNode;
	// The capsule inside a `radiogroup` announces as a radio rather than a
	// button; everywhere else "button" (the default) is right. Selection is
	// still `BORDER.heavy` + `accessibilityState.selected`. [wave 4]
	role?: "button" | "radio";
	tone?: ChipTone;
	// Custom ink for a data-coded capsule (a rarity badge reads
	// RARITY_BADGE[r].ink on RARITY_BADGE[r].bg). Pair it with a `style`
	// backgroundColor from the same validated map; never a fresh hex. (2026-09-11)
	ink?: string;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
	// A ceiling on Dynamic Type for the capsule's words, forwarded to the
	// <Text>. Undefined by default — a capsule normally scales the whole 200%.
	// Pass 1.3 only where the capsule rides fixed-height chrome. (2026-09-12)
	maxFontSizeMultiplier?: number;
}

/**
 * The selectable capsule — filters, stake amounts, the pig picker. Selection is
 * `BORDER.heavy`, never a color change alone (spec §3.3). (2026-09-11)
 */
export function Chip({
	label,
	sub,
	selected,
	disabled,
	onPress,
	icon,
	glyph,
	art,
	coin,
	badge,
	role = "button",
	ink: inkOverride,
	tone = "paper",
	accessibilityLabel,
	accessibilityHint,
	testID,
	style,
	maxFontSizeMultiplier,
}: ChipProps) {
	const ink = disabled ? DISABLED_TEXT.color : (inkOverride ?? TONE_INK[tone]);
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={CHIP_HIT_SLOP}
			accessibilityRole={role}
			accessibilityLabel={accessibilityLabel ?? (sub ? `${label}, ${sub}` : label)}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ selected: !!selected, disabled: !!disabled }}
			testID={testID}
			style={({ pressed }) => [
				styles.capsule,
				// A disabled capsule keeps its whole shape: muted fill, ink
				// outline, text-safe muted ink — and drops the shadow, because a
				// resting control is not lifted off the paper.
				disabled
					? DISABLED
					: [
							{ backgroundColor: TONE_FILL[tone] },
							SHADOW_SM,
						],
				selected && styles.selected,
				style,
				pressed && !disabled && PRESSED_FLAT,
			]}
		>
			<CapsuleMark icon={icon} glyph={glyph} coin={coin} art={art} color={ink} />
			{sub ? (
				<View style={styles.stack}>
					<Text
						maxFontSizeMultiplier={maxFontSizeMultiplier}
						style={[styles.label, { color: ink }]}
					>
						{label}
					</Text>
					<Hand
						tone={disabled ? "disabled" : "secondary"}
						align="center"
						maxFontSizeMultiplier={maxFontSizeMultiplier}
					>
						{sub}
					</Hand>
				</View>
			) : (
				<Text
					maxFontSizeMultiplier={maxFontSizeMultiplier}
					style={[styles.label, { color: ink }]}
				>
					{label}
				</Text>
			)}
			{badge ? (
				<View style={styles.badge} pointerEvents="none">
					{badge}
				</View>
			) : null}
		</Pressable>
	);
}

export interface TagProps {
	label: string;
	// A node that rides at the head of the capsule, before the mark — the one
	// case a `CapsuleMark` cannot serve, because the thing in front of the
	// number is a whole `Avatar` rather than a 14pt glyph. The capsule hugs it,
	// so a leading avatar sets the tag's height. [visit status row]
	leading?: React.ReactNode;
	tone?: ChipTone;
	// Prefix the label with the Snout Coin, for the capsules that state a cost.
	coin?: boolean;
	icon?: IconName;
	glyph?: GlyphName;
	art?: ImageSourcePropType;
	// Custom ink for a data-coded capsule (see ChipProps.ink).
	ink?: string;
	accessibilityLabel?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
	// See ChipProps.maxFontSizeMultiplier. The visit screen's status row is the
	// caller that needs it: three capsules on one wrapping line. (2026-09-12)
	maxFontSizeMultiplier?: number;
}

/**
 * The read-only capsule — rank, count, cost. Same drawing as `Chip`, no press:
 * it announces as text rather than pretending to be a button. (2026-09-11)
 */
export function Tag({
	label,
	leading,
	tone = "paper",
	coin,
	icon,
	glyph,
	art,
	ink: inkOverride,
	accessibilityLabel,
	testID,
	style,
	maxFontSizeMultiplier,
}: TagProps) {
	const ink = inkOverride ?? TONE_INK[tone];
	return (
		<View
			accessibilityRole="text"
			accessibilityLabel={accessibilityLabel ?? label}
			testID={testID}
			style={[
				styles.capsule,
				{ backgroundColor: TONE_FILL[tone] },
				SHADOW_SM,
				style,
			]}
		>
			{leading}
			<CapsuleMark icon={icon} glyph={glyph} coin={coin} art={art} color={ink} />
			<Text
				maxFontSizeMultiplier={maxFontSizeMultiplier}
				style={[styles.label, { color: ink }]}
			>
				{label}
			</Text>
		</View>
	);
}

export type RibbonTone = "slopGold" | "sun" | "rose";

const RIBBON_FILL: Record<RibbonTone, string> = {
	slopGold: WHIMSY.slopGold,
	sun: WHIMSY.sun,
	rose: WHIMSY.rose,
};

// The banner runs corner-to-corner, so it is wider than the card it crosses and
// hangs off the right edge. Neither number is a spacing decision — they are the
// geometry of a 35° chord — so they are named here rather than borrowed from
// SPACE. Matches the MEMBERS ribbon the shop draws today.
const RIBBON_WIDTH = 120;
const RIBBON_OVERHANG = -30;
const RIBBON_ANGLE = "35deg";
// The ribbon mark matches its 10px caps label.
const RIBBON_MARK = TYPE.kickerPillSm.fontSize;

export interface RibbonProps {
	label: string;
	tone?: RibbonTone;
	// Which corner the ribbon crosses. Top-right is the shop's MEMBERS ribbon;
	// a postcard whose result line sits top-right hangs it top-left instead.
	corner?: "topRight" | "topLeft";
	// A mark before the label — the gated lock on MEMBERS. (2026-09-11)
	icon?: IconName;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

/**
 * The corner marker — MEMBERS, NEW, GATED. Absolutely positioned, so the parent
 * it crosses must be `overflow: "hidden"`. (2026-09-11)
 */
export function Ribbon({
	label,
	tone = "slopGold",
	corner = "topRight",
	icon,
	style,
	testID,
}: RibbonProps) {
	return (
		<View
			accessibilityRole="text"
			accessibilityLabel={label}
			testID={testID}
			style={[
				styles.ribbon,
				corner === "topLeft" && styles.ribbonLeft,
				{ backgroundColor: RIBBON_FILL[tone] },
				style,
			]}
		>
			<View style={styles.ribbonRow}>
				{icon ? (
					<Icon name={icon} size={RIBBON_MARK} color={UI_COLORS.textPrimary} />
				) : null}
				<Text style={styles.ribbonLabel}>{label}</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	capsule: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		minHeight: CAPSULE_VISUAL_H,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	selected: {
		borderWidth: BORDER.heavy,
	},
	// The two-line capsule: label over its qualifier, both centred on the mark.
	stack: {
		alignItems: "center",
	},
	// `flexShrink: 1` is load-bearing, not cosmetic: React Native defaults
	// flexShrink to 0, so a capsule whose words outgrew the row pushed its own
	// width past the container and ran off the screen edge instead of wrapping.
	// With it, a capsule constrained by a `maxWidth` wraps its label. (2026-09-12)
	label: {
		...TYPE.label,
		textAlign: "center",
		flexShrink: 1,
	},
	// The badge hangs off the corner by one gutter — far enough to read as a
	// marker on the capsule rather than a word inside it.
	badge: {
		position: "absolute",
		top: -SPACE.xs,
		right: -SPACE.xs,
	},
	ribbon: {
		position: "absolute",
		top: SPACE.md,
		right: RIBBON_OVERHANG,
		width: RIBBON_WIDTH,
		paddingVertical: SPACE.xxs,
		borderTopWidth: BORDER.thin,
		borderBottomWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		transform: [{ rotate: RIBBON_ANGLE }],
		zIndex: 2,
	},
	ribbonLeft: {
		right: undefined,
		left: RIBBON_OVERHANG,
		transform: [{ rotate: `-${RIBBON_ANGLE}` }],
	},
	ribbonRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xxs,
	},
	ribbonLabel: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.textPrimary,
		textAlign: "center",
	},
});
