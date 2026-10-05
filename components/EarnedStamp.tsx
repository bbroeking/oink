// The Barn's top-left corner: a rose heart stamp carrying the lifetime tickle
// total. It is the PERMANENT number — the scrapbook figure, never a live one —
// so it wears nothing transient: no ribbon, no clock, no stamp. Its partner
// across the sky is the coin (`TickleCoin`), which holds everything live.
// From the two-corner layout (E) in docs/design/claude-design/barn/coin.html.
// (2026-09-13)
import { StyleSheet, View } from "react-native";
import { Glyph, KickerPill, Sticker, T } from "./ui";
import { CHROME_TYPE_CAP, RADII, SPACE } from "@/constants/theme";
import { formatBarnTickleTotal } from "@/utils/tickleDisplay";

// The heart is art, so it takes a picture size rather than a spacing step.
const HEART = 26;
// The stamp's scrapbook lean, mirroring the coin's own (`TickleCoin`).
const STAMP_TILT = -3;

export function EarnedStamp({ total, loaded = true }: { total: number; loaded?: boolean }) {
	const value = formatBarnTickleTotal(total);
	return (
		// ONE ELEMENT. VoiceOver used to read the stamp as two fragments, "452"
		// then "TICKLED": a label on a plain View is inert on iOS. A labelled
		// Sticker is an accessibility element now, so the stamp is spoken as the
		// sentence it is. (polish 2026-10-04, B-03)
		<Sticker
			color="rose"
			rotate={STAMP_TILT}
			radius={RADII.xl}
			accessibilityRole="text"
			accessibilityLabel={loaded ? `${value} tickles earned` : "Tickles earned, still loading"}
			style={styles.stamp}
		>
			<Glyph name="heart" size={HEART} />
			<View>
				{/* The total never truncates and never shrinks-to-fit: the
				    format steps it down to "1.3M" before it could outgrow the
				    numeral role. While the bank is still loading it reads "·"
				    — the coin's placeholder — never a "0" that fills in under
				    the thumb. Chrome on the scene: it states its type ceiling. */}
				<T
					role="numeralLg"
					tone={loaded ? "primary" : "secondary"}
					numberOfLines={1}
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
				>
					{loaded ? value : "·"}
				</T>
				<KickerPill star={false} maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.cap}>
					tickled
				</KickerPill>
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	stamp: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
		paddingLeft: SPACE.md,
		paddingRight: SPACE.card,
		// The stamp is a corner object and never a column: the coin across from
		// it sets the band's height, this one hugs its own copy.
		alignSelf: "flex-start",
	},
	cap: {
		marginTop: SPACE.xxs,
	},
});
