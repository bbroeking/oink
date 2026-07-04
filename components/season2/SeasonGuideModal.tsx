// Season 2 guide — "how the season works" in five steps + the Hunger level
// ladder. Pops on EVERY Season-tab visit for now (see season.tsx's
// GUIDE_EVERY_VISIT) so the flow can be tested repeatedly; before public S2
// it flips to a once-per-user AsyncStorage stamp like the intro storybook.
//
// The ladder shows named LEVELS with big hunger-credit numbers — the
// obfuscation layer from hooks/useHungerMeter: display numbers are the raw
// server totals × HUNGER_CREDIT_SCALE, so the real (tiny, tunable)
// thresholds never show and can be retuned mid-season.

import {
	Modal,
	View,
	Text,
	Pressable,
	ScrollView,
	StyleSheet,
} from "react-native";
import { Sticker } from "../ui/Sticker";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { Button } from "../ui/Button";
import {
	useHungerMeter,
	HUNGER_STAGES,
	HUNGER_LEVEL_NAME,
	HUNGER_LEVEL_CREDIT_PREVIEW,
	formatCredit,
} from "@/hooks/useHungerMeter";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

const STEPS: { g: GlyphName; title: string; line: string }[] = [
	{
		g: "friends",
		title: "Join a Sounder",
		line: "Five snouts, one banner. Slip into an open Sounder or tap a + slot to rally friends.",
	},
	{
		g: "gem",
		title: "Dig the Truffle Patch",
		line: "Every 8 hours the Hungerer gorges — dig while he's distracted. Golden Truffles buy scuffle exclusives.",
	},
	{
		g: "flame",
		title: "Scuffle rival Sounders",
		line: "Scuffles are dig-offs — out-dig the rival Sounder across the feedings. Wins pay tickles for what YOU dug.",
	},
	{
		g: "heart",
		title: "Tend your herd",
		line: "Bless your crewmates. Three voices in half an hour raise the Chorus — the whole Sounder glows.",
	},
	{
		g: "ogre",
		title: "Starve the Hungerer",
		line: "Everything the barnyard does drains him, level by level, until the herd drives him from the bog.",
	},
];

export function SeasonGuideModal({
	visible,
	onDismiss,
}: {
	visible: boolean;
	onDismiss: () => void;
}) {
	const meter = useHungerMeter();

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
			<View style={styles.backdrop}>
				<Sticker
					color="paper"
					rotate={-0.8}
					radius={20}
					border={3}
					style={[styles.card, STICKER_SHADOW]}
				>
					<Text style={styles.kicker}>★ the season, in five steps ★</Text>
					<Text style={styles.headline}>The Season of the Hunger</Text>

					<ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
						{STEPS.map((s, i) => (
							<View key={s.title} style={styles.stepRow}>
								<View style={styles.stepGlyph}>
									<Glyph name={s.g} size={22} />
								</View>
								<View style={styles.stepText}>
									<Text style={styles.stepTitle}>
										{i + 1}. {s.title}
									</Text>
									<Text style={styles.stepLine}>{s.line}</Text>
								</View>
							</View>
						))}

						{/* The ladder — gorged → famished, counted in tickles
						    reclaimed. He ate the valley's tickles; the barnyard
						    steals every last one back. */}
						<Text style={styles.ladderKicker}>★ steal back the tickles ★</Text>
						{HUNGER_STAGES.map((stage, i) => {
							const here = meter.available && meter.stageIndex === i;
							return (
								<View key={stage} style={[styles.ladderRow, here && styles.ladderRowHere]}>
									<Text style={[styles.ladderName, here && styles.ladderHereText]}>
										{HUNGER_LEVEL_NAME[stage]}
										{here ? " — he is here" : ""}
									</Text>
									<Text style={[styles.ladderCredit, here && styles.ladderHereText]}>
										{formatCredit(HUNGER_LEVEL_CREDIT_PREVIEW[i])}
									</Text>
								</View>
							);
						})}
						<Text style={styles.ladderFoot}>
							He ate the valley's tickles. Every dig and blessing pries
							them back — starve him from Gorged to Famished.
						</Text>
					</ScrollView>

					<Button size="md" variant="primary" full onPress={onDismiss}>
						To the bog
					</Button>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 400,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.md,
	},
	scroll: { maxHeight: 420, marginBottom: SPACE.md },
	stepRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	stepGlyph: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	stepText: { flex: 1, minWidth: 0 },
	stepTitle: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 14.5,
		color: WHIMSY.ink,
		marginBottom: 1,
	},
	stepLine: { ...TYPE.bodySm, fontFamily: FONTS.body, color: WHIMSY.mute },
	ladderKicker: {
		...KICKER_TEXT,
		textAlign: "center",
		marginTop: SPACE.sm,
		marginBottom: SPACE.sm,
	},
	ladderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.cream2,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: 6,
		marginBottom: 5,
	},
	ladderRowHere: {
		borderColor: WHIMSY.ink,
		borderWidth: 2,
		backgroundColor: WHIMSY.sun,
	},
	ladderLevel: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.mute,
		width: 38,
	},
	ladderName: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 13.5, color: WHIMSY.ink },
	ladderCredit: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.mute },
	ladderHereText: { color: WHIMSY.ink },
	ladderFoot: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
});
