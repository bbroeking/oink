// Phase 4 — the season finale reveal. Mounted at root by _layout
// when my_finale_result returns a pending verdict. Shows the user
// their final side, rank, bracket, and the title + snouts they
// earned. Dismiss calls mark_finale_seen.
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
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { AlignmentEmblem } from "./ui/AlignmentEmblem";
import { SnoutCoin } from "./ui/SnoutCoin";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

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
		return r.side === "generous" ? "A Halo Bearer!" : "A Goblin King!";
	}
	if (r.bracket === "top10") return "Gilded!";
	if (r.bracket === "neutral") return "Calm in the Storm";
	return r.side === "generous" ? "A Generous Soul" : "A Greedy Hog";
}

function sideIcon(side: FinaleResult["side"]): "halo" | "horns" | "scales" {
	return side === "generous" ? "halo" : side === "greedy" ? "horns" : "scales";
}

export function JudgementDayModal({ result, onDismiss }: Props) {
	const scale = useRef(new Animated.Value(0)).current;
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.parallel([
			Animated.spring(scale, {
				toValue: 1,
				tension: 55,
				friction: 7,
				useNativeDriver: true,
			}),
			Animated.timing(opacity, {
				toValue: 1,
				duration: 280,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
	}, [scale, opacity]);

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

	const isAngel = result.side === "generous";

	return (
		<Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
			<View style={styles.backdrop}>
				<Animated.View
					style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
				>
					<Sticker
						color={isAngel ? "sun" : "paper"}
						rotate={-1.4}
						radius={20}
						border={3}
						style={[styles.card, STICKER_SHADOW]}
					>
						<Text style={styles.kicker}>⚖ judgement day ⚖</Text>
						<AlignmentEmblem
							kind={sideIcon(result.side)}
							size={76}
							style={styles.emblem}
						/>
						<Text style={styles.headline}>{headline(result)}</Text>

						{result.side !== "neutral" && result.side_rank != null && (
							<Text style={styles.rankLine}>
								#{result.side_rank} most{" "}
								{result.side === "generous" ? "generous" : "greedy"} ·
								final alignment{" "}
								{result.final_score > 0
									? `+${result.final_score}`
									: result.final_score}
							</Text>
						)}

						<View style={styles.rewardBox}>
							{!!result.title_name && (
								<View style={styles.rewardRow}>
									<Text style={styles.rewardGlyph}>"</Text>
									<Text style={styles.rewardText}>
										Title: {result.title_name}
									</Text>
								</View>
							)}
							{result.snouts > 0 && (
								<View style={styles.rewardRow}>
									<SnoutCoin size={18} />
									<Text style={styles.rewardText}>+{result.snouts} snouts</Text>
								</View>
							)}
						</View>

						<Text style={styles.resetNote}>
							Season 2 begins — alignment reset to Neutral.
						</Text>

						<Pressable
							testID="finale-dismiss"
							onPress={handleDismiss}
							style={({ pressed }) => [
								styles.btn,
								{ backgroundColor: isAngel ? WHIMSY.lilac : WHIMSY.sun },
								pressed && { opacity: 0.75 },
							]}
						>
							<Text style={styles.btnText}>Onward</Text>
						</Pressable>
					</Sticker>
				</Animated.View>
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
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 380 },
	card: { paddingHorizontal: 24, paddingVertical: 26, alignItems: "center" },
	kicker: { ...KICKER_TEXT, marginBottom: 12 },
	emblem: { marginBottom: 6 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 8,
	},
	rankLine: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 14,
	},
	rewardBox: {
		width: "100%",
		gap: 8,
		backgroundColor: WHIMSY.cream,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		padding: 12,
		marginBottom: 12,
	},
	rewardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	rewardGlyph: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	rewardText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	resetNote: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 18,
	},
	btn: {
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	btnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
});
