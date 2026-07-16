// Crew row grammar — the one "portrait · body · action" row shared by every
// Sounder invite/matchmaking surface (SounderCard, FriendInvitePicker,
// JoinableSounders, TransferLeadershipSheet), plus the small pieces the
// mockup composes rows from: sun pill, hand status/links, section kicker
// with its dashed rule, and the found-banner flag icon.
// Mockup: docs/design/claude-design/sounder/invite-matchmaking.html.

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
import { PigAvatar } from "./ui/PigAvatar";
import { Glyph, type GlyphName } from "./ui/Glyph";
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

// Default portrait diameter; INDENT lines follow-up copy (the stale-invite
// note) up with the row body, past the portrait + gap.
export const PORTRAIT_SIZE = 48;
export const CREW_ROW_INDENT = PORTRAIT_SIZE + SPACE.md;

// "hand the ⟨crew⟩ to a crewmate" / "riding with the ⟨crew⟩" — dedupe the
// article when the crew is already named "The …".
export function theCrew(name: string): string {
	return /^the\s/i.test(name.trim()) ? name : `the ${name}`;
}

// ── Portrait — PigAvatar in an ink ring with the hard sticker shadow ─────────
// `glyph` swaps the pig for hand-drawn art (a crew banner row); `crowned`
// perches the crown on top (the leader row); `ghost` is the dashed empty
// ring for a pending invitee.
export function CrewPortrait({
	size = PORTRAIT_SIZE,
	hatId = null,
	glyph,
	crowned = false,
	ghost = false,
}: {
	size?: number;
	hatId?: string | null;
	glyph?: GlyphName;
	crowned?: boolean;
	ghost?: boolean;
}) {
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
			style={[styles.portrait, { width: size, height: size, borderRadius: size / 2 }]}
		>
			{glyph ? (
				<Glyph name={glyph} size={size * 0.55} />
			) : (
				<PigAvatar size={size - 5} hatId={hatId} />
			)}
			{crowned && (
				<Glyph name="crown" size={size * 0.5} style={styles.portraitCrown} />
			)}
		</View>
	);
}

// ── The row ──────────────────────────────────────────────────────────────────
export function CrewRow({
	left,
	title,
	sub,
	right,
	divider = false,
	dim = false,
	onPress,
}: {
	left: ReactNode;
	/** String or rich <Text> spans (accent names); wrapped in the name style. */
	title: ReactNode;
	sub?: string;
	right?: ReactNode;
	/** Dashed rule above — pass for every row after a section's first. */
	divider?: boolean;
	dim?: boolean;
	onPress?: () => void;
}) {
	return (
		<>
			{divider && <DashedRule />}
			<Pressable
				onPress={onPress}
				disabled={!onPress}
				style={[styles.row, dim && styles.rowDim]}
			>
				{left}
				<View style={styles.rowBody}>
					<Text style={styles.rowName} numberOfLines={2}>
						{title}
					</Text>
					{!!sub && (
						<Text style={styles.rowSub} numberOfLines={1}>
							{sub}
						</Text>
					)}
				</View>
				{right ? <View style={styles.rowRight}>{right}</View> : null}
			</Pressable>
		</>
	);
}

// Accent-colored span inside a row title ("⟨Rosie⟩ wants you in ⟨Crew⟩").
export function Accent({ children }: { children: ReactNode }) {
	return <Text style={styles.accent}>{children}</Text>;
}

// Muted "#0192" / "you" tag beside a name.
export function DiscText({ children }: { children: ReactNode }) {
	return <Text style={styles.disc}>{children}</Text>;
}

// ── The sun pill — the one button everywhere a row acts ─────────────────────
export function SunPill({
	children,
	onPress,
	disabled = false,
}: {
	children: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={6}
			style={({ pressed }) => [styles.pill, (disabled || pressed) && styles.pillDim]}
		>
			<Text style={styles.pillText} numberOfLines={1}>
				{children}
			</Text>
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
		<Text style={[styles.status, accent && styles.statusAccent]} numberOfLines={1}>
			{children}
		</Text>
	);
}

// Underlined hand-script link ("not today", "let it go", "Done").
export function HandLink({
	children,
	onPress,
	accent = false,
	underline = true,
	disabled = false,
	style,
	textStyle,
}: {
	children: string;
	onPress: () => void;
	accent?: boolean;
	underline?: boolean;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={8}
			style={({ pressed }) => [style, (disabled || pressed) && styles.linkDim]}
		>
			<Text
				style={[
					styles.link,
					!underline && styles.linkPlain,
					accent && styles.linkAccent,
					textStyle,
				]}
			>
				{children}
			</Text>
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
	return <Text style={[styles.note, style]}>{children}</Text>;
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
			<Text style={styles.kickText}>{children}</Text>
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
// Transcribed from the mockup's btnbig svg — no Icon entry exists for it.
export function FlagIcon({ size = 20, color = WHIMSY.ink }: { size?: number; color?: string }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<Path
				d="M5 21 V4"
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
			/>
			<Path
				d="M5 4 Q12 1 19 5 L16 9 L19 13 Q12 10 5 12"
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

const styles = StyleSheet.create({
	portrait: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	portraitGhost: {
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: WHIMSY.muteSoft,
	},
	portraitCrown: {
		position: "absolute",
		top: -SPACE.md,
		alignSelf: "center",
		transform: [{ rotate: "-8deg" }],
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	rowDim: { opacity: 0.55 },
	rowBody: { flex: 1, minWidth: 0 },
	// Fredoka name line over a Patrick Hand subline — the mockup's .nm/.ln pair.
	rowName: { ...TYPE.body, fontFamily: FONTS.display, color: WHIMSY.ink },
	rowSub: { ...TYPE.kicker, color: WHIMSY.mute, marginTop: 2 },
	rowRight: { alignItems: "flex-end", gap: SPACE.xs + 1 },
	accent: { color: WHIMSY.accent },
	disc: { ...TYPE.label, color: WHIMSY.muteSoft },
	pill: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xs + 2,
		...SHADOW_SM,
	},
	pillDim: { opacity: 0.6 },
	pillText: { ...TYPE.bodySm, fontFamily: FONTS.display, color: WHIMSY.ink },
	status: { ...TYPE.kicker, color: WHIMSY.muteSoft },
	statusAccent: { color: WHIMSY.accent },
	link: { ...TYPE.kicker, color: WHIMSY.mute, textDecorationLine: "underline" },
	linkPlain: { textDecorationLine: "none" },
	linkDim: { opacity: 0.6 },
	linkAccent: { color: WHIMSY.accent },
	note: { ...TYPE.kicker, color: WHIMSY.accent },
	kickRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.sm + 2,
	},
	kickText: {
		...TYPE.kicker,
		color: WHIMSY.accent,
		textTransform: "uppercase",
		letterSpacing: 1.5,
	},
	kickRule: { flex: 1 },
	dashes: {
		height: 0,
		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: WHIMSY.muteSoft,
		borderRadius: 1,
		opacity: 0.45,
	},
});
