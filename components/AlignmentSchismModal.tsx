// One-time fullscreen reveal that fires when a user's alignment_score
// first crosses ±25. Tells them their behavior is starting to take
// shape — they're showing a Generous (angel) or Greedy (goblin)
// nature. Setup for everything that follows in Season 0.
//
// Driven by check_schism_status RPC → app/_layout polls on focus →
// if 'angel' or 'goblin' returned, mounts this modal. Dismiss calls
// mark_schism_seen so the user never sees the same crossing twice.
//
// Wave-4 conformance pass: the raw Modal is `AdaptiveModalScaffold` with a
// `DialogCloseRow` exit (C-14); `#D5E4C9` — a hex the token layer named as
// already-retired — is `WHIMSY.curseSurface` (C-11); the headline, body, kicker
// and score speak through text roles (C-19); and the CTA is a pressable
// `Sticker`, which owns the sanctioned press, because the side tint IS the
// message and `Button` has no identity-tinted variant (see System asks).
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import {
	AdaptiveModalScaffold,
	AlignmentEmblem,
	Sticker,
	T,
} from "./ui";
import {
	BORDER,
	RADII,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	MOTION_DURATION,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

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
			buttonBg: WHIMSY.curseSurface,
		},
		50: {
			kicker: "★ deeply greedy ★",
			icon: "horns",
			headline: "Friends step lightly",
			body: "Half a hundred points of pinching. The sounder remembers what you took. Keep going and Goblin King is within reach.",
			buttonBg: WHIMSY.curseSurface,
		},
		100: {
			kicker: "★ goblin king ★",
			icon: "horns",
			headline: "Pure greed",
			body: "A hundred points. Nowhere further to fall — the throne is yours. Every pig in the sounder pulls their snout away.",
			buttonBg: WHIMSY.curseSurface,
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
	const motionPolicy = useMotionPolicy();

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
		if (motionPolicy.reduceMotion) {
			scale.setValue(1);
			Animated.timing(opacity, {
				toValue: 1,
				duration: MOTION_DURATION.crossfade,
				useNativeDriver: true,
			}).start();
			return;
		}
		Animated.parallel([
			Animated.spring(scale, {
				toValue: 1,
				tension: 60,
				friction: 7,
				useNativeDriver: true,
			}),
			Animated.timing(opacity, {
				toValue: 1,
				duration: MOTION_DURATION.state,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
	}, [visible, scale, opacity, motionPolicy.reduceMotion]);

	const handleDismiss = async () => {
		try {
			await rpc("mark_schism_seen", { side, milestone });
		} catch {
			// best-effort; if it fails the user might see the modal
			// again on next focus, which is annoying but not broken.
			// Belt-and-braces: rpc() resolves null rather than rejecting today,
			// but dismissing must survive ANY seen-marking failure (contract
			// pinned by __tests__/AlignmentSchismModal.test.tsx).
		}
		onDismiss();
	};

	const copy = COPY[side][milestone];

	const signed = score > 0 ? `+${score}` : `${score}`;

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={handleDismiss}
			animationType="fade"
			bare
			maxWidth={CARD_WIDTH}
			// The exit C-14 found missing in every modal in this area.
			showCloseButton
			closeLabel="Close"
			contentContainerStyle={styles.content}
			testID="schism-modal"
		>
			<Animated.View
				style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
			>
				<Sticker
					color={side === "angel" ? "sun" : "paper"}
					rotate={TILT_CARD}
					radius={RADII.xxl}
					border={BORDER.heavy}
					style={[styles.card, STICKER_SHADOW]}
				>
					<T role="kicker" tone="accent" align="center" style={styles.kicker}>
						{copy.kicker}
					</T>
					<AlignmentEmblem
						kind={copy.icon}
						size={EMBLEM_ART}
						style={styles.emblem}
					/>
					<T
						role="pageTitle"
						align="center"
						accessibilityRole="header"
						style={styles.headline}
					>
						{copy.headline}
					</T>
					<T role="handLg" align="center" style={styles.body}>
						{copy.body}
					</T>
					<Sticker
						color="cream"
						rotate={0}
						radius={RADII.pill}
						border={BORDER.thin}
						shadow="none"
						accessibilityRole="text"
						accessibilityLabel={`alignment ${signed}`}
						style={styles.scoreRow}
					>
						<T role="kickerPillSm" tone="secondary">
							alignment
						</T>
						<T role="numeral">{signed}</T>
					</Sticker>
					{/* The CTA wears the side's own tint, so it is a pressable
					    Sticker (which owns the sanctioned press) rather than a
					    Button, whose variants carry no identity hue. */}
					<Sticker
						color={copy.buttonBg}
						rotate={0}
						radius={RADII.lg}
						border={BORDER.ink}
						shadow="none"
						testID="schism-dismiss"
						onPress={handleDismiss}
						accessibilityLabel="I see my path"
						accessibilityHint="Closes this reveal and records that you have seen it"
						style={styles.btn}
					>
						<T role="handLg" align="center">
							I see my path
						</T>
					</Sticker>
				</Sticker>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

// Drawing geometry: the card's ceiling width, its lean, and the emblem that
// crowns it. Not spacing steps — named so no number floats.
const CARD_WIDTH = 380;
const TILT_CARD = -1.2;
const EMBLEM_ART = 84;

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		justifyContent: "center",
		padding: SPACE.sm,
	},
	cardWrap: { width: "100%" },
	card: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
	},
	kicker: { marginBottom: SPACE.card },
	emblem: { marginBottom: SPACE.sm },
	headline: { marginBottom: SPACE.md },
	body: { marginBottom: SPACE.lg },
	scoreRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.xs,
		marginBottom: SPACE.xl,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.xs,
		borderColor: UI_COLORS.border,
	},
	btn: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.md,
	},
});
