// The bottom-sheet chrome every direct-tap sheet slides up through: a
// TRANSPARENT native Modal with animationType="none" so the two layers animate
// independently — one 0..1 value fades the warm-ink scrim in place while the
// panel translates from off-screen up to the bottom edge. (animationType="slide"
// drags the whole full-screen scrim up as one body, which reads as a grey flash.)
//
// Callers own the panel itself (paper Sticker, plain View, whatever) and keep
// their own `useUnmanagedModalHold` latch — this owns only the Modal, the scrim,
// the slide, and the bottom anchoring, which were hand-rolled identically in
// BuryTruffleSheet / BuriedTruffleSheet / TruffleCatalogSheet /
// EnemyBreakdownSheet / TickleBreakdownSheet / HoofprintsSheet.
//
// The grabber pill those panels put at the top is exported as SHEET_GRABBER so
// the 44×4 hairline stays one definition.

import { useEffect, useRef, type ReactNode } from "react";
import {
	Animated,
	Dimensions,
	Easing,
	Modal,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import {
	MODAL_BACKDROP_BG,
	MOTION,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

export function SlideUpSheet({
	open,
	onClose,
	duration = MOTION.sheetIn,
	modalVisible,
	backdropLabel,
	children,
	overlay,
	presentation = "native",
	flush = false,
}: {
	// Drives the slide-in. The sheet renders nothing while closed, so callers
	// mount it only for the open beat.
	open: boolean;
	onClose: () => void;
	duration?: number;
	// Escape hatch for a sheet that must hide its Modal without closing (so a
	// nested native Modal can present over it) — defaults to visible.
	modalVisible?: boolean;
	backdropLabel?: string;
	children: ReactNode;
	// Rendered as a SIBLING of the panel, still inside this Modal — for a nested
	// native Modal that must present over the sheet (iOS won't reliably present
	// one mounted outside the presenting Modal).
	overlay?: ReactNode;
	// "inline" renders the scrim + panel as an absolute overlay in the CURRENT
	// tree instead of a native Modal — for a sheet that opens from inside
	// another native Modal (iOS will not reliably present a nested one). The
	// mirror of AdaptiveModalScaffold's `presentation`. (2026-09-11, wave 3)
	presentation?: "native" | "inline";
	// Drops the wrapper's inset so the panel sits FLUSH against the bottom edge —
	// what a top-corners-only panel (the `Sheet` primitive) needs. The floating
	// hand-rolled panels keep the default inset.
	flush?: boolean;
}) {
	// Captured once — these sheets are portrait-only, so no rotation reads.
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	// Reduce Motion turns the slide into a fade IN PLACE: the panel never
	// travels, and the one shared 0..1 value drives opacity on both layers over
	// MOTION.fade instead of MOTION.sheetIn.
	const { reduceMotion } = useMotionPolicy();

	useEffect(() => {
		if (!open) return;
		anim.setValue(0);
		Animated.timing(anim, {
			toValue: 1,
			duration: reduceMotion ? MOTION.fade : duration,
			easing: reduceMotion ? Easing.linear : Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [open, anim, duration, reduceMotion]);

	if (!open) return null;

	const translateY = anim.interpolate({
		inputRange: [0, 1],
		outputRange: [reduceMotion ? 0 : screenH, 0],
	});

	const layers = (
		<>
			{/* Scrim — its OWN layer, fading in place. Tapping it dismisses. */}
			<Animated.View style={[styles.backdrop, { opacity: anim }]}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={onClose}
					accessibilityRole={backdropLabel ? "button" : undefined}
					accessibilityLabel={backdropLabel}
				/>
			</Animated.View>
			{/* Panel — slides up over the static scrim. box-none lets taps above
			    the panel fall through to the scrim. */}
			<Animated.View
				pointerEvents="box-none"
				style={[
					styles.sheetWrap,
					flush && styles.sheetWrapFlush,
					{ opacity: reduceMotion ? anim : 1, transform: [{ translateY }] },
				]}
			>
				{children}
			</Animated.View>
			{overlay}
		</>
	);

	if (presentation === "inline") {
		return (
			<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
				{layers}
			</View>
		);
	}

	return (
		<Modal
			visible={modalVisible ?? true}
			transparent
			animationType="none"
			onRequestClose={onClose}
		>
			{layers}
		</Modal>
	);
}

// The iOS-style drag pill the panels wear at their top edge.
export function SheetGrabber() {
	return <View style={styles.grabber} />;
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFill,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: SPACE.card,
		paddingBottom: SPACE.xxl,
	},
	sheetWrapFlush: {
		padding: 0,
		paddingBottom: 0,
	},
	// The 44x4 hairline pill, in tokens: TAP_MIN wide so the drag affordance
	// matches the minimum interactive frame, RADII.hair, uiMuted (a boundary,
	// never a word).
	grabber: {
		alignSelf: "center",
		width: TAP_MIN,
		height: SPACE.xs,
		borderRadius: RADII.hair,
		backgroundColor: UI_COLORS.uiMuted,
		marginBottom: SPACE.md,
	},
});
