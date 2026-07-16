// Season-1 value banner — the compressed hero. A small vignette thumb + the
// stage name + the one loop line ("dig at his feedings — keep the truffles,
// level your pass, starve him together."). It answers "what is this?" in a
// strip, not a whole first screen.
//
// Tapping it opens the full hero sheet: the big GreatHungerMeter vignette, the
// six stage segments (the power the herd is taking back), and the hunger ladder
// (Gorged → Famished). The ladder rendering mirrors SeasonGuideModal's — the
// same named levels + obfuscated credit numbers, one source of feeling.
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
import { Button } from "../ui/Button";
import { bannerDigStatus } from "@/utils/rooting";
import type { FeedingCta } from "../mudwar/useFeedingCta";
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

// The whole game in one line — the loop the tab is organized around.
const LOOP_LINE =
	"dig at his feedings — keep the truffles, level your pass, starve him together.";

export function HungerHero({
	refreshKey,
	open: openProp,
	onOpenChange,
	cta,
}: {
	refreshKey?: number;
	// Optional controlled-open — lets another surface (the YOUR TAKE tickle
	// cell) open THIS hero's sheet instead of minting a second one. Omitted:
	// the banner owns its own open state as before (backward-compatible).
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	// The season tab's ONE shared feeding CTA — the same instance the Sounder
	// cards consume, so the banner's dig button can never disagree with theirs.
	// The owner renders cta.modal once; omitted → no CTA row (banner only).
	cta?: FeedingCta;
}) {
	const meter = useHungerMeter(refreshKey);
	const [openInternal, setOpenInternal] = useState(false);
	const open = openProp ?? openInternal;
	const setOpen = (v: boolean) => {
		setOpenInternal(v);
		onOpenChange?.(v);
	};

	return (
		<>
			{/* Compressed value banner — one sticker, two rows. Row 1 (the header:
			    vignette thumb + stage + loop line) is its own Pressable that opens
			    the full hero art + ladder; row 2 is the dig call, INSIDE the same
			    sticker so it reads as the banner's own footer, never a detached
			    pill floating below. The header Pressable stays a sibling of the
			    CTA (not its parent) so the dig tap digs and a header tap still
			    opens the sheet. */}
			<Sticker
				color="paper"
				rotate={-0.5}
				radius={RADII.lg}
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

				{/* The dig call footer, for crewed players only. Open + not dug →
				    the real primary button; guarded or already dug → a quiet hand
				    status line (the call stays always-visible, it just stops
				    impersonating a button — the founder's dead-pill note). The
				    line comes from bannerDigStatus, which derives the words AND
				    the countdown together from the PHASE — never from
				    cta.countdown, whose open-phase value is a closes-in (the
				    founder's "opens in 2h, still dug later" wrong-number bug).
				    Crewless players see nothing here (noCrew) — the join door
				    owns their funnel. The owner renders the shared cta.modal
				    beside the Sounder card, not here. */}
				{cta && !cta.noCrew &&
					(cta.phaseOpen && !cta.dugThisWindow ? (
						<View style={styles.ctaRow}>
							<Button size="md" variant="primary" full onPress={cta.start}>
								dig this feeding ›
							</Button>
						</View>
					) : (
						<Text style={styles.ctaStatus}>
							{bannerDigStatus(cta.phaseOpen, cta.dugThisWindow)}
						</Text>
					))}
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
									<Text style={[styles.ladderCredit, here && styles.ladderHereText]}>
										{formatCredit(HUNGER_LEVEL_CREDIT_PREVIEW[i])}
									</Text>
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
	// The compressed banner — a column: header row, then the dig-call footer.
	banner: {
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	thumbWrap: {
		width: 52,
		height: 52,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	thumb: { width: 46, height: 46 },
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

	// The dig-call footer inside the banner — a small gap off the header row.
	ctaRow: { marginTop: SPACE.sm },
	// The guarded/dug status line — hand voice, quiet, centered: always-visible
	// schedule without the dead disabled-button read.
	ctaStatus: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
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
	ladderCredit: { ...TYPE.hand, fontFamily: FONTS.whimsy, lineHeight: undefined, color: WHIMSY.mute },
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
