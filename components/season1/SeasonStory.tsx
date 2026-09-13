// "What's happening this season" — a four-beat storybook strip that explains
// Season 1 in the game's own words: the theft, the Sounders, the dig,
// and starving the Hungerer off. Static copy, zero jargon, no numbers — the
// mechanics live on the season tab; this is the campfire version. (No dates:
// S1 deliberately has no Judgement-Day countdown.)

import { View, StyleSheet } from "react-native";
import { Body, Glyph, Kicker, Sticker, type GlyphName } from "@/components/ui";
import { CREW_CAP_WORD } from "@/constants/crews";
import { ART_SIZE, RADII, ROW_TILTS, SPACE } from "@/constants/theme";

const BEATS: { g: GlyphName; kicker: string; line: string }[] = [
	{
		g: "ghost",
		kicker: "the theft",
		line: "The Great Hungerer crept in one night and ate the valley's tickles — every last one.",
	},
	{
		g: "friends",
		kicker: "the sounders",
		line: `So pigs band into Sounders — ${CREW_CAP_WORD.toLowerCase()} snouts, one banner — because no pig shoos a hog alone.`,
	},
	{
		g: "gem",
		kicker: "the dig",
		line: "He gorges in 8-hour feedings — for the first four hours the patch lies open to sneaky snouts, then he guards it while he digests.",
	},
	{
		g: "crown",
		kicker: "the last feast",
		line: "Every truffle pried back leaves him a little weaker — until the whole herd starves him and takes the valley home.",
	},
];

export function SeasonStory() {
	return (
		<View style={styles.wrap}>
			{BEATS.map((b, i) => (
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
