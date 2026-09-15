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
// One toast at a time, MOTION.toast of dwell, MOTION.fade in and out. Hosts
// register in a module-level STACK: the root host is the floor, and a native
// Modal (Ceremony, SlideUpSheet) mounts a host of its own on top, because a
// native Modal paints over the root — a toast fired inside the visit used to
// land on the root host, invisible under the scene (2026-09-15). The LAST host
// mounted takes the calls, never a broadcast; unmounting removes that host by
// identity, so closing a Modal hands the calls back to whoever is left. No
// host: calls simply no-op.
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

const TOAST_Z = 200;
const BADGE_SIZE = SPACE.xxl;
const ICON_SIZE = SPACE.lg;
const COIN_SIZE = SPACE.card;
// How far the card drops in from above, when motion is allowed.
const DROP = -SPACE.md;

// The host stack. `showToast` addresses hosts[hosts.length - 1] only.
type SetToast = (t: Toast | null) => void;
const hosts: SetToast[] = [];

export function showToast(opts: ToastOpts): void {
	const host = hosts[hosts.length - 1];
	if (!host) return;
	host({ ...opts, ts: Date.now() });
}

export function ToastHost({ top }: { top?: number } = {}) {
	const [toast, setToast] = useState<Toast | null>(null);
	const opacity = useRef(new Animated.Value(0)).current;
	const ty = useRef(new Animated.Value(DROP)).current;
	const insets = useSafeAreaInsets();
	const { reduceMotion } = useMotionPolicy();
	// The toast line: just under the safe area by default; a scene with its
	// own top chrome passes the line under that chrome instead (the visit's
	// host clears its tallies — 2026-09-15, placement B).
	const topLine = top ?? insets.top + SPACE.sm;

	useEffect(() => {
		const mine: SetToast = (t) => setToast(t);
		hosts.push(mine);
		return () => {
			// By identity, never pop(): a host that unmounts out of order (the
			// root never does, but a sheet under a visit can) must remove
			// itself, not whoever mounted last.
			const at = hosts.indexOf(mine);
			if (at >= 0) hosts.splice(at, 1);
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
			style={[styles.wrap, { top: topLine }]}
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
		// Above every scene: a toast is the topmost transient wherever its host
		// sits. The visit's root fills its Modal at zIndex 100, so a host
		// inside that Modal at 50 painted under the barn (2026-09-15).
		zIndex: TOAST_Z,
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
