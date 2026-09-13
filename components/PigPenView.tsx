import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { PigPortrait } from "./ui/PigPortrait";
import { Glyph, type GlyphName } from "./ui/Glyph";
import {
	Body,
	BodySm,
	Button,
	CardTitle,
	ConfirmDialog,
	EmptyState,
	Hand,
	LoadingBeat,
	SectionHeader,
	SectionTitle,
	Sticker,
	T,
	Tag,
	Tape,
} from "./ui";
import { showPurchaseToast } from "./PurchaseToast";
import {
	PAGE_PAD,
	BORDER,
	PIG_ACCENT,
	RADII,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { pigRosterActionMessage, type PigRoster } from "@/utils/pigRoster";
import { PIGS, pigDefinition, type PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

interface Props {
	roster: PigRoster;
	loading: boolean;
	/**
	 * The roster read never came back. The Pen keeps its scene but must not draw
	 * a shelf of "Recruit" buttons off a roster it doesn't have — a failed read
	 * used to arrive as DEFAULT_PIG_ROSTER and quietly un-recruit a member's
	 * companion. `null` is unknown, not empty. [B-02, B-14] (2026-09-11, wave 4)
	 */
	error?: boolean;
	/** Re-asks for the roster from the error state (`usePigRoster().refresh`). */
	onRetry?: () => void;
	busyPigId: PigId | null;
	onJoinSlopClub: (pigId: PigId) => Promise<void>;
	onRecruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	onActivate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

const FRIENDS = PIGS.filter((pig) => pig.id !== "rosie");

// ── Drawing constants ───────────────────────────────────────────────────────
// The Pen is a drawn scene — a fenced paddock with two pigs in it — so its
// geometry is art, not spacing. Named here so no style block carries a bare
// number. (2026-09-11)
/** The paddock and the pigs standing in it. */
const HERO_H = 260;
const HERO_PIG = 148;
/** The fence: overall height, the lower rail's drop, and one post. */
const FENCE_H = 74;
const FENCE_RAIL_DROP = 42;
const FENCE_POST_H = 70;
/** A roster card's art window and the portrait inside it. */
const CARD_ART_H = 120;
const CARD_PIG = 116;
/** The motif badge in the art window's corner. */
const MOTIF_BADGE = 28;
const MOTIF_MARK = 18;
/** The pig's nameplate — wide enough for the longest name. */
const NAMEPLATE_MIN_W = 104;
/** Two lines of coat description, so the grid's cards stay the same height. */
const COAT_LINES_H = 38;
/** A "put at home" choice card — a 44pt tap with its own breathing room. */
const HOME_CHOICE_H = 52;
/** The alternating scrapbook lean across the two grid columns. */
const CARD_TILT = 0.5;
/** The widest a centred paragraph gets before it stops being readable. */
const STORY_MAX_W = 330;

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
	error = false,
	onRetry,
	busyPigId,
	onJoinSlopClub,
	onRecruit,
	onActivate,
}: Props) {
	const [previewPigId, setPreviewPigId] = useState<PigId>(
		roster.recruitedPigId ?? "bandit"
	);
	const [joining, setJoining] = useState(false);
	// The companion choice is permanent, so it's a decision — a ConfirmDialog,
	// never a system Alert. Holds the pig awaiting confirmation.
	const [pendingRecruitId, setPendingRecruitId] = useState<PigId | null>(null);

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
		Haptics.selectionAsync().catch(() => {});
		const result =
			action === "recruit" ? await onRecruit(pigId) : await onActivate(pigId);
		// The outcome used to land as a bare centred sentence at the bottom of a
		// long scroll, often off-screen from the control that caused it. The rest
		// of the Shop reports outcomes as toasts. [D-16] (2026-09-11)
		showPurchaseToast({
			type: result.ok ? "success" : "fail",
			title: pigRosterActionMessage(result),
		});
		if (result.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		}
	};

	const recruit = (pigId: PigId) => {
		if (roster.recruitedPigId) return;
		setPendingRecruitId(pigId);
	};

	const pendingRecruitPig = pendingRecruitId
		? pigDefinition(pendingRecruitId)
		: null;

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

			<Sticker
				color="sky"
				rotate={0}
				style={styles.hero}
				accessibilityRole="image"
				accessibilityLabel={
					recruitedPig
						? `Rosie and ${recruitedPig.name} in the Pen`
						: `Rosie in the Pen, previewing ${previewPig.name}`
				}
			>
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
						<PigPortrait pigId="rosie" size={HERO_PIG} />
					</View>
					<View style={styles.heroPig}>
						<PigPortrait pigId={heroFriend.id} size={HERO_PIG} />
					</View>
				</View>
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.sm}
					shadow="sm"
					border={BORDER.thin}
					style={styles.heroNote}
				>
					<Hand>
						{recruitedPig
							? `${recruitedPig.name} lives here with Rosie`
							: `previewing ${previewPig.name}`}
					</Hand>
				</Sticker>
			</Sticker>

			{roster.isMember ? (
				<Sticker color="paper" rotate={0} style={styles.memberStory}>
					<SectionTitle align="center">
						{recruitedPig ? `${recruitedPig.name} joined the Pen.` : "Choose Rosie’s friend."}
					</SectionTitle>
					<Body tone="secondary" align="center" style={styles.storyBody}>
						{recruitedPig
							? "Choose who greets you at home. Your other pig will stay cozy in the Pen."
							: "Your Slop Club membership includes one companion. Choose carefully—your pick is locked for now."}
					</Body>
					{recruitedPig ? (
						<View style={styles.homeChoices}>
							{(["rosie", recruitedPig.id] as PigId[]).map((pigId) => {
								const pig = pigDefinition(pigId);
								const active = roster.activePigId === pigId;
								// The pig already at home is a STATUS, not a control: it
								// keeps the sage fill and the heavy selected outline and
								// announces as text. Only the other card is tappable, so
								// "selected" never has to be drawn as "asleep".
								return active ? (
									<Sticker
										key={pigId}
										color="sage"
										rotate={0}
										radius={RADII.md}
										shadow="sm"
										border={BORDER.heavy}
										accessibilityRole="text"
										accessibilityLabel={`${pig.name} is at home`}
										style={styles.homeChoice}
									>
										<CardTitle>{pig.name}</CardTitle>
										<Hand tone="secondary">At home</Hand>
									</Sticker>
								) : (
									<Sticker
										key={pigId}
										color="cream"
										rotate={0}
										radius={RADII.md}
										shadow="none"
										disabled={busyPigId != null}
										onPress={() => void runAction(pigId, "activate")}
										accessibilityLabel={`Put ${pig.name} at home`}
										accessibilityHint={`Makes ${pig.name} the pig who greets you at home`}
										style={styles.homeChoice}
									>
										<CardTitle>{pig.name}</CardTitle>
										<Hand tone="secondary">Put at home</Hand>
									</Sticker>
								);
							})}
						</View>
					) : null}
				</Sticker>
			) : (
				<View style={styles.joinStory}>
					<SectionTitle align="center">Rosie has room for a friend.</SectionTitle>
					<Body tone="secondary" align="center" style={styles.storyBody}>
						Slop Club members choose one long-term companion. This choice cannot be changed right now.
					</Body>
					<Button
						variant="gold"
						size="md"
						full
						onPress={() => void join()}
						loading={joining}
						accessibilityLabel={`Join Slop Club and recruit ${previewPig.name}`}
						accessibilityHint="Opens the Slop Club purchase, then puts this pig in the Pen"
						style={styles.joinButton}
					>
						Join Slop Club — recruit {previewPig.name}
					</Button>
					<Hand tone="secondary" style={styles.slotNote}>
						one companion · one long-term choice
					</Hand>
				</View>
			)}

			<View style={styles.rosterHeader}>
				<SectionTitle align="center">Meet Rosie’s friends</SectionTitle>
				{!error && (
					<BodySm tone="secondary" align="center" style={styles.rosterHint}>
						{roster.isMember
							? roster.recruitedPigId
								? "Your companion choice is locked for now."
								: "Choose carefully. You can recruit only one."
							: "Tap a pig to preview them with Rosie."}
					</BodySm>
				)}
			</View>

			{/* A failed roster read replaces the shelf rather than decorating it:
			    the grid's owned / recruitable / locked states are exactly what we
			    don't know, and a permanent choice must never be offered off a
			    guess. [B-02] */}
			{error && (
				<EmptyState
					kind="error"
					title="Couldn't round up your pigs"
					sub="They're out in the field somewhere. Give it another go."
					action={
						onRetry ? (
							<Button
								variant="ghost"
								size="sm"
								onPress={onRetry}
								accessibilityLabel="Try again"
								accessibilityHint="Asks for your pigs again"
							>
								Try again
							</Button>
						) : undefined
					}
				/>
			)}

			{!error && (
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
					const actionDisabled =
						recruited ||
						replacing ||
						busyPigId != null ||
						(!pig.recruitable && !pig.owned);

					return (
						<Sticker
							key={pig.id}
							color={recruited ? "sage" : previewing ? "rose" : "paper"}
							rotate={index % 2 === 0 ? -CARD_TILT : CARD_TILT}
							radius={RADII.md}
							shadow="sm"
							onPress={() => setPreviewPigId(pig.id)}
							accessibilityLabel={`Preview ${pig.name}, ${pig.coat}`}
							accessibilityHint="Shows this pig beside Rosie in the Pen above"
							accessibilityState={{ selected: previewing }}
							style={styles.pigCard}
						>
							<Tape color="sun" rotate={0} style={styles.tape} />
							<View
								style={[
									styles.pigArt,
									{ backgroundColor: PIG_ACCENT[pig.id].tint },
								]}
							>
								<View style={styles.motif}>
									<Glyph name={motifGlyph(pig.motif)} size={MOTIF_MARK} />
								</View>
								<PigPortrait pigId={pig.id} size={CARD_PIG} />
							</View>
							<View style={[styles.nameplate, { backgroundColor: pig.accent }]}>
								<T role="handDisplay">{pig.name}</T>
							</View>
							<Hand tone="secondary" align="center" style={styles.pigCoat}>
								{pig.coat}
							</Hand>
							{roster.isMember ? (
								recruited ? (
									// A recruited pig's line is a state readout, not a
									// control — a disabled button would say "tap me later",
									// and there is no later. [D-12]
									<Tag
										tone="sage"
										icon="check"
										label={actionLabel}
										style={styles.cardState}
									/>
								) : (
									<Button
										variant="lilac"
										size="sm"
										full
										disabled={actionDisabled}
										loading={busyPigId === pig.id}
										onPress={() => recruit(pig.id)}
										accessibilityLabel={`${actionLabel} ${pig.name}`}
										accessibilityHint={
											actionDisabled
												? "Your companion choice is already made"
												: `Asks you to confirm ${pig.name} as Rosie's one companion`
										}
									>
										{actionLabel}
									</Button>
								)
							) : (
								<Hand tone="secondary" align="center" style={styles.previewLabel}>
									{previewing ? "Previewing with Rosie" : "Tap to preview"}
								</Hand>
							)}
						</Sticker>
					);
				})}
			</View>
			)}

			{loading && busyPigId == null ? (
				<LoadingBeat label="gathering the pigs" />
			) : null}

			<ConfirmDialog
				open={pendingRecruitPig != null}
				title={`Choose ${pendingRecruitPig?.name ?? "this pig"} as Rosie’s friend?`}
				body="This is your one long-term companion choice. You can’t change it right now."
				confirmLabel={`Choose ${pendingRecruitPig?.name ?? "pig"}`}
				confirmHint="Puts this pig in the Pen for good — the choice can't be changed right now"
				cancelLabel="Keep looking"
				cancelHint="Closes this without choosing"
				destructive={false}
				onCancel={() => setPendingRecruitId(null)}
				onConfirm={() => {
					const pigId = pendingRecruitId;
					setPendingRecruitId(null);
					if (pigId) void runAction(pigId, "recruit");
				}}
			/>
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
		height: HERO_H,
		marginTop: SPACE.md,
		overflow: "hidden",
	},
	sky: {
		...StyleSheet.absoluteFill,
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
		height: FENCE_H,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	fenceRail: {
		position: "absolute",
		left: 0,
		right: 0,
		height: SPACE.sm,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream2,
	},
	fenceRailTop: { top: SPACE.md },
	fenceRailBottom: { top: FENCE_RAIL_DROP },
	fencePost: {
		width: SPACE.md,
		height: FENCE_POST_H,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
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
	},
	joinStory: {
		alignItems: "center",
		marginTop: SPACE.xl,
	},
	memberStory: {
		alignItems: "center",
		marginTop: SPACE.xl,
		padding: SPACE.lg,
	},
	storyBody: {
		maxWidth: STORY_MAX_W,
		marginTop: SPACE.sm,
	},
	joinButton: {
		marginTop: SPACE.md,
	},
	slotNote: {
		marginTop: SPACE.sm,
	},
	homeChoices: {
		width: "100%",
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	homeChoice: {
		flex: 1,
		minHeight: HOME_CHOICE_H,
		alignItems: "center",
		justifyContent: "center",
	},
	rosterHeader: {
		alignItems: "center",
		marginTop: SPACE.xl,
		marginBottom: SPACE.md,
	},
	rosterHint: {
		marginTop: SPACE.xs,
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
	},
	tape: {
		position: "absolute",
		top: -SPACE.sm,
		zIndex: 3,
	},
	pigArt: {
		width: "100%",
		height: CARD_ART_H,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: RADII.sm,
	},
	motif: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		width: MOTIF_BADGE,
		height: MOTIF_BADGE,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		zIndex: 2,
	},
	nameplate: {
		minWidth: NAMEPLATE_MIN_W,
		alignItems: "center",
		marginTop: -SPACE.xs,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
	},
	pigCoat: {
		minHeight: COAT_LINES_H,
		marginTop: SPACE.xs,
	},
	previewLabel: {
		minHeight: TAP_MIN,
		paddingTop: SPACE.md,
	},
	cardState: { alignSelf: "stretch", marginTop: SPACE.xs },
});
