// The Barn button — the one control in the scene's bottom-right corner, and the
// only place the home's secondary actions live (taste-standard, 2026-09-13).
//
// ITS FACE IS THE DEFAULT ACTION. While the Truffle Patch is open the face is
// the shovel on a sage fill with a slow dashed ring, and a tap digs; otherwise
// it is the barn door on sun, and a tap goes in. The little "+" on its shoulder
// (or a long press) fans the full list — Dig / Go in / Bury a truffle — over a
// scrim, with the default listed first and biggest. One tap on the face never
// makes the player pick from a menu to do the obvious thing.
//
// Decided 2026-09-13; comp in docs/design/claude-design/barn/action-button.html.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
	Animated,
	Dimensions,
	Easing,
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BarnDoor, Hand, Label, Shovel, T } from "./ui";
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
// How far each option climbs from the button when the fan opens.
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

export type BarnFace = "door" | "shovel";

export interface BarnFanOption {
	key: string;
	title: string;
	/** The hand line under the title ("the patch is open · 2h 10m"). */
	sub?: string;
	/** The option's mark: a `Glyph`, or one of the two faces. */
	mark: BarnFace | Exclude<ReactNode, string | Iterable<ReactNode>>;
	onPress: () => void;
	accessibilityHint?: string;
}

interface Props {
	/** Which face the button wears — and so which action a tap performs. */
	face: BarnFace;
	/** The word under the face on the scene ("go in" / "dig"). */
	label: string;
	/** What the face does. */
	onPrimary: () => void;
	accessibilityLabel: string;
	accessibilityHint?: string;
	/** The fan, default first. Fewer than two options and the "+" stays home. */
	options: BarnFanOption[];
	/** The dashed ring breathes: the patch is open right now. */
	live?: boolean;
	/** Where the button sits — the caller parks it in the scene's corner. */
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

function Face({ face, size }: { face: BarnFace; size: number }) {
	return face === "shovel" ? <Shovel size={size} /> : <BarnDoor size={size} />;
}

function Mark({ mark, size }: { mark: BarnFanOption["mark"]; size: number }) {
	if (mark === "door" || mark === "shovel") return <Face face={mark} size={size} />;
	return <>{mark}</>;
}

export function BarnButton({
	face,
	label,
	onPrimary,
	accessibilityLabel,
	accessibilityHint,
	options,
	live = false,
	style,
	testID,
}: Props) {
	const motion = useMotionPolicy();
	const [fanned, setFanned] = useState(false);
	const fan = useRef(new Animated.Value(0)).current;
	const breath = useRef(new Animated.Value(0)).current;

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
		Haptics.selectionAsync().catch(() => {});
		onPrimary();
	};
	const canFan = options.length > 1;

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
					? options.map((option, index) => {
							const isDefault = index === 0;
							const size = isDefault ? OPTION_DEFAULT : OPTION;
							const art = isDefault ? OPTION_ART_DEFAULT : OPTION_ART;
							// Each option rises from the button: the first one clears it,
							// the rest stack above at one option's pitch.
							const rest = FAB + OPTION_RISE + index * (OPTION + OPTION_RISE);
							const translateY = fan.interpolate({
								inputRange: [0, 1],
								outputRange: [OPTION_RISE, 0],
							});
							return (
								<Animated.View
									key={option.key}
									style={[
										styles.option,
										{ bottom: rest, opacity: fanOpacity, transform: [{ translateY }] },
									]}
								>
									<Pressable
										onPress={() => close(option.onPress)}
										accessibilityRole="button"
										accessibilityLabel={option.title}
										accessibilityHint={option.accessibilityHint}
										style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
									>
										<View style={[styles.optionTitle, isDefault && styles.optionTitleDefault]}>
											<T role="label">{option.title}</T>
											{option.sub ? (
												<Hand tone="secondary" numberOfLines={1}>
													{option.sub}
												</Hand>
											) : null}
										</View>
										<View
											style={[
												styles.optionMark,
												{ width: size, height: size },
												isDefault && styles.optionMarkDefault,
											]}
										>
											<Mark mark={option.mark} size={art} />
										</View>
									</Pressable>
								</Animated.View>
							);
						})
					: null}

				{live && !fanned ? (
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
						accessibilityLabel={accessibilityLabel}
						accessibilityHint={accessibilityHint}
						style={({ pressed }) => [
							styles.fab,
							live && styles.fabLive,
							pressed && styles.fabPressed,
						]}
					>
						<Face face={face} size={FACE} />
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
						<View pointerEvents="none" style={styles.label}>
							<Hand numberOfLines={1}>{label}</Hand>
						</View>
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
	// A fanned option: right-anchored on the seat, its mark under the button's
	// column and its title to the left.
	option: {
		position: "absolute",
		right: 0,
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
