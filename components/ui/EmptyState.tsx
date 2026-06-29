// Cozy empty + loading states — the one true treatment for "there's nothing
// here yet" and "we're fetching." Replaces bare gray <Text>"Nothing here."</Text>
// and naked <ActivityIndicator/> across the app. Consolidates the paper-Sticker
// empty card first invented in Leaderboard and the "★ saddling up ★" loading
// beat from the tab layout. See docs/design/taste-standard.md (rule 4).
import React from "react";
import {
	View,
	Text,
	ActivityIndicator,
	StyleProp,
	ViewStyle,
} from "react-native";
import { Sticker } from "./Sticker";
import { Glyph, GlyphName } from "./Glyph";
import { WHIMSY, KICKER_TEXT, SPACE, TYPE } from "@/constants/theme";

// A paper Sticker with an optional hand-drawn Glyph, a whimsy title line, and an
// optional softer sub line. Pick a glyph that fits the surface (zzz for a slept
// shop, trophy for achievements, friends for an empty Sounder) — the contextual
// art is the cozy, intentional touch a bare string can't carry.
export function EmptyState({
	glyph,
	title,
	sub,
	color = "paper",
	rotate = -0.6,
	style,
}: {
	glyph?: GlyphName;
	title: string;
	sub?: string;
	color?: string;
	rotate?: number;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[{ paddingHorizontal: 14, paddingTop: 12 }, style]}>
			<Sticker color={color} rotate={rotate} radius={12} style={styles.card}>
				{glyph && (
					<Glyph name={glyph} size={40} style={{ marginBottom: 10, opacity: 0.9 }} />
				)}
				<Text style={styles.title}>{title}</Text>
				{!!sub && <Text style={styles.sub}>{sub}</Text>}
			</Sticker>
		</View>
	);
}

// The "★ saddling up ★" loading beat: a kicker line over a spinner, with an
// optional Glyph above. Inline variant sized for list bodies and sheet content;
// the full-screen splash continuation lives in (tabs)/_layout.
export function LoadingBeat({
	label = "loading",
	glyph,
	style,
}: {
	label?: string;
	glyph?: GlyphName;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.beat, style]}>
			{glyph && <Glyph name={glyph} size={32} style={{ opacity: 0.85 }} />}
			<Text style={[KICKER_TEXT, { fontSize: 13 }]}>★ {label} ★</Text>
			<ActivityIndicator color={WHIMSY.ink} />
		</View>
	);
}

const styles = {
	card: {
		paddingHorizontal: 18,
		paddingVertical: 20,
		alignItems: "center" as const,
	},
	title: {
		...TYPE.cardTitle,
		color: WHIMSY.ink,
		textAlign: "center" as const,
	},
	sub: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center" as const,
		marginTop: 4,
	},
	beat: {
		alignItems: "center" as const,
		justifyContent: "center" as const,
		paddingVertical: 28,
		gap: SPACE.sm + 2,
	},
};
