// Cozy empty + loading states — the one true treatment for "there's nothing
// here yet", "we're fetching", and "that didn't load." Replaces bare gray
// <Text>"Nothing here."</Text> and naked <ActivityIndicator/> across the app.
// Consolidates the paper-Sticker empty card first invented in Leaderboard and
// the "★ saddling up ★" loading beat from the tab layout.
// See docs/design/taste-standard.md (rule 4).
import React from "react";
import {
	Image,
	View,
	type ImageSourcePropType,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { WaitingRosie } from "./WaitingRosie";
import { Sticker } from "./Sticker";
import { Glyph, GlyphName } from "./Glyph";
import { CardTitle, Hand, T } from "./Text";
import { PAGE_PAD, RADII, SPACE, TILT } from "@/constants/theme";

// An empty shelf and a failed fetch are the same shape with a different mood,
// so they're one component: `error` swaps the paper for rose, the contextual
// glyph for the dizzy pig, and supplies its own title.
export type EmptyStateKind = "empty" | "error";

const ERROR_DEFAULTS = {
	color: "rose",
	glyph: "dizzy" as GlyphName,
	title: "Couldn't load that",
};

// The empty-state glyph reads as art, not as an icon — bigger than any Icon
// size and not a spacing step, so it gets its own name.
const GLYPH_SIZE = 40;

// A paper Sticker with an optional hand-drawn Glyph, a whimsy title line, an
// optional softer sub line, and an optional action (usually a `retry` Button).
// Pick a glyph that fits the surface (zzz for a slept shop, trophy for
// achievements, friends for an empty Sounder) — the contextual art is the cozy,
// intentional touch a bare string can't carry.
export function EmptyState({
	glyph,
	art,
	title,
	sub,
	kind = "empty",
	action,
	color,
	rotate = TILT.card,
	accessibilityRole,
	accessibilityLabel,
	style,
}: {
	glyph?: GlyphName;
	/** Product art instead of a glyph (a cabinet, a hat) — same box. (2026-09-11) */
	art?: ImageSourcePropType;
	title?: string;
	sub?: string;
	kind?: EmptyStateKind;
	/** Rendered under the sub line — a retry Button, a "go shopping" link. */
	action?: React.ReactNode;
	color?: string;
	rotate?: number;
	/** Defaults to "alert" for `kind="error"` so the failure is announced. */
	accessibilityRole?: "alert" | "summary" | "text";
	accessibilityLabel?: string;
	style?: StyleProp<ViewStyle>;
}) {
	const isError = kind === "error";
	const resolvedColor = color ?? (isError ? ERROR_DEFAULTS.color : "paper");
	const resolvedGlyph = glyph ?? (isError ? ERROR_DEFAULTS.glyph : undefined);
	const resolvedTitle = title ?? (isError ? ERROR_DEFAULTS.title : undefined);

	return (
		<View
			style={[styles.wrap, style]}
			accessibilityRole={accessibilityRole ?? (isError ? "alert" : undefined)}
			accessibilityLabel={accessibilityLabel}
		>
			<Sticker
				color={resolvedColor}
				rotate={rotate}
				radius={RADII.md}
				style={styles.card}
			>
				{art ? (
					<Image
						source={art}
						style={[styles.glyph, { width: GLYPH_SIZE, height: GLYPH_SIZE }]}
						resizeMode="contain"
						accessible={false}
					/>
				) : resolvedGlyph ? (
					<Glyph
						name={resolvedGlyph}
						size={GLYPH_SIZE}
						style={styles.glyph}
					/>
				) : null}
				{!!resolvedTitle && <CardTitle align="center">{resolvedTitle}</CardTitle>}
				{!!sub && (
					<Hand tone="secondary" align="center" style={styles.sub}>
						{sub}
					</Hand>
				)}
				{!!action && <View style={styles.action}>{action}</View>}
			</Sticker>
		</View>
	);
}

// Compact Rosie waiting treatment. Text is available immediately and the
// owner unmounts this region as soon as data is ready, independent of playback.
// `label` is REQUIRED: a progressbar whose name is "loading" tells a screen
// reader nothing about what is loading.
export function LoadingBeat({
	label,
	style,
}: {
	label: string;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.beat, style]} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
			<WaitingRosie />
			<T role="kicker" tone="accent">★ {label} ★</T>
		</View>
	);
}

const styles = {
	wrap: {
		paddingHorizontal: SPACE.card,
		paddingTop: SPACE.md,
	},
	card: {
		paddingHorizontal: PAGE_PAD,
		paddingVertical: SPACE.xl,
		alignItems: "center" as const,
	},
	glyph: {
		marginBottom: SPACE.sm,
	},
	sub: {
		marginTop: SPACE.xs,
	},
	action: {
		marginTop: SPACE.md,
	},
	beat: {
		alignItems: "center" as const,
		justifyContent: "center" as const,
		paddingVertical: SPACE.xxl,
		gap: SPACE.sm,
	},
};
