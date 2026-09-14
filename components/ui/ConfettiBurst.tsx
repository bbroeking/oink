// A one-shot confetti burst for the Barn tap loop (Confetti Snout, weekday
// rituals 2026-09-14). The Barn mounts one and fires it per tickle while the
// blessing is on; it draws NOTHING at rest — no Views, no Animated.Values, no
// timers — so an ordinary Barn pays nothing for it.
//
// Sixteen paper bits in WHIMSY hues fly out of the centre on random headings,
// tumble, fall, and fade over ~900ms, then the whole burst unmounts itself.
// Each burst gets a fresh id, so a fast tickler's second tap starts a new
// burst rather than restarting a half-finished one.
//
// Reduce Motion: one static ring of bits that fades in, holds, and leaves. The
// ritual is still legible — the confetti is THERE — it just doesn't fly.
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	Animated,
	Easing,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { ART_SIZE, MOTION, RADII, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

export interface ConfettiBurstHandle {
	fire(): void;
}

export interface ConfettiBurstProps {
	// Diameter of the burst's box, px. Defaults to the caller's pig size.
	size?: number;
	style?: StyleProp<ViewStyle>;
}

// The paper the bits are cut from — the celebration end of WHIMSY, five hues so
// no two neighbours match.
const BIT_HUES = [
	WHIMSY.sun,
	WHIMSY.rose,
	WHIMSY.sky,
	WHIMSY.lilac,
	WHIMSY.sage,
] as const;

const BIT_COUNT = 16;
const BURST_MS = 900;
// Reduce Motion: fade the ring in over a state-change beat, hold, then leave.
const STATIC_FADE_MS = MOTION.sheetIn;

// Fixed scatter, not Math.random() per fire: a burst that is the same shape
// every time still reads as confetti, and a pure table keeps the component
// deterministic under test (and free of a render-time random).
const BITS = Array.from({ length: BIT_COUNT }, (_, i) => {
	// Golden-angle headings, so the spread never clumps; the radius and spin
	// wobble on the index so the ring is a burst, not a clock face.
	const angle = i * 137.5 * (Math.PI / 180);
	const wobble = ((i * 7919) % 100) / 100; // deterministic 0..1
	return {
		dx: Math.cos(angle) * (0.32 + wobble * 0.2),
		dy: Math.sin(angle) * (0.32 + wobble * 0.2),
		hue: BIT_HUES[i % BIT_HUES.length],
		spin: (i % 2 === 0 ? 1 : -1) * (180 + wobble * 360),
		w: 5 + Math.round(wobble * 4),
		h: 8 + Math.round(wobble * 5),
		delay: Math.round(wobble * 90),
	};
});

export const ConfettiBurst = forwardRef<ConfettiBurstHandle, ConfettiBurstProps>(
	function ConfettiBurst({ size = ART_SIZE.stage, style }, ref) {
		// null = at rest, nothing mounted. A number = the live burst's id.
		const [burst, setBurst] = useState<number | null>(null);
		const nextId = useRef(0);
		const { allowDecorativeMotion } = useMotionPolicy();

		const fire = useCallback(() => {
			nextId.current += 1;
			setBurst(nextId.current);
		}, []);
		useImperativeHandle(ref, () => ({ fire }), [fire]);

		const done = useCallback((id: number) => {
			setBurst((cur) => (cur === id ? null : cur));
		}, []);

		if (burst === null) return null;
		return (
			<View
				key={burst}
				pointerEvents="none"
				testID="confetti-burst"
				style={[styles.box, { width: size, height: size }, style]}
			>
				{BITS.map((bit, i) => (
					<ConfettiBit
						key={i}
						bit={bit}
						size={size}
						still={!allowDecorativeMotion}
						onDone={i === 0 ? () => done(burst) : undefined}
					/>
				))}
			</View>
		);
	},
);

function ConfettiBit({
	bit,
	size,
	still,
	onDone,
}: {
	bit: (typeof BITS)[number];
	size: number;
	still: boolean;
	onDone?: () => void;
}) {
	const v = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		const anim = still
			? Animated.timing(v, {
					toValue: 1,
					duration: STATIC_FADE_MS,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				})
			: Animated.timing(v, {
					toValue: 1,
					duration: BURST_MS,
					delay: bit.delay,
					// Out-fast then settle: the bits leap, then gravity takes them.
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				});
		anim.start();
		// Only one bit owns the teardown timer (the caller passes onDone to the
		// first), so a burst unmounts once rather than sixteen times.
		const id = onDone
			? setTimeout(onDone, still ? STATIC_FADE_MS + MOTION.beat : BURST_MS + 120)
			: null;
		return () => {
			anim.stop();
			v.stopAnimation();
			if (id) clearTimeout(id);
		};
	}, [v, still, bit.delay, onDone]);

	const travelX = bit.dx * size;
	const travelY = bit.dy * size;
	// Gravity-ish: the bit rises along its heading, then sags past it.
	const fall = size * 0.22;

	return (
		<Animated.View
			pointerEvents="none"
			testID="confetti-bit"
			style={{
				position: "absolute",
				left: size / 2 - bit.w / 2,
				top: size / 2 - bit.h / 2,
				width: bit.w,
				height: bit.h,
				borderRadius: RADII.hair,
				backgroundColor: bit.hue,
				opacity: still
					? v
					: v.interpolate({
							inputRange: [0, 0.1, 0.7, 1],
							outputRange: [0, 1, 1, 0],
						}),
				transform: still
					? [
							{ translateX: travelX },
							{ translateY: travelY },
							{ rotate: `${Math.round(bit.spin / 4)}deg` },
						]
					: [
							{
								translateX: v.interpolate({
									inputRange: [0, 1],
									outputRange: [0, travelX],
								}),
							},
							{
								translateY: v.interpolate({
									inputRange: [0, 0.45, 1],
									outputRange: [0, travelY, travelY + fall],
								}),
							},
							{
								rotate: v.interpolate({
									inputRange: [0, 1],
									outputRange: ["0deg", `${Math.round(bit.spin)}deg`],
								}),
							},
						],
			}}
		/>
	);
}

const styles = StyleSheet.create({
	// The burst rides above the pig it pops off, and never takes a tap — the
	// tickle underneath has to keep landing.
	box: { position: "absolute", left: 0, top: 0, zIndex: 20 },
});
