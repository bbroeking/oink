// The social row vocabulary — the pieces every Sounder invite/matchmaking
// surface composes a row out of: the portrait, the sun pill, the hand link, the
// quiet status, the accent span, the section kicker with its dashed rule, and
// the found-banner flag.
//
// Graduated out of `components/CrewRow.tsx` into the system 2026-09-11 (wave 4):
// five surfaces (SounderCard, FriendInvitePicker, PlayerInvitePicker,
// JoinableSounders, TransferLeadershipSheet) plus SounderHomeCard consume these,
// which is the definition of a primitive. `CrewRow` itself lives next door in
// `./CrewRow`, built from `DashedRule` and `textOf` below.
// Mockup: docs/design/claude-design/sounder/invite-matchmaking.html.
//
// **Accessibility lives here, not at the call sites** [B-04]. `SunPill` and
// `HandLink` are consumed by five surfaces, so a forgotten label multiplies by
// five. Each sets `accessibilityRole` itself and composes its own label from the
// text it already renders; a call site may sharpen the label or add a hint, but
// it cannot forget one.
//
// Two of these overlap `Button` and deliberately stay separate drawings:
// `SunPill` is a FLAT sun capsule in the display face (Button's `gold` is a
// gradient in Nunito), and `HandLink` is the underlined 13pt kicker with a
// trailing glyph (Button's `handLink` is the un-underlined 14pt hand). Folding
// either into `Button` would redraw six screens, not retire a duplicate.

import React, { type ReactNode } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	type StyleProp,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { PrestigeAvatar } from "./PrestigeAvatar";
import { Glyph, type GlyphName } from "./Glyph";
import { Label, T } from "./Text";
import {
	ART_SIZE,
	BORDER,
	DISABLED,
	DISABLED_TEXT,
	OPACITY,
	PRESSED,
	PRESSED_FLAT,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
	UI_COLORS,
	FONTS,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

// The portrait column: the portrait diameter plus the row's own gap. Named once
// so the follow-up copy (the stale-invite note) can indent past the portrait and
// line up with the row body.
export const ROW_GAP = SPACE.md;
export const PORTRAIT_SIZE = 48;
export const CREW_ROW_INDENT = PORTRAIT_SIZE + ROW_GAP;

// The portrait's inner art, as a fraction of the ring — the crown perches at
// half, the glyph fills a little over half. Drawing geometry, not spacing.
const GLYPH_FRAC = 0.55;
const CROWN_FRAC = 0.5;
// A prestige frame draws its own ring, so it overflows the plain one slightly;
// a plain portrait insets inside it. Both are the drawing of the ring.
const PRESTIGE_BLEED = 8;
const PORTRAIT_INSET = 5;

// "hand the ⟨crew⟩ to a crewmate" / "riding with the ⟨crew⟩" — dedupe the
// article when the crew is already named "The …".
export function theCrew(name: string): string {
	return /^the\s/i.test(name.trim()) ? name : `the ${name}`;
}

// The screen-reader name for a row whose title is a rich span tree ("⟨Rosie⟩
// wants you in ⟨Crew⟩"): flatten whatever text the row already renders rather
// than asking every call site to retype it.
export function textOf(node: ReactNode): string {
	if (node === null || node === undefined || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (React.isValidElement(node)) {
		return textOf((node.props as { children?: ReactNode }).children);
	}
	return "";
}

// ── Portrait — PigAvatar in an ink ring with the hard sticker shadow ─────────
// `glyph` swaps the pig for hand-drawn art (a crew banner row); `crowned`
// perches the crown on top (the leader row); `ghost` is the dashed empty
// ring for a pending invitee.
export function CrewPortrait({
	size = PORTRAIT_SIZE,
	hatId = null,
	bowId = null,
	prestigeLevel = 0,
	glyph,
	crowned = false,
	ghost = false,
}: {
	size?: number;
	hatId?: string | null;
	bowId?: string | null;
	prestigeLevel?: number | null;
	glyph?: GlyphName;
	crowned?: boolean;
	ghost?: boolean;
}) {
	const prestige = Math.max(0, prestigeLevel ?? 0);
	if (ghost) {
		return (
			<View
				style={[
					styles.portraitGhost,
					{ width: size, height: size, borderRadius: size / 2 },
				]}
			/>
		);
	}
	return (
		<View
			style={[
				styles.portrait,
				{ width: size, height: size, borderRadius: size / 2 },
				prestige > 0 && styles.portraitPrestige,
			]}
		>
			{glyph ? (
				<Glyph name={glyph} size={size * GLYPH_FRAC} />
			) : (
				<PrestigeAvatar
					size={prestige > 0 ? size + PRESTIGE_BLEED : size - PORTRAIT_INSET}
					hatId={hatId}
					bowId={bowId}
					prestigeLevel={prestige}
				/>
			)}
			{crowned && (
				<Glyph name="crown" size={size * CROWN_FRAC} style={styles.portraitCrown} />
			)}
		</View>
	);
}

// Accent-colored span inside a row title ("⟨Rosie⟩ wants you in ⟨Crew⟩").
// A raw <Text> on purpose: this is an inline span that must INHERIT the role of
// the line it sits in (a `T` would re-impose its own TYPE role and break the
// Fredoka name line). Colour is the only thing it says, and it says it in a token.
export function Accent({ children }: { children: ReactNode }) {
	return <Text style={styles.accent}>{children}</Text>;
}

// Muted "#0192" / "you" tag beside a name — deliberately steps DOWN to the
// label role, so it is a role swap rather than an inherited span.
export function DiscText({ children }: { children: ReactNode }) {
	return <Label tone="secondary">{children}</Label>;
}

// ── The sun pill — the one button everywhere a row acts ─────────────────────
// Pressed and disabled are two different drawings, not one `pillDim`: pressed
// shoves the pill into its own shadow, disabled swaps the fill and keeps the
// outline ("a button, asleep"). [B-08]
export function SunPill({
	children,
	onPress,
	disabled = false,
	glyph,
	accessibilityLabel,
	accessibilityHint,
}: {
	children: string;
	onPress: () => void;
	disabled?: boolean;
	/** Trailing mark — the drawn chevron a "go" pill wears, never a text `›`. [B-13] */
	glyph?: GlyphName;
	accessibilityLabel?: string;
	accessibilityHint?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={SPACE.sm}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? children}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled }}
			style={({ pressed }) => [
				styles.pill,
				disabled && styles.pillDisabled,
				!disabled && pressed && PRESSED,
			]}
		>
			<T
				role="bodySm"
				style={[styles.pillText, disabled && DISABLED_TEXT]}
				numberOfLines={1}
			>
				{children}
			</T>
			{!!glyph && <Glyph name={glyph} size={ART_SIZE.mark} />}
		</Pressable>
	);
}

// Quiet hand-script status where a row doesn't act ("crewmate", "full now").
export function RowStatus({
	children,
	accent = false,
}: {
	children: string;
	accent?: boolean;
}) {
	return (
		<T role="kicker" tone={accent ? "accent" : "secondary"} numberOfLines={1}>
			{children}
		</T>
	);
}

// Underlined hand-script link ("not today", "let it go", "Done").
export function HandLink({
	children,
	onPress,
	accent = false,
	underline = true,
	disabled = false,
	glyph,
	style,
	textStyle,
	accessibilityLabel,
	accessibilityHint,
}: {
	children: string;
	onPress: () => void;
	accent?: boolean;
	underline?: boolean;
	disabled?: boolean;
	/** Trailing mark — the drawn chevron a "go" link wears, never a text `›`. [B-13] */
	glyph?: GlyphName;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
	accessibilityLabel?: string;
	accessibilityHint?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={SPACE.sm}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? children}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled }}
			style={({ pressed }) => [
				glyph ? styles.linkRow : null,
				style,
				!disabled && pressed && PRESSED_FLAT,
			]}
		>
			<T
				role="kicker"
				tone={disabled ? "disabled" : accent ? "accent" : "secondary"}
				style={[styles.link, !underline && styles.linkPlain, textStyle]}
			>
				{children}
			</T>
			{!!glyph && <Glyph name={glyph} size={ART_SIZE.mark} />}
		</Pressable>
	);
}

// Hand-script accent note under a section ("the bog moves fast — …").
export function AccentNote({
	children,
	style,
}: {
	children: ReactNode;
	style?: StyleProp<TextStyle>;
}) {
	return (
		<T role="kicker" tone="accent" style={style}>
			{children}
		</T>
	);
}

// ── Section kicker — accent caps + trailing dashed rule ─────────────────────
export function CrewSectionKicker({
	children,
	plain = false,
}: {
	children: string;
	plain?: boolean;
}) {
	return (
		<View style={styles.kickRow}>
			<T role="kicker" tone="accent" style={styles.kickText} accessibilityRole="header">
				{children}
			</T>
			{!plain && <DashedRule style={styles.kickRule} />}
		</View>
	);
}

// A dashed ink rule. RN only renders dashed borders when the border is
// uniform, so this is a zero-height view wearing a 1px dashed border band.
export function DashedRule({ style }: { style?: StyleProp<ViewStyle> }) {
	return <View style={[styles.dashes, style]} />;
}

// ── The found-banner flag (the "Found the Sounder" CTA icon) ────────────────
// Transcribed from the mockup's btnbig svg. The one named drawing in this file:
// `Icon` has no flag entry and the banner CTA is the only place it appears, so
// the path stays here rather than becoming a one-consumer Icon name. [B-13]
const FLAG_STROKE = 2.5;
export function FlagIcon({ size = 20, color = WHIMSY.ink }: { size?: number; color?: string }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<Path d="M5 21 V4" stroke={color} strokeWidth={FLAG_STROKE} strokeLinecap="round" />
			<Path
				d="M5 4 Q12 1 19 5 L16 9 L19 13 Q12 10 5 12"
				stroke={color}
				strokeWidth={FLAG_STROKE}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

const styles = StyleSheet.create({
	portrait: {
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	portraitPrestige: {
		backgroundColor: "transparent",
		borderColor: "transparent",
		shadowOpacity: 0,
		elevation: 0,
	},
	portraitGhost: {
		borderWidth: BORDER.ink,
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
	},
	portraitCrown: {
		position: "absolute",
		top: -SPACE.md,
		alignSelf: "center",
		transform: [{ rotate: "-8deg" }],
	},
	accent: { color: UI_COLORS.action },
	pill: {
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xs,
		...SHADOW_SM,
	},
	pillDisabled: DISABLED,
	pillText: { fontFamily: FONTS.display, color: WHIMSY.ink },
	linkRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	link: { textDecorationLine: "underline" },
	linkPlain: { textDecorationLine: "none" },
	kickRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.sm,
	},
	kickText: {
		textTransform: "uppercase",
		letterSpacing: TYPE.kickerPill.letterSpacing,
	},
	kickRule: { flex: 1 },
	dashes: {
		height: 0,
		borderWidth: BORDER.hair,
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
		borderRadius: 1,
		opacity: OPACITY.ghost,
	},
});
