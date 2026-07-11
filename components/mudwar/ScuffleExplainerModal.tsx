// "How the scuffle works ›" — the plain-words explainer the war page links to,
// where the jargon (areas, notches, the rope) is spelled out below the fold so
// the first screenful can stay WHO / WHERE THE ROPE IS / WHAT TO DO NOW. Modeled
// on SeasonGuideModal; a few cozy lines, no mechanics dump.

import { useRef } from "react";
import { Modal, View, Text, ScrollView, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { scoringRules } from "./warCopy";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

// `frontsOnly` points describe the legacy fronts/rhythm layer (areas, notches,
// Hold runs). Season 1 wars are plain totals (2026-07-06 decision), so these
// render only for a legacy fronts war; a plain dig-off reads the base points.
const POINTS: { g: GlyphName; title: string; line: string; frontsOnly?: boolean }[] = [
	{
		g: "friends",
		title: "You vs the other Sounder",
		line: "Two crews, one rope. Every scoop counts once — whoever scoops more joy pulls the rope their way.",
	},
	{
		g: "sparkle",
		title: "Digging is the game",
		line: "Every 8 hours the Hungerer gorges and a patch opens. Dig it — the joy you scoop pulls your side of the rope.",
	},
	{
		g: "flame",
		title: "Holding the line",
		line: "Later in a scuffle the horde marches. On those days you take short holding runs to defend your ground.",
		frontsOnly: true,
	},
	{
		g: "trophy",
		title: "Areas & notches",
		line: "Some scuffles split the bog into areas worth notches. Hold the richer areas and the rope leans harder your way — but a plain dig-off counts too.",
		frontsOnly: true,
	},
	{
		g: "handshake",
		title: "Every pig counts",
		line: "Scores are per pig, so a small crew that all show up can out-scuffle a big quiet one. Two of you have to dig for it to count.",
	},
];

export function ScuffleExplainerModal({
	visible,
	onClose,
	/** Open scrolled to the "How points are scored" section (from the scoreboard). */
	focusScoring = false,
	/** Legacy fronts war — surfaces the areas/notches/Hold copy. Plain S1 wars omit it. */
	frontsEnabled = false,
}: {
	visible: boolean;
	onClose: () => void;
	focusScoring?: boolean;
	frontsEnabled?: boolean;
}) {
	const points = frontsEnabled ? POINTS : POINTS.filter((p) => !p.frontsOnly);
	const scrollRef = useRef<ScrollView>(null);
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<Sticker color="paper" rotate={-0.4} radius={RADII.xxl} style={styles.card}>
					<Text style={styles.kicker}>the mud scuffle</Text>
					<Text style={styles.title}>How the scuffle works</Text>
					<ScrollView
						ref={scrollRef}
						style={styles.body}
						contentContainerStyle={{ gap: SPACE.md }}
					>
						{points.map((p) => (
							<View key={p.title} style={styles.point}>
								<Glyph name={p.g} size={22} />
								<View style={{ flex: 1 }}>
									<Text style={styles.pointTitle}>{p.title}</Text>
									<Text style={styles.pointLine}>{p.line}</Text>
								</View>
							</View>
						))}

						{/* How points are scored — the transparency section the scoreboard's
						    "how the scoring works ›" link jumps to. */}
						<View
							onLayout={(e) => {
								if (focusScoring && visible) {
									scrollRef.current?.scrollTo({
										y: Math.max(0, e.nativeEvent.layout.y - 8),
										animated: true,
									});
								}
							}}
						>
							<View style={styles.rule} />
							<Text style={styles.scoringHead}>How points are scored</Text>
							<View style={{ gap: SPACE.md }}>
								{scoringRules(frontsEnabled).map((r) => (
									<View key={r.title} style={styles.point}>
										<Glyph name="scales" size={22} />
										<View style={{ flex: 1 }}>
											<Text style={styles.pointTitle}>{r.title}</Text>
											<Text style={styles.pointLine}>{r.line}</Text>
										</View>
									</View>
								))}
							</View>
						</View>
					</ScrollView>
					<Button variant="primary" full onPress={onClose} style={{ marginTop: SPACE.md }}>
						Got it
					</Button>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		padding: SPACE.lg,
	},
	card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg, maxHeight: "80%" },
	kicker: { ...KICKER_TEXT, marginBottom: 2 },
	title: { ...TYPE.sectionTitle, color: WHIMSY.ink, marginBottom: SPACE.md },
	body: { flexGrow: 0 },
	point: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
	pointTitle: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	pointLine: { ...TYPE.bodySm, fontFamily: FONTS.body, color: WHIMSY.mute, marginTop: 2 },
	rule: {
		height: 2,
		backgroundColor: WHIMSY.cream2,
		borderRadius: 1,
		marginTop: SPACE.xs,
		marginBottom: SPACE.md,
	},
	scoringHead: { ...TYPE.sectionTitle, color: WHIMSY.ink, marginBottom: SPACE.md },
});
