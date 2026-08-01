import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { PigPortrait } from "./ui/PigPortrait";
import { Glyph, type GlyphName } from "./ui/Glyph";
import { SectionHeader } from "./ui";
import {
	PAGE_PAD,
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TAB_SAFE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import { pigRosterActionMessage, type PigRoster } from "@/utils/pigRoster";
import { PIGS, pigDefinition, type PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

interface Props {
	roster: PigRoster;
	loading: boolean;
	busyPigId: PigId | null;
	onJoinSlopClub: (pigId: PigId) => Promise<void>;
	onRecruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	onActivate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

const FRIENDS = PIGS.filter((pig) => pig.id !== "rosie");

function motifGlyph(motif: (typeof PIGS)[number]["motif"]): GlyphName {
	if (motif === "mask") return "mask";
	if (motif === "heart") return "heart";
	if (motif === "spark") return "sparkle";
	if (motif === "leaf" || motif === "wheat") return "sun";
	return "pigface";
}

export function PigPenView({
	roster,
	loading,
	busyPigId,
	onJoinSlopClub,
	onRecruit,
	onActivate,
}: Props) {
	const [previewPigId, setPreviewPigId] = useState<PigId>(
		roster.recruitedPigId ?? "bandit"
	);
	const [message, setMessage] = useState<string | null>(null);
	const [joining, setJoining] = useState(false);

	useEffect(() => {
		if (roster.recruitedPigId) setPreviewPigId(roster.recruitedPigId);
	}, [roster.recruitedPigId]);

	const previewPig = pigDefinition(previewPigId);
	const recruitedPig = roster.recruitedPigId
		? pigDefinition(roster.recruitedPigId)
		: null;
	const heroFriend = recruitedPig ?? previewPig;

	const friendRoster = useMemo(
		() =>
			FRIENDS.map((definition) => {
				const state = roster.pigs.find((pig) => pig.id === definition.id);
				return {
					...definition,
					owned: state?.owned ?? false,
					recruitable: state?.recruitable ?? false,
				};
			}),
		[roster.pigs]
	);

	const runAction = async (pigId: PigId, action: "recruit" | "activate") => {
		setMessage(null);
		Haptics.selectionAsync().catch(() => {});
		const result =
			action === "recruit" ? await onRecruit(pigId) : await onActivate(pigId);
		setMessage(pigRosterActionMessage(result));
		if (result.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		}
	};

	const recruit = (pigId: PigId) => {
		if (roster.recruitedPigId) return;
		const pig = pigDefinition(pigId);
		Alert.alert(
			`Choose ${pig.name} as Rosie’s friend?`,
			"This is your one long-term companion choice. You can’t change it right now.",
			[
				{ text: "Keep looking", style: "cancel" },
				{
					text: `Choose ${pig.name}`,
					onPress: () => void runAction(pigId, "recruit"),
				},
			],
		);
	};

	const join = async () => {
		if (joining) return;
		setJoining(true);
		Haptics.selectionAsync().catch(() => {});
		try {
			await onJoinSlopClub(previewPigId);
		} finally {
			setJoining(false);
		}
	};

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<SectionHeader kicker="rosie’s place" title="The Pen" ruleWidth={92} />

			<View style={styles.hero}>
				<View style={styles.sky} />
				<View style={styles.grass} />
				<View style={styles.fence} pointerEvents="none">
					<View style={[styles.fenceRail, styles.fenceRailTop]} />
					<View style={[styles.fenceRail, styles.fenceRailBottom]} />
					{[0, 1, 2, 3].map((post) => (
						<View key={post} style={styles.fencePost} />
					))}
				</View>
				<View style={styles.heroPigs}>
					<View style={styles.heroPig}>
						<PigPortrait
							pigId="rosie"
							size={148}
						/>
					</View>
					<View style={styles.heroPig}>
						<PigPortrait
							pigId={heroFriend.id}
							size={148}
						/>
					</View>
				</View>
				<View style={styles.heroNote}>
					<Text style={styles.heroNoteText}>
						{recruitedPig
							? `${recruitedPig.name} lives here with Rosie`
							: `previewing ${previewPig.name}`}
					</Text>
				</View>
			</View>

			{roster.isMember ? (
				<View style={styles.memberStory}>
					<Text style={styles.storyTitle}>
						{recruitedPig ? `${recruitedPig.name} joined the Pen.` : "Choose Rosie’s friend."}
					</Text>
					<Text style={styles.storyBody}>
						{recruitedPig
							? "Choose who greets you at home. Your other pig will stay cozy in the Pen."
							: "Your Slop Club membership includes one companion. Choose carefully—your pick is locked for now."}
					</Text>
					{recruitedPig ? (
						<View style={styles.homeChoices}>
							{(["rosie", recruitedPig.id] as PigId[]).map((pigId) => {
								const pig = pigDefinition(pigId);
								const active = roster.activePigId === pigId;
								return (
									<Pressable
										key={pigId}
										disabled={active || busyPigId != null}
										onPress={() => void runAction(pigId, "activate")}
										style={({ pressed }) => [
											styles.homeChoice,
											active && styles.homeChoiceActive,
											pressed && styles.pressed,
										]}
										accessibilityRole="button"
										accessibilityLabel={
											active ? `${pig.name} is at home` : `Put ${pig.name} at home`
										}
									>
										<Text style={styles.homeChoiceName}>{pig.name}</Text>
										<Text style={styles.homeChoiceState}>
											{active ? "At home" : "Put at home"}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : null}
				</View>
			) : (
				<View style={styles.joinStory}>
					<Text style={styles.storyTitle}>Rosie has room for a friend.</Text>
					<Text style={styles.storyBody}>
						Slop Club members choose one long-term companion. This choice cannot be changed right now.
					</Text>
					<Pressable
						onPress={() => void join()}
						disabled={joining}
						style={({ pressed }) => [
							styles.joinButton,
							pressed && styles.pressed,
							joining && styles.disabled,
						]}
						accessibilityRole="button"
						accessibilityLabel={`Join Slop Club and recruit ${previewPig.name}`}
					>
						{joining ? (
							<ActivityIndicator size="small" color={WHIMSY.ink} />
						) : (
							<Text style={styles.joinButtonText}>
								Join Slop Club — recruit {previewPig.name}
							</Text>
						)}
					</Pressable>
					<Text style={styles.slotNote}>one companion · one long-term choice</Text>
				</View>
			)}

			<View style={styles.rosterHeader}>
				<Text style={styles.rosterTitle}>Meet Rosie’s friends</Text>
				<Text style={styles.rosterHint}>
					{roster.isMember
						? roster.recruitedPigId
							? "Your companion choice is locked for now."
							: "Choose carefully. You can recruit only one."
						: "Tap a pig to preview them with Rosie."}
				</Text>
			</View>

			<View style={styles.grid}>
				{friendRoster.map((pig, index) => {
					const previewing = pig.id === previewPigId;
					const recruited = pig.id === roster.recruitedPigId;
					const replacing = !!roster.recruitedPigId && !recruited;
					const actionLabel = recruited
						? roster.activePigId === pig.id
							? "At home"
							: "In your Pen"
						: replacing
							? "Choice locked"
							: "Recruit";

					return (
						<Pressable
							key={pig.id}
							onPress={() => setPreviewPigId(pig.id)}
							style={({ pressed }) => [
								styles.pigCard,
								{ transform: [{ rotate: index % 2 === 0 ? "-0.5deg" : "0.5deg" }] },
								previewing && styles.pigCardPreviewing,
								recruited && styles.pigCardRecruited,
								pressed && styles.pressed,
							]}
							accessibilityRole="button"
							accessibilityLabel={`Preview ${pig.name}, ${pig.coat}`}
						>
							<View style={styles.tape} />
							<View style={[styles.pigArt, { backgroundColor: `${pig.accent}33` }]}>
								<View style={styles.motif}>
									<Glyph name={motifGlyph(pig.motif)} size={18} />
								</View>
								<PigPortrait
									pigId={pig.id}
									size={116}
								/>
							</View>
							<View style={[styles.ribbon, { backgroundColor: pig.accent }]}>
								<Text style={styles.pigName}>{pig.name}</Text>
							</View>
							<Text style={styles.pigCoat}>{pig.coat}</Text>
							{roster.isMember ? (
								<Pressable
									disabled={
										recruited ||
										replacing ||
										busyPigId != null ||
										(!pig.recruitable && !pig.owned)
									}
									onPress={() => recruit(pig.id)}
									style={({ pressed }) => [
										styles.cardAction,
										recruited && styles.cardActionOwned,
										(recruited ||
											replacing ||
											busyPigId != null ||
											(!pig.recruitable && !pig.owned)) &&
											styles.disabled,
										pressed && styles.pressed,
									]}
									accessibilityRole="button"
									accessibilityLabel={`${actionLabel} ${pig.name}`}
								>
									{busyPigId === pig.id ? (
										<ActivityIndicator size="small" color={WHIMSY.ink} />
									) : (
										<Text style={styles.cardActionText}>{actionLabel}</Text>
									)}
								</Pressable>
							) : (
								<Text style={styles.previewLabel}>
									{previewing ? "Previewing with Rosie" : "Tap to preview"}
								</Text>
							)}
						</Pressable>
					);
				})}
			</View>

			{loading && busyPigId == null ? (
				<ActivityIndicator size="small" color={WHIMSY.ink} />
			) : null}
			{message ? <Text style={styles.message}>{message}</Text> : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.lg,
		paddingBottom: TAB_SAFE,
	},
	hero: {
		height: 260,
		marginTop: SPACE.md,
		overflow: "hidden",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.sky,
		...STICKER_SHADOW,
	},
	sky: {
		...StyleSheet.absoluteFillObject,
		bottom: "34%",
		backgroundColor: WHIMSY.sky,
	},
	grass: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: "38%",
		backgroundColor: WHIMSY.sage,
	},
	fence: {
		position: "absolute",
		left: SPACE.sm,
		right: SPACE.sm,
		bottom: SPACE.xl,
		height: 74,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	fenceRail: {
		position: "absolute",
		left: 0,
		right: 0,
		height: SPACE.sm,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
	},
	fenceRailTop: { top: SPACE.md },
	fenceRailBottom: { top: 42 },
	fencePost: {
		width: SPACE.md,
		height: 70,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
	},
	heroPigs: {
		position: "absolute",
		left: SPACE.sm,
		right: SPACE.sm,
		bottom: SPACE.xs,
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
	},
	heroPig: { width: "47%", alignItems: "center" },
	heroNote: {
		position: "absolute",
		alignSelf: "center",
		bottom: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	heroNoteText: { ...TYPE.kicker, color: WHIMSY.ink },
	joinStory: {
		alignItems: "center",
		marginTop: SPACE.xl,
	},
	memberStory: {
		alignItems: "center",
		marginTop: SPACE.xl,
		padding: SPACE.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.paper,
	},
	storyTitle: {
		...TYPE.sectionTitle,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	storyBody: {
		...TYPE.body,
		maxWidth: 330,
		marginTop: SPACE.sm,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	joinButton: {
		width: "100%",
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
		marginTop: SPACE.md,
		paddingHorizontal: SPACE.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		backgroundColor: WHIMSY.slopGold,
		...SHADOW_SM,
	},
	joinButtonText: {
		...TYPE.label,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	slotNote: {
		...TYPE.kicker,
		marginTop: SPACE.sm,
		color: WHIMSY.mute,
	},
	homeChoices: {
		width: "100%",
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	homeChoice: {
		flex: 1,
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
	},
	homeChoiceActive: { backgroundColor: WHIMSY.sage, ...SHADOW_SM },
	homeChoiceName: { ...TYPE.cardTitle, color: WHIMSY.ink },
	homeChoiceState: { ...TYPE.kicker, color: WHIMSY.mute },
	rosterHeader: {
		alignItems: "center",
		marginTop: SPACE.xl,
		marginBottom: SPACE.md,
	},
	rosterTitle: {
		...TYPE.sectionTitle,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	rosterHint: {
		...TYPE.bodySm,
		marginTop: SPACE.xs,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.md,
		paddingBottom: SPACE.sm,
	},
	pigCard: {
		width: "48%",
		alignItems: "center",
		padding: SPACE.sm,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	pigCardPreviewing: { backgroundColor: WHIMSY.rose },
	pigCardRecruited: { backgroundColor: WHIMSY.sage },
	tape: {
		position: "absolute",
		top: -SPACE.sm,
		width: 48,
		height: SPACE.lg,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		opacity: 0.82,
		zIndex: 3,
	},
	pigArt: {
		width: "100%",
		height: 120,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: RADII.sm,
	},
	motif: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		zIndex: 2,
	},
	ribbon: {
		minWidth: 104,
		alignItems: "center",
		marginTop: -SPACE.xs,
		paddingHorizontal: SPACE.md,
		paddingVertical: 2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
	},
	pigName: {
		fontFamily: FONTS.hand,
		fontSize: 26,
		lineHeight: 29,
		color: WHIMSY.ink,
	},
	pigCoat: {
		...TYPE.kicker,
		minHeight: 38,
		marginTop: SPACE.xs,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	cardAction: {
		width: "100%",
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.xs,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.lilac,
	},
	cardActionOwned: { backgroundColor: WHIMSY.sage },
	cardActionText: { ...TYPE.label, color: WHIMSY.ink, textAlign: "center" },
	previewLabel: {
		...TYPE.kicker,
		minHeight: 44,
		paddingTop: SPACE.md,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	message: {
		...TYPE.bodySm,
		marginTop: SPACE.md,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
	disabled: { opacity: 0.5 },
});
