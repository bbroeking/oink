// A full-page background that cross-fades through a list of frames in a
// ping-pong loop (forward then reverse), so e.g. the Northern Lights aurora
// waves back and forth. Two stacked layers: the base frame stays fully opaque
// underneath while the next frame fades in on top — so there's never a
// transparent gap mid-transition. When a fade finishes, the faded-in frame
// becomes the new base and the next one is chosen (bouncing at the ends).
import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	StyleSheet,
	View,
	type ImageSourcePropType,
	type ImageResizeMode,
} from "react-native";

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
	frameMs = 1400,
	resizeMode = "cover",
}: Props) {
	const n = frames.length;
	const [base, setBase] = useState(0);
	const [top, setTop] = useState(n > 1 ? 1 : 0);
	const fade = useRef(new Animated.Value(0)).current;
	const dir = useRef(1);

	useEffect(() => {
		if (n < 2) return;
		let cancelled = false;

		const run = (from: number) => {
			let d = dir.current;
			let to = from + d;
			if (to > n - 1) {
				d = -1;
				to = from - 1;
			} else if (to < 0) {
				d = 1;
				to = from + 1;
			}
			dir.current = d;
			setBase(from);
			setTop(to);
			fade.setValue(0);
			Animated.timing(fade, {
				toValue: 1,
				duration: frameMs,
				useNativeDriver: true,
			}).start(({ finished }) => {
				if (finished && !cancelled) run(to);
			});
		};

		run(0);
		return () => {
			cancelled = true;
			fade.stopAnimation();
		};
	}, [n, frameMs, fade]);

	if (n === 0) return <View style={styles.root}>{children}</View>;

	return (
		<View style={styles.root}>
			<Animated.Image
				source={frames[base]}
				resizeMode={resizeMode}
				style={StyleSheet.absoluteFill}
			/>
			<Animated.Image
				source={frames[top]}
				resizeMode={resizeMode}
				style={[StyleSheet.absoluteFill, { opacity: fade }]}
			/>
			<View style={styles.content}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, width: "100%", height: "100%" },
	content: { flex: 1 },
});
