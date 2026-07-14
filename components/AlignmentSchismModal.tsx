// One-time fullscreen reveal that fires when a user's alignment_score
// first crosses ±25. Tells them their behavior is starting to take
// shape — they're showing a Generous (angel) or Greedy (goblin)
// nature. Setup for everything that follows in Season 0.
//
// Driven by check_schism_status RPC → app/_layout polls on focus →
// if 'angel' or 'goblin' returned, mounts this modal. Dismiss calls
// mark_schism_seen so the user never sees the same crossing twice.
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
import { rpc } from "@/utils/rpc";
import { Sticker } from "./ui/Sticker";
import { AlignmentEmblem } from "./ui/AlignmentEmblem";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
	RADII,
} from "@/constants/theme";

export type SchismSide = "angel" | "goblin";
export type SchismMilestone = 25 | 50 | 100;

interface Props {
	side: SchismSide;
	score: number;
	// Default 25 for backward compat with older callers that don't
	// pass it through (this used to be the only milestone the modal
	// fired at). Server's new check_schism_status returns it
	// explicitly.
	milestone?: SchismMilestone;
	// Driven by the popup-queue slot in _layout: the native Modal animates
	// out on visible=false BEFORE the parent unmounts it (the unmount-while-
	// presented hazard, see PopupQueue.tsx). Defaults true so direct renders
	// (tests) behave as before.
	visible?: boolean;
	onDismiss: () => void;
}

// Per-side per-milestone copy. Tier 1 (25) = "you're becoming";
// tier 2 (50) = "you've settled in"; tier 3 (100) = the title moment.
// Push body copy (alignment_notifications.sql) carries the same
// title cadence so device + modal read consistently.
const COPY: Record<
	SchismSide,
	Record<SchismMilestone, {
		kicker: string;
		icon: "halo" | "horns";
		headline: string;
		body: string;
		buttonBg: string;
	}>
> = {
	angel: {
		25: {
			kicker: "★ the schism stirs ★",
			icon: "halo",
			headline: "You're becoming Generous",
			body: "Your tickle trades have a pattern. You give freely. You bless. You ask for little. Lean in and the path to Halo Bearer is yours.",
			buttonBg: WHIMSY.sun,
		},
		50: {
			kicker: "★ deeply generous ★",
			icon: "halo",
			headline: "The sounder remembers",
			body: "Half a hundred points of giving. Friends notice when you walk in. Keep going and the title of Saint is in reach.",
			buttonBg: WHIMSY.sun,
		},
		100: {
			kicker: "★ saint of the sounder ★",
			icon: "halo",
			headline: "Pure light",
			body: "A hundred points. Nowhere further to give — you ARE the giving. Every pig in the sounder knows your name.",
			buttonBg: WHIMSY.sun,
		},
	},
	goblin: {
		25: {
			kicker: "★ a goblin nature stirs ★",
			icon: "horns",
			headline: "You're becoming Greedy",
			body: "You take more than you give. You hoard your debts. Embrace it and the throne of Goblin King awaits.",
			buttonBg: "#D5E4C9",
		},
		50: {
			kicker: "★ deeply greedy ★",
			icon: "horns",
			headline: "Friends step lightly",
			body: "Half a hundred points of pinching. The sounder remembers what you took. Keep going and Goblin King is within reach.",
			buttonBg: "#D5E4C9",
		},
		100: {
			kicker: "★ goblin king ★",
			icon: "horns",
			headline: "Pure greed",
			body: "A hundred points. Nowhere further to fall — the throne is yours. Every pig in the sounder pulls their snout away.",
			buttonBg: "#D5E4C9",
		},
	},
};

export function AlignmentSchismModal({
	side,
	score,
	milestone = 25,
	visible = true,
	onDismiss,
}: Props) {
	const scale = useRef(new Animated.Value(0)).current;
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		// Keyed on visible so the entrance plays when the queue actually
		// presents us (the component can now mount before its turn).
		if (!visible) {
			scale.setValue(0);
			opacity.setValue(0);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.parallel([
			Animated.spring(scale, {
				toValue: 1,
				tension: 60,
				friction: 7,
				useNativeDriver: true,
			}),
			Animated.timing(opacity, {
				toValue: 1,
				duration: 250,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
	}, [visible, scale, opacity]);

	const handleDismiss = async () => {
		try {
			await rpc("mark_schism_seen", { side, milestone });
		} catch {
			// best-effort; if it fails the user might see the modal
			// again on next focus, which is annoying but not broken
		}
		onDismiss();
	};

	const copy = COPY[side][milestone];

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleDismiss}
		>
			<View style={styles.backdrop}>
				<Animated.View
					style={[
						styles.cardWrap,
						{ opacity, transform: [{ scale }] },
					]}
				>
					<Sticker
						color={side === "angel" ? "sun" : "paper"}
						rotate={-1.2}
						radius={RADII.xxl}
						border={3}
						style={[styles.card, STICKER_SHADOW]}
					>
						<Text style={styles.kicker}>{copy.kicker}</Text>
						<AlignmentEmblem
							kind={copy.icon}
							size={84}
							style={styles.emblem}
						/>
						<Text style={styles.headline}>{copy.headline}</Text>
						<Text style={styles.body}>{copy.body}</Text>
						<View style={styles.scoreRow}>
							<Text style={styles.scoreLabel}>alignment</Text>
							<Text style={styles.scoreValue}>
								{score > 0 ? `+${score}` : score}
							</Text>
						</View>
						<Pressable
							testID="schism-dismiss"
							onPress={handleDismiss}
							style={({ pressed }) => [
								styles.btn,
								{ backgroundColor: copy.buttonBg },
								pressed && { opacity: 0.75 },
							]}
						>
							<Text style={styles.btnText}>I see my path</Text>
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
	card: {
		paddingHorizontal: 24,
		paddingVertical: 28,
		alignItems: "center",
	},
	kicker: { ...KICKER_TEXT, marginBottom: 14, textAlign: "center" },
	emblem: { marginBottom: 8 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 12,
	},
	body: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		lineHeight: 22,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 18,
	},
	scoreRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
		marginBottom: 22,
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	scoreLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
	scoreValue: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
	btn: {
		paddingHorizontal: 28,
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
