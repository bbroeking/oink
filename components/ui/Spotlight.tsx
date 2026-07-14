// Spotlight — the onboarding coach-mark primitive. Dims the whole screen, cuts a
// bright hole around one target control, breathes a halo around the hole, and
// forces the tap: the scrim swallows every touch EXCEPT the one that lands inside
// the hole (which passes straight through to the real control underneath).
//
// Three pieces, dependency-free beyond svg + reanimated (both already deps):
//
//   SpotlightProvider — a context + ref map. Targets register their measured
//                       window rect by id; the overlay reads the active id's rect.
//   SpotlightTarget   — wraps any child, measures it (measureInWindow) on layout
//                       and remeasures when asked, publishing its rect to the map.
//   SpotlightOverlay  — rendered once inside the provider. A full-screen Modal
//                       (so it sits above tab bars / headers), an SVG scrim with
//                       an even-odd rounded-rect hole, the breathing halo ring,
//                       and a Sticker caption card that auto-flips above/below the
//                       hole with a hand-drawn arrow pointing at it.
//
// TOUCH POLICY (the Fabric footgun, build 99): a full-screen absolute overlay
// eats ALL touches unless pointerEvents is handled deliberately. We DON'T try to
// carve a hole in pointerEvents — RN can't mask a view's touch region. Instead the
// scrim container answers onStartShouldSetResponder: if the touch point is inside
// the hole rect it returns FALSE (declining to capture, so the touch falls through
// the transparent Modal to the real control below) and fires onTargetPress; if
// it's on the scrim it returns TRUE (captures + drops the touch, optional wiggle).
// This works on the new architecture because the responder decision is made from
// the raw pageX/pageY BEFORE any child claims the gesture — no view-masking needed.

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	AccessibilityInfo,
	Dimensions,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
	type GestureResponderEvent,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import Svg, { Defs, Mask, Path, Rect } from "react-native-svg";
import Animated, {
	Easing,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { FONTS, RADII, SPACE, STICKER_SHADOW, TYPE, WHIMSY } from "@/constants/theme";

// A measured target rect in WINDOW coordinates (measureInWindow: page-absolute,
// the same space the responder event's pageX/pageY live in — so the hit-test and
// the drawn hole can never disagree).
export interface SpotlightRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Registry {
	register: (id: string, rect: SpotlightRect | null) => void;
	get: (id: string) => SpotlightRect | null;
	/** Bumped whenever any rect changes, so the overlay re-reads on remeasure. */
	version: number;
}

const SpotlightContext = createContext<Registry | null>(null);

// The provider owns the id → rect map. A plain ref map (no per-target state) keeps
// registration cheap; a version counter is the single reactive signal the overlay
// subscribes to, so a remeasure repaints the hole without a context-value churn.
export function SpotlightProvider({ children }: { children: ReactNode }) {
	const map = useRef<Map<string, SpotlightRect>>(new Map());
	const [version, setVersion] = useState(0);

	const register = useCallback((id: string, rect: SpotlightRect | null) => {
		const prev = map.current.get(id);
		if (rect === null) {
			if (prev === undefined) return;
			map.current.delete(id);
			setVersion((v) => v + 1);
			return;
		}
		// Skip a repaint when the rect is unchanged (layout passes fire freely).
		if (
			prev &&
			prev.x === rect.x &&
			prev.y === rect.y &&
			prev.width === rect.width &&
			prev.height === rect.height
		) {
			return;
		}
		map.current.set(id, rect);
		setVersion((v) => v + 1);
	}, []);

	const get = useCallback((id: string) => map.current.get(id) ?? null, []);

	const value = useMemo<Registry>(
		() => ({ register, get, version }),
		[register, get, version]
	);

	return (
		<SpotlightContext.Provider value={value}>
			{children}
		</SpotlightContext.Provider>
	);
}

function useRegistry(): Registry {
	const ctx = useContext(SpotlightContext);
	if (!ctx) {
		throw new Error("Spotlight components must live inside a <SpotlightProvider>");
	}
	return ctx;
}

// Wrap any control to make it a spotlight target. It measures itself on layout
// (and republishes on every layout pass, so scroll/rotation/font-scale reflows
// keep the hole aligned). Registers `null` on unmount so a stale rect can't haunt
// a later spotlight. `active` gates the measure work — off-screen targets pay
// nothing until the overlay wants them.
export function SpotlightTarget({
	id,
	active = true,
	children,
	style,
}: {
	id: string;
	/** Only measure while this target could actually be spotlit (cheap when false). */
	active?: boolean;
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const { register } = useRegistry();
	const ref = useRef<View>(null);

	const measure = useCallback(() => {
		if (!active) return;
		const node = ref.current;
		if (!node) return;
		node.measureInWindow((x, y, width, height) => {
			// A not-yet-laid-out node measures as zeros — don't publish a degenerate
			// rect the overlay would draw a hole around at the origin.
			if (width === 0 && height === 0) return;
			register(id, { x, y, width, height });
		});
	}, [active, id, register]);

	const onLayout = useCallback(
		(_e: LayoutChangeEvent) => {
			// measureInWindow is only accurate after the frame commits; defer a tick.
			requestAnimationFrame(measure);
		},
		[measure]
	);

	useEffect(() => {
		if (active) requestAnimationFrame(measure);
		return () => register(id, null);
	}, [active, id, measure, register]);

	return (
		<View ref={ref} collapsable={false} onLayout={onLayout} style={style}>
			{children}
		</View>
	);
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The pad the hole grows beyond the target's own bounds, and the hole corner
// radius — a hair rounder than the target so its outline reads as a soft cut, not
// a tight trace.
const HOLE_PAD = SPACE.sm; // ~8
const HALO_GAP = 6; // ring sits just outside the hole edge

interface SpotlightOverlayProps {
	/** The target id to spotlight, or null to render nothing. */
	activeId: string | null;
	/** Hand-voice, lowercase caption for the coach-mark card. */
	caption: string;
	/** Fired when the player taps THROUGH the hole onto the real control. */
	onTargetPress?: () => void;
	/** Fired when the player taps the scrim (dead zone) — default just wiggles. */
	onScrimPress?: () => void;
	/** Optional dismiss affordance (a quiet "skip" line under the caption). */
	onDismiss?: () => void;
	/** Corner radius of the cut hole; defaults to a soft RADII.lg. */
	holeRadius?: number;
}

// Rendered ONCE inside the provider (per-screen is fine — the Modal sits above
// that screen's chrome). Draws nothing until a valid rect exists for activeId.
export function SpotlightOverlay({
	activeId,
	caption,
	onTargetPress,
	onScrimPress,
	onDismiss,
	holeRadius = RADII.lg,
}: SpotlightOverlayProps) {
	const { get, version } = useRegistry();
	const [reduceMotion, setReduceMotion] = useState(false);

	// Respect the OS reduced-motion switch: no halo breathe, no caption wiggle.
	useEffect(() => {
		let alive = true;
		AccessibilityInfo.isReduceMotionEnabled()
			.then((on) => alive && setReduceMotion(on))
			.catch(() => {});
		const sub = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(on) => alive && setReduceMotion(on)
		);
		return () => {
			alive = false;
			sub?.remove?.();
		};
	}, []);

	// Re-read the active rect whenever the registry version ticks (remeasure) or
	// the active id changes. `version` is intentionally in the dep list.
	const rect = useMemo(
		() => (activeId ? get(activeId) : null),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[activeId, get, version]
	);

	// The halo breathe (scale 1 → 1.08) + a soft opacity breathe, ease in/out,
	// looped. Reversed sequence so it eases both ways. Held at rest when reduced.
	const pulse = useSharedValue(0);
	useEffect(() => {
		if (!rect || reduceMotion) {
			pulse.value = 0;
			return;
		}
		pulse.value = withRepeat(
			withSequence(
				withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
				withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
			),
			-1,
			false
		);
	}, [rect, reduceMotion, pulse]);

	// The caption wiggle — a quick shake when the player taps the dead scrim, a
	// gentle "not there, HERE" nudge. Held at 0 when reduced.
	const wiggle = useSharedValue(0);
	const bumpWiggle = useCallback(() => {
		if (reduceMotion) return;
		wiggle.value = withSequence(
			withTiming(-1, { duration: 55 }),
			withTiming(1, { duration: 55 }),
			withTiming(-0.6, { duration: 55 }),
			withTiming(0, { duration: 55 })
		);
	}, [reduceMotion, wiggle]);

	if (!rect) return null;

	const win = Dimensions.get("window");

	// The hole geometry — the target rect grown by HOLE_PAD on every side, clamped
	// into the window so a target near an edge doesn't cut off-screen.
	const hx = Math.max(0, rect.x - HOLE_PAD);
	const hy = Math.max(0, rect.y - HOLE_PAD);
	const hw = Math.min(win.width - hx, rect.width + HOLE_PAD * 2);
	const hh = Math.min(win.height - hy, rect.height + HOLE_PAD * 2);
	const holeCx = hx + hw / 2;
	const holeCy = hy + hh / 2;

	// Which half of the screen the hole sits in decides the caption's side: hole
	// in the top half → caption below it (arrow points up); bottom half → caption
	// above (arrow points down). Keeps the card off the target and on-screen.
	const holeInTopHalf = holeCy < win.height / 2;

	// The raw hit-test: is a page-space point inside the hole rect? This is the
	// whole touch policy — inside → let it fall through; outside → capture + drop.
	const pointInHole = (pageX: number, pageY: number) =>
		pageX >= hx && pageX <= hx + hw && pageY >= hy && pageY <= hy + hh;

	// onStartShouldSetResponder runs on touch-DOWN with page coords, BEFORE any
	// child grabs the gesture. Returning false here means "I decline this touch" —
	// on a transparent Modal the touch then falls through to the real control
	// underneath (Fabric-safe: the decision is coordinate-based, not view-masked).
	const onShouldSetResponder = (e: GestureResponderEvent) => {
		const { pageX, pageY } = e.nativeEvent;
		if (pointInHole(pageX, pageY)) {
			// Let the real control receive this touch; notify + dismiss on our side.
			onTargetPress?.();
			return false;
		}
		return true; // capture — the scrim is a dead zone.
	};

	// A captured scrim touch (outside the hole) resolves here: wiggle the caption
	// and run any onScrimPress. We never dismiss on a scrim tap (the point is to
	// keep insisting on the real control).
	const onScrimGrant = () => {
		bumpWiggle();
		onScrimPress?.();
	};

	return (
		<Modal
			transparent
			visible
			animationType="fade"
			statusBarTranslucent
			// No onRequestClose dismiss path by default — the coach-mark is only
			// satisfied by the real tap. A back-press falls to the optional dismiss.
			onRequestClose={() => onDismiss?.()}
		>
			<View
				style={StyleSheet.absoluteFill}
				// The single responder that governs the whole scrim. Its decision is
				// made from raw page coords, so the "hole" is a hit-test, not a masked
				// view — the reliable Fabric pattern.
				onStartShouldSetResponder={onShouldSetResponder}
				onMoveShouldSetResponder={onShouldSetResponder}
				onResponderGrant={onScrimGrant}
			>
				{/* The dimmed scrim with the cut hole — an SVG even-odd mask so the
				    hole is truly transparent (the real control shows through bright),
				    not just a lighter tint. pointerEvents none: the SVG never
				    intercepts; the responder View above owns every touch. */}
				<Svg
					width={win.width}
					height={win.height}
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
				>
					<Defs>
						<Mask id="spotlight-hole">
							{/* White = keep (dim); black = punch (bright hole). */}
							<Rect
								x={0}
								y={0}
								width={win.width}
								height={win.height}
								fill="#fff"
							/>
							<Rect
								x={hx}
								y={hy}
								width={hw}
								height={hh}
								rx={holeRadius}
								ry={holeRadius}
								fill="#000"
							/>
						</Mask>
					</Defs>
					<Rect
						x={0}
						y={0}
						width={win.width}
						height={win.height}
						fill={WHIMSY.ink}
						opacity={0.68}
						mask="url(#spotlight-hole)"
					/>
				</Svg>

				{/* The breathing halo ring, drawn as its own animated stroked path so
				    its scale/opacity breathe doesn't touch the mask. Sits just outside
				    the hole edge; centered on the hole so scale grows from the middle. */}
				<HaloRing
					cx={holeCx}
					cy={holeCy}
					width={hw + HALO_GAP * 2}
					height={hh + HALO_GAP * 2}
					radius={holeRadius + HALO_GAP}
					pulse={pulse}
				/>

				{/* The caption card — a hand-tilted Sticker with a hand-drawn arrow
				    pointing at the hole, flipped to whichever side keeps it on-screen. */}
				<CaptionCard
					caption={caption}
					onDismiss={onDismiss}
					holeCx={holeCx}
					holeTop={hy}
					holeBottom={hy + hh}
					below={holeInTopHalf}
					winWidth={win.width}
					winHeight={win.height}
					wiggle={wiggle}
				/>
			</View>
		</Modal>
	);
}

// The pulsing ring around the hole. A rounded-rect stroke path whose scale +
// opacity breathe on the shared `pulse` value (0 at rest → 1 at peak). Absolute,
// pointerEvents none — purely decorative, never a touch target.
function HaloRing({
	cx,
	cy,
	width,
	height,
	radius,
	pulse,
}: {
	cx: number;
	cy: number;
	width: number;
	height: number;
	radius: number;
	pulse: Animated.SharedValue<number>;
}) {
	// The ring lives in a small box sized to the ring and positioned so its OWN
	// center lands on the hole center — so a plain `scale` transform (which pivots
	// about a view's center by default) grows the ring symmetrically about the
	// hole, no transformOrigin needed (avoids a not-yet-typed RN style prop).
	const stroke = 3;
	const pad = stroke; // room for the stroke width so it isn't clipped
	const boxW = width + pad * 2;
	const boxH = height + pad * 2;
	// The rounded-rect path in the box's own local coords (inset by pad).
	const d = roundedRectPath(pad, pad, width, height, radius);

	const animatedProps = useAnimatedProps(() => ({
		strokeOpacity: 0.35 + pulse.value * 0.45,
	}));
	const style = useAnimatedStyle(() => ({
		transform: [{ scale: 1 + pulse.value * 0.08 }],
	}));

	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{
					position: "absolute",
					left: cx - boxW / 2,
					top: cy - boxH / 2,
					width: boxW,
					height: boxH,
				},
				style,
			]}
		>
			<Svg width={boxW} height={boxH} pointerEvents="none">
				<AnimatedPath
					d={d}
					fill="none"
					stroke={WHIMSY.sun}
					strokeWidth={stroke}
					strokeLinejoin="round"
					animatedProps={animatedProps}
				/>
			</Svg>
		</Animated.View>
	);
}

// A rounded-rect as an SVG path string (react-native-svg has no rounded <Path>
// helper). Corners are quarter arcs of `r`.
function roundedRectPath(
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
): string {
	const rr = Math.min(r, w / 2, h / 2);
	return [
		`M${x + rr},${y}`,
		`H${x + w - rr}`,
		`A${rr},${rr} 0 0 1 ${x + w},${y + rr}`,
		`V${y + h - rr}`,
		`A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}`,
		`H${x + rr}`,
		`A${rr},${rr} 0 0 1 ${x},${y + h - rr}`,
		`V${y + rr}`,
		`A${rr},${rr} 0 0 1 ${x + rr},${y}`,
		"Z",
	].join(" ");
}

// The caption card — a paper Sticker in the game's hand voice, tilted like it was
// stuck on, with a small hand-drawn arrow reaching toward the hole. Positioned by
// absolute top/left math off the hole so it hugs the target without covering it.
const CARD_WIDTH = 260;
const CARD_GAP = 18; // gap between hole edge and card
const ARROW_H = 22;

function CaptionCard({
	caption,
	onDismiss,
	holeCx,
	holeTop,
	holeBottom,
	below,
	winWidth,
	winHeight,
	wiggle,
}: {
	caption: string;
	onDismiss?: () => void;
	holeCx: number;
	holeTop: number;
	holeBottom: number;
	below: boolean;
	winWidth: number;
	winHeight: number;
	wiggle: Animated.SharedValue<number>;
}) {
	// Center the card on the hole horizontally, then clamp so it never runs off an
	// edge (PAGE-pad worth of margin on each side).
	const rawLeft = holeCx - CARD_WIDTH / 2;
	const left = Math.max(
		SPACE.md,
		Math.min(rawLeft, winWidth - CARD_WIDTH - SPACE.md)
	);
	// The arrow points from the card toward the hole, anchored under the hole's
	// horizontal center (clamped inside the card so it never floats past the edge).
	const arrowLeft = Math.max(
		SPACE.md,
		Math.min(holeCx - left, CARD_WIDTH - SPACE.md - 12)
	);

	// A gentle -1.2° resting tilt, plus the wiggle offset when the scrim's tapped.
	const style = useAnimatedStyle(() => ({
		transform: [{ rotate: `${-1.2 + wiggle.value * 2.5}deg` }],
	}));

	// Below the hole → anchor by top just under it. Above the hole → anchor by
	// bottom (window height − hole top) so the card+arrow stack grows UPWARD off
	// the hole edge without needing to know the card's exact height.
	const positional: ViewStyle = below
		? { top: holeBottom + CARD_GAP }
		: { bottom: winHeight - holeTop + CARD_GAP };

	// The arrow rides in its own full-width row so its `left` lands under the
	// hole's center; column order flips with the card side.
	const arrow = (
		<View style={styles.arrowRow} pointerEvents="none">
			<HandArrow
				direction={below ? "up" : "down"}
				style={{ position: "absolute", left: arrowLeft }}
			/>
		</View>
	);

	return (
		<Animated.View
			pointerEvents="box-none"
			style={[styles.captionLayer, { left }, positional, style]}
		>
			{/* Arrow ABOVE the card when the card is below the hole (points up at the
			    hole); arrow BELOW the card when the card is above the hole. */}
			{below && arrow}
			<View style={styles.card}>
				<Text style={styles.captionText}>{caption}</Text>
				{onDismiss && (
					<Pressable
						onPress={onDismiss}
						hitSlop={8}
						style={({ pressed }) => pressed && { opacity: 0.6 }}
					>
						<Text style={styles.skip}>maybe later ›</Text>
					</Pressable>
				)}
			</View>
			{!below && arrow}
		</Animated.View>
	);
}

// A small hand-drawn-feel arrow — a single curved stroke with a two-line head, in
// the sticker ink. Not a glyph asset: a bespoke SVG so it can point either way.
function HandArrow({
	direction,
	style,
}: {
	direction: "up" | "down";
	style?: StyleProp<ViewStyle>;
}) {
	const up = direction === "up";
	// A slightly wobbly shaft + a chevron head, drawn in a 24×ARROW_H box.
	const shaft = up
		? `M12,${ARROW_H - 2} C10,${ARROW_H * 0.6} 14,${ARROW_H * 0.4} 12,2`
		: `M12,2 C14,${ARROW_H * 0.4} 10,${ARROW_H * 0.6} 12,${ARROW_H - 2}`;
	const head = up
		? `M6,8 L12,2 L18,8`
		: `M6,${ARROW_H - 8} L12,${ARROW_H - 2} L18,${ARROW_H - 8}`;
	return (
		<View style={style} pointerEvents="none">
			<Svg width={24} height={ARROW_H}>
				<Path
					d={shaft}
					stroke={WHIMSY.ink}
					strokeWidth={2.5}
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d={head}
					stroke={WHIMSY.ink}
					strokeWidth={2.5}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	captionLayer: {
		position: "absolute",
		width: CARD_WIDTH,
		alignItems: "center",
	},
	card: {
		width: CARD_WIDTH,
		backgroundColor: WHIMSY.paper,
		borderColor: WHIMSY.ink,
		borderWidth: 2,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		...STICKER_SHADOW,
	},
	captionText: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	skip: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
		textDecorationLine: "underline",
	},
	// The arrow row spans the card width so the arrow's `left` lands under the
	// hole's horizontal center; the row's own height is the arrow's box.
	arrowRow: {
		width: CARD_WIDTH,
		height: ARROW_H,
	},
});
