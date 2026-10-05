// A single progression readout — a Caprasimo numeral over a tracked pill label
// ("1,250 / snouts", "12 / day streak"). Canvas section 09.
//
// **Feelings are sprites, progression is numerals** (taste standard, spec §4).
// Rosie's mood, a herd's warmth, how loved a pig is — those are drawn, never
// counted. Only progression systems (snouts, finds, streak, XP, tiers, prices)
// may wear a number, and when they do they wear this. If you are reaching for
// `Stat` to display a feeling, the answer is a sprite or a Glyph instead.
//
// `flame` is the streak's fiery treatment (decision log, 2026-08-28) and `gold`
// is the blessing/bless hue — two sanctioned exceptions to the ink numeral, not
// a free colour axis.
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { CHROME_TYPE_CAP, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { Glyph, type GlyphName } from "./Glyph";
import { T } from "./Text";

type StatSize = "md" | "lg";
// `onDark` for a readout on bark/stage (the Mote console). (2026-09-11)
type StatTone = "primary" | "flame" | "gold" | "onDark";

const TONE_COLOR: Record<StatTone, string> = {
	primary: UI_COLORS.textPrimary,
	flame: WHIMSY.flame,
	gold: WHIMSY.bless,
	onDark: UI_COLORS.textOnDark,
};

const SIZE_ROLE = { md: "numeral", lg: "numeralLg" } as const;

interface Props {
	/** The number itself. Pre-formatted by the caller (grouping, abbreviation). */
	value: string | number;
	/** What the number counts. Rendered as the tracked pill caption. */
	label: string;
	size?: StatSize;
	tone?: StatTone;
	/** Optional subject glyph, sitting to the left of the numeral. */
	glyph?: GlyphName;
	/** Container style override. */
	style?: StyleProp<ViewStyle>;
	/**
	 * A Dynamic Type ceiling for the numeral, for a readout in a fixed-width
	 * band (the passport's three columns, ~94pt of text on an SE). Undefined by
	 * default: spec §1.2's 200 % still rules. The caption is capped regardless
	 * (see below), and at this value when it is the lower one. (2026-10-04)
	 */
	maxFontSizeMultiplier?: number;
}

// The caption is compact chrome: a 10pt tracked-caps word under a numeral, in
// a band of two or three columns. Its tracking makes its words the first to
// outgrow a column, and a word never breaks mid-word, so it states its ceiling
// (taste standard 2026-10-04): at accessibility-large "LIFETIME" measured
// ~123pt against the passport column's 103pt and broke as "LIFETIM / E"
// (after/107); at the cap it is ~75pt, inside the SE's ~94pt.
const CAPTION_TYPE_CAP = CHROME_TYPE_CAP;

export function Stat({
	value,
	label,
	size = "md",
	tone = "primary",
	glyph,
	style,
	maxFontSizeMultiplier,
}: Props) {
	const role = SIZE_ROLE[size];
	// React Native reads a multiplier below 1 as "no cap", and so does this.
	const captionCap =
		maxFontSizeMultiplier !== undefined && maxFontSizeMultiplier >= 1
			? Math.min(maxFontSizeMultiplier, CAPTION_TYPE_CAP)
			: CAPTION_TYPE_CAP;
	return (
		<View
			style={[styles.wrap, style]}
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${value} ${label}`}
		>
			<View style={styles.row}>
				{glyph ? <Glyph name={glyph} size={TYPE[role].fontSize} /> : null}
				<T
					role={role}
					maxFontSizeMultiplier={maxFontSizeMultiplier}
					style={{ color: TONE_COLOR[tone] }}
				>
					{value}
				</T>
			</View>
			<T
				role="kickerPillSm"
				tone={tone === "onDark" ? "onDarkMute" : "secondary"}
				align="center"
				maxFontSizeMultiplier={captionCap}
			>
				{label}
			</T>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		gap: SPACE.xxs,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
});
