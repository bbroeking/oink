// ── ReclaimSlam ──────────────────────────────────────────────────────────────
// The shared "slam" payoff for every scuffle minigame: the moment a scoop lands,
// a burst of golden joy-motes rips FROM a Hungerer-side anchor and flies TO the
// player's tally — the earned points made visible as joy pried back from the
// Great Hunger (see SKILL.md 2026-07-06 decision). Reuses the Barn HeartFloats
// vocabulary (imperative spawn handle + RN Animated particles, native-driven)
// so it stays procedural — no baked sprites, no new deps.
//
// Mount it as the last child of a minigame's root view; drive it through the
// ref. Parameterized by INTENSITY (a wisp for a small find, a burst for a run
// banked / both-truffles haul) and by from/to anchors (0..1 fractions of the
// overlay box — his corner → your tally).

import React, {
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { View, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { WHIMSY } from "@/constants/theme";

export type SlamIntensity = "wisp" | "pop" | "burst";

export interface SlamOpts {
	/** How much joy tears loose — scales mote count + haptic weight. */
	intensity?: SlamIntensity;
	/** The Hungerer-side source, as a 0..1 fraction of the overlay box. */
	from?: { x: number; y: number };
	/** The player's-tally target, as a 0..1 fraction of the overlay box. */
	to?: { x: number; y: number };
	/** Fire the reclaim haptic (default true). Pass false where the caller
	 *  already buzzes on the exact same beat so the two don't stack. */
	haptic?: boolean;
}

export interface ReclaimSlamHandle {
	slam: (opts?: SlamOpts) => void;
}

const TIER: Record<SlamIntensity, { count: number; size: number }> = {
	wisp: { count: 4, size: 9 },
	pop: { count: 7, size: 11 },
	burst: { count: 12, size: 13 },
};

// Defaults: joy rips from his corner (top-right) and flies to your tally
// (bottom-centre) — overridable per-site when the anchors differ.
const DEFAULT_FROM = { x: 0.82, y: 0.14 };
const DEFAULT_TO = { x: 0.5, y: 0.92 };

interface Mote {
	id: number;
	sx: number; // start px (overlay-local)
	sy: number;
	ex: number; // end px
	ey: number;
	lift: number; // arc apex offset (negative = up)
	size: number;
	delay: number;
	duration: number;
	anim: Animated.Value;
}

function jitter(base: number, spread: number): number {
	return base + (Math.random() * 2 - 1) * spread;
}

export const ReclaimSlam = React.forwardRef<ReclaimSlamHandle, {}>(
	function ReclaimSlam(_props, ref) {
		const [motes, setMotes] = useState<Mote[]>([]);
		const nextId = useRef(0);
		const box = useRef({ w: 0, h: 0 });

		const slam = useCallback((opts: SlamOpts = {}) => {
			const { w, h } = box.current;
			if (w <= 0 || h <= 0) return; // not laid out yet — no anchors to fly between
			const tier = TIER[opts.intensity ?? "pop"];
			const from = opts.from ?? DEFAULT_FROM;
			const to = opts.to ?? DEFAULT_TO;
			const fx = from.x * w;
			const fy = from.y * h;
			const tx = to.x * w;
			const ty = to.y * h;

			if (opts.haptic !== false) {
				const kind = opts.intensity ?? "pop";
				if (kind === "burst") {
					Haptics.notificationAsync(
						Haptics.NotificationFeedbackType.Success
					).catch(() => {});
				} else {
					Haptics.impactAsync(
						kind === "wisp"
							? Haptics.ImpactFeedbackStyle.Light
							: Haptics.ImpactFeedbackStyle.Medium
					).catch(() => {});
				}
			}

			for (let i = 0; i < tier.count; i++) {
				const id = nextId.current++;
				const anim = new Animated.Value(0);
				const mote: Mote = {
					id,
					sx: jitter(fx, 14),
					sy: jitter(fy, 12),
					ex: jitter(tx, 18),
					ey: jitter(ty, 14),
					lift: -(26 + Math.random() * 30),
					size: tier.size * (0.8 + Math.random() * 0.5),
					delay: Math.floor(Math.random() * 90),
					duration: 520 + Math.floor(Math.random() * 260),
					anim,
				};
				setMotes((m) => [...m, mote]);
				Animated.timing(anim, {
					toValue: 1,
					duration: mote.duration,
					delay: mote.delay,
					useNativeDriver: true,
				}).start(() => {
					setMotes((m) => m.filter((x) => x.id !== id));
				});
			}
		}, []);

		useImperativeHandle(ref, () => ({ slam }), [slam]);

		return (
			<View
				pointerEvents="none"
				style={StyleSheet.absoluteFill}
				onLayout={(e) => {
					box.current = {
						w: e.nativeEvent.layout.width,
						h: e.nativeEvent.layout.height,
					};
				}}
			>
				{motes.map((f) => {
					const translateX = f.anim.interpolate({
						inputRange: [0, 1],
						outputRange: [f.sx, f.ex],
					});
					// Gentle arc: apex lifted above the straight line, mid-flight.
					const translateY = f.anim.interpolate({
						inputRange: [0, 0.5, 1],
						outputRange: [f.sy, (f.sy + f.ey) / 2 + f.lift, f.ey],
					});
					const opacity = f.anim.interpolate({
						inputRange: [0, 0.12, 0.82, 1],
						outputRange: [0, 1, 1, 0],
					});
					const scale = f.anim.interpolate({
						inputRange: [0, 0.18, 0.85, 1],
						outputRange: [0.4, 1.15, 1, 0.7],
					});
					return (
						<Animated.View
							key={f.id}
							style={[
								styles.mote,
								{
									width: f.size,
									height: f.size,
									borderRadius: f.size / 2,
									left: 0,
									top: 0,
									// translate first (native), then position via translate
									transform: [{ translateX }, { translateY }, { scale }],
									opacity,
									marginLeft: -f.size / 2,
									marginTop: -f.size / 2,
								},
							]}
						>
							{/* tiny inner glint keeps the mote from reading as a flat dot */}
							<View style={styles.glint} />
						</Animated.View>
					);
				})}
			</View>
		);
	}
);

const styles = StyleSheet.create({
	mote: {
		// WHIMSY.sun is the paper-sticker palette's gold — a golden joy-mote with
		// the standard ink outline, matching the war UI's sticker vocabulary.
		position: "absolute",
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	glint: {
		width: "38%",
		height: "38%",
		borderRadius: 999,
		backgroundColor: WHIMSY.paper,
	},
});
