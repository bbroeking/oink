// The Barn button — the one control in the scene's bottom-right corner, and the
// only place the home's secondary actions live (taste-standard, 2026-09-13).
//
// ITS FACE IS A STICKY QUICK ACTION. The face wears one action — the door,
// the shovel, or the truffle — and a tap on it fires that action. The little
// "+" on its shoulder (or a long press) fans the full list — Dig / Barn / Bury
// a truffle — over a scrim, the armed one first and biggest. A tap in the fan
// never fires: it ARMS. The fan folds, the face flips to that mark, and the
// player fires it from the page. The caller owns which action is armed (and
// remembers it); this component only reports the pick. One tap on the face
// never opens a menu; one tap in the fan never leaves the home.
//
// Decided 2026-09-13; comp in docs/design/claude-design/barn/action-button.html.
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	Easing,
	Platform,
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BarnDoor, Glyph, Hand, Label, Shovel, T } from "./ui";
import {
	BORDER,
	MODAL_BACKDROP_BG,
	OPACITY,
	PRESSED,
	RADII,
	PAGE_PAD,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	MOTION_DURATION,
	startDecorativeLoop,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";
import { POP_IN_SPRING } from "@/utils/motionRecipes";

// --- ART -------------------------------------------------------------------
// Drawing geometry for one control, in points.
const FAB = 72;
const FACE = 40;
// The "+" on the shoulder, and how far it overhangs the rim.
const MORE = 26;
const MORE_OVERHANG = -8;
// The dashed ring that breathes around the button while the patch is open.
const RING_OVERHANG = -10;
const RING_SCALE = 1.08;
const RING_BREATH_MS = 1800;
// A fanned option: its round mark, the bigger default mark, and the mark's art.
const OPTION = 50;
const OPTION_DEFAULT = 58;
const OPTION_ART = 28;
const OPTION_ART_DEFAULT = 34;
// The fan's column: one pitch from mark centre to mark centre, the gap between
// the button's rim and the first mark, and how far each option climbs from the
// button as the fan opens.
const OPTION_PITCH = 70;
const FAN_GAP = 18;
const OPTION_RISE = 24;
// How far a fanned row may reach left from the button: the page's width inside
// its gutters. An absolute child of the 72pt anchor is otherwise measured
// against the anchor and its copy clips.
const FAN_SPAN = Dimensions.get("window").width - PAGE_PAD * 2;
// The gap between the button's rim and the word beside it.
const LABEL_GAP = 12;
// Leans.
const FAB_TILT = "-3deg";
const LABEL_TILT = "-2deg";

/** The marks the button can wear — on its face and in the fan. */
export type BarnMark = "door" | "shovel" | "truffle";

export interface BarnFanOption {
	key: string;
	/** The fan row's title ("Dig" / "Barn" / "Bury a truffle"). */
	title: string;
	/** The hand line under the title ("+20 Pass XP · closes in 3h 25m"). */
	sub?: string;
	/** The word beside the button while this action is armed ("dig" / "barn"). */
	label: string;
	mark: BarnMark;
	/** What one tap on the face does while this action is armed. */
	onPress: () => void;
	/** The face's name and hint while this action is armed. */
	accessibilityLabel: string;
	accessibilityHint?: string;
	/**
	 * The action can't happen right now (the patch is shut, already dug). It
	 * stays in the fan so the player can see it exists and why, but it can't
	 * be pressed, can't be armed as the face's default, and the face wears
	 * the reason instead of the verb.
	 */
	disabled?: boolean;
	/** The hand line that explains `disabled` — on the fan row and beside the face. */
	disabledLine?: string;
}

interface Props {
	/** The fan, in its fixed order. Fewer than two options and the "+" stays home. */
	options: BarnFanOption[];
	/** Which option the face wears — and so which action a tap performs. Must be one of `options`. */
	armedKey: string;
	/** The player picked from the fan: arm this one. Fired after the fan folds. */
	onArm: (key: string) => void;
	/** The dashed ring breathes: the patch is open right now. */
	live?: boolean;
	/** Where the button sits — the caller parks it in the scene's corner. */
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

function Mark({ mark, size }: { mark: BarnMark; size: number }) {
	if (mark === "shovel") return <Shovel size={size} />;
	if (mark === "truffle") return <Glyph name="truffle" size={size} />;
	return <BarnDoor size={size} />;
}

export function BarnButton({ options, armedKey, onArm, live = false, style, testID }: Props) {
	const motion = useMotionPolicy();
	const [fanned, setFanned] = useState(false);
	const fan = useRef(new Animated.Value(0)).current;
	const breath = useRef(new Animated.Value(0)).current;
	const pop = useRef(new Animated.Value(1)).current;

	// The armed option leads the fan; the rest keep their fixed order.
	const armed = options.find((option) => option.key === armedKey) ?? options[0];
	const fanOptions = armed
		? [armed, ...options.filter((option) => option.key !== armed.key)]
		: options;

	// The face pops in when it changes hands. Under Reduce Motion it fades.
	const lastArmed = useRef(armed?.key);
	useEffect(() => {
		if (lastArmed.current === armed?.key) return;
		lastArmed.current = armed?.key;
		pop.setValue(0);
		(motion.reduceMotion
			? Animated.timing(pop, {
					toValue: 1,
					duration: MOTION_DURATION.crossfade,
					useNativeDriver: true,
				})
			: Animated.spring(pop, {
					toValue: 1,
					...POP_IN_SPRING,
					useNativeDriver: true,
				})
		).start();
	}, [armed?.key, pop, motion.reduceMotion]);

	// The fan springs up from the button and eases back down. Under Reduce
	// Motion it crossfades in place.
	useEffect(() => {
		if (fanned) {
			fan.setValue(0);
			(motion.reduceMotion
				? Animated.timing(fan, {
						toValue: 1,
						duration: MOTION_DURATION.crossfade,
						useNativeDriver: true,
					})
				: Animated.spring(fan, {
						toValue: 1,
						...POP_IN_SPRING,
						useNativeDriver: true,
					})
			).start();
		}
	}, [fanned, fan, motion.reduceMotion]);

	const close = useCallback(
		(then?: () => void) => {
			Animated.timing(fan, {
				toValue: 0,
				duration: motion.duration(MOTION_DURATION.state, MOTION_DURATION.crossfade),
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}).start(() => {
				setFanned(false);
				then?.();
			});
		},
		[fan, motion],
	);

	// The ring's breath while the patch is open — decoration, so it obeys the
	// motion policy and rests at its first frame otherwise.
	useEffect(() => {
		if (!live) {
			breath.setValue(0);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(breath, {
					toValue: 1,
					duration: RING_BREATH_MS / 2,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(breath, {
					toValue: 0,
					duration: RING_BREATH_MS / 2,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
			]),
		);
		return startDecorativeLoop({
			policy: motion,
			animation: loop,
			rest: () => breath.setValue(0),
		});
	}, [live, breath, motion]);

	const open = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		setFanned(true);
	};
	const primary = () => {
		if (!armed || armed.disabled) return;
		Haptics.selectionAsync().catch(() => {});
		armed.onPress();
	};
	const faceDisabled = !!armed?.disabled;
	// Arming is a light tap, not the action's own haptic — nothing has fired.
	const arm = (key: string) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		close(() => onArm(key));
	};
	const canFan = options.length > 1;
	// The sage fill belongs to the open patch and the shovel together; a door
	// or a truffle on the face stays on sun while the ring does the announcing.
	const sage = live && armed?.mark === "shovel" && !faceDisabled;

	const fanOpacity = fan.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

	return (
		<>
			{/* The scrim: the whole screen, only while the fan is open, so it can
			    never sit over Rosie and eat her taps the rest of the time (the
			    Fabric overlay footgun, build 99). Tap anywhere to fold. It is a
			    SIBLING of the anchor, so `absoluteFill` is the scene, not the seat. */}
			{fanned ? (
				<Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: fanOpacity }]}>
					<Pressable
						onPress={() => close()}
						accessibilityRole="button"
						accessibilityLabel="Close"
						accessibilityHint="Folds the Barn button's actions away"
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>
			) : null}

			<View style={[styles.anchor, style]} testID={testID}>
				{fanned
					? fanOptions.map((option, index) => {
							const isDefault = index === 0;
							const size = isDefault ? OPTION_DEFAULT : OPTION;
							const art = isDefault ? OPTION_ART_DEFAULT : OPTION_ART;
							// ONE COLUMN, ONE PITCH. Every mark — small, default, and the
							// button under them — shares the button's centre line, and the
							// marks' centres sit one pitch apart whatever their size, so
							// the fan reads as a ladder rather than a scatter.
							const rest = FAB + FAN_GAP + index * OPTION_PITCH + (OPTION_DEFAULT - size) / 2;
							const inset = (FAB - size) / 2;
							const translateY = fan.interpolate({
								inputRange: [0, 1],
								outputRange: [OPTION_RISE, 0],
							});
							return (
								<Animated.View
									key={option.key}
									style={[
										styles.option,
										{ bottom: rest, right: inset, opacity: fanOpacity, transform: [{ translateY }] },
									]}
								>
									<Pressable
										onPress={() => arm(option.key)}
										disabled={option.disabled}
										accessibilityRole="button"
										accessibilityLabel={option.title}
										accessibilityHint={
											option.disabled ? option.disabledLine : `Sets the Barn button to ${option.title}`
										}
										accessibilityState={{ selected: isDefault, disabled: !!option.disabled }}
										style={({ pressed }) => [
											styles.optionRow,
											pressed && !option.disabled && styles.optionPressed,
											option.disabled && styles.notAllowed,
										]}
									>
										<View
											style={[
												styles.optionTitle,
												isDefault && !option.disabled && styles.optionTitleDefault,
												option.disabled && styles.optionTitleDisabled,
											]}
										>
											<T role="label" tone={option.disabled ? "disabled" : "primary"}>
												{option.title}
											</T>
											{(option.disabled ? option.disabledLine : option.sub) ? (
												<Hand tone={option.disabled ? "disabled" : "secondary"} numberOfLines={1}>
													{option.disabled ? option.disabledLine : option.sub}
												</Hand>
											) : null}
										</View>
										<View
											style={[
												styles.optionMark,
												{ width: size, height: size },
												isDefault && !option.disabled && styles.optionMarkDefault,
												option.disabled && styles.optionMarkDisabled,
											]}
										>
											<View style={option.disabled ? styles.dimmed : null}>
												<Mark mark={option.mark} size={art} />
											</View>
										</View>
									</Pressable>
								</Animated.View>
							);
						})
					: null}

				{live && !fanned && !faceDisabled ? (
					<Animated.View
						pointerEvents="none"
						style={[
							styles.ring,
							{
								opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [OPACITY.ghost, OPACITY.rule] }),
								transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, RING_SCALE] }) }],
							},
						]}
					/>
				) : null}
				{fanned ? (
					<Pressable
						onPress={() => close()}
						accessibilityRole="button"
						accessibilityLabel="Close"
						accessibilityHint="Folds the Barn button's actions away"
						style={({ pressed }) => [styles.fab, styles.fabClosing, pressed && styles.fabPressed]}
					>
						<T role="display">×</T>
					</Pressable>
				) : (
					<Pressable
						onPress={primary}
						onLongPress={canFan ? open : undefined}
						accessibilityRole="button"
						accessibilityLabel={armed?.accessibilityLabel}
						accessibilityHint={faceDisabled ? armed?.disabledLine : armed?.accessibilityHint}
						accessibilityState={{ disabled: faceDisabled }}
						style={({ pressed, hovered }) => [
							styles.fab,
							sage && styles.fabLive,
							// A disabled face keeps its place in the yard but loses the
							// things that say "press me": the sun, the shadow, the ring.
							faceDisabled && styles.fabDisabled,
							// Web: the shove at half strength on hover, the full shove on press.
							hovered && !pressed && !faceDisabled && styles.fabHovered,
							pressed && !faceDisabled && styles.fabPressed,
							faceDisabled && styles.notAllowed,
						]}
					>
						<Animated.View
							style={[{ opacity: pop, transform: [{ scale: pop }] }, faceDisabled && styles.dimmed]}
						>
							{armed ? <Mark mark={armed.mark} size={FACE} /> : null}
						</Animated.View>
						{canFan ? (
							<Pressable
								onPress={open}
								hitSlop={SPACE.sm}
								accessibilityRole="button"
								accessibilityLabel="More"
								accessibilityHint="Fans out everything the Barn button can do"
								style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
							>
								<Label>+</Label>
							</Pressable>
						) : null}
						{armed ? (
							<View pointerEvents="none" style={[styles.label, faceDisabled && styles.labelDisabled]}>
								<Hand numberOfLines={1} tone={faceDisabled ? "disabled" : "primary"}>
									{faceDisabled && armed.disabledLine ? armed.disabledLine : armed.label}
								</Hand>
							</View>
						) : null}
					</Pressable>
				)}
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	scrim: {
		backgroundColor: MODAL_BACKDROP_BG,
	},
	// Where the button sits: the caller positions this anchor; the fan stacks
	// above it in the same coordinate space.
	anchor: {
		width: FAB,
		height: FAB,
		alignItems: "center",
		justifyContent: "center",
	},
	fab: {
		width: FAB,
		height: FAB,
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: FAB_TILT }],
		...STICKER_SHADOW,
	},
	fabLive: {
		backgroundColor: WHIMSY.sage,
	},
	// Not now: cream, flat, no shadow — the shove affordance is what says
	// "tappable", so its absence says "not now". The tilt and the seat stay so
	// the yard doesn't rearrange.
	fabDisabled: {
		backgroundColor: WHIMSY.cream2,
		borderColor: UI_COLORS.uiMuted,
		shadowOpacity: 0,
		elevation: 0,
	},
	// Web hover: half the pressed shove, no shadow change.
	fabHovered: {
		transform: [{ rotate: FAB_TILT }, { translateX: 1 }, { translateY: 1 }],
	},
	dimmed: {
		opacity: OPACITY.dim,
	},
	// RN Web honours `cursor`; native ignores it.
	notAllowed: (Platform.OS === "web" ? { cursor: "not-allowed" } : {}) as ViewStyle,
	fabClosing: {
		backgroundColor: WHIMSY.paper,
		transform: [],
	},
	fabPressed: {
		...PRESSED,
		transform: [{ rotate: FAB_TILT }, { translateX: SPACE.xxs }, { translateY: SPACE.xxs }],
		elevation: 0,
	},
	ring: {
		position: "absolute",
		top: RING_OVERHANG,
		left: RING_OVERHANG,
		right: RING_OVERHANG,
		bottom: RING_OVERHANG,
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
	},
	more: {
		position: "absolute",
		top: MORE_OVERHANG,
		right: MORE_OVERHANG,
		width: MORE,
		height: MORE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	morePressed: {
		...PRESSED,
		elevation: 0,
	},
	// The word beside the face, hanging off the button's left edge.
	label: {
		position: "absolute",
		right: FAB + LABEL_GAP,
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		transform: [{ rotate: LABEL_TILT }],
		...SHADOW_SM,
	},
	labelDisabled: {
		backgroundColor: WHIMSY.cream2,
		borderColor: UI_COLORS.uiMuted,
		shadowOpacity: 0,
		elevation: 0,
	},
	optionTitleDisabled: {
		backgroundColor: WHIMSY.cream2,
		borderColor: UI_COLORS.uiMuted,
		shadowOpacity: 0,
		elevation: 0,
	},
	optionMarkDisabled: {
		backgroundColor: WHIMSY.cream2,
		borderColor: UI_COLORS.uiMuted,
		shadowOpacity: 0,
		elevation: 0,
	},
	// A fanned option: right-anchored on the seat, its mark under the button's
	// column and its title to the left.
	option: {
		position: "absolute",
		width: FAN_SPAN,
		alignItems: "flex-end",
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	optionPressed: {
		opacity: OPACITY.pressed,
	},
	optionTitle: {
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	optionTitleDefault: {
		backgroundColor: WHIMSY.sun,
	},
	optionMark: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	optionMarkDefault: {
		backgroundColor: WHIMSY.sage,
		...STICKER_SHADOW,
	},
});
