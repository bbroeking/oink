// Season-1 value banner — the top-of-tab Hungerer card. The vignette and loop
// line answer "what is this?"; the server's six-stop ladder answers "where are
// we?" without exposing the server's raw thresholds.
//
// Tapping its header opens the full hero sheet: the big GreatHungerMeter
// vignette, the six server-stage segments, and the detailed hunger ladder.
//
// Note: GreatHungerMeter owns its own useHungerMeter() read; we read it again
// here for the strip + segments. Two calls to one cheap STABLE read — collapse
// into a shared provider if it ever grows a cost.

import { useState } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	Modal,
	ScrollView,
	StyleSheet,
} from "react-native";
import { GreatHungerMeter } from "../GreatHungerMeter";
import { Sticker } from "../ui/Sticker";
import { useUnmanagedModalHold } from "../ui/PopupQueue";
import { HAT_IMAGES } from "@/constants/hats";
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
import {
	useHungerMeter,
	stageProgress,
	formatCredit,
	HUNGER_STAGES,
	HUNGER_LEVEL_NAME,
	HUNGER_LEVEL_CREDIT_PREVIEW,
} from "@/hooks/useHungerMeter";

const CHIP = require("../../assets/images/hunger/great_hungerer_chip.png");
const GOLDEN_TRUFFLE = HAT_IMAGES.golden_truffle;
const STAGE_REWARD = 15;

// The whole game in one line — the loop the tab is organized around.
const LOOP_LINE =
	"dig at his feedings — keep the truffles, level your pass, starve him together.";

// One-to-one with hunger_meter(): the card, sheet, and server all speak the
// same six stage names and cross the same five reward thresholds.
const HERO_STAGES = [
	{ name: "Gorged", minStageIndex: 0, reward: null },
	{ name: "Stuffed", minStageIndex: 1, reward: STAGE_REWARD },
	{ name: "Full", minStageIndex: 2, reward: STAGE_REWARD },
	{ name: "Peckish", minStageIndex: 3, reward: STAGE_REWARD },
	{ name: "Hungry", minStageIndex: 4, reward: STAGE_REWARD },
	{ name: "Famished", minStageIndex: 5, reward: STAGE_REWARD },
] as const;

const DIVIDER_DASHES = Array.from({ length: 30 });
const CONNECTOR_DASHES = Array.from({ length: 5 });

function DashLine({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
	const dashes = compact ? CONNECTOR_DASHES : DIVIDER_DASHES;
	return (
		<View style={compact ? styles.connector : styles.divider} pointerEvents="none">
			{dashes.map((_, index) => (
				<View
					key={index}
					style={[
						compact ? styles.connectorDash : styles.dividerDash,
						dark && styles.dashDark,
					]}
				/>
			))}
		</View>
	);
}

export function hungerHeroStageIndex(serverStageIndex: number): number {
	let index = 0;
	for (let i = 0; i < HERO_STAGES.length; i++) {
		if (serverStageIndex >= HERO_STAGES[i].minStageIndex) index = i;
	}
	return index;
}

export function HungerHero({
	refreshKey,
	open: openProp,
	onOpenChange,
	stageIndexOverride,
}: {
	refreshKey?: number;
	// Optional controlled-open — lets another surface (the YOUR TAKE tickle
	// cell) open THIS hero's sheet instead of minting a second one. Omitted:
	// the banner owns its own open state as before (backward-compatible).
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Dev-only presentation seam; production callers omit it. */
	stageIndexOverride?: number;
}) {
	const meter = useHungerMeter(refreshKey);
	const serverStageIndex =
		__DEV__ && stageIndexOverride != null
			? stageIndexOverride
			: meter.stageIndex;
	const heroStageIndex = hungerHeroStageIndex(serverStageIndex);
	const tiersRemaining = HERO_STAGES.length - 1 - heroStageIndex;
	const [openInternal, setOpenInternal] = useState(false);
	const open = openProp ?? openInternal;
	const setOpen = (v: boolean) => {
		setOpenInternal(v);
		onOpenChange?.(v);
	};

	return (
		<>
			{/* The season at a glance: who the herd is fighting, the whole arc,
			    and exactly where he is now. The deeper art and numeric ladder stay
			    one tap away in the existing sheet. */}
			<Sticker
				color="paper"
				rotate={-0.5}
				radius={RADII.lg}
				border={3}
				style={styles.banner}
			>
				<Pressable
					onPress={() => setOpen(true)}
					accessibilityRole="button"
					accessibilityLabel="See the Hungerer and the season ladder"
					style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.85 }]}
				>
					<View style={styles.thumbWrap}>
						<Image source={CHIP} style={styles.thumb} resizeMode="contain" />
					</View>
					<View style={styles.bannerText}>
						<Text style={styles.stage}>
							The Great Hungerer — {HUNGER_LEVEL_NAME[meter.stage]}
						</Text>
						<Text style={styles.loop}>{LOOP_LINE}</Text>
					</View>
					<Text style={styles.chevron}>›</Text>
				</Pressable>

				<DashLine />

				<View
					accessible
					accessibilityLabel={`Hungerer progress: ${HERO_STAGES[heroStageIndex].name}. ${tiersRemaining} tiers remain.`}
				>
					<View style={styles.progressRow}>
						{HERO_STAGES.map((stage, index) => {
							const complete = index < heroStageIndex;
							const current = index === heroStageIndex;
							const distant = index > heroStageIndex + 1;
							return (
								<View key={stage.name} style={styles.progressCell}>
									{index < HERO_STAGES.length - 1 && (
										<DashLine compact dark={index < heroStageIndex} />
									)}
									<View
										style={[
											styles.stageNode,
											complete && styles.stageNodeComplete,
											current && styles.stageNodeCurrent,
											distant && styles.stageNodeFuture,
										]}
									>
										{complete ? (
											<Text style={styles.check}>✓</Text>
										) : index === HERO_STAGES.length - 1 ? (
											<Text style={styles.star}>★</Text>
										) : null}
									</View>
								</View>
							);
						})}
					</View>

					<View style={styles.stageLabels}>
						{HERO_STAGES.map((stage, index) => {
							const complete = index < heroStageIndex;
							const current = index === heroStageIndex;
							const next = index === heroStageIndex + 1;
							return (
								<View key={stage.name} style={styles.stageLabelCell}>
									<Text
										style={[
											styles.stageLabel,
											current && styles.stageLabelCurrent,
											complete && styles.stageLabelComplete,
										]}
										numberOfLines={2}
									>
										{stage.name}
									</Text>
									<View style={styles.stageStatus}>
										{current && <Text style={styles.here}>HE'S{"\n"}HERE</Text>}
										{next && <Text style={styles.next}>NEXT</Text>}
									</View>
									{stage.reward != null && (
										<View style={styles.stageReward}>
											<Image
												source={GOLDEN_TRUFFLE}
												style={styles.stageRewardArt}
												resizeMode="contain"
											/>
											<Text style={styles.stageRewardAmount}>{stage.reward}</Text>
										</View>
									)}
								</View>
							);
						})}
					</View>
				</View>

				<View
					style={styles.rewardPromise}
					accessible
					accessibilityLabel={`Each stage you help complete pays ${STAGE_REWARD} Golden Truffles. ${tiersRemaining} rewards remain.`}
				>
					<Image
						source={GOLDEN_TRUFFLE}
						style={styles.rewardPromiseArt}
						resizeMode="contain"
					/>
					<View style={styles.rewardPromiseCopy}>
						<Text style={styles.rewardPromiseTitle}>
							{STAGE_REWARD} Golden Truffles each stage
						</Text>
						<Text style={styles.rewardPromiseBody}>
							{tiersRemaining === 0
								? "every stage reward has fallen"
								: `dig during a stage to share its payout · ${tiersRemaining} ${tiersRemaining === 1 ? "reward" : "rewards"} ahead`}
						</Text>
					</View>
				</View>
			</Sticker>

			<HungerHeroSheet
				visible={open}
				onClose={() => setOpen(false)}
				refreshKey={refreshKey}
			/>
		</>
	);
}

// The full hero art + power segments + hunger ladder, one tap away.
function HungerHeroSheet({
	visible,
	onClose,
	refreshKey,
}: {
	visible: boolean;
	onClose: () => void;
	refreshKey?: number;
}) {
	// Unmanaged native Modal (the hero sheet, one tap off the season tab, outside
	// the popup queue): hold the queue while visible so a foreground poll can't
	// present a queued popup over it — the #50152 wedge (issue #4).
	useUnmanagedModalHold(visible);
	const meter = useHungerMeter(refreshKey);
	// Within-stage drain — the current segment fills live toward the next stage
	// (the six segments together read as one power bar for the boss).
	const pct = stageProgress(meter);

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<Sticker
					color="paper"
					rotate={-0.8}
					radius={20}
					border={3}
					style={[styles.sheet, STICKER_SHADOW]}
				>
					<Text style={styles.sheetKicker}>★ the great hunger ★</Text>

					<ScrollView
						style={styles.scroll}
						showsVerticalScrollIndicator={false}
					>
						<GreatHungerMeter refreshKey={refreshKey} />

						{/* The power we're taking back — six stage segments; crossed
						    ones are full, the current one fills as the herd drains him. */}
						<View style={styles.strip}>
							<View style={styles.segRow}>
								{HUNGER_STAGES.map((s, i) => {
									const crossed = i < meter.stageIndex;
									const current = i === meter.stageIndex;
									return (
										<View
											key={s}
											style={[styles.seg, crossed && styles.segCrossed]}
										>
											{current && (
												<View
													style={[
														styles.segFill,
														{ width: `${Math.round(pct * 100)}%` },
													]}
												/>
											)}
										</View>
									);
								})}
							</View>
							<Text style={styles.everyWar}>
								Every truffle the herd digs back weakens him — dig at his
								feedings and the whole valley pries its joy loose.
							</Text>
						</View>

						{/* The ladder — Gorged → Famished, counted in tickles reclaimed.
						    Mirrors SeasonGuideModal's ladder: named levels + obfuscated
						    credit numbers, the current level lit. */}
						<Text style={styles.ladderKicker}>★ steal back the tickles ★</Text>
						{HUNGER_STAGES.map((stage, i) => {
							const here = meter.available && meter.stageIndex === i;
							return (
								<View
									key={stage}
									style={[styles.ladderRow, here && styles.ladderRowHere]}
								>
									<Text style={[styles.ladderName, here && styles.ladderHereText]}>
										{HUNGER_LEVEL_NAME[stage]}
										{here ? " — he is here" : ""}
									</Text>
									<View style={styles.ladderMeta}>
										<Text style={[styles.ladderCredit, here && styles.ladderHereText]}>
											{formatCredit(HUNGER_LEVEL_CREDIT_PREVIEW[i])}
										</Text>
										{i > 0 && (
											<View style={styles.ladderReward}>
												<Image
													source={GOLDEN_TRUFFLE}
													style={styles.ladderRewardArt}
													resizeMode="contain"
												/>
												<Text style={styles.ladderRewardAmount}>+{STAGE_REWARD}</Text>
											</View>
										)}
									</View>
								</View>
							);
						})}
						<Text style={styles.ladderFoot}>
							He ate the valley's tickles. Every dig and blessing pries them
							back — starve him from Gorged to Famished.
						</Text>
						<Text style={styles.ladderPromise}>
							starve him to Famished and every digger with ten finds takes
							his crown.
						</Text>
					</ScrollView>

					<Pressable
						onPress={onClose}
						style={({ pressed }) => [
							styles.closeBtn,
							pressed && { opacity: 0.85 },
						]}
						accessibilityRole="button"
						accessibilityLabel="Close"
					>
						<Text style={styles.closeText}>close</Text>
					</Pressable>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	banner: {
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.md,
		paddingBottom: SPACE.lg,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	thumbWrap: {
		width: 62,
		height: 62,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	thumb: { width: 56, height: 56 },
	bannerText: { flex: 1, minWidth: 0 },
	stage: {
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	loop: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginTop: 1,
	},
	chevron: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.mute,
		marginLeft: SPACE.xs,
	},
	divider: {
		flexDirection: "row",
		gap: 3,
		height: 2,
		marginTop: SPACE.md,
		marginBottom: SPACE.md,
	},
	dividerDash: {
		flex: 1,
		height: 2,
		backgroundColor: WHIMSY.muteSoft,
	},
	progressRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	progressCell: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	stageNode: {
		width: 34,
		height: 34,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
		zIndex: 1,
	},
	stageNodeComplete: { backgroundColor: WHIMSY.sage },
	stageNodeCurrent: { backgroundColor: WHIMSY.sun, borderWidth: 3 },
	stageNodeFuture: {
		borderColor: WHIMSY.mute,
		borderStyle: "dashed",
	},
	connector: {
		position: "absolute",
		left: "50%",
		width: "100%",
		top: 16,
		height: 2,
		flexDirection: "row",
		gap: 3,
		paddingHorizontal: 10,
	},
	connectorDash: {
		flex: 1,
		height: 2,
		backgroundColor: WHIMSY.muteSoft,
	},
	dashDark: { backgroundColor: WHIMSY.ink },
	check: {
		fontFamily: FONTS.bodyBlack,
		fontSize: 18,
		lineHeight: 20,
		color: WHIMSY.ink,
	},
	star: {
		fontFamily: FONTS.bodyBlack,
		fontSize: 14,
		lineHeight: 16,
		color: WHIMSY.ink,
	},
	stageLabels: {
		flexDirection: "row",
		marginTop: SPACE.xs,
	},
	stageLabelCell: { flex: 1, alignItems: "center", minHeight: 72 },
	stageLabel: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	stageLabelComplete: { color: WHIMSY.mute },
	stageLabelCurrent: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyBlack,
		color: WHIMSY.ink,
	},
	stageStatus: {
		height: 27,
		alignItems: "center",
		justifyContent: "flex-start",
	},
	here: {
		...TYPE.label,
		fontSize: 11,
		lineHeight: 13,
		letterSpacing: 1.2,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 1,
	},
	next: {
		...TYPE.label,
		fontSize: 11,
		lineHeight: 13,
		letterSpacing: 1.2,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	stageReward: {
		minWidth: 39,
		height: 22,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream2,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 1,
		paddingHorizontal: 3,
		marginTop: 2,
	},
	stageRewardArt: { width: 15, height: 15 },
	stageRewardAmount: {
		...TYPE.label,
		fontFamily: FONTS.bodyBlack,
		fontSize: 11,
		lineHeight: 12,
		color: WHIMSY.ink,
	},
	rewardPromise: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sun,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginTop: SPACE.sm,
	},
	rewardPromiseArt: { width: 34, height: 34 },
	rewardPromiseCopy: { flex: 1, minWidth: 0 },
	rewardPromiseTitle: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyBlack,
		color: WHIMSY.ink,
	},
	rewardPromiseBody: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
	},

	// The sheet.
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	sheet: {
		width: "100%",
		maxWidth: 400,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	sheetKicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: SPACE.md },
	scroll: { maxHeight: 460, marginBottom: SPACE.md },

	// Power segments (moved from the old inline strip).
	strip: { marginTop: SPACE.sm },
	segRow: { flexDirection: "row", gap: 5 },
	seg: {
		flex: 1,
		height: 12,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	segCrossed: { backgroundColor: WHIMSY.sun },
	// in-progress fill = the SAME sun as a crossed segment, faded — one hue,
	// two states (audit: peach-vs-sun read as two competing golds).
	segFill: { height: "100%", backgroundColor: WHIMSY.sun, opacity: 0.55 },
	everyWar: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
	},

	// The hunger ladder (mirrors SeasonGuideModal).
	ladderKicker: {
		...KICKER_TEXT,
		textAlign: "center",
		marginTop: SPACE.md,
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
	ladderName: {
		flex: 1,
		...TYPE.label,
		color: WHIMSY.ink,
	},
	ladderMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	ladderCredit: { ...TYPE.hand, fontFamily: FONTS.whimsy, lineHeight: undefined, color: WHIMSY.mute },
	ladderReward: {
		flexDirection: "row",
		alignItems: "center",
		gap: 1,
		minWidth: 42,
	},
	ladderRewardArt: { width: 17, height: 17 },
	ladderRewardAmount: {
		...TYPE.label,
		fontFamily: FONTS.bodyBlack,
		color: WHIMSY.ink,
	},
	ladderHereText: { color: WHIMSY.ink },
	ladderFoot: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	// The finale promise — the crown you take when he's Famished. Accent so the
	// payoff reads warmer than the mute foot line above it.
	ladderPromise: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},

	closeBtn: {
		alignSelf: "center",
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.lg,
	},
	closeText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});
