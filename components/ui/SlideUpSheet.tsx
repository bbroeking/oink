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
import { MODAL_BACKDROP_BG, SPACE, WHIMSY } from "@/constants/theme";

export function SlideUpSheet({
	open,
	onClose,
	duration = 300,
	modalVisible,
	backdropLabel,
	children,
	overlay,
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
}) {
	// Captured once — these sheets are portrait-only, so no rotation reads.
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!open) return;
		anim.setValue(0);
		Animated.timing(anim, {
			toValue: 1,
			duration,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [open, anim, duration]);

	if (!open) return null;

	const translateY = anim.interpolate({
		inputRange: [0, 1],
		outputRange: [screenH, 0],
	});

	return (
		<Modal
			visible={modalVisible ?? true}
			transparent
			animationType="none"
			onRequestClose={onClose}
		>
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
				style={[styles.sheetWrap, { transform: [{ translateY }] }]}
			>
				{children}
			</Animated.View>
			{overlay}
		</Modal>
	);
}

// The iOS-style drag pill the panels wear at their top edge.
export function SheetGrabber() {
	return <View style={styles.grabber} />;
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: SPACE.md + 2,
		paddingBottom: SPACE.xl + 4,
	},
	grabber: {
		alignSelf: "center",
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: SPACE.md,
	},
});
