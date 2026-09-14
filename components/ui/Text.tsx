// The text-role primitive — the migration lever for the 521 bare `fontSize`
// sites the 2026-09 audit counted (design-system-spec §1.2, the folding rule).
//
// **A bare `fontSize` in a screen is the smell this component retires.** So is a
// bare `color:` on a <Text>, and so is `{ ...TYPE.body, color: UI_COLORS.mute }`
// re-typed per file. Text has exactly two axes here — `role` (which of the
// sixteen TYPE roles you are speaking in) and `tone` (which semantic ink it is
// written with) — and every value on both axes comes from constants/theme.ts.
// Colour is deliberately NOT baked into TYPE, so one role serves ink / mute /
// accent; this component is where that composition happens once.
//
// `allowFontScaling` is left at its React Native default on purpose: spec §1.2
// requires every role to scale with Dynamic Type to 200%, so we never pass
// `false`, and this component never REACHES for `adjustsFontSizeToFit` /
// `minimumFontScale` (the Button test guards the same rule) — long strings wrap,
// they don't shrink. Both still pass THROUGH, but nothing in the app uses them
// any more: the friend row's actions panel was the one caller, and the honest
// answer there was a label role whose words fit the cell at full size rather
// than type that shrinks until it doesn't. The repo-wide budget for either prop
// is zero (`scripts/quality/quality.config.mjs`). (2026-09-14)
//
// Accent tone is restricted by rule: spec §5 decision 2 allows WHIMSY.accent
// text only on ACCENT_SAFE_FILLS. On lilac / peach / roseDeep / lilacDeep /
// slopGold / goblin surfaces use tone="primary" instead.
import React from "react";
import { DynamicTypeText as RNText } from "./DynamicTypeText";
import {
	type StyleProp,
	type TextProps,
	type TextStyle,
} from "react-native";
import { TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";

/** Every role in the type scale. A role, never a number. */
export type TextRole = keyof typeof TYPE;

/** The semantic inks a role may be written in. */
export type TextTone =
	| "primary"
	| "secondary"
	| "disabled"
	| "accent"
	| "onDark"
	| "onDarkMute"
	// The kicker voice on bark/stage — sun, per the bark token's rule.
	| "onDarkAccent"
	// The alignment countdown inks (blessing gold / curse green).
	| "bless"
	| "curse"
	| "danger"
	| "success"
	| "warning"
	| "info";

const TONE_COLOR: Record<TextTone, string> = {
	primary: UI_COLORS.textPrimary,
	secondary: UI_COLORS.textSecondary,
	disabled: UI_COLORS.textDisabled,
	accent: UI_COLORS.action,
	onDark: UI_COLORS.textOnDark,
	onDarkMute: WHIMSY.barkMute,
	onDarkAccent: WHIMSY.sun,
	bless: WHIMSY.bless,
	curse: WHIMSY.curseGreen,
	danger: UI_COLORS.dangerText,
	success: UI_COLORS.successText,
	warning: UI_COLORS.warningText,
	info: UI_COLORS.infoText,
};

// React Native's own `role` prop is the ARIA mirror of `accessibilityRole`; we
// take the name for the type scale (spec §2 spells the API `<T role="body">`)
// and keep `accessibilityRole`, which the rest of components/ui already uses.
export interface TProps extends Omit<TextProps, "role"> {
	/** Which TYPE role this text speaks in. */
	role?: TextRole;
	/** Which semantic ink it is written with. */
	tone?: TextTone;
	/** Horizontal alignment, when the default (start) isn't right. */
	align?: TextStyle["textAlign"];
	/** Truncate after N lines. Omit to wrap freely (the default). */
	numberOfLines?: number;
	/** Style override. Always last, so a caller can win. */
	style?: StyleProp<TextStyle>;
}

/**
 * `<T role="body" tone="secondary">` — the one way to render words.
 * All `accessibilityRole` / `accessibilityLabel` / `testID` and the rest of
 * React Native's TextProps forward through untouched.
 */
export function T({
	role = "body",
	tone = "primary",
	align,
	numberOfLines,
	style,
	children,
	...textProps
}: TProps) {
	return (
		<RNText
			{...textProps}
			numberOfLines={numberOfLines}
			style={[
				TYPE[role],
				{ color: TONE_COLOR[tone] },
				align ? { textAlign: align } : null,
				style,
			]}
		>
			{children}
		</RNText>
	);
}

// ---------------------------------------------------------------------------
// Role shorthands. Same component, one axis pre-answered — so a screen reads
// `<CardTitle>` rather than `<T role="cardTitle">`, and a reviewer can see the
// hierarchy of a file by skimming its tag names.
// ---------------------------------------------------------------------------

type RoleProps = Omit<TProps, "role">;

export const Display = (props: RoleProps) => <T role="display" {...props} />;
export const PageTitle = (props: RoleProps) => <T role="pageTitle" {...props} />;
export const SectionTitle = (props: RoleProps) => (
	<T role="sectionTitle" {...props} />
);
export const CardTitle = (props: RoleProps) => <T role="cardTitle" {...props} />;
export const Body = (props: RoleProps) => <T role="body" {...props} />;
export const BodyLg = (props: RoleProps) => <T role="bodyLg" {...props} />;
export const BodySm = (props: RoleProps) => <T role="bodySm" {...props} />;
export const Label = (props: RoleProps) => <T role="label" {...props} />;
export const Hand = (props: RoleProps) => <T role="hand" {...props} />;
export const HandLg = (props: RoleProps) => <T role="handLg" {...props} />;
export const Numeral = (props: RoleProps) => <T role="numeral" {...props} />;

interface KickerProps extends Omit<TProps, "role"> {
	/** The "★ " lead-in. Spec §6: ★ is typography, not an icon. */
	star?: boolean;
}

/**
 * The hand-script accent line above a section title ("★ welcome").
 * The star lives HERE — every caller that types `★ {kicker}` inline is a copy
 * of this component waiting to drift.
 */
export function Kicker({ star = true, children, ...props }: KickerProps) {
	return (
		<T role="kicker" tone="accent" {...props}>
			{star ? "★ " : null}
			{children}
		</T>
	);
}

/** The tracked uppercase pill kicker above a page title ("★ THE SHOP"). */
export function KickerPill({ star = true, children, ...props }: KickerProps) {
	return (
		<T role="kickerPill" tone="secondary" {...props}>
			{star ? "★ " : null}
			{children}
		</T>
	);
}
