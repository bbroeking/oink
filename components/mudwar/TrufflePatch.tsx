// The Truffle Patch — the 8h feeding-window dig session (Season 2's heartbeat
// minigame; crowned 2026-07-03, see SKILL.md decision log).
//
// One chill scratch-to-dig board: rub (quiet, +1 stir) or snout-shove (loud,
// +3 stir) through 1–3 layers of mud; truffle-cluster silhouettes peek through
// the last layer; at full stir the Hunger lifts his snout and the session ends
// GRACEFULLY between actions — everything uncovered is already yours. There is
// no fail state, only "clean and quiet" vs "he stirred".
//
// Board layout comes from utils/rooting.generateBoard(seed) — the server hands
// the seed (open_rooting) and re-validates the finds (submit_rooting), so this
// component is presentation + gesture only. All art routes through PATCH_ART
// so generated assets drop in without code changes.

import { useCallback, useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	Image,
	StyleSheet,
	Pressable,
	Animated,
	PanResponder,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
	PATCH_COLS,
	PATCH_ROWS,
	STIR_BUDGET,
	STIR_RUB,
	STIR_SHOVE,
	SHOVE_HOLD_MS,
} from "@/constants/mudFights";
import { generateBoard, ClaimableFind, Find } from "@/utils/rooting";
import { RootingOutcome, RootingSession } from "@/hooks/useRooting";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY, RADII, SPACE, STICKER_SHADOW, SHADOW_SM } from "@/constants/theme";

// ── Art slots (placeholders — generated art drops in here, nowhere else) ─────
// Mud tints are a sanctioned palette exception: WHIMSY has no earth tones, and
// the patch IS mud (matches the mocks' approved exception in the taste pass).
const PATCH_ART = {
	truffle: HAT_IMAGES.mud_pie, // plain truffle stand-in
	golden: HAT_IMAGES.golden_truffle,
	hunger: require("../../assets/images/hunger/great_hungerer_chip.png"), // the gorging Hungerer (real art)
	mud: ["#c2a077", "#a5825f", "#8a6b4f"] as const, // layer 1 → 3 (shallow → deep)
	silhouette: "rgba(42,31,21,0.55)",
} as const;

const FIND_LINES: Record<Find, string> = {
	truffle_l: "a fat truffle — into the pouch.",
	truffle_d: "another truffle. he'll miss that one.",
	shimmer: "a pocket of tickle-motes drifts free.",
	stone: "just a stone.",
	junk_boot: "his old boot. why.",
	junk_wrap: "a licked-clean wrapper. keep it?",
};

interface Props {
	session: RootingSession;
	onSubmit: (
		finds: ClaimableFind[],
		actions: number
	) => Promise<RootingOutcome | null>;
	onClose: () => void;
}

interface EndState {
	line: string;
	outcome: RootingOutcome | null;
	finds: Find[];
}

export function TrufflePatch({ session, onSubmit, onClose }: Props) {
	const board = useMemo(() => generateBoard(session.seed), [session.seed]);
	// Co-op depth: a crewmate already dug this feeding → he's more distracted,
	// so you can stir more before he notices (matches the server's 25-action cap).
	const stirBudget = session.coop ? STIR_BUDGET * 1.25 : STIR_BUDGET;

	// Float layers so rub-splash can take half-layers off neighbors.
	const [layers, setLayers] = useState<number[]>(() => [...board.layers]);
	const [stir, setStir] = useState(0);
	const [collected, setCollected] = useState<Find[]>([]);
	const [whisper, setWhisper] = useState<string | null>(null);
	const [end, setEnd] = useState<EndState | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const layersRef = useRef(layers);
	const stirRef = useRef(0);
	const actionsRef = useRef(0);
	const collectedRef = useRef<Set<Find>>(new Set());
	const endedRef = useRef(false);
	const boardW = useRef(0);
	const [tile, setTile] = useState(0);

	const stirAnim = useRef(new Animated.Value(0)).current;
	const popAnim = useRef(new Animated.Value(0)).current;

	const claimables = useCallback((): ClaimableFind[] => {
		return [...collectedRef.current].filter(
			(f): f is ClaimableFind => f !== "stone"
		);
	}, []);

	const finish = useCallback(
		async (line: string) => {
			if (endedRef.current) return;
			endedRef.current = true;
			setSubmitting(true);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
				() => {}
			);
			const outcome = await onSubmit(claimables(), actionsRef.current);
			setSubmitting(false);
			setEnd({ line, outcome, finds: [...collectedRef.current] });
		},
		[onSubmit, claimables]
	);

	// Collect a fully-uncovered find; returns true when both truffles are home.
	const collect = useCallback(
		(kind: Find) => {
			if (collectedRef.current.has(kind)) return;
			collectedRef.current.add(kind);
			setCollected([...collectedRef.current]);
			setWhisper(FIND_LINES[kind]);
			if (kind === "truffle_l" || kind === "truffle_d") {
				Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Success
				).catch(() => {});
				popAnim.setValue(0);
				Animated.spring(popAnim, {
					toValue: 1,
					useNativeDriver: true,
					speed: 14,
					bounciness: 14,
				}).start();
			} else {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			}
		},
		[popAnim]
	);

	const afterReveal = useCallback(
		(next: number[]) => {
			// Cluster completion + single-cell finds.
			const revealed = (idx: number) => next[idx] <= 0;
			if (board.truffleL.every(revealed)) collect("truffle_l");
			if (board.truffleD.every(revealed)) collect("truffle_d");
			for (let i = 0; i < next.length; i++) {
				const cell = board.cells[i];
				if (!cell || cell.kind === "truffle_l" || cell.kind === "truffle_d")
					continue;
				if (revealed(i)) collect(cell.kind);
			}
			const bothTruffles =
				collectedRef.current.has("truffle_l") &&
				collectedRef.current.has("truffle_d");
			if (bothTruffles) {
				finish("Clean and quiet — he never noticed.");
			} else if (stirRef.current >= stirBudget) {
				finish("He stirred — you trotted off with your armful.");
			}
		},
		[board, collect, finish]
	);

	const applyAction = useCallback(
		(kind: "rub" | "shove", idx: number) => {
			if (endedRef.current) return;
			if (stirRef.current >= stirBudget) return; // ends BETWEEN actions
			if (idx < 0 || idx >= PATCH_ROWS * PATCH_COLS) return;
			if (layersRef.current[idx] <= 0 && kind === "rub") return; // free re-rub: no stir
			actionsRef.current += 1;
			stirRef.current += kind === "rub" ? STIR_RUB : STIR_SHOVE;
			setStir(stirRef.current);
			Animated.timing(stirAnim, {
				toValue: Math.min(1, stirRef.current / stirBudget),
				duration: 160,
				useNativeDriver: false,
			}).start();

			const next = [...layersRef.current];
			const splash = (i: number, amt: number) => {
				if (i >= 0 && i < next.length) next[i] = Math.max(0, next[i] - amt);
			};
			const r = Math.floor(idx / PATCH_COLS);
			const c = idx % PATCH_COLS;
			const neighbors = [
				r > 0 ? idx - PATCH_COLS : -1,
				r < PATCH_ROWS - 1 ? idx + PATCH_COLS : -1,
				c > 0 ? idx - 1 : -1,
				c < PATCH_COLS - 1 ? idx + 1 : -1,
			];
			if (kind === "rub") {
				splash(idx, 1);
				for (const n of neighbors) if (n >= 0) splash(n, 0.5);
				Haptics.selectionAsync().catch(() => {});
			} else {
				splash(idx, 2);
				for (const n of neighbors) if (n >= 0) splash(n, 1);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
			}
			layersRef.current = next;
			setLayers(next);
			afterReveal(next);
		},
		[afterReveal, stirAnim]
	);

	// ── One PanResponder over the whole grid ────────────────────────────────
	const gesture = useRef({
		startT: 0,
		startX: 0,
		startY: 0,
		lastX: 0,
		lastSign: 0,
		reversals: 0,
		movedFar: false,
		rubs: 0,
	});
	const tileAt = useCallback((x: number, y: number): number => {
		const t = boardW.current / PATCH_COLS;
		if (t <= 0) return -1;
		const c = Math.min(PATCH_COLS - 1, Math.max(0, Math.floor(x / t)));
		const r = Math.min(PATCH_ROWS - 1, Math.max(0, Math.floor(y / t)));
		return r * PATCH_COLS + c;
	}, []);

	const pan = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				const g = gesture.current;
				g.startT = Date.now();
				g.startX = evt.nativeEvent.locationX;
				g.startY = evt.nativeEvent.locationY;
				g.lastX = g.startX;
				g.lastSign = 0;
				g.reversals = 0;
				g.movedFar = false;
				g.rubs = 0;
			},
			onPanResponderMove: (evt) => {
				const g = gesture.current;
				const x = evt.nativeEvent.locationX;
				const y = evt.nativeEvent.locationY;
				const dx = x - g.lastX;
				const dist = Math.hypot(x - g.startX, y - g.startY);
				// 14px thumb-jitter tolerance before a hold degrades into a scrub.
				if (dist > 14) g.movedFar = true;
				if (Math.abs(dx) > 3) {
					const sign = dx > 0 ? 1 : -1;
					if (g.lastSign !== 0 && sign !== g.lastSign) {
						g.reversals += 1;
						// Every 2 direction reversals = one rub, live, on the tile
						// under the finger — scrubbing feels immediate.
						if (g.reversals % 2 === 0) {
							g.rubs += 1;
							applyAction("rub", tileAt(x, y));
						}
					}
					g.lastSign = sign;
				}
				g.lastX = x;
			},
			onPanResponderRelease: (evt) => {
				const g = gesture.current;
				const dt = Date.now() - g.startT;
				const idx = tileAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
				if (!g.movedFar && dt >= SHOVE_HOLD_MS) {
					applyAction("shove", idx); // the big scoop lands where you release
				} else if (g.rubs === 0 && !g.movedFar && dt < 250) {
					applyAction("rub", idx); // a plain tap is one rub
				}
			},
			onPanResponderTerminate: () => {
				// Gesture stolen (scroll/modal) — nothing to clean up; stir only
				// moves on completed actions.
			},
		})
	).current;

	// ── Render ───────────────────────────────────────────────────────────────
	const stirW = stirAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0%", "100%"],
	});
	const hungerWobble = stir >= stirBudget * 0.75 ? "-3deg" : "0deg";

	return (
		<View style={styles.wrap}>
			{/* Header */}
			<Text style={styles.kicker}>THE TRUFFLE PATCH</Text>
			<Text style={styles.title}>He's gorging — dig quick, dig quiet.</Text>
			{session.practice && (
				<View style={styles.practice}>
					<Text style={styles.practiceText}>
						practice patch — the real bog opens soon
					</Text>
				</View>
			)}

			{/* The Hunger vignette + stir meter */}
			<View style={styles.vigRow}>
				<View style={styles.stirCol}>
					<Text style={styles.stirLabel}>his attention</Text>
				{session.coop && (
					<Text style={styles.depthChip}>crew dug too — dig deeper</Text>
				)}
				{session.blessed && (
					<Text style={styles.depthChip}>blessed — luckier digs</Text>
				)}
					<View style={styles.stirTrack}>
						<Animated.View style={[styles.stirFill, { width: stirW }]} />
					</View>
				</View>
				<Image
					source={PATCH_ART.hunger}
					style={[styles.hunger, { transform: [{ rotate: hungerWobble }] }]}
					resizeMode="contain"
				/>
			</View>

			{/* The board */}
			<View
				style={styles.board}
				onLayout={(e) => {
					boardW.current = e.nativeEvent.layout.width;
					setTile(Math.floor(e.nativeEvent.layout.width / PATCH_COLS));
				}}
				{...pan.panHandlers}
			>
				{tile > 0 &&
					layers.map((depth, i) => {
						const cell = board.cells[i];
						const revealed = depth <= 0;
						const silhouette = !revealed && depth <= 1 && !!cell;
						const tint =
							PATCH_ART.mud[Math.min(2, Math.max(0, Math.ceil(depth) - 1))];
						return (
							<View
								key={i}
								style={[
									styles.tile,
									{ width: tile, height: tile },
									!revealed && { backgroundColor: tint },
									revealed && styles.tileCleared,
								]}
							>
								{silhouette && (
									<View
										style={[
											styles.silhouette,
											cell.kind === "stone" && styles.silhouetteRound,
										]}
									/>
								)}
								{revealed && cell && <RevealedCell kind={cell.kind} />}
							</View>
						);
					})}
			</View>

			{/* Whisper + pouch */}
			{whisper && <Text style={styles.whisper}>{whisper}</Text>}
			<View style={styles.pouchRow}>
				<PouchChip
					label="pouch"
					count={
						collected.filter((f) => f === "truffle_l" || f === "truffle_d")
							.length
					}
				/>
				<PouchChip
					label="clan mud"
					count={Math.min(
						2,
						collected.filter((f) => f === "truffle_l" || f === "truffle_d")
							.length
					)}
				/>
				<PouchChip
					label="motes freed"
					count={collected.includes("shimmer") ? 1 : 0}
				/>
			</View>

			{/* End card */}
			{end && (
				<View style={styles.endCard}>
					<Text style={styles.endTitle}>{end.line}</Text>
					{end.outcome ? (
						<>
							<Text style={styles.endLine}>
								The clan's pile: +{end.outcome.mud} mud
							</Text>
							<Text style={styles.endLine}>
								Your pouch: +{end.outcome.truffles}{" "}
								{end.outcome.truffles === 1 ? "golden truffle" : "golden truffles"}
								{end.outcome.echo ? " — a clanmate dug this feeding too!" : ""}
							</Text>
							{end.outcome.practice && (
								<Text style={styles.endPractice}>
									(practice — nothing banked yet)
								</Text>
							)}
						</>
					) : (
						<Text style={styles.endLine}>
							Couldn't bank that rooting — the bog will remember your armful.
						</Text>
					)}
					<Pressable onPress={onClose} style={styles.endBtn} hitSlop={8}>
						<Text style={styles.endBtnText}>
							{submitting ? "Trotting home…" : "Back to the war"}
						</Text>
					</Pressable>
				</View>
			)}
		</View>
	);
}

function RevealedCell({ kind }: { kind: Find }) {
	if (kind === "truffle_l" || kind === "truffle_d") {
		return (
			<Image source={PATCH_ART.truffle} style={styles.findImg} resizeMode="contain" />
		);
	}
	if (kind === "shimmer") return <View style={styles.shimmer} />;
	if (kind === "stone") return <View style={styles.stone} />;
	// junk (boot / wrapper) — chunky ink shape until art lands.
	return <View style={styles.junk} />;
}

function PouchChip({ label, count }: { label: string; count: number }) {
	return (
		<View style={styles.chip}>
			<Text style={styles.chipCount}>{count}</Text>
			<Text style={styles.chipLabel}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		padding: SPACE.lg,
		...STICKER_SHADOW,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.6,
		textTransform: "uppercase",
		color: WHIMSY.mute,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		marginTop: 2,
		marginBottom: SPACE.sm,
	},
	practice: {
		alignSelf: "flex-start",
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 2,
		marginBottom: SPACE.sm,
	},
	practiceText: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink },
	vigRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	stirCol: { flex: 1 },
	stirLabel: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	stirTrack: {
		height: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
		overflow: "hidden",
		marginTop: 2,
	},
	stirFill: { height: "100%", backgroundColor: WHIMSY.roseDeep },
	hunger: { width: 44, height: 44 },
	board: {
		flexDirection: "row",
		flexWrap: "wrap",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		overflow: "hidden",
		backgroundColor: WHIMSY.cream2,
	},
	tile: {
		borderWidth: 0.5,
		borderColor: "rgba(42,31,21,0.25)",
		alignItems: "center",
		justifyContent: "center",
	},
	tileCleared: { backgroundColor: WHIMSY.cream2 },
	silhouette: {
		width: "62%",
		height: "52%",
		borderRadius: RADII.sm,
		backgroundColor: PATCH_ART.silhouette,
	},
	silhouetteRound: { borderRadius: 999, width: "50%", height: "50%" },
	findImg: { width: "78%", height: "78%" },
	shimmer: {
		width: "45%",
		height: "45%",
		borderRadius: 999,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	stone: {
		width: "55%",
		height: "42%",
		borderRadius: 999,
		backgroundColor: WHIMSY.muteSoft,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	junk: {
		width: "52%",
		height: "52%",
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.peach,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		transform: [{ rotate: "-8deg" }],
	},
	depthChip: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
	},
	whisper: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	pouchRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 3,
		...SHADOW_SM,
	},
	chipCount: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	chipLabel: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	endCard: {
		marginTop: SPACE.md,
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		padding: SPACE.md,
		alignItems: "center",
		...SHADOW_SM,
	},
	endTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	endLine: {
		fontFamily: FONTS.body,
		fontSize: 13,
		color: WHIMSY.ink,
		marginTop: 4,
		textAlign: "center",
	},
	endPractice: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	endBtn: {
		marginTop: SPACE.md,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.sm,
		...SHADOW_SM,
	},
	endBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});
