// A full-page background that cross-fades through a list of frames in a smooth,
// SEAMLESS CIRCULAR loop (… → frameN → frame1 → …, every transition a cross-fade,
// including the wrap, so there's no flick back to the start).
//
// Technique: two stacked layers. Each step the HIDDEN layer takes the next frame
// and fades in OVER the currently-visible layer, then they swap z-order. A
// layer's opacity is only ever reset to 0 while it sits hidden behind the other,
// so there's never a one-frame flash of the wrong image and never a transparent
// gap. The root is absolutely positioned edge-to-edge so the cover image centers
// and fills with no side slivers.
import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	Easing,
	StyleSheet,
	View,
	type ImageSourcePropType,
	type ImageResizeMode,
} from "react-native";

// Explicit screen pixels — see styles.fill note (matches PageBackground).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Props {
	frames: ImageSourcePropType[];
	children?: React.ReactNode;
	// Cross-fade duration between adjacent frames.
	frameMs?: number;
	resizeMode?: ImageResizeMode;
}

export function AnimatedBackground({
	frames,
	children,
	frameMs = 1700,
	resizeMode = "cover",
}: Props) {
	const n = frames.length;
	const opA = useRef(new Animated.Value(1)).current; // layer A starts visible (frame 0)
	const opB = useRef(new Animated.Value(0)).current;
	const [a, setA] = useState(0); // frame index on layer A
	const [b, setB] = useState(n > 1 ? 1 : 0); // frame index on layer B
	const [aTop, setATop] = useState(false); // is layer A rendered on top?

	useEffect(() => {
		if (n < 2) return;
		let cancelled = false;
		let cur = 0; // the frame currently fully shown
		let showingA = true; // is `cur` on layer A?

		const tick = () => {
			if (cancelled) return;
			const next = (cur + 1) % n; // circular
			if (showingA) {
				// A holds `cur` at opacity 1. Bring `next` up on B, over A.
				setB(next);
				opB.setValue(0);
				setATop(false); // B on top
				Animated.timing(opB, {
					toValue: 1,
					duration: frameMs,
					easing: Easing.linear,
					useNativeDriver: true,
				}).start(({ finished }) => {
					if (!finished || cancelled) return;
					cur = next;
					showingA = false;
					tick();
				});
			} else {
				setA(next);
				opA.setValue(0);
				setATop(true); // A on top
				Animated.timing(opA, {
					toValue: 1,
					duration: frameMs,
					easing: Easing.linear,
					useNativeDriver: true,
				}).start(({ finished }) => {
					if (!finished || cancelled) return;
					cur = next;
					showingA = true;
					tick();
				});
			}
		};

		const id = setTimeout(tick, frameMs);
		return () => {
			cancelled = true;
			clearTimeout(id);
			opA.stopAnimation();
			opB.stopAnimation();
		};
	}, [n, frameMs, opA, opB]);

	if (n === 0) return <View style={styles.root}>{children}</View>;

	// Frames are non-interactive (pointerEvents lives in styles.fill — see note).
	const layerA = (
		<Animated.Image
			key="a"
			source={frames[a]}
			resizeMode={resizeMode}
			style={[styles.fill, { opacity: opA }]}
		/>
	);
	const layerB = (
		<Animated.Image
			key="b"
			source={frames[b]}
			resizeMode={resizeMode}
			style={[styles.fill, { opacity: opB }]}
		/>
	);

	return (
		<View style={styles.root}>
			{aTop ? [layerB, layerA] : [layerA, layerB]}
			<View style={styles.content}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// flex:1 so it fills the screen via the parent's flex — same as the static
	// PageBackground/ImageBackground that fills correctly.
	root: { flex: 1, width: "100%", height: "100%" },
	// Explicit SCREEN pixels (not "100%") so `cover` fills the screen instead of
	// the image's intrinsic size — the Yoga indefinite-size quirk that left a
	// centered band with an edge sliver (matches PageBackground/BarnVisitModal).
	// pointerEvents:"none" + the zIndex pair are LOAD-BEARING: on the new arch
	// (Fabric) an absolute sibling can hit-test ABOVE a later flex sibling, so
	// without them these full-screen frames swallow every touch on the screen
	// they back (the Barn went fully dead). Guarded by AnimatedBackground.test.
	fill: { position: "absolute", top: 0, left: 0, width: SCREEN_W, height: SCREEN_H, zIndex: 0, pointerEvents: "none" },
	content: { flex: 1, zIndex: 1 },
});
