// The generic round frame — an ink-outlined pastel disc that clips whatever it
// is given: a pig portrait image, a subject Glyph, or arbitrary children. Spec
// §2 row 06; `ListRow` uses it as its leading slot.
//
// This is deliberately NOT `PigAvatar`. PigAvatar knows about pigs, cosmetics
// and anchors; this knows about a circle with a 2px ink border. Keeping them
// apart is what lets a friend row, an inbox event and a crew member all wear the
// same frame without dragging the pig renderer in behind them.
//
// The diameter is one of three tokenized steps (`AVATAR_SIZE`) rather than a
// free number, so a wall of avatars lines up instead of drifting 38 / 40 / 42.
import React, { type ReactNode } from "react";
import {
	Image,
	View,
	StyleSheet,
	type ImageSourcePropType,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	AVATAR_GLYPH_FRAC,
	AVATAR_SIZE,
	BORDER,
	RADII,
	UI_COLORS,
	WHIMSY,
	type AvatarSize,
} from "@/constants/theme";
import { Glyph, type GlyphName } from "./Glyph";

/** The pastel fills an avatar frame may wear — the Sticker fill vocabulary. */
export type AvatarFill =
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
	// The blessing / curse surface pair. Not part of the twelve-fill Sticker
	// vocabulary — they are the effect domain's own surfaces — but an avatar is
	// exactly where a blessing has to read apart from a curse before its glyph
	// is parsed. [A-11, C-11] (2026-09-11)
	| "blessSurface"
	| "curseSurface";

interface Props {
	size?: AvatarSize;
	fill?: AvatarFill;
	/** Arbitrary content, clipped to the circle. Lowest precedence. */
	children?: ReactNode;
	/** A subject glyph, centred. Used when no `source` is given. */
	glyph?: GlyphName;
	/** A portrait image, filling the circle. Highest precedence. */
	source?: ImageSourcePropType;
	/** What this avatar depicts — required; an unlabelled face is unreadable. */
	label: string;
	/** Style override. */
	style?: StyleProp<ViewStyle>;
}

export function Avatar({
	size = AVATAR_SIZE[1],
	fill = "rose",
	children,
	glyph,
	source,
	label,
	style,
}: Props) {
	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={label}
			style={[
				styles.frame,
				{
					width: size,
					height: size,
					backgroundColor: WHIMSY[fill],
				},
				style,
			]}
		>
			{source ? (
				<Image source={source} style={styles.image} resizeMode="cover" />
			) : glyph ? (
				<Glyph name={glyph} size={Math.round(size * AVATAR_GLYPH_FRAC)} />
			) : (
				children
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	frame: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	image: {
		width: "100%",
		height: "100%",
	},
});
