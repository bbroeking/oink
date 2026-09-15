// RitualBubble — the cast moment for a blessing or a curse.
//
// The ritual's own painted sticker, sealed in a soap bubble, rises from the
// bottom edge of the whole screen to just under the safe area and pops. A
// small paper tag hangs under it: "Cloud Nine → Bandit". No card, no title,
// no dismiss — the friend row's notice is the lasting record; this is only
// the moment. (Design: docs/design/taste-standard.md, 2026-09-15.)
//
//   showRitualBubble({ mode: "bless", ritual, targetName: "Bandit",
//                      announcement: "Cloud Nine sent to Bandit" })
//
// Same host pattern as Toast: mounted once at app root, the imperative call
// routes through a module-level callback the host registers on mount, so a
// call before/without a host no-ops. One bubble at a time — a second cast
// replaces the first at the surface beat, never stacks.
//
// It is NOT fired from the profile sheet's RitualPicker: that sheet is a
// native Modal, which paints over a root host, so the picker keeps its own
// in-sheet "sent" beat.
//
// Three motions, three values, so each is one interpolation:
//   rise   — bottom → header, the overshoot surface, the pop (master 0→1)
//   sway   — a sideways sine + a little tilt, looping on its own clock
//   wobble — the soap-bubble breathing (scaleX/scaleY), same clock as sway
// A blessing is buoyant (MOTION.ritualRiseBless, sparkles trickle behind
// it); a curse is heavier (MOTION.ritualRiseCurse, bigger tilt, drips fall).
//
// Reduce Motion: no travel, no loops — the bubble cross-fades at mid-screen
// and holds a beat. The announcement is not motion, so it always fires.

import { useEffect, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	Easing,
	Image,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	ART_SIZE,
	BORDER,
	MOTION,
	PAGE_PAD,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { RitualMode, TodayRitual } from "@/utils/rituals";
import { Glyph } from "./Glyph";
import { Sticker } from "./Sticker";
import { Hand, T } from "./Text";

export interface RitualBubbleOpts {
	mode: RitualMode;
	/** What was cast — the server's kind, so the art matches the day it landed on. */
	ritual: TodayRitual;
	targetName: string;
	/** The sentence a screen reader hears — the caster's outcome text. */
	announcement: string;
}

type Bubble = RitualBubbleOpts & { ts: number };

// ── Drawing constants ───────────────────────────────────────────────────
// Per-mode feel. Not SPACE steps: these are the bubble's own physics.
const FEEL: Record<
	RitualMode,
	{
		skin: string;
		ring: string;
		droplet: string;
		/** Sideways drift, px, and the tilt that goes with it, degrees. */
		swayPx: number;
		tiltDeg: number;
		/** One full sway cycle, ms. */
		swayMs: number;
		/** The overshoot peak on the surface beat. */
		surfaceScale: number;
		/** The swell just before the pop. */
		popScale: number;
		/** How far the droplets fly, px. */
		dropletThrow: number;
	}
> = {
	bless: {
		skin: WHIMSY.blessSurface,
		ring: WHIMSY.bless,
		droplet: WHIMSY.sun,
		swayPx: 14,
		tiltDeg: 4,
		swayMs: 1100,
		surfaceScale: 1.09,
		popScale: 1.16,
		dropletThrow: 62,
	},
	curse: {
		skin: WHIMSY.curseSurface,
		ring: WHIMSY.curseGreen,
		droplet: WHIMSY.curseSurface,
		swayPx: 9,
		tiltDeg: 6,
		swayMs: 1500,
		surfaceScale: 1.07,
		popScale: 1.14,
		dropletThrow: 54,
	},
};

// Surface-to-pop travel per mode, from the two flat MOTION tokens.
const RISE_MS: Record<RitualMode, number> = {
	bless: MOTION.ritualRiseBless,
	curse: MOTION.ritualRiseCurse,
};
const BUBBLE = ART_SIZE.bubble;
const ART = ART_SIZE.thumb;
const TRAIL_GLYPH = ART_SIZE.glyphSm;
const DRIP_W = 10;
const DRIP_H = 14;
const DROPLET = 12;
const RING_INSET = -6;
// The bubble breathes ±4% — a soap skin, not a ball.
const WOBBLE = 0.04;
// Where along the rise each beat lands — fractions of the TRAVEL TIME. The
// master value runs on RISE_EASING (slow off the bottom edge, slowing again
// under the header), so every interpolation reads its stops through `at()`,
// which turns a time fraction into the master's value at that moment. The
// native driver takes no `easing` inside an interpolation, so the curve can
// live nowhere else.
const SURFACE_AT = 0.12;
const SETTLE_AT = 0.18;
const POP_AT = 0.88;
const GONE_AT = 0.92;
const POP_MS = 280;
const RISE_EASING = Easing.inOut(Easing.quad);
const at = (timeFraction: number) => RISE_EASING(timeFraction);
// Six droplets on 60° spokes.
const DROPLET_ANGLES = [0, 60, 120, 180, 240, 300];
// The trail's stagger per particle, ms.
const TRAIL_STAGGER: Record<RitualMode, number> = { bless: 260, curse: 380 };
const TRAIL_COUNT = 3;
const TRAIL_FALL = 70;
// Where the trail hangs from, relative to the bubble's top-left.
const TRAIL_X = [-12, 6, -24];
const TRAIL_TOP = BUBBLE - DROPLET;
const TAG_TOP = BUBBLE + SPACE.xs;

// Module-level host registry. The LAST host mounted takes the calls — the
// root host normally, a dev preview's own host while that screen is up — and
// unmounting hands the calls back to whoever is left. No host: calls no-op.
type SetBubble = (b: Bubble | null) => void;
const hosts: SetBubble[] = [];

export function showRitualBubble(opts: RitualBubbleOpts): void {
	const host = hosts[hosts.length - 1];
	if (!host) return;
	host({ ...opts, ts: Date.now() });
}

export function RitualBubbleHost() {
	const [bubble, setBubble] = useState<Bubble | null>(null);
	const { height: windowH, width: windowW } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const { reduceMotion } = useMotionPolicy();

	// Lazy-state, not a ref: the values are render inputs, and this is the
	// idiom that keeps react-hooks/refs quiet (see Friends' RitualCastNotice).
	const [rise] = useState(() => new Animated.Value(0));
	const [sway] = useState(() => new Animated.Value(0));
	const [pop] = useState(() => new Animated.Value(0));
	// Reduce Motion's cross-fade rides its own value so the rise interpolations
	// never see a partial travel.
	const [fade] = useState(() => new Animated.Value(0));

	useEffect(() => {
		const mine: SetBubble = (b) => setBubble(b);
		hosts.push(mine);
		return () => {
			const at = hosts.indexOf(mine);
			if (at >= 0) hosts.splice(at, 1);
		};
	}, []);

	useEffect(() => {
		if (!bubble) return;
		const feel = FEEL[bubble.mode];
		AccessibilityInfo.announceForAccessibility(bubble.announcement);

		// Only clear if this is still the current bubble — a new cast could have
		// replaced it before its run finished.
		const clear = () =>
			setBubble((cur) => (cur?.ts === bubble.ts ? null : cur));

		if (reduceMotion) {
			fade.setValue(0);
			const run = Animated.sequence([
				Animated.timing(fade, {
					toValue: 1,
					duration: MOTION.fade,
					useNativeDriver: true,
				}),
				Animated.delay(MOTION.beat),
				Animated.timing(fade, {
					toValue: 0,
					duration: MOTION.fade,
					useNativeDriver: true,
				}),
			]);
			run.start(({ finished }) => finished && clear());
			return () => run.stop();
		}

		rise.setValue(0);
		sway.setValue(0);
		pop.setValue(0);
		const total = RISE_MS[bubble.mode];
		const climb = Animated.timing(rise, {
			toValue: 1,
			duration: total,
			easing: RISE_EASING,
			useNativeDriver: true,
		});
		// Sway + wobble share one clock: −1 → 1 → −1, a sine each way.
		const drift = Animated.loop(
			Animated.sequence([
				Animated.timing(sway, {
					toValue: 1,
					duration: feel.swayMs / 2,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
				Animated.timing(sway, {
					toValue: -1,
					duration: feel.swayMs / 2,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
			]),
		);
		// The pop fires at POP_AT of the climb — its own value, delayed to land
		// on that beat, so the ring and droplets are one interpolation each.
		const burst = Animated.sequence([
			Animated.delay(total * POP_AT),
			Animated.timing(pop, {
				toValue: 1,
				duration: POP_MS,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		]);
		drift.start();
		const run = Animated.parallel([climb, burst]);
		run.start(({ finished }) => {
			drift.stop();
			if (finished) clear();
		});
		return () => {
			drift.stop();
			run.stop();
		};
	}, [bubble, fade, pop, reduceMotion, rise, sway]);

	if (!bubble) return null;
	const feel = FEEL[bubble.mode];
	const isBless = bubble.mode === "bless";

	// The travel: surface from under the bottom edge, pop just under the safe
	// area — the same top line a Toast sits on.
	const startY = windowH + BUBBLE;
	const endY = insets.top + SPACE.sm;
	const surfaceY = startY - (startY - endY) * 0.2;
	const translateY = reduceMotion
		? (windowH - BUBBLE) / 2
		: rise.interpolate({
				inputRange: [0, at(SURFACE_AT), at(SETTLE_AT), at(POP_AT), 1],
				outputRange: [startY, surfaceY, surfaceY - BUBBLE, endY, endY],
			});
	const scale = reduceMotion
		? 1
		: rise.interpolate({
				inputRange: [0, at(SURFACE_AT), at(SETTLE_AT), at(POP_AT), at(GONE_AT), 1],
				outputRange: [0.45, feel.surfaceScale, 1, 1, feel.popScale, feel.popScale],
			});
	const opacity = reduceMotion
		? fade
		: rise.interpolate({
				inputRange: [0, at(0.04), at(POP_AT), at(GONE_AT), 1],
				outputRange: [0, 1, 1, 0, 0],
			});
	const swayX = reduceMotion
		? 0
		: sway.interpolate({ inputRange: [-1, 1], outputRange: [-feel.swayPx, feel.swayPx] });
	const tilt = reduceMotion
		? "0deg"
		: sway.interpolate({
				inputRange: [-1, 1],
				outputRange: [`${-feel.tiltDeg}deg`, `${feel.tiltDeg}deg`],
			});
	const wobbleX = reduceMotion
		? 1
		: sway.interpolate({ inputRange: [-1, 1], outputRange: [1 + WOBBLE, 1 - WOBBLE] });
	const wobbleY = reduceMotion
		? 1
		: sway.interpolate({ inputRange: [-1, 1], outputRange: [1 - WOBBLE, 1 + WOBBLE] });
	// The tag fades up a beat after the surface and is gone before the pop.
	const tagOpacity = reduceMotion
		? fade
		: rise.interpolate({
				inputRange: [0, at(SURFACE_AT), at(SETTLE_AT), at(POP_AT - 0.04), at(POP_AT), 1],
				outputRange: [0, 0, 1, 1, 0, 0],
			});
	const ringScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
	const ringOpacity = pop.interpolate({
		inputRange: [0, 0.1, 1],
		outputRange: [0, 0.9, 0],
	});
	const dropletY = pop.interpolate({
		inputRange: [0, 1],
		outputRange: [0, -feel.dropletThrow],
	});
	const dropletOpacity = pop.interpolate({
		inputRange: [0, 0.1, 0.8, 1],
		outputRange: [0, 1, 0.6, 0],
	});
	const dropletScale = pop.interpolate({
		inputRange: [0, 0.1, 1],
		outputRange: [0.6, 1, 0.5],
	});

	return (
		<View
			style={styles.host}
			pointerEvents="none"
			testID="ritual-bubble-host"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Animated.View
				style={[
					styles.rise,
					{ left: (windowW - BUBBLE) / 2, opacity, transform: [{ translateY }, { scale }] },
				]}
			>
				<Animated.View
					style={[
						styles.sway,
						{ transform: [{ translateX: swayX }, { rotate: tilt }] },
					]}
				>
					{/* the pop: a ring rushing out, six droplets on their spokes */}
					<Animated.View
						style={[
							styles.ring,
							{ borderColor: feel.ring, opacity: ringOpacity, transform: [{ scale: ringScale }] },
						]}
					/>
					{DROPLET_ANGLES.map((deg) => (
						<Animated.View
							key={deg}
							style={[
								styles.droplet,
								{
									backgroundColor: feel.droplet,
									opacity: dropletOpacity,
									transform: [
										{ rotate: `${deg}deg` },
										{ translateY: dropletY },
										{ scale: dropletScale },
									],
								},
							]}
						/>
					))}

					{/* the trail: sparkles let go behind a blessing; drips fall from a curse */}
					{!reduceMotion &&
						Array.from({ length: TRAIL_COUNT }, (_, i) => (
							<Trail
								key={i}
								index={i}
								mode={bubble.mode}
								rise={rise}
								total={RISE_MS[bubble.mode]}
							/>
						))}

					{/* the skin */}
					<Animated.View
						style={[
							styles.skin,
							{ backgroundColor: feel.skin, transform: [{ scaleX: wobbleX }, { scaleY: wobbleY }] },
						]}
					>
						<Image source={bubble.ritual.icon} style={styles.art} resizeMode="contain" />
						<View style={styles.shine} />
						<View style={styles.shineDot} />
					</Animated.View>

					{/* the tag */}
					<Animated.View
						style={[
							styles.tagWrap,
							{ left: -(windowW - BUBBLE) / 2, width: windowW, opacity: tagOpacity },
						]}
					>
						<Sticker
							color="paper"
							radius={RADII.sm}
							rotate={TILT.card}
							border={BORDER.ink}
							shadow="sm"
							style={[styles.tag, { maxWidth: windowW - PAGE_PAD * 2 }]}
							testID={`ritual-bubble-${isBless ? "bless" : "curse"}`}
						>
							<T role="cardTitleSm" numberOfLines={1}>
								{bubble.ritual.name}
							</T>
							<Hand tone="secondary" numberOfLines={1} style={styles.tagTo}>
								→ {bubble.targetName}
							</Hand>
						</Sticker>
					</Animated.View>
				</Animated.View>
			</Animated.View>
		</View>
	);
}

// One trail particle. It rides the master rise value so it needs no clock of
// its own: each particle lets go a stagger later and falls TRAIL_FALL behind
// the bubble, twice over the climb.
function Trail({
	index,
	mode,
	rise,
	total,
}: {
	index: number;
	mode: RitualMode;
	rise: Animated.Value;
	total: number;
}) {
	const start = SETTLE_AT + (TRAIL_STAGGER[mode] * index) / total;
	const span = 0.2;
	// Two drops over the climb, the second half a climb later.
	const second = start + 0.32;
	const clamp = (v: number) => Math.min(v, POP_AT - 0.01);
	const inputRange = [
		0,
		start,
		clamp(start + span * 0.35),
		clamp(start + span),
		clamp(second),
		clamp(second + span * 0.35),
		clamp(second + span),
		1,
	].map(at);
	// Interpolation input ranges must be monotonic; the clamp above can fold
	// two stops onto one value, so nudge any repeat forward by a hair.
	for (let i = 1; i < inputRange.length; i++) {
		if (inputRange[i] <= inputRange[i - 1]) inputRange[i] = inputRange[i - 1] + 0.0001;
	}
	const opacity = rise.interpolate({
		inputRange,
		outputRange: [0, 0, 1, 0, 0, 1, 0, 0],
	});
	const fall = rise.interpolate({
		inputRange,
		outputRange: [0, 0, TRAIL_FALL * 0.2, TRAIL_FALL, 0, TRAIL_FALL * 0.2, TRAIL_FALL, 0],
	});
	const left = TRAIL_X[index % TRAIL_X.length];
	if (mode === "bless") {
		return (
			<Animated.View
				style={[styles.trail, { left, opacity, transform: [{ translateY: fall }] }]}
			>
				<Glyph name="sparkle" size={TRAIL_GLYPH} />
			</Animated.View>
		);
	}
	return (
		<Animated.View
			style={[styles.drip, { left: left + SPACE.sm, opacity, transform: [{ translateY: fall }] }]}
		/>
	);
}

const styles = StyleSheet.create({
	host: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		// Under the Toast (200): a refusal toast, if one ever coincides, reads on top.
		zIndex: 40,
	},
	rise: {
		position: "absolute",
		top: 0,
		width: BUBBLE,
		height: BUBBLE,
	},
	sway: {
		width: BUBBLE,
		height: BUBBLE,
	},
	skin: {
		width: BUBBLE,
		height: BUBBLE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...STICKER_SHADOW,
	},
	art: {
		width: ART,
		height: ART,
	},
	// Two paper highlights make a sphere out of a disc.
	shine: {
		position: "absolute",
		left: SPACE.lg,
		top: SPACE.card,
		width: SPACE.lg,
		height: SPACE.sm,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		transform: [{ rotate: "-32deg" }],
	},
	shineDot: {
		position: "absolute",
		left: SPACE.card,
		top: SPACE.xl,
		width: SPACE.xs,
		height: SPACE.xs,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
	},
	ring: {
		position: "absolute",
		left: RING_INSET,
		top: RING_INSET,
		right: RING_INSET,
		bottom: RING_INSET,
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
	},
	droplet: {
		position: "absolute",
		left: (BUBBLE - DROPLET) / 2,
		top: (BUBBLE - DROPLET) / 2,
		width: DROPLET,
		height: DROPLET,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	trail: {
		position: "absolute",
		top: TRAIL_TOP,
		width: TRAIL_GLYPH,
		height: TRAIL_GLYPH,
	},
	drip: {
		position: "absolute",
		top: TRAIL_TOP + SPACE.sm,
		width: DRIP_W,
		height: DRIP_H,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sky,
	},
	// Full window wide and centred on the bubble, so the tag centres itself
	// under it whatever its text measures.
	tagWrap: {
		position: "absolute",
		top: TAG_TOP,
		alignItems: "center",
	},
	tag: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
	},
	tagTo: {
		flexShrink: 1,
	},
});
