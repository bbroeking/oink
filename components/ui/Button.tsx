import React from "react";
import { DynamicTypeText as Text } from "./DynamicTypeText";
import {
	Pressable,
	ViewStyle,
	type PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
	BORDER,
	BUTTON_SIZE,
	DISABLED,
	DISABLED_TEXT,
	FONTS,
	GRADIENT,
	OPACITY,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// Cozy treatment for the colorful gradient CTAs (primary/purple/gold): the
// app's signature ink outline + hard "sticker" drop shadow, so they read as
// hand-drawn buttons instead of flat gradient pills.
const COZY_GRADIENT = {
	borderWidth: BORDER.ink,
	borderColor: UI_COLORS.border,
	...SHADOW_SM,
};

type Variant =
	| "primary"
	| "purple"
	| "gold"
	| "dark"
	| "ghost"
	| "locked"
	| "success"
	// Tertiary: no fill, no border, an underlined ink label inside a full 44pt
	// frame. Retires the five ad-hoc text links. [D-08] (2026-09-11)
	| "link"
	// The cozy accent link ("see the full field ›"): the same tappable-text
	// frame as `link`, in the hand voice and the accent ink, no underline —
	// the voice race-standings and the shop already used for their "more"
	// doors. (2026-09-11, wave 3 · C)
	| "handLink"
	// The same hand link on bark/stage, in sun (the kicker ink on dark). (2026-09-11)
	| "handLinkOnDark"
	// The soft affirmative: a pastel-lilac flat pill with the ink outline —
	// "got it", "keep looking" — where a gradient CTA would shout. (2026-09-11)
	| "lilac"
	// The commit button on a destructive decision, promoted out of
	// ConfirmDialog so "this cannot be undone" has one drawing. [F-22]
	| "destructive";
type Size = "xs" | "sm" | "md" | "lg";

// The label a loading button wears. No spinner, ever — the button says what it
// is doing, in the hand, and keeps its shape. [B-14] (2026-09-11)
const WORKING_LABEL = "\u2605 working \u2605";

interface Props extends Pick<
	PressableProps,
	"accessibilityHint" | "accessibilityLabel" | "accessibilityState" | "accessibilityValue" | "testID"
> {
	children: React.ReactNode;
	variant?: Variant;
	size?: Size;
	icon?: React.ReactNode;
	full?: boolean;
	style?: ViewStyle;
	onPress?: () => void;
	// Optional secondary gesture (e.g. long-press-to-copy on a share CTA). Threads
	// to the same Pressable as onPress for both the gradient and flat variants.
	onLongPress?: () => void;
	disabled?: boolean;
	// In-flight. Disables the control, swaps the label for the hand-written
	// working line, and announces `busy` — never an ActivityIndicator.
	loading?: boolean;
	// The working label while `loading` ("Saving…", "Opening Google…"). Defaults
	// to the hand-voiced "★ working ★". (2026-09-11)
	loadingLabel?: string;
	// A ceiling on Dynamic Type for this label, forwarded straight to the
	// <Text>. Undefined by default — spec §1.2 scales to 200% and that is still
	// the rule. A caller passes 1.3 ONLY when the button sits in fixed-height
	// chrome that would clip rather than grow (the visit screen's header row and
	// bottom bar), which is the same cap `ListRow` takes on compact rows.
	// (2026-09-12)
	maxFontSizeMultiplier?: number;
}

const GRADIENT_VARIANTS: Partial<Record<Variant, readonly [string, string]>> = {
	primary: GRADIENT.rose,
	// White labels need one consistently dark ramp; the old light stop dropped
	// below 4.5:1 halfway through the gradient.
	purple: GRADIENT.purple,
	gold: GRADIENT.gold,
};

const FLAT_VARIANTS: Partial<
	Record<
		Variant,
		{
			bg: string;
			color: string;
			border?: string;
			bw?: number;
			shadow?: boolean;
		}
	>
> = {
	dark: { bg: UI_COLORS.textPrimary, color: UI_COLORS.textOnDark },
	ghost: {
		bg: UI_COLORS.surface,
		color: UI_COLORS.textPrimary,
		border: UI_COLORS.separator,
	},
	// The "asleep button": full chrome (2px ink outline, muted paper fill + ink
	// text) with NO opacity crush, so a disabled CTA reads as a button that's
	// resting rather than a washed-out, borderless pill. This IS the DISABLED
	// token — `locked` is just the variant you reach for when the button is
	// permanently gated rather than momentarily unavailable. (2026-09-11)
	locked: {
		bg: DISABLED.backgroundColor as string,
		color: DISABLED_TEXT.color,
		border: DISABLED.borderColor as string,
		bw: DISABLED.borderWidth,
	},
	success: {
		bg: UI_COLORS.successSurface,
		color: UI_COLORS.successText,
		border: UI_COLORS.successBorder,
	},
	// Flat danger pair with the signature ink outline: the destructive commit
	// still reads as one of our buttons, not as a red web alert.
	destructive: {
		bg: UI_COLORS.dangerSurface,
		color: UI_COLORS.dangerText,
		border: UI_COLORS.border,
		bw: BORDER.ink,
		shadow: true,
	},
	// A link is text that happens to be tappable: no fill, no outline, no lift.
	link: { bg: "transparent", color: UI_COLORS.textPrimary },
	handLink: { bg: "transparent", color: UI_COLORS.action },
	handLinkOnDark: { bg: "transparent", color: WHIMSY.sun },
	lilac: {
		bg: WHIMSY.lilac,
		color: UI_COLORS.textPrimary,
		border: UI_COLORS.border,
		bw: BORDER.ink,
		shadow: true,
	},
};

const TEXT_COLORS: Record<Variant, string> = {
	primary: UI_COLORS.textPrimary,
	purple: UI_COLORS.textOnDark,
	gold: WHIMSY.goldInk,
	dark: UI_COLORS.textOnDark,
	ghost: UI_COLORS.textPrimary,
	locked: DISABLED_TEXT.color,
	success: UI_COLORS.successText,
	destructive: UI_COLORS.dangerText,
	link: UI_COLORS.textPrimary,
	handLink: UI_COLORS.action,
	handLinkOnDark: WHIMSY.sun,
	lilac: UI_COLORS.textPrimary,
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	icon,
	full,
	style,
	onPress,
	onLongPress,
	disabled,
	loadingLabel,
	loading,
	maxFontSizeMultiplier,
	accessibilityHint,
	accessibilityLabel,
	accessibilityState,
	accessibilityValue,
	testID,
}: Props) {
	const sz = BUTTON_SIZE[size];
	// A button in flight is a button you may not press.
	const inert = !!disabled || !!loading;
	// A disabled button never renders its gradient: spec §3.3 / the 2026-07-07
	// "button, asleep" ruling says disabled keeps full chrome over a muted fill,
	// so every variant collapses to the same locked look instead of wearing an
	// opacity crush over its own colors. (2026-09-11)
	const gradient = inert ? undefined : GRADIENT_VARIANTS[variant];
	const flat = FLAT_VARIANTS[variant];
	const textColor = inert ? DISABLED_TEXT.color : TEXT_COLORS[variant];
	// `xs` is deliberately shorter than the 44pt floor; the frame comes back as
	// hitSlop rather than as a taller pill. [C-04] (2026-09-11)
	const hitGrow = sz.minH < TAP_MIN ? (TAP_MIN - sz.minH) / 2 : 0;
	const hitSlop = hitGrow
		? { top: hitGrow, bottom: hitGrow, left: 0, right: 0 }
		: undefined;
	const a11yState = {
		...accessibilityState,
		disabled: inert,
		...(loading ? { busy: true } : null),
	};

	const inner = (
		<>
			{loading ? null : icon}
			<Text
				maxFontSizeMultiplier={maxFontSizeMultiplier}
				style={
					loading
						? {
								...TYPE.hand,
								color: textColor,
								flexShrink: 1,
								textAlign: "center",
							}
						: variant === "handLink" || variant === "handLinkOnDark"
							? {
									...TYPE.hand,
									color: textColor,
									marginLeft: icon ? SPACE.sm : 0,
									flexShrink: 1,
									textAlign: "center",
								}
							: {
								color: textColor,
								fontFamily: FONTS.bodyExtra,
								fontSize: sz.fs,
								letterSpacing: 0.1,
								marginLeft: icon ? SPACE.sm : 0,
								flexShrink: 1,
								textAlign: "center",
								// A link IS its underline — it has no fill or outline
								// left to say "tap me".
								textDecorationLine:
									variant === "link" ? "underline" : "none",
							}
				}
			>
				{loading ? (loadingLabel ?? WORKING_LABEL) : children}
			</Text>
		</>
	);

	const baseStyle: ViewStyle = {
		// A link keeps the full 44pt frame even though it draws nothing.
		minHeight: variant === "link" || variant === "handLink" || variant === "handLinkOnDark" ? TAP_MIN : sz.minH,
		paddingHorizontal: sz.px,
		paddingVertical: sz.py,
		borderRadius: sz.br,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		alignSelf: full ? "stretch" : undefined,
		...style,
	};

	if (gradient) {
		return (
			<Pressable
				onPress={onPress}
				onLongPress={onLongPress}
				disabled={inert}
				hitSlop={hitSlop}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={accessibilityHint}
				accessibilityValue={accessibilityValue}
				accessibilityState={a11yState}
				testID={testID}
				style={({ pressed }) => ({
					opacity: pressed ? OPACITY.pressed : 1,
				})}
			>
				<LinearGradient
					colors={gradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 0, y: 1 }}
					style={[baseStyle, COZY_GRADIENT]}
				>
					{inner}
				</LinearGradient>
			</Pressable>
		);
	}

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={inert}
			hitSlop={hitSlop}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
				accessibilityValue={accessibilityValue}
			accessibilityState={a11yState}
			testID={testID}
			style={({ pressed }) => [
				baseStyle,
				inert
					? // A resting link has no box to mute — it stays text, in the
						// text-safe disabled ink.
						variant === "link" ||
							variant === "handLink" ||
							variant === "handLinkOnDark"
						? null
						: DISABLED
					: {
							backgroundColor: flat?.bg ?? UI_COLORS.surface,
							borderWidth: flat?.border ? (flat.bw ?? BORDER.thin) : 0,
							borderColor: flat?.border,
						},
				// The destructive commit is lifted off the paper like the other
				// flat controls that ask for a tap; a link never is.
				!inert && flat?.shadow ? SHADOW_SM : null,
				pressed && !inert && { opacity: OPACITY.pressed },
			]}
		>
			{inner}
		</Pressable>
	);
}
