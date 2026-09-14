import React from "react";
import {
	Pressable,
	View,
	ViewStyle,
	StyleProp,
	StyleSheet,
	type PressableProps,
} from "react-native";
import {
	BORDER,
	DISABLED,
	PRESSED,
	PRESSED_FLAT,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { CardTitle } from "./Text";

type StickerColor =
	| "paper"
	| "cream"
	| "cream2"
	| "bark"
	| "rose"
	| "roseDeep"
	| "sky"
	| "sage"
	| "sun"
	| "lilac"
	| "lilacDeep"
	| "peach"
	// The members band (Slop Club) — the one identity fill a Sticker may wear.
	| "slopBand";

interface Props
	extends Pick<
		PressableProps,
		"accessibilityHint" | "accessibilityLabel" | "accessibilityRole" | "accessibilityValue" | "accessibilityState" | "testID"
	> {
	children?: React.ReactNode;
	// A named theme token OR a raw color string. `string & {}` keeps the token
	// names in autocomplete instead of letting the bare `string` swallow them.
	color?: StickerColor | (string & {});
	rotate?: number; // degrees
	radius?: number;
	border?: number;
	// A dashed outline is the "waiting / not yet" sticker (an empty slot, a
	// shelf still to fill). Solid is every other sticker. (2026-09-11)
	borderStyle?: "solid" | "dashed" | "dotted";
	// Which of the two sanctioned shadow tiers this sticker wears. `true` is the
	// full 4,4 sticker shadow, `false`/"none" is flat, and "sm" is the 2,2 tier a
	// chip-sized sticker wants — previously reachable only by passing the shadow
	// through `style`, which is how soft blurs kept sneaking back. [F-01]
	// (2026-09-11)
	shadow?: boolean | "sticker" | "sm" | "none";
	// Inner padding. NOT applied by default: the 58 stickers that predate this
	// prop pad themselves, so turning padding on for everyone would double it.
	// `pad` opts into the sanctioned `SPACE.card` inset. [F-16] (2026-09-11)
	pad?: boolean;
	// Slots. `title` takes a string (drawn as `CardTitle`) or any node; `right`
	// rides the title row's far edge; `footer` closes the card. [F-16]
	title?: React.ReactNode | string;
	right?: React.ReactNode;
	footer?: React.ReactNode;
	// Press. With `onPress` the sticker becomes a Pressable wearing the
	// shadow-collapse press; without it, it stays the plain View it always was.
	// [F-15] (2026-09-11)
	onPress?: () => void;
	onLongPress?: () => void;
	// Extends the touch frame to TAP_MIN without inflating a small sticker (a
	// pill, a corner tag). Pressable-only. (2026-09-11)
	hitSlop?: PressableProps["hitSlop"];
	disabled?: boolean;
	/**
	 * Web-only ARIA attributes react-native-web forwards straight to the DOM
	 * node and React Native has no prop mirror for. Inert on native.
	 * (2026-09-14)
	 */
	webAria?: Record<`aria-${string}`, string>;
	style?: StyleProp<ViewStyle>;
}

const SHADOW_MAP = {
	sticker: STICKER_SHADOW,
	sm: SHADOW_SM,
	none: undefined,
} as const;

const COLOR_MAP: Record<StickerColor, string> = {
	paper: WHIMSY.paper,
	cream: WHIMSY.cream,
	cream2: WHIMSY.cream2,
	bark: WHIMSY.bark,
	rose: WHIMSY.rose,
	roseDeep: WHIMSY.roseDeep,
	sky: WHIMSY.sky,
	sage: WHIMSY.sage,
	sun: WHIMSY.sun,
	lilac: WHIMSY.lilac,
	lilacDeep: WHIMSY.lilacDeep,
	peach: WHIMSY.peach,
	slopBand: WHIMSY.slopBand,
};

/**
 * Forwards its ref to the host surface, so a caller can measure it or send
 * accessibility focus to it (the friend row's action cells). (2026-09-14)
 */
export const Sticker = React.forwardRef<View, Props>(function Sticker(
	{
	children,
	color = "paper",
	rotate = TILT.card,
	radius = RADII.lg,
	border = BORDER.ink,
	borderStyle,
	shadow = true,
	pad,
	title,
	right,
	footer,
	onPress,
	onLongPress,
	hitSlop,
	disabled,
	accessibilityHint,
	accessibilityValue,
	accessibilityState,
	accessibilityLabel,
	accessibilityRole,
	testID,
	webAria,
	style,
	},
	ref
) {
	const bg =
		color in COLOR_MAP ? COLOR_MAP[color as StickerColor] : color;
	const tier =
		shadow === true ? "sticker" : shadow === false ? "none" : shadow;
	const interactive = !!onPress || !!onLongPress;

	const surface: ViewStyle = {
		backgroundColor: bg,
		borderRadius: radius,
		borderWidth: border,
		borderStyle,
		transform: [{ rotate: `${rotate}deg` }],
	};
	// The press. `PRESSED` carries its own `transform`, and spreading it
	// wholesale would REPLACE the rotate and pop the card flat mid-press, so the
	// shove is re-composed on top of the tilt. Offsets are `SPACE.xxs` because
	// that is the value `PRESSED` shoves by. [C-01, C-07] (2026-09-11)
	const pressedStyle: ViewStyle =
		tier === "none"
			? PRESSED_FLAT
			: {
					...PRESSED,
					transform: [
						{ rotate: `${rotate}deg` },
						{ translateX: SPACE.xxs },
						{ translateY: SPACE.xxs },
					],
				};
	// Disabled keeps full chrome over a muted fill — never an opacity crush.
	const asleep: ViewStyle | undefined = disabled
		? {
				backgroundColor: DISABLED.backgroundColor,
				borderColor: DISABLED.borderColor,
				borderWidth: DISABLED.borderWidth,
			}
		: undefined;

	const body = (
		<>
			{title !== undefined || right !== undefined ? (
				<View style={styles.titleRow}>
					<View style={styles.titleSlot}>
						{typeof title === "string" ? (
							<CardTitle>{title}</CardTitle>
						) : (
							title
						)}
					</View>
					{right !== undefined ? <View>{right}</View> : null}
				</View>
			) : null}
			{children}
			{footer !== undefined ? (
				<View style={styles.footer}>{footer}</View>
			) : null}
		</>
	);

	if (!interactive) {
		return (
			<View
				ref={ref}
				{...webAria}
				accessibilityHint={accessibilityHint}
				accessibilityLabel={accessibilityLabel}
				accessibilityRole={accessibilityRole}
				testID={testID}
				style={[
					styles.base,
					surface,
					pad && styles.pad,
					SHADOW_MAP[tier],
					asleep,
					style,
				]}
			>
				{body}
			</View>
		);
	}

	return (
		<Pressable
			ref={ref}
			{...webAria}
			onPress={onPress}
			onLongPress={onLongPress}
			hitSlop={hitSlop}
			disabled={disabled}
			accessibilityRole={accessibilityRole ?? "button"}
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityValue={accessibilityValue}
			accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
			testID={testID}
			style={({ pressed }) => [
				styles.base,
				surface,
				pad && styles.pad,
				SHADOW_MAP[tier],
				asleep,
				style,
				pressed && !disabled && pressedStyle,
			]}
		>
			{body}
		</Pressable>
	);
});

// Strip of "tape" — narrow translucent rect, used to pin stickers.
export function Tape({
	color = "sun",
	rotate = TILT.tape,
	width = 48,
	height = 14,
	style,
}: {
	// A named theme token OR a raw color string. `string & {}` keeps the token
	// names in autocomplete instead of letting the bare `string` swallow them.
	color?: StickerColor | (string & {});
	rotate?: number;
	width?: number;
	height?: number;
	style?: StyleProp<ViewStyle>;
}) {
	const bg =
		color in COLOR_MAP ? COLOR_MAP[color as StickerColor] : color;
	return (
		<View
			style={[
				styles.tape,
				{
					backgroundColor: bg,
					width,
					height,
					transform: [{ rotate: `${rotate}deg` }],
				},
				style,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	base: {
		borderColor: UI_COLORS.border,
	},
	// The sanctioned Sticker inset — structural to the 2px-ink-border look
	// (spec §5 decision 3), opt-in via `pad`.
	pad: {
		padding: SPACE.card,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.sm,
	},
	titleSlot: {
		flex: 1,
	},
	footer: {
		marginTop: SPACE.sm,
	},
	tape: {
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		// Tape is translucent so the sticker under it shows through; this is a
		// material property, not the pressed state. (2026-09-11)
		opacity: 0.85,
	},
});
