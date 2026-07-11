// Season 1 guide — "how the season works" in five steps + the Hunger level
// ladder. Pops on EVERY Season-tab visit for now (see season.tsx's
// GUIDE_EVERY_VISIT) so the flow can be tested repeatedly; before public S1
// it flips to a once-per-user AsyncStorage stamp like the intro storybook.
//
// The ladder shows named LEVELS with big hunger-credit numbers — the
// obfuscation layer from hooks/useHungerMeter: display numbers are the raw
// server totals × HUNGER_CREDIT_SCALE, so the real (tiny, tunable)
// thresholds never show and can be retuned mid-season.

import { useState } from "react";
import {
	Modal,
	View,
	Text,
	TextInput,
	Pressable,
	ScrollView,
	StyleSheet,
	Alert,
} from "react-native";
import { Sticker } from "../ui/Sticker";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { CREW_CAP_WORD } from "@/constants/crews";
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
		line: `${CREW_CAP_WORD} snouts, one banner. Slip into an open Sounder or tap a + slot to rally friends — the dig needs a herd.`,
	},
	{
		g: "gem",
		title: "Dig every feeding",
		line: "Every 8 hours the Hungerer gorges — dig the Truffle Patch open through his first four hours, then he guards it the next four while he digests. Every truffle is yours to keep.",
	},
	{
		g: "trophy",
		title: "Earn herd milestones",
		line: "Your Sounder's finds add up for good. Cross a milestone and every member earns a title and a snout purse.",
	},
	{
		g: "star",
		title: "Race the week",
		line: "Every find counts forever on the season board. Each week the best diggers take spoils — the standings settle every Monday.",
	},
	{
		g: "ogre",
		title: "Starve the Hungerer",
		line: "Every truffle the herd digs back drains him, level by level, until the whole valley starves him and takes its joy home.",
	},
];

export function SeasonGuideModal({
	visible,
	onDismiss,
	onLeave,
	onRename,
	crewName,
}: {
	visible: boolean;
	onDismiss: () => void;
	/** When set (caller is in a Sounder), a quiet leave action shows in the
	    footer with a two-tap Alert confirm. */
	onLeave?: () => void;
	/** When set (caller LEADS the Sounder), a quiet rename affordance shows in
	    the footer. Resolves { ok } so we can hold the row open on failure. */
	onRename?: (name: string) => Promise<{ ok: boolean }>;
	/** Current Sounder name — prefills the rename input. */
	crewName?: string;
}) {
	const meter = useHungerMeter();

	// Inline rename row (leader only) — collapsed until the link is tapped.
	const [renaming, setRenaming] = useState(false);
	const [renameText, setRenameText] = useState(crewName ?? "");
	const [renameBusy, setRenameBusy] = useState(false);
	const [renameNote, setRenameNote] = useState<string | null>(null);

	const openRename = () => {
		setRenameText(crewName ?? "");
		setRenameNote(null);
		setRenaming(true);
	};

	const saveRename = async () => {
		const trimmed = renameText.trim();
		if (!trimmed || renameBusy || !onRename) return;
		setRenameBusy(true);
		setRenameNote(null);
		const r = await onRename(trimmed);
		setRenameBusy(false);
		if (r.ok) {
			setRenaming(false);
		} else {
			setRenameNote("that name didn't stick — try another, short and snappy");
		}
	};

	const confirmLeave = () => {
		Alert.alert(
			"Leave your Sounder?",
			"You'll stop digging with this herd. You can join another any time.",
			[
				{ text: "Stay", style: "cancel" },
				{
					text: "Leave",
					style: "destructive",
					onPress: () => {
						onLeave?.();
						onDismiss();
					},
				},
			]
		);
	};

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
						To the patch
					</Button>
					{onRename &&
						(renaming ? (
							<View style={styles.renameRow}>
								<TextInput
									value={renameText}
									onChangeText={setRenameText}
									maxLength={24}
									placeholder="name your Sounder"
									placeholderTextColor={WHIMSY.muteSoft}
									style={styles.renameInput}
									returnKeyType="done"
									onSubmitEditing={saveRename}
									autoFocus
								/>
								<Button
									size="sm"
									variant="primary"
									onPress={saveRename}
									disabled={renameBusy || !renameText.trim()}
								>
									{renameBusy ? "…" : "Save"}
								</Button>
							</View>
						) : (
							<Pressable onPress={openRename} hitSlop={8} style={styles.renameLinkRow}>
								<Text style={styles.renameLink}>rename your Sounder ›</Text>
							</Pressable>
						))}
					{onRename && renaming && !!renameNote && (
						<Text style={styles.renameNote}>{renameNote}</Text>
					)}
					{onLeave && (
						<Pressable onPress={confirmLeave} hitSlop={8} style={styles.leaveRow}>
							<Text style={styles.leaveLink}>leave your Sounder ›</Text>
						</Pressable>
					)}
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
	scroll: { maxHeight: 420, marginTop: SPACE.xs, marginBottom: SPACE.md },
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
	leaveRow: { alignSelf: "center", marginTop: SPACE.sm, paddingVertical: 4 },
	leaveLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	// Leader-only rename affordance — the collapsed link matches leaveLink;
	// the expanded row pairs a name field with a small Save button.
	renameLinkRow: { alignSelf: "center", marginTop: SPACE.sm, paddingVertical: 4 },
	renameLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	renameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
	},
	renameInput: {
		flex: 1,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: SPACE.md,
		paddingVertical: 8,
		fontFamily: FONTS.body,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	renameNote: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
});
