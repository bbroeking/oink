// Toast — the one transient outcome surface (design-system spec §2, row 07).
//
// An outcome or a refusal is a toast; a decision is a ConfirmDialog; a branch is
// an ActionSheet; Alert.alert is for OS-level errors and nothing else. Promoted
// out of components/PurchaseToast.tsx so the shape is a primitive rather than a
// shop feature (the shop keeps calling it through a compat module).
//
//   showToast({ tone: "success", title: "Bought the Moonlit Cap", text: "…" })
//   showToast({ tone: "fail", title: "Not enough snouts" })
//   showToast({ tone: "info", title: "Your herd oinked" })
//
// One toast at a time, MOTION.toast of dwell, MOTION.fade in and out. The host
// is mounted once at app root; the imperative call routes through a
// module-level callback the host registers on mount, so calls before/without a
// host simply no-op.
//
// Reduce Motion: the drop-from-the-top translate is dropped entirely — the card
// cross-fades in place. The announcement is NOT motion, so it always fires.

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BORDER,
	MOTION,
	PAGE_PAD,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Icon, type IconName } from "./Icon";
import { SnoutCoin } from "./SnoutCoin";
import { Sticker } from "./Sticker";
import { Hand, Numeral, T } from "./Text";

export type ToastTone = "success" | "fail" | "info";

export interface ToastOpts {
	tone: ToastTone;
	title?: string;
	text?: string;
	/** Success only: the snouts this outcome cost, rendered as a "−N" chip. */
	cost?: number;
}

type Toast = ToastOpts & { ts: number };

// Per-tone dressing. The tint IS the semantics (sage = it worked, rose = it
// didn't, sky = here's something) and the icon repeats it for anyone who can't
// read the tint. `alert` isn't in the Icon set, so failure wears `x`.
const TONES: Record<
	ToastTone,
	{ fill: string; icon: IconName; badge: string; fallbackTitle: string }
> = {
	success: {
		fill: WHIMSY.sage,
		icon: "check",
		badge: UI_COLORS.successText,
		fallbackTitle: "Done",
	},
	fail: {
		fill: WHIMSY.rose,
		icon: "x",
		badge: UI_COLORS.dangerText,
		fallbackTitle: "That didn't work",
	},
	info: {
		fill: WHIMSY.sky,
		icon: "bell",
		badge: UI_COLORS.infoText,
		fallbackTitle: "Heads up",
	},
};

const BADGE_SIZE = SPACE.xxl;
const ICON_SIZE = SPACE.lg;
const COIN_SIZE = SPACE.card;
// How far the card drops in from above, when motion is allowed.
const DROP = -SPACE.md;

// Module-level callback set by ToastHost on mount. Stays quiet if no host is
// mounted — calls just no-op.
let setToastRef: ((t: Toast | null) => void) | null = null;

export function showToast(opts: ToastOpts): void {
	if (!setToastRef) return;
	setToastRef({ ...opts, ts: Date.now() });
}

export function ToastHost() {
	const [toast, setToast] = useState<Toast | null>(null);
	const opacity = useRef(new Animated.Value(0)).current;
	const ty = useRef(new Animated.Value(DROP)).current;
	const insets = useSafeAreaInsets();
	const { reduceMotion } = useMotionPolicy();

	useEffect(() => {
		setToastRef = (t) => setToast(t);
		return () => {
			setToastRef = null;
		};
	}, []);

	// Announce, animate in, dwell, animate out.
	useEffect(() => {
		if (!toast) return;
		const tone = TONES[toast.tone];
		AccessibilityInfo.announceForAccessibility(
			toast.title ?? tone.fallbackTitle,
		);
		opacity.setValue(0);
		ty.setValue(reduceMotion ? 0 : DROP);
		Animated.parallel([
			Animated.timing(opacity, {
				toValue: 1,
				duration: MOTION.fade,
				useNativeDriver: true,
			}),
			Animated.timing(ty, {
				toValue: 0,
				duration: reduceMotion ? 0 : MOTION.fade,
				useNativeDriver: true,
			}),
		]).start();

		const id = setTimeout(() => {
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 0,
					duration: MOTION.fade,
					useNativeDriver: true,
				}),
				Animated.timing(ty, {
					toValue: reduceMotion ? 0 : DROP,
					duration: reduceMotion ? 0 : MOTION.fade,
					useNativeDriver: true,
				}),
			]).start(() =>
				// Only clear if this is still the current toast (a new toast could
				// have replaced it before the timeout fired).
				setToast((cur) => (cur?.ts === toast.ts ? null : cur)),
			);
		}, MOTION.toast);
		return () => clearTimeout(id);
	}, [toast, opacity, ty, reduceMotion]);

	if (!toast) return null;
	const tone = TONES[toast.tone];

	return (
		<View
			style={[styles.wrap, { top: insets.top + SPACE.sm }]}
			pointerEvents="box-none"
		>
			<Animated.View
				accessibilityLiveRegion="polite"
				accessible
				accessibilityLabel={[toast.title ?? tone.fallbackTitle, toast.text]
					.filter(Boolean)
					.join(". ")}
				style={{ opacity, transform: [{ translateY: ty }] }}
			>
				<Sticker
					color={tone.fill}
					rotate={TILT.card}
					radius={RADII.lg}
					border={BORDER.ink}
					style={styles.card}
				>
					<View style={[styles.badge, { backgroundColor: tone.badge }]}>
						<Icon
							name={tone.icon}
							size={ICON_SIZE}
							color={UI_COLORS.surface}
							strokeWidth={2.6}
						/>
					</View>
					<View style={styles.copy}>
						<T role="cardTitleSm" numberOfLines={1}>
							{toast.title ?? tone.fallbackTitle}
						</T>
						{!!toast.text && (
							<Hand tone="secondary" numberOfLines={2} style={styles.text}>
								{toast.text}
							</Hand>
						)}
					</View>
					{toast.tone === "success" && typeof toast.cost === "number" && (
						<View style={styles.costRow}>
							<SnoutCoin size={COIN_SIZE} />
							<Numeral tone="accent">−{toast.cost}</Numeral>
						</View>
					)}
				</Sticker>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: "absolute",
		left: PAGE_PAD,
		right: PAGE_PAD,
		zIndex: 50,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	badge: {
		width: BADGE_SIZE,
		height: BADGE_SIZE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	copy: {
		flex: 1,
		minWidth: 0,
	},
	text: {
		marginTop: SPACE.xxs,
	},
	costRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
});
