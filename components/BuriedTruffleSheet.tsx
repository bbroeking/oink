// "Check on your truffle" — a bottom sheet showing how much of your buried
// truffle is left and which visitors have been digging it up.
import { useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet, Dimensions } from "react-native";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph, IconText } from "./ui/Glyph";
import { WHIMSY, FONTS } from "@/constants/theme";
import type { TruffleStatus } from "@/hooks/useBuriedTruffle";

interface Props {
	open: boolean;
	onClose: () => void;
	status: TruffleStatus | null;
}

// "just now" / "12m ago" / "3h ago" / "2d ago"
function ago(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 60_000) return "just now";
	const m = Math.floor(ms / 60_000);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

export function BuriedTruffleSheet({ open, onClose, status }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!open) return;
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [open, anim]);

	if (!open || !status?.buried) return null;

	const pct = status.total > 0 ? Math.max(0, Math.min(1, status.remaining / status.total)) : 0;
	const dugTotal = status.total - status.remaining;
	const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [screenH, 0] });

	return (
		<Modal visible transparent animationType="none" onRequestClose={onClose}>
			<Animated.View style={[styles.backdrop, { opacity: anim }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View pointerEvents="box-none" style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<IconText left={<Glyph name="star" size={12} />} gap={4}>
						<Text style={styles.kicker}>YOUR TRUFFLE</Text>
					</IconText>
					<IconText right={<Glyph name="pigface" size={20} />} gap={6} style={styles.titleRow}>
						<Text style={styles.title}>Buried truffle</Text>
					</IconText>

					{/* remaining pot */}
					<View style={styles.potRow}>
						<SnoutCoin size={22} />
						<Text style={styles.potNum}>{status.remaining}</Text>
						<Text style={styles.potCap}> / {status.total} left</Text>
					</View>
					<View style={styles.track}>
						<View style={[styles.fill, { width: `${pct * 100}%` }]} />
					</View>
					<Text style={styles.sub}>
						{dugTotal > 0
							? `Visitors have dug up ${dugTotal} snout${dugTotal === 1 ? "" : "s"} so far.`
							: "No one's dug it up yet — waiting for a visitor."}
					</Text>

					{/* diggers */}
					{status.diggers.length > 0 && (
						<View style={styles.list}>
							{status.diggers.map((d, i) => (
								<View key={i} style={styles.digRow}>
									<Text style={styles.digName} numberOfLines={1}>
										{d.username}
									</Text>
									<Text style={styles.digWhen}>{ago(d.dug_at)}</Text>
									<View style={styles.digAmt}>
										<SnoutCoin size={14} />
										<Text style={styles.digAmtText}>+{d.amount}</Text>
									</View>
								</View>
							))}
						</View>
					)}

					<Pressable onPress={onClose} style={styles.doneBtn}>
						<Text style={styles.doneText}>Done</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const sticker = { shadowColor: INK, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 };
const styles = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,16,28,0.5)" },
	sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 28 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 22,
		padding: 18,
		paddingTop: 10,
		...sticker,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: 12 },
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	titleRow: { marginBottom: 14 },
	title: { fontFamily: FONTS.whimsy, fontSize: 24, color: INK },

	potRow: { flexDirection: "row", alignItems: "center", gap: 6 },
	potNum: { fontFamily: FONTS.whimsy, fontSize: 22, color: INK, marginLeft: 2 },
	potCap: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute },
	track: {
		height: 12,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: INK,
		backgroundColor: "rgba(42,31,21,0.1)",
		marginTop: 8,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: "#e8a82e", borderRadius: 999 },
	sub: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute, marginTop: 10 },

	list: { marginTop: 14, gap: 8 },
	digRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	digName: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 14, color: INK },
	digWhen: { fontFamily: FONTS.body, fontSize: 12, color: WHIMSY.mute },
	digAmt: { flexDirection: "row", alignItems: "center", gap: 3 },
	digAmtText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },

	doneBtn: {
		marginTop: 18,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		...sticker,
	},
	doneText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
});
