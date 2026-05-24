// The season finale reveal. Mounted at root by _layout when
// my_finale_result returns a pending verdict. Shows the user their
// final side, rank, bracket, and the title + snouts they earned.
// Dismiss calls mark_finale_seen.
//
// Visually mirrors the design's JudgementDay full-screen moment:
// dark gradient backdrop, light rays radiating from above, ⚖
// glyph + "judgement day" kicker, display-font headline with a
// drop shadow, a paper Sticker holding the verdict rewards, and
// a gold "Claim verdict" CTA.
import React, { useEffect, useRef } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	Animated,
	Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polygon } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { FONTS, WHIMSY } from "@/constants/theme";

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
	onDismiss: () => void;
}

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

export function JudgementDayModal({ result, onDismiss }: Props) {
	const fade = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.timing(fade, {
			toValue: 1,
			duration: 320,
			easing: Easing.out(Easing.quad),
			useNativeDriver: true,
		}).start();
	}, [fade]);

	const handleDismiss = async () => {
		try {
			await supabase.rpc("mark_finale_seen", {
				target_season_key: result.season_key,
			});
		} catch {
			// best-effort; the modal can re-show on next focus if this fails
		}
		onDismiss();
	};

	return (
		<Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
			<Animated.View style={[styles.root, { opacity: fade }]}>
				{/* Warm-to-dark vertical gradient — the ember backdrop
				    that sets the verdict moment apart from any other
				    surface in the app. */}
				<LinearGradient
					colors={["#1a1411", "#2a1f15", "#4a2f1f"]}
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
						fill="rgba(255,216,122,0.18)"
					/>
					<Polygon
						points="50,40 40,-20 60,-20"
						fill="rgba(255,216,122,0.22)"
					/>
					<Polygon
						points="50,40 90,-20 110,-20"
						fill="rgba(255,216,122,0.18)"
					/>
				</Svg>

				<View style={styles.center}>
					<Text style={styles.scales}>⚖</Text>
					<Text style={styles.kicker}>★ judgement day</Text>
					<Text style={styles.headline}>{headline(result)}</Text>
					<Text style={styles.subtitle}>{subtitle(result)}</Text>

					<Sticker
						color="paper"
						rotate={-1}
						radius={16}
						border={2}
						style={styles.verdict}
					>
						<Text style={styles.verdictKicker}>★ your verdict</Text>
						<View style={styles.rewardList}>
							{!!result.title_name && (
								<View style={styles.rewardRow}>
									<Text style={styles.rewardGlyph}>👑</Text>
									<Text style={styles.rewardText}>
										Title: {result.title_name}
									</Text>
								</View>
							)}
							{result.snouts > 0 && (
								<View style={styles.rewardRow}>
									<SnoutCoin size={20} />
									<Text style={styles.rewardText}>
										+{result.snouts} snouts
									</Text>
								</View>
							)}
							{!result.title_name && result.snouts === 0 && (
								<View style={styles.rewardRow}>
									<Text style={styles.rewardGlyph}>✦</Text>
									<Text style={styles.rewardText}>
										Carry it into Season 2
									</Text>
								</View>
							)}
						</View>
						<Text style={styles.resetNote}>
							Season 2 begins — alignment reset to Neutral.
						</Text>
					</Sticker>

					<Pressable
						testID="finale-dismiss"
						onPress={handleDismiss}
						style={({ pressed }) => [
							styles.claimBtn,
							pressed && { opacity: 0.85 },
						]}
					>
						<Text style={styles.claimBtnText}>Claim verdict</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 28,
	},
	scales: {
		fontSize: 42,
		color: WHIMSY.paper,
		marginBottom: 6,
	},
	kicker: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.sun,
		letterSpacing: 0.4,
		marginBottom: 4,
	},
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 36,
		lineHeight: 38,
		color: WHIMSY.paper,
		textAlign: "center",
		marginTop: 6,
		// Drop shadow to mimic the design's textShadow on the headline.
		textShadowColor: "rgba(0,0,0,0.35)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 0,
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		lineHeight: 22,
		color: "rgba(255,250,240,0.75)",
		textAlign: "center",
		marginTop: 12,
	},
	verdict: {
		minWidth: 240,
		maxWidth: 320,
		paddingHorizontal: 18,
		paddingVertical: 14,
		marginTop: 24,
	},
	verdictKicker: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
		marginBottom: 8,
	},
	rewardList: { gap: 8 },
	rewardRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	rewardGlyph: {
		fontSize: 18,
		width: 22,
		textAlign: "center",
	},
	rewardText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	resetNote: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 12,
	},
	claimBtn: {
		marginTop: 28,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 28,
		paddingVertical: 14,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 3, height: 3 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 3,
	},
	claimBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
});
