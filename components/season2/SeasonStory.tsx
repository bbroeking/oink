// "What's happening this season" — a four-beat storybook strip that explains
// Season 2 in the game's own words: the theft, the Sounders, the fight-back,
// and driving the Hungerer off. Static copy, zero jargon, no numbers — the
// mechanics live on the war screen; this is the campfire version. (No dates:
// S2 deliberately has no Judgement-Day countdown.)

import { View, Text, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { FONTS, ROW_TILTS, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const BEATS: { g: GlyphName; kicker: string; line: string }[] = [
	{
		g: "ghost",
		kicker: "the theft",
		line: "The Great Hungerer crept in one night and ate the valley's tickles — every last one.",
	},
	{
		g: "friends",
		kicker: "the sounders",
		line: "So pigs band into Sounders — five snouts, one banner — because no pig shoos a hog alone.",
	},
	{
		g: "flame",
		kicker: "the fight",
		line: "Sounders wage Mud Wars over his feeding grounds, and dig truffles back while he gorges.",
	},
	{
		g: "crown",
		kicker: "the last feast",
		line: "Every truffle pried back leaves him a little weaker — until the whole herd drives him from the bog.",
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
					radius={14}
					style={styles.card}
				>
					<Glyph name={b.g} size={26} />
					<View style={styles.textCol}>
						<Text style={styles.kicker}>{"★ "}{b.kicker}</Text>
						<Text style={styles.line}>{b.line}</Text>
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
	kicker: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginBottom: 2,
	},
	line: {
		...TYPE.body,
		fontFamily: FONTS.body,
		color: WHIMSY.ink,
	},
});
