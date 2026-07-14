// Global purchase toast — slides down from the top of the screen,
// auto-dismisses after 2.6s. Surface anywhere via
//
//   showPurchaseToast({ type: "success", title: "...", text: "...", cost?: N })
//   showPurchaseToast({ type: "fail",    title: "...", text: "..." })
//
// One toast at a time. The host is mounted once at app root
// (app/_layout.tsx); the imperative call routes through a
// module-level callback the host registers on mount.
//
// Visual spec from the redesign: sage tint + ✓ for success, rose
// tint + ! for failure; success can show a "−N" snout-coin chip on
// the right when a cost is provided.
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Icon } from "./ui/Icon";
import { COLORS, FONTS, WHIMSY, STICKER_SHADOW } from "@/constants/theme";

export interface PurchaseToastOpts {
	type: "success" | "fail";
	title?: string;
	text?: string;
	cost?: number;
}

type Toast = PurchaseToastOpts & { ts: number };

// Module-level callback set by PurchaseToastHost on mount. Stays
// quiet if no host is mounted — calls just no-op.
let setToastRef: ((t: Toast | null) => void) | null = null;

export function showPurchaseToast(opts: PurchaseToastOpts): void {
	if (!setToastRef) return;
	const ts = Date.now();
	setToastRef({ ...opts, ts });
}

export function PurchaseToastHost() {
	const [toast, setToast] = useState<Toast | null>(null);
	const opacity = useRef(new Animated.Value(0)).current;
	const ty = useRef(new Animated.Value(-12)).current;

	useEffect(() => {
		setToastRef = (t) => setToast(t);
		return () => {
			setToastRef = null;
		};
	}, []);

	// Slide in / dismiss timer.
	useEffect(() => {
		if (!toast) return;
		Animated.parallel([
			Animated.timing(opacity, {
				toValue: 1,
				duration: 220,
				useNativeDriver: true,
			}),
			Animated.spring(ty, {
				toValue: 0,
				friction: 8,
				tension: 80,
				useNativeDriver: true,
			}),
		]).start();
		const id = setTimeout(() => {
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 0,
					duration: 180,
					useNativeDriver: true,
				}),
				Animated.timing(ty, {
					toValue: -12,
					duration: 180,
					useNativeDriver: true,
				}),
			]).start(() =>
				// Only clear if this is still the current toast (a new toast
				// could have replaced it before the timeout fired).
				setToast((cur) => (cur?.ts === toast.ts ? null : cur))
			);
		}, 2600);
		return () => clearTimeout(id);
	}, [toast, opacity, ty]);

	if (!toast) return null;
	const isSuccess = toast.type !== "fail";

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Animated.View
				style={[
					styles.card,
					{
						backgroundColor: isSuccess ? WHIMSY.sage : WHIMSY.rose,
						opacity,
						transform: [{ translateY: ty }],
					},
				]}
			>
				<View
					style={[
						styles.iconCircle,
						{ backgroundColor: isSuccess ? COLORS.successText : WHIMSY.accent },
					]}
				>
					{isSuccess ? (
						<Icon name="check" size={16} color={WHIMSY.paper} strokeWidth={2.6} />
					) : (
						<Text style={styles.iconGlyph}>!</Text>
					)}
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.title} numberOfLines={1}>
						{toast.title ??
							(isSuccess ? "Purchase complete" : "Purchase failed")}
					</Text>
					<Text style={styles.text} numberOfLines={2}>
						{toast.text ??
							(isSuccess
								? "Equipped & added to your closet."
								: "Something went wrong. Try again?")}
					</Text>
				</View>
				{isSuccess && typeof toast.cost === "number" && (
					<View style={styles.costRow}>
						<SnoutCoin size={14} />
						<Text style={styles.costText}>−{toast.cost}</Text>
					</View>
				)}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: "absolute",
		top: 56,
		left: 14,
		right: 14,
		zIndex: 50,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	iconCircle: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	iconGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.paper,
		lineHeight: 22,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		lineHeight: 18,
	},
	text: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	costRow: { flexDirection: "row", alignItems: "center", gap: 4 },
	costText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.accent,
	},
});
