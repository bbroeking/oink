// Title-unlock modal — fires after the Lucky Pig burst dismisses, on
// the 20% sub-roll that grants a lucky-drop title. Visually quieter
// than the burst (no fanfare, gentler animation) so the two don't
// feel like the same beat.
import React, { useEffect, useRef } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Animated,
	Pressable,
	Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Sticker } from "./ui/Sticker";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import type { TitleRow } from "@/constants/title_types";

interface Props {
	title: TitleRow | null;
	onDismiss: () => void;
	onEquip?: (id: string) => void;
}

export function LuckyTitleUnlockModal({ title, onDismiss, onEquip }: Props) {
	const cardScale = useRef(new Animated.Value(0)).current;
	const cardOpacity = useRef(new Animated.Value(0)).current;
	const titleSlide = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!title) {
			cardScale.setValue(0);
			cardOpacity.setValue(0);
			titleSlide.setValue(0);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
			() => {}
		);
		Animated.parallel([
			Animated.spring(cardScale, {
				toValue: 1,
				tension: 70,
				friction: 7,
				useNativeDriver: true,
			}),
			Animated.timing(cardOpacity, {
				toValue: 1,
				duration: 220,
				useNativeDriver: true,
			}),
			Animated.sequence([
				Animated.delay(180),
				Animated.timing(titleSlide, {
					toValue: 1,
					duration: 380,
					easing: Easing.out(Easing.back(1.5)),
					useNativeDriver: true,
				}),
			]),
		]).start();
	}, [title, cardScale, cardOpacity, titleSlide]);

	if (!title) return null;

	const titleTranslateY = titleSlide.interpolate({
		inputRange: [0, 1],
		outputRange: [16, 0],
	});

	return (
		<Modal
			visible={!!title}
			transparent
			animationType="fade"
			onRequestClose={onDismiss}
		>
			<View style={styles.backdrop}>
				<Animated.View
					style={[
						styles.card,
						{ opacity: cardOpacity, transform: [{ scale: cardScale }] },
					]}
				>
					<Sticker color="paper" rotate={1.2} radius={18} style={styles.sticker}>
						<Text style={styles.kicker}>★ rare title unlocked</Text>
						<Animated.View
							style={{
								opacity: titleSlide,
								transform: [{ translateY: titleTranslateY }],
							}}
						>
							<Text style={styles.titleName}>{title.name}</Text>
							<Text style={styles.placement}>
								{title.placement === "pre"
									? "appears before your name"
									: "appears after your name"}
							</Text>
							{title.description && (
								<Text style={styles.desc}>{title.description}</Text>
							)}
						</Animated.View>
						<View style={styles.buttons}>
							{onEquip && (
								<Pressable
									onPress={() => onEquip(title.id)}
									style={({ pressed }) => [
										styles.equipBtn,
										pressed && { opacity: 0.7 },
									]}
								>
									<Text style={styles.equipBtnText}>Equip now</Text>
								</Pressable>
							)}
							<Pressable onPress={onDismiss} style={styles.skipBtn}>
								<Text style={styles.skipBtnText}>
									{onEquip ? "Maybe later" : "Nice"}
								</Text>
							</Pressable>
						</View>
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
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 340,
	},
	sticker: {
		paddingHorizontal: 22,
		paddingVertical: 22,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 14,
	},
	titleName: {
		fontFamily: FONTS.whimsy,
		fontSize: 30,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 4,
	},
	placement: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		textAlign: "center",
		marginBottom: 10,
	},
	desc: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 20,
	},
	buttons: {
		flexDirection: "column",
		gap: 8,
		marginTop: 18,
		width: "100%",
		alignItems: "center",
	},
	equipBtn: {
		backgroundColor: WHIMSY.lilac,
		paddingHorizontal: 22,
		paddingVertical: 10,
		borderRadius: 12,
	},
	equipBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	skipBtn: {
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	skipBtnText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});
