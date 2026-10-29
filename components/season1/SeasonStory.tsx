// "What's happening this season" — a four-beat storybook strip that explains
// the season in the game's own words (Season 1: the theft, the Sounders, the
// dig, and starving the Hungerer off; Season 2: the lean year ending, the long
// table, the Larder, the Feast). Static copy, zero jargon, no numbers — the
// mechanics live on the season tab; this is the campfire version. (No dates:
// S1 deliberately has no Judgement-Day countdown.)

import { View, StyleSheet } from "react-native";
import { Body, Glyph, Kicker, Sticker } from "@/components/ui";
import { ART_SIZE, RADII, ROW_TILTS, SPACE } from "@/constants/theme";
import { seasonTheme, type SeasonTheme } from "@/utils/seasonTheme";

// The beats are the season's own (utils/seasonTheme.ts); with no theme the
// strip tells Season 1's story, as it always did.
export function SeasonStory({ theme = seasonTheme("snout_season_1") }: { theme?: SeasonTheme } = {}) {
	return (
		<View style={styles.wrap}>
			{theme.story.map((b, i) => (
				<Sticker
					key={b.kicker}
					color={i % 2 === 0 ? "paper" : "cream"}
					rotate={ROW_TILTS[i % ROW_TILTS.length]}
					radius={RADII.lg}
					style={styles.card}
				>
					<Glyph name={b.g} size={ART_SIZE.glyphSm} />
					<View style={styles.textCol}>
						<Kicker style={styles.kicker}>{b.kicker}</Kicker>
						<Body>{b.line}</Body>
					</View>
				</Sticker>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.sm },
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
	},
	textCol: { flex: 1, minWidth: 0 },
	kicker: { marginBottom: SPACE.xxs },
});
