// The Snout Hook — the third scuffle game (lab option ③): a swinging hook
// sweeps over the soil; drop it at the right moment to haul up whatever
// sits shallowest in that column. Same server contract as the Truffle
// Patch — generateBoard(session.seed) lays the finds, each drop is a
// chunky 4-action haul, and the submit re-validates against the seed.
// Rotation picks it by feeding window (FeedingStrip: windowIndex % 3).
//
// Presentation mirrors the Truffle Patch's art vocabulary: the gorging
// Hunger watches from the vignette (and flinches as joy tears loose), the
// hook is a real ink line + head that PLUNGES through the mud strata to the
// caught cell on every drop, and hauled finds surface as their sticker
// tokens (truffle art / gold shimmer / peach junk / stone). All game logic
// below the render is byte-for-byte the seeded-board contract; the visuals
// are procedural (tokens only, no baked frames).

import { useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	StyleSheet,
	Animated,
	Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { ReclaimSlam, ReclaimSlamHandle } from "./ReclaimSlam";
import { HAT_IMAGES } from "@/constants/hats";
import type { RootingSession, RootingOutcome } from "@/hooks/useRooting";
import {
	generateBoard,
	claimableFinds,
	type ClaimableFind,
	type Find,
} from "@/utils/rooting";
import { PATCH_ROWS, PATCH_COLS } from "@/constants/mudFights";
import { FONTS, KICKER_TEXT, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const ACTIONS_PER_DROP = 4;

// Art vocabulary — mirrors TrufflePatch's PATCH_ART so a find reads the same in
// every dig game. Mud tints are the sanctioned earth-tone exception (WHIMSY has
// no earth tones); the finds themselves are token/sticker shapes + real art.
const HOOK_ART = {
	hunger: require("../../assets/images/hunger/great_hungerer_chip.png"),
	truffle: HAT_IMAGES.mud_pie,
} as const;

// Soil strata, shallow → deep (mud exception). A drop plunges through these.
const SOIL = ["#c9a06b", "#b98d55", "#a67a45", "#8f6636", "#7a542b"];

// Plunge-zone geometry (kept in sync with the styles below) so the hook head
// can reach the exact caught row. lane + its margin + soil top border, then a
// fixed row pitch. Cozy-tolerant — a pixel of drift is invisible on a lump.
const LANE_H = 34;
const LANE_MB = 4;
const SOIL_TOP = 2; // soil border
const ROW_H = 30; // soilRow: paddingVertical 6 (×2) + soilSpot 18
const REST_DEPTH = LANE_H / 2; // hook head hangs mid-lane at rest
const rowCenterY = (row: number) =>
	LANE_H + LANE_MB + SOIL_TOP + row * ROW_H + ROW_H / 2;

const HAUL_LINE: Record<Find, string> = {
	truffle_l: "the long truffle! straight to the pouch.",
	truffle_d: "the dark truffle! straight to the pouch.",
	shimmer: "a shimmer — pretty.",
	junk_boot: "an old boot. huh.",
	junk_wrap: "a mud-soaked wrap. huh.",
	stone: "clonk — the hook skips off stone.",
};

interface Props {
	session: RootingSession;
	onSubmit: (
		finds: ClaimableFind[],
		actions: number
	) => Promise<RootingOutcome | null>;
	onClose: () => void;
}

export function SnoutHook({ session, onSubmit, onClose }: Props) {
	const board = useMemo(() => generateBoard(session.seed), [session.seed]);
	const maxDrops = session.coop ? 6 : 5; // 6×4=24 ≤ 25 / 5×4=20 ≤ 20

	const [drops, setDrops] = useState(0);
	const [hauled, setHauled] = useState<Set<number>>(new Set());
	const [line, setLine] = useState<string | null>(
		session.coop ? "a crewmate hauled this feeding — one extra drop." : null
	);
	const [ending, setEnding] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const collectedRef = useRef<Set<Find>>(new Set());
	const dropsRef = useRef(0);
	const endedRef = useRef(false);
	// Reclaim slam — joy-motes rip from his corner (top) to your pouch (bottom).
	const slamRef = useRef<ReclaimSlamHandle>(null);
	// The Hunger flinches as the joy tears free (matches TrufflePatch).
	const hungerFlinch = useRef(new Animated.Value(0)).current;

	// The sweep — an eased ping-pong across the columns; sampled at drop time.
	const sweep = useRef(new Animated.Value(0)).current;
	const sweepVal = useRef(0);
	const sweepLoop = useRef<Animated.CompositeAnimation | null>(null);
	const startSweep = () => {
		sweepLoop.current?.stop();
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sweep, {
					toValue: 1,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: false,
				}),
				Animated.timing(sweep, {
					toValue: 0,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: false,
				}),
			])
		);
		sweepLoop.current = loop;
		loop.start();
	};
	useEffect(() => {
		const id = sweep.addListener(({ value }) => (sweepVal.current = value));
		startSweep();
		return () => {
			sweep.removeListener(id);
			sweepLoop.current?.stop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sweep]);

	// The hook plunge — head depth in px; rests mid-lane, dives to the caught
	// row on a drop, then reels back. Purely cosmetic; the haul resolves below.
	const plunge = useRef(new Animated.Value(REST_DEPTH)).current;
	const runPlunge = (targetDepth: number) => {
		// Hold the sweep where it is so the line drops straight, then resume.
		sweepLoop.current?.stop();
		Animated.sequence([
			Animated.timing(plunge, {
				toValue: targetDepth,
				duration: 240,
				easing: Easing.in(Easing.quad),
				useNativeDriver: false,
			}),
			Animated.timing(plunge, {
				toValue: REST_DEPTH,
				duration: 320,
				easing: Easing.out(Easing.quad),
				useNativeDriver: false,
			}),
		]).start(() => {
			if (!endedRef.current) startSweep();
		});
	};

	const flinch = () => {
		hungerFlinch.setValue(0);
		Animated.sequence([
			Animated.spring(hungerFlinch, {
				toValue: 1,
				useNativeDriver: true,
				speed: 40,
				bounciness: 16,
			}),
			Animated.timing(hungerFlinch, {
				toValue: 0,
				duration: 240,
				useNativeDriver: true,
			}),
		]).start();
	};

	const claimables = (): ClaimableFind[] =>
		claimableFinds(board, collectedRef.current);

	const finish = async (why: string) => {
		if (endedRef.current) return;
		endedRef.current = true;
		sweepLoop.current?.stop();
		setEnding(why);
		setSubmitting(true);
		await onSubmit(claimables(), dropsRef.current * ACTIONS_PER_DROP);
		setSubmitting(false);
	};

	const drop = () => {
		if (endedRef.current || dropsRef.current >= maxDrops) return;
		dropsRef.current += 1;
		setDrops(dropsRef.current);
		const col = Math.min(
			PATCH_COLS - 1,
			Math.floor(sweepVal.current * PATCH_COLS)
		);
		// The hook sinks to the SHALLOWEST unhauled thing in this column.
		let caught: { idx: number; kind: Find } | null = null;
		for (let row = 0; row < PATCH_ROWS; row++) {
			const idx = row * PATCH_COLS + col;
			const cell = board.cells[idx];
			if (cell && !hauled.has(idx)) {
				caught = { idx, kind: cell.kind };
				break;
			}
		}
		if (!caught) {
			setLine("the hook comes up muddy — nothing there.");
			Haptics.selectionAsync().catch(() => {});
			// A dry column: plunge to the deepest strata and come up empty.
			runPlunge(rowCenterY(PATCH_ROWS - 1));
		} else {
			const caughtRow = Math.floor(caught.idx / PATCH_COLS);
			runPlunge(rowCenterY(caughtRow));
			setHauled((s) => new Set(s).add(caught!.idx));
			setLine(HAUL_LINE[caught.kind]);
			if (caught.kind !== "stone") {
				const kind = caught.kind;
				collectedRef.current.add(kind);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
				flinch();
				// The haul reclaims joy — golden burst for a truffle, a wisp for a
				// shimmer. (haptic:false — the haul already buzzed on this beat.)
				slamRef.current?.slam({
					intensity: kind.startsWith("truffle") ? "pop" : "wisp",
					to: { x: 0.24, y: 0.95 },
					haptic: false,
				});
			}
		}
		const both =
			collectedRef.current.has("truffle_l") &&
			collectedRef.current.has("truffle_d");
		if (both) {
			void finish("Both truffles hauled — reel it in.");
		} else if (dropsRef.current >= maxDrops) {
			void finish("Out of drops — you reel in your haul.");
		}
	};

	const hookLeft = sweep.interpolate({
		inputRange: [0, 1],
		outputRange: ["2%", "88%"],
	});

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the snout hook ★</Text>
			<Text style={styles.headline}>He's gorging — drop the hook.</Text>

			{/* The gorging Hunger watches, and flinches as joy tears loose. */}
			<View style={styles.vigRow}>
				<View style={styles.hintCol}>
					<Text style={styles.hint}>
						the hook swings — drop it over a buried lump to haul it up.
					</Text>
					{session.blessed && (
						<Text style={styles.blessed}>blessed — luckier hauls</Text>
					)}
				</View>
				<Animated.Image
					source={HOOK_ART.hunger}
					resizeMode="contain"
					style={[
						styles.hunger,
						{
							transform: [
								{
									scale: hungerFlinch.interpolate({
										inputRange: [0, 1],
										outputRange: [1, 0.86],
									}),
								},
							],
						},
					]}
				/>
			</View>

			{/* The plunge zone: sweep lane on top, mud strata below, one hook rig
			    absolutely positioned so it can dive from the lane into the soil. */}
			<View style={styles.plungeZone}>
				<View style={styles.lane} />

				{/* The soil — silhouettes until hauled, then the find's sticker. */}
				<View style={styles.soil}>
					{Array.from({ length: PATCH_ROWS }).map((_, row) => (
						<View
							key={row}
							style={[
								styles.soilRow,
								{ backgroundColor: SOIL[row % SOIL.length] },
								row > 0 && styles.strataLine,
							]}
						>
							{Array.from({ length: PATCH_COLS }).map((_, col) => {
								const idx = row * PATCH_COLS + col;
								const cell = board.cells[idx];
								const isHauled = hauled.has(idx);
								return (
									<View key={col} style={styles.soilSpot}>
										{cell && !isHauled && <View style={styles.lump} />}
										{cell && isHauled && <HauledFind kind={cell.kind} />}
									</View>
								);
							})}
						</View>
					))}
				</View>

				{/* The hook rig — a real ink line + head that plunges to the catch. */}
				<Animated.View style={[styles.hookRig, { left: hookLeft }]}>
					<Animated.View style={[styles.hookLine, { height: plunge }]} />
					<View style={styles.hookHead}>
						<Glyph name="pinch" size={20} />
					</View>
				</Animated.View>
			</View>

			<Button
				size="md"
				variant="primary"
				full
				onPress={drop}
				disabled={!!ending || drops >= maxDrops}
			>
				{`Drop the hook (${maxDrops - drops} left)`}
			</Button>

			{!!line && !ending && <Text style={styles.line}>{line}</Text>}
			{!!ending && (
				<Text style={styles.line}>
					{ending}
					{submitting ? " …" : ""}
				</Text>
			)}

			<View style={styles.footRow}>
				<Text style={styles.pouch}>
					pouch · {claimables().length}
					{session.blessed ? "  ✦ blessed" : ""}
				</Text>
				{ending ? (
					<Button size="sm" variant="primary" onPress={onClose} disabled={submitting}>
						Done
					</Button>
				) : (
					<Pressable onPress={() => finish("Reeled in early — haul banked.")} hitSlop={8}>
						<Text style={styles.bagOut}>reel in ›</Text>
					</Pressable>
				)}
			</View>

			<ReclaimSlam ref={slamRef} />
		</View>
	);
}

// A hauled cell's surfaced find — the shared dig-game art vocabulary.
function HauledFind({ kind }: { kind: Find }) {
	if (kind === "truffle_l" || kind === "truffle_d") {
		return <Image source={HOOK_ART.truffle} style={styles.findImg} resizeMode="contain" />;
	}
	if (kind === "shimmer") return <View style={styles.shimmer} />;
	if (kind === "stone") return <View style={styles.stone} />;
	return <View style={styles.junk} />; // boot / wrapper
}

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		padding: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center" },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.sm,
	},
	vigRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	hintCol: { flex: 1 },
	hint: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	blessed: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.accent, marginTop: 2 },
	hunger: { width: 48, height: 48 },
	plungeZone: { position: "relative", marginBottom: SPACE.md },
	lane: {
		height: LANE_H,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.sky,
		marginBottom: LANE_MB,
	},
	soil: {
		borderWidth: SOIL_TOP,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		overflow: "hidden",
	},
	soilRow: {
		flexDirection: "row",
		justifyContent: "space-around",
		paddingVertical: 6,
	},
	// A faint ink seam between strata — reads as geological layers.
	strataLine: { borderTopWidth: 1, borderTopColor: "rgba(42,31,21,0.28)" },
	soilSpot: { width: 30, height: 18, alignItems: "center", justifyContent: "center" },
	lump: {
		width: 16,
		height: 12,
		borderRadius: 6,
		backgroundColor: "rgba(42,31,21,0.35)",
	},
	// Surfaced finds — mirror TrufflePatch's sticker tokens.
	findImg: { width: "94%", height: "94%" },
	shimmer: {
		width: 15,
		height: 15,
		borderRadius: 999,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	stone: {
		width: 16,
		height: 11,
		borderRadius: 999,
		backgroundColor: WHIMSY.muteSoft,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	junk: {
		width: 15,
		height: 15,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.peach,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		transform: [{ rotate: "-8deg" }],
	},
	// The hook rig — anchored at the top of the plunge zone; the line grows
	// downward (its height IS the head's depth) so the head reaches the catch.
	hookRig: { position: "absolute", top: 0, alignItems: "center", width: 24 },
	hookLine: { width: 2, backgroundColor: WHIMSY.ink },
	hookHead: {
		marginTop: -4,
		alignItems: "center",
		justifyContent: "center",
	},
	line: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	footRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: SPACE.md,
	},
	pouch: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	bagOut: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});
