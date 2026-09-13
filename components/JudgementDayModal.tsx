// The season finale reveal. Mounted at root by _layout when
// my_finale_result returns a pending verdict. Shows the user their
// final side, rank, bracket, and the title + snouts they earned.
// Dismiss calls mark_finale_seen.
//
// Visually mirrors the design's JudgementDay full-screen moment:
// dark ember backdrop, light rays radiating from above, ⚖
// glyph + "judgement day" kicker, display-font headline with a
// drop shadow, a paper Sticker holding the verdict rewards, and
// a gold "Claim verdict" CTA.
//
// Wave-4 conformance pass: the raw Modal is `AdaptiveModalScaffold` (the
// ceremony keeps its art, and `DialogCloseRow` is the exit none of the area's
// 14 modals had — C-14); the three ungoverned darks collapse onto
// `WHIMSY.inkDeep` → `WHIMSY.stage` → `WHIMSY.bark` with the rays painted in
// `WHIMSY.sun` at named alphas and the kicker on dark in `sun` (C-23); the
// headline is the `displayLg` role rather than a bare 36 (C-19); the claim CTA
// is a `Button` carrying its reward in its label (C-03, C-06); and the entrance
// fade asks `useMotionPolicy` first.
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polygon } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Icon,
	SnoutCoin,
	Sticker,
	T,
} from "./ui";
import {
	BORDER,
	MOTION,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";

export interface FinaleResult {
	season_key: string;
	final_score: number;
	side: "generous" | "greedy" | "neutral";
	side_rank: number | null;
	bracket: "top3" | "top10" | "participant" | "neutral";
	title_id: string | null;
	title_name: string | null;
	snouts: number;
}

interface Props {
	result: FinaleResult;
	// Driven by the popup-queue slot in _layout: the native Modal animates
	// out on visible=false BEFORE the parent unmounts it (the unmount-while-
	// presented hazard, see PopupQueue.tsx). Defaults true so direct renders
	// (tests) behave as before.
	visible?: boolean;
	onDismiss: () => void;
}

// Drawing geometry for the ceremony's art — the stage's width, the scales that
// crown it, the fixed reward column, and the two ray alphas. Not spacing steps.
const CEREMONY_WIDTH = 560;
const SCALES_ART = 48;
const REWARD_MARK = 20;
const REWARD_COL = 22;
// The light rays: `WHIMSY.sun` painted at two alphas so the centre beam reads
// brighter than its flankers. The palette has no sun-alpha token, so the alpha
// rides SVG's own fillOpacity rather than a hand-mixed rgba. [C-23]
const RAY_ALPHA_EDGE = 0.18;
const RAY_ALPHA_CORE = 0.22;
// The headline's hard drop shadow — the ceremony's one text shadow, drawn in the
// ink the palette already owns.
const HEADLINE_SHADOW_OFFSET = { width: 0, height: 2 };

function headline(r: FinaleResult): string {
	if (r.bracket === "top3") {
		return r.side === "generous" ? "Halo Bearer" : "Goblin King";
	}
	if (r.bracket === "top10") return "Gilded";
	if (r.bracket === "neutral") return "Calm in the Storm";
	return r.side === "generous" ? "Generous Soul" : "Greedy Hog";
}

// Subtitle line summarizing how the user ended the season. Mirrors
// the design's "you ended Season N at +X — top 3 of the Generous side"
// pattern, gracefully degraded for neutral / participant cases.
function subtitle(r: FinaleResult): string {
	const signed = r.final_score > 0 ? `+${r.final_score}` : `${r.final_score}`;
	const ended = `you ended at ${signed}`;
	if (r.bracket === "top3" && r.side_rank != null) {
		const sideLabel = r.side === "generous" ? "Generous" : "Greedy";
		return `${ended}\ntop 3 of the ${sideLabel} side`;
	}
	if (r.bracket === "top10" && r.side_rank != null) {
		const sideLabel = r.side === "generous" ? "Generous" : "Greedy";
		return `${ended}\n#${r.side_rank} most ${sideLabel.toLowerCase()}`;
	}
	if (r.bracket === "neutral") return ended + "\nyou kept the balance";
	return ended;
}

export function JudgementDayModal({ result, visible = true, onDismiss }: Props) {
	const fade = useRef(new Animated.Value(0)).current;
	const motionPolicy = useMotionPolicy();

	useEffect(() => {
		// Keyed on visible so the entrance plays when the queue actually
		// presents us (the component can now mount before its turn).
		if (!visible) {
			fade.setValue(0);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.timing(fade, {
			toValue: 1,
			// Under Reduce Motion the verdict crossfades in rather than easing.
			duration: motionPolicy.duration(
				MOTION.sheetIn,
				MOTION_DURATION.crossfade
			),
			easing: motionPolicy.reduceMotion
				? Easing.linear
				: Easing.out(Easing.quad),
			useNativeDriver: true,
		}).start();
	}, [visible, fade, motionPolicy]);

	const handleDismiss = async () => {
		try {
			await rpc("mark_finale_seen", {
				target_season_key: result.season_key,
			});
		} catch {
			// best-effort; the modal can re-show on next focus if this fails.
			// Belt-and-braces: rpc() resolves null rather than rejecting today, but
			// dismissing must survive ANY seen-marking failure (contract pinned by
			// __tests__/JudgementDayModal.test.tsx).
		}
		onDismiss();
	};

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={handleDismiss}
			animationType="fade"
			bare
			maxWidth={CEREMONY_WIDTH}
			frameStyle={styles.frame}
			contentContainerStyle={styles.content}
			scrollViewProps={{ style: styles.scroll }}
			testID="judgement-day-modal"
		>
			<Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
				{/* Warm-to-dark vertical gradient — the ember backdrop that sets
				    the verdict moment apart from any other surface in the app.
				    Three sanctioned dark stops, not three hand-mixed hexes. */}
				<LinearGradient
					colors={[WHIMSY.inkDeep, WHIMSY.stage, WHIMSY.bark]}
					locations={[0, 0.6, 1]}
					style={StyleSheet.absoluteFill}
				/>
				{/* Light rays radiating from above — SVG-painted polys
				    stand in for the design's conic-gradient beam
				    effect (RN can't do conic). Three soft yellow
				    triangles fan out from a focal point at 50% / 40%. */}
				<Svg
					style={StyleSheet.absoluteFill}
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<Polygon
						points="50,40 -10,-20 10,-20"
						fill={WHIMSY.sun}
						fillOpacity={RAY_ALPHA_EDGE}
					/>
					<Polygon
						points="50,40 40,-20 60,-20"
						fill={WHIMSY.sun}
						fillOpacity={RAY_ALPHA_CORE}
					/>
					<Polygon
						points="50,40 90,-20 110,-20"
						fill={WHIMSY.sun}
						fillOpacity={RAY_ALPHA_EDGE}
					/>
				</Svg>
			</Animated.View>

			{/* The exit C-14 found missing in every modal in this area. It rides
			    OVER the ceremony's art rather than above it, so the ember ground
			    still reaches the top edge. */}
			<DialogCloseRow
				onPress={handleDismiss}
				label="Close the verdict"
				style={styles.closeRow}
			/>

			<Animated.View style={[styles.center, { opacity: fade }]}>
				<View style={styles.scalesWrap}>
					<Icon name="scales" size={SCALES_ART} color={WHIMSY.paper} filled />
				</View>
				{/* A kicker on the dark ground is written in sun, not accent. [C-23] */}
				<T role="kicker" align="center" style={styles.kicker}>
					★ judgement day
				</T>
				<T
					role="displayLg"
					tone="onDark"
					align="center"
					accessibilityRole="header"
					style={styles.headline}
				>
					{headline(result)}
				</T>
				<T role="bodyLg" tone="onDarkMute" align="center" style={styles.subtitle}>
					{subtitle(result)}
				</T>

				<Sticker
					color="paper"
					rotate={-1}
					radius={RADII.lg}
					border={BORDER.ink}
					style={styles.verdict}
				>
					<T role="kicker" tone="accent" style={styles.verdictKicker}>
						★ your verdict
					</T>
					<View style={styles.rewardList}>
						{!!result.title_name && (
							<View style={styles.rewardRow}>
								<View style={styles.rewardGlyphWrap}>
									<Icon name="crown" size={REWARD_MARK} color={WHIMSY.ink} filled />
								</View>
								<T role="label" style={styles.rewardText}>
									Title: {result.title_name}
								</T>
							</View>
						)}
						{result.snouts > 0 && (
							<View style={styles.rewardRow}>
								<View style={styles.rewardGlyphWrap}>
									<SnoutCoin size={REWARD_MARK} />
								</View>
								<T role="label" style={styles.rewardText}>
									+{result.snouts} snouts
								</T>
							</View>
						)}
						{!result.title_name && result.snouts === 0 && (
							<View style={styles.rewardRow}>
								<View style={styles.rewardGlyphWrap}>
									<T role="cardTitle" align="center">✦</T>
								</View>
								<T role="label" style={styles.rewardText}>
									Carry it into Season 1
								</T>
							</View>
						)}
					</View>
					<T role="kicker" tone="secondary" align="center" style={styles.resetNote}>
						Season 1 begins — alignment reset to Neutral.
					</T>
				</Sticker>

				<Button
					size="lg"
					variant="gold"
					testID="finale-dismiss"
					onPress={handleDismiss}
					accessibilityLabel={
						result.snouts > 0
							? `Claim verdict · ${result.snouts} snouts`
							: "Claim verdict"
					}
					accessibilityHint="Banks the season's rewards and closes the ceremony"
					style={styles.claimBtn}
				>
					Claim verdict
				</Button>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	// The ceremony ground — the one sanctioned dark surface. [C-23]
	frame: {
		flex: 1,
		backgroundColor: WHIMSY.stage,
		borderRadius: RADII.xxl,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
	},
	scroll: { flex: 1 },
	content: { flexGrow: 1 },
	closeRow: {
		position: "absolute",
		top: 0,
		right: 0,
		zIndex: 1,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.xl,
		paddingBottom: SPACE.xl,
	},
	// Scales icon wrapper — sets the bottom rhythm under the glyph
	// so the kicker doesn't crowd it.
	scalesWrap: {
		marginBottom: SPACE.xs,
	},
	kicker: {
		color: WHIMSY.sun,
	},
	headline: {
		marginTop: SPACE.xs,
		// Hard drop shadow, echoing the sticker language's offset shadow.
		textShadowColor: WHIMSY.inkDeep,
		textShadowOffset: HEADLINE_SHADOW_OFFSET,
		textShadowRadius: 0,
	},
	subtitle: {
		marginTop: SPACE.md,
	},
	verdict: {
		alignSelf: "stretch",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.card,
		marginTop: SPACE.xl,
	},
	verdictKicker: {
		marginBottom: SPACE.sm,
	},
	rewardList: { gap: SPACE.sm },
	rewardRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	// Fixed-width slot so the icon (or the ✦ fallback char) lines up
	// against the reward text consistently across all three branches.
	rewardGlyphWrap: {
		width: REWARD_COL,
		alignItems: "center",
		justifyContent: "center",
	},
	rewardText: {
		flexShrink: 1,
	},
	resetNote: {
		marginTop: SPACE.md,
	},
	claimBtn: {
		marginTop: SPACE.xl,
	},
});
