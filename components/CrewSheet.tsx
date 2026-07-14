// Crew bottom-sheet chrome — the paper sheet the Sounder surfaces slide up
// (FriendInvitePicker, TransferLeadershipSheet): warm ink scrim, ink-bordered
// paper anchored to the bottom edge, grabber, whimsy title + hand sub.
// Mockup frames C & E in invite-matchmaking.html.
//
// Animation matches UserSheet (the sibling sheet in the same flow): a
// TRANSPARENT Modal with animationType="none", so the two layers animate
// independently — the scrim fades its opacity 0↔1 while the paper panel
// slides on translateY. The old animationType="slide" dragged the whole
// full-screen scrim up as one body, which read as an abrupt grey flash.
// Both layers are driven by one 0..1 `progress` value so they stay in
// lockstep, and the panel stays mounted through the close tween (no
// un-animated dismiss frame) before it unmounts.

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	Animated,
	Easing,
	Dimensions,
} from "react-native";
import {
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

export function CrewSheet({
	visible,
	onDismiss,
	title,
	sub,
	children,
}: {
	visible: boolean;
	onDismiss: () => void;
	title: string;
	sub?: string;
	children: ReactNode;
}) {
	// Captured once — the sheet is portrait-only, so no rotation reads.
	const screenH = useRef(Dimensions.get("window").height).current;
	// 0 = fully dismissed (scrim clear, panel below the screen), 1 = open.
	const progress = useRef(new Animated.Value(0)).current;
	// Keep the Modal mounted through the close tween so the dismiss animates
	// out instead of popping; unmount once it settles at 0.
	const [mounted, setMounted] = useState(visible);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			Animated.timing(progress, {
				toValue: 1,
				duration: 240,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start();
		} else if (mounted) {
			Animated.timing(progress, {
				toValue: 0,
				duration: 180,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}).start(({ finished }) => {
				if (finished) setMounted(false);
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	if (!mounted) return null;

	const sheetTranslateY = progress.interpolate({
		inputRange: [0, 1],
		outputRange: [screenH, 0],
	});

	return (
		<Modal visible transparent animationType="none" onRequestClose={onDismiss}>
			{/* Scrim — its OWN layer, fading in place. Never slides. Tapping it
			    (outside the panel) dismisses. */}
			<Animated.View style={[styles.backdrop, { opacity: progress }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
			</Animated.View>
			{/* Paper panel — slides up over the static scrim. box-none lets taps
			    above the panel fall through to the scrim. */}
			<Animated.View
				pointerEvents="box-none"
				style={[styles.sheetWrap, { transform: [{ translateY: sheetTranslateY }] }]}
			>
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<Text style={styles.title}>{title}</Text>
					{!!sub && <Text style={styles.sub}>{sub}</Text>}
					{children}
				</View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	// Full-screen warm ink veil — the shared modal-backdrop token, not a grey.
	// The dim IS the fade; no saturate/filter emulation (RN has no CSS filters).
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
	},
	// Paper sticker anchored to the bottom edge: ink border on the three
	// visible sides, top corners rounded, grabber on top.
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderTopLeftRadius: RADII.xxl,
		borderTopRightRadius: RADII.xxl,
		borderWidth: 3,
		borderBottomWidth: 0,
		borderColor: WHIMSY.ink,
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.sm,
		paddingBottom: SPACE.xl,
	},
	grabber: {
		alignSelf: "center",
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: SPACE.sm,
	},
	title: { ...TYPE.sectionTitle, color: WHIMSY.ink },
	sub: { ...TYPE.kicker, color: WHIMSY.mute, marginTop: 2, marginBottom: SPACE.sm },
});
