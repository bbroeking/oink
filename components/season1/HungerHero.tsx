// Season-1 value banner — the top-of-tab Hungerer card. The vignette and loop
// line answer "what is this?"; the server's six-stop ladder answers "where are
// we?" without exposing the server's raw thresholds.
//
// Tapping its header opens the full hero sheet: the big GreatHungerMeter
// vignette, the Great Hunger meter (one `ProgressTrack` over the six server
// stages, named in words rather than in a percentage), and the detailed
// hunger ladder.
//
// Note: GreatHungerMeter owns its own useHungerMeter() read; we read it again
// here for the strip + segments. Two calls to one cheap STABLE read — collapse
// into a shared provider if it ever grows a cost.

import { useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import {
	AdaptiveModalScaffold,
	Button,
	CardTitle,
	DialogCloseRow,
	Hand,
	Icon,
	Kicker,
	Label,
	ListRow,
	ProgressTrack,
	Sticker,
	T,
	useUnmanagedModalHold,
} from "@/components/ui";
import { GreatHungerMeter } from "../GreatHungerMeter";
import { HAT_IMAGES } from "@/constants/hats";
import {
	ART_SIZE,
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY, TYPE } from "@/constants/theme";
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

// Drawing geometry for the banner's hand-composed ladder. These are the
// proportions of one picture — a 62pt art well, a 34pt stage stone, the dashed
// rule that threads them — not steps on the spacing scale.
const THUMB_WELL = 62;
const THUMB_ART = 56;
const DASH_H = 2;
const DASH_GAP = 3;
const NODE = 34;
// The connector rides the stones' vertical centre and stops short of each one.
const CONNECTOR_TOP = (NODE - DASH_H) / 2;
const CONNECTOR_INSET = 10;
// The per-stage status line reserves two capped lines so the labels stay level.
// Two lines of the kickerPill role ("he's / here"); a minHeight so a larger
// font-scale setting grows the cell instead of clipping the second line.
const STATUS_H = TYPE.kickerPill.lineHeight * 2;
// The reward pill under a stage, and the truffle arts at their three sizes.
const REWARD_PILL_W = 39;
const REWARD_PILL_H = 22;
const REWARD_PILL_ART = 15;
const LADDER_ART = 17;
const PROMISE_ART = 34;
const CHECK_MARK = 18;

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
	hero = false,
}: {
	refreshKey?: number;
	// Optional controlled-open — lets another surface (the YOUR TAKE tickle
	// cell) open THIS hero's sheet instead of minting a second one. Omitted:
	// the banner owns its own open state as before (backward-compatible).
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Dev-only presentation seam; production callers omit it. */
	stageIndexOverride?: number;
	/**
	 * The one-hero rule (C-26). This banner is CONTEXT, not an action — it only
	 * becomes the tab's loud surface when `season.tsx`'s single `primaryAction`
	 * derivation lands on "browse": nothing to dig, nothing to claim, a herd
	 * already found. Then the reward promise wears the full sun. Every other
	 * state it keeps the band, the art and the words on `cream2` and lets the
	 * actionable card do the shouting. The band's ink edge is drawn either way,
	 * so quieting it never dissolves the shape.
	 */
	hero?: boolean;
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
				border={BORDER.heavy}
				style={styles.banner}
			>
				<Pressable
					onPress={() => setOpen(true)}
					accessibilityRole="button"
					accessibilityLabel="See the Hungerer and the season ladder"
					accessibilityHint="Opens the Great Hungerer sheet"
					style={({ pressed }) => [styles.headerRow, pressed && PRESSED_FLAT]}
				>
					<View style={styles.thumbWrap}>
						<Image source={CHIP} style={styles.thumb} resizeMode="contain" />
					</View>
					<View style={styles.bannerText}>
						<CardTitle>
							The Great Hungerer — {HUNGER_LEVEL_NAME[meter.stage]}
						</CardTitle>
						<Kicker star={false} style={styles.loop}>
							{LOOP_LINE}
						</Kicker>
					</View>
					<Icon
						name="chevronRight"
						size={ART_SIZE.glyphSm}
						color={UI_COLORS.textSecondary}
					/>
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
											<Icon
												name="check"
												size={CHECK_MARK}
												color={UI_COLORS.textPrimary}
												strokeWidth={3}
											/>
										) : index === HERO_STAGES.length - 1 ? (
											<Label>★</Label>
										) : null}
									</View>
								</View>
							);
						})}
					</View>

					<View style={styles.stageLabels}>
						{HERO_STAGES.map((stage, index) => {
							const current = index === heroStageIndex;
							const next = index === heroStageIndex + 1;
							return (
								<View key={stage.name} style={styles.stageLabelCell}>
									<T
										role={current ? "bodySm" : "kicker"}
										tone={current ? "primary" : "secondary"}
										align="center"
										numberOfLines={2}
									>
										{stage.name}
									</T>
									<View style={styles.stageStatus}>
										{current && (
											<T role="kickerPill" tone="accent" align="center">
												{"he's\nhere"}
											</T>
										)}
										{next && (
											<T role="kickerPill" tone="secondary">
												next
											</T>
										)}
									</View>
									{stage.reward != null && (
										<View style={styles.stageReward}>
											<Image
												source={GOLDEN_TRUFFLE}
												style={styles.stageRewardArt}
												resizeMode="contain"
											/>
											<Label>{stage.reward}</Label>
										</View>
									)}
								</View>
							);
						})}
					</View>
				</View>

				<View
					style={[styles.rewardPromise, hero && styles.rewardPromiseHero]}
					accessible
					accessibilityLabel={`Each stage you help complete pays ${STAGE_REWARD} Golden Truffles. ${tiersRemaining} rewards remain.`}
				>
					<Image
						source={GOLDEN_TRUFFLE}
						style={styles.rewardPromiseArt}
						resizeMode="contain"
					/>
					<View style={styles.rewardPromiseCopy}>
						<Label>{STAGE_REWARD} Golden Truffles each stage</Label>
						<Kicker star={false} tone="primary">
							{tiersRemaining === 0
								? "every stage reward has fallen"
								: `dig during a stage to share its payout · ${tiersRemaining} ${tiersRemaining === 1 ? "reward" : "rewards"} ahead`}
						</Kicker>
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

// The full hero art + the Great Hunger meter + the hunger ladder, one tap away.
function HungerHeroSheet({
	visible,
	onClose,
	refreshKey,
}: {
	visible: boolean;
	onClose: () => void;
	refreshKey?: number;
}) {
	// The hero sheet sits one tap off the season tab and outside the popup queue:
	// hold the queue while visible so a foreground poll can't present a queued
	// popup over it — the #50152 wedge (issue #4).
	useUnmanagedModalHold(visible);
	const meter = useHungerMeter(refreshKey);
	// Within-stage drain — the meter fills live toward the next stage, so the six
	// server stops read as one bar for the boss.
	const pct = stageProgress(meter);

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onClose}
			maxWidth={400}
			bare
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				border={BORDER.heavy}
				style={styles.sheet}
			>
				<DialogCloseRow onPress={onClose} label="Close" />
				<Kicker align="center" style={styles.sheetKicker}>
					the great hunger ★
				</Kicker>

				<GreatHungerMeter refreshKey={refreshKey} />

				{/* The Great Hunger meter — the power we're taking back. One track
				    over the six server stages, named in WORDS; the stage is a
				    feeling, so it never reads as a percentage. [D-13] */}
				<View style={styles.strip}>
					<Hand align="center">
						he is {HUNGER_LEVEL_NAME[meter.stage]}
					</Hand>
					<ProgressTrack
						value={meter.stageIndex + pct}
						max={HUNGER_STAGES.length}
						tone="sage"
						accessibilityLabel={`The Great Hunger: ${HUNGER_LEVEL_NAME[meter.stage]}`}
						announceValue={false}
						style={styles.meter}
					/>
					<Kicker star={false} align="center" style={styles.everyWar}>
						Every truffle the herd digs back weakens him — dig at his
						feedings and the whole valley pries its joy loose.
					</Kicker>
				</View>

				{/* The ladder — Gorged → Famished, counted in tickles reclaimed.
				    Mirrors SeasonGuideModal's ladder: named levels + obfuscated
				    credit numbers, the current level lit. */}
				<Kicker align="center" style={styles.ladderKicker}>
					steal back the tickles ★
				</Kicker>
				<View style={styles.ladder}>
					{HUNGER_STAGES.map((stage, i) => {
						const here = meter.available && meter.stageIndex === i;
						return (
							<ListRow
								key={stage}
								tilt={false}
								fill={here ? "sun" : "paper"}
								selected={here}
								title={
									<Label>
										{HUNGER_LEVEL_NAME[stage]}
										{here ? " — he is here" : ""}
									</Label>
								}
								trailing={
									<View style={styles.ladderMeta}>
										<Hand tone={here ? "primary" : "secondary"}>
											{formatCredit(HUNGER_LEVEL_CREDIT_PREVIEW[i])}
										</Hand>
										{i > 0 && (
											<View style={styles.ladderReward}>
												<Image
													source={GOLDEN_TRUFFLE}
													style={styles.ladderRewardArt}
													resizeMode="contain"
												/>
												<Label>+{STAGE_REWARD}</Label>
											</View>
										)}
									</View>
								}
							/>
						);
					})}
				</View>
				<Hand tone="secondary" align="center" style={styles.ladderFoot}>
					He ate the valley&apos;s tickles. Every dig and blessing pries them
					back — starve him from Gorged to Famished.
				</Hand>
				{/* The finale promise — the crown you take when he's Famished. Accent
				    so the payoff reads warmer than the mute foot line above it. */}
				<Hand tone="accent" align="center" style={styles.ladderPromise}>
					starve him to Famished and every digger with ten finds takes his
					crown.
				</Hand>

				<Button
					size="sm"
					variant="handLink"
					onPress={onClose}
					accessibilityLabel="Close the Great Hungerer sheet"
					style={styles.closeBtn}
				>
					close
				</Button>
			</Sticker>
		</AdaptiveModalScaffold>
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
		width: THUMB_WELL,
		height: THUMB_WELL,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	thumb: { width: THUMB_ART, height: THUMB_ART },
	bannerText: { flex: 1, minWidth: 0 },
	loop: { marginTop: 1 },
	divider: {
		flexDirection: "row",
		gap: DASH_GAP,
		height: DASH_H,
		marginTop: SPACE.md,
		marginBottom: SPACE.md,
	},
	dividerDash: {
		flex: 1,
		height: DASH_H,
		backgroundColor: UI_COLORS.uiMuted,
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
		width: NODE,
		height: NODE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: UI_COLORS.surface,
		zIndex: 1,
	},
	stageNodeComplete: { backgroundColor: WHIMSY.sage },
	stageNodeCurrent: {
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.heavy,
	},
	stageNodeFuture: {
		borderColor: UI_COLORS.textSecondary,
		borderStyle: "dashed",
	},
	connector: {
		position: "absolute",
		left: "50%",
		width: "100%",
		top: CONNECTOR_TOP,
		height: DASH_H,
		flexDirection: "row",
		gap: DASH_GAP,
		paddingHorizontal: CONNECTOR_INSET,
	},
	connectorDash: {
		flex: 1,
		height: DASH_H,
		backgroundColor: UI_COLORS.uiMuted,
	},
	dashDark: { backgroundColor: UI_COLORS.border },
	stageLabels: {
		flexDirection: "row",
		marginTop: SPACE.xs,
	},
	stageLabelCell: { flex: 1, alignItems: "center", minHeight: ART_SIZE.thumb },
	stageStatus: {
		minHeight: STATUS_H,
		alignItems: "center",
		justifyContent: "flex-start",
	},
	stageReward: {
		minWidth: REWARD_PILL_W,
		height: REWARD_PILL_H,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surfaceStrong,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 1,
		paddingHorizontal: SPACE.xxs,
		marginTop: SPACE.xxs,
	},
	stageRewardArt: { width: REWARD_PILL_ART, height: REWARD_PILL_ART },
	rewardPromise: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: UI_COLORS.surfaceStrong,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginTop: SPACE.sm,
	},
	// The one-hero fill: the same band, shouting. [C-26]
	rewardPromiseHero: { backgroundColor: WHIMSY.sun },
	rewardPromiseArt: { width: PROMISE_ART, height: PROMISE_ART },
	rewardPromiseCopy: { flex: 1, minWidth: 0 },

	// The sheet.
	sheet: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
	},
	sheetKicker: { marginBottom: SPACE.md },

	// The Great Hunger meter.
	strip: { marginTop: SPACE.md },
	meter: { marginTop: SPACE.xs },
	everyWar: { marginTop: SPACE.sm },

	// The hunger ladder (mirrors SeasonGuideModal).
	ladderKicker: { marginTop: SPACE.md, marginBottom: SPACE.sm },
	ladder: { gap: SPACE.sm },
	ladderMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	ladderReward: {
		flexDirection: "row",
		alignItems: "center",
		gap: 1,
	},
	ladderRewardArt: { width: LADDER_ART, height: LADDER_ART },
	ladderFoot: { marginTop: SPACE.sm },
	ladderPromise: { marginTop: SPACE.xs },
	closeBtn: { alignSelf: "center", marginTop: SPACE.sm },
});
