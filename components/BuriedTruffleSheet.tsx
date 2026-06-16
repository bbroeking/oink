// "Check on your truffle" — a bottom sheet showing how much of your buried
// truffle is left and which visitors have been digging it up, plus two host
// actions: top up the pot, or dig it back up (reclaim the unspent remainder).
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet, Dimensions, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph, IconText } from "./ui/Glyph";
import { WHIMSY, FONTS, SHADOW_SM } from "@/constants/theme";
import type { TruffleStatus } from "@/hooks/useBuriedTruffle";

const STAKES = [10, 20, 50];

interface Props {
	open: boolean;
	onClose: () => void;
	status: TruffleStatus | null;
	onChanged?: () => void; // top-up landed — re-fetch status (sheet stays open)
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

export function BuriedTruffleSheet({ open, onClose, status, onChanged }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	const [topUpStake, setTopUpStake] = useState(10);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [confirmReclaim, setConfirmReclaim] = useState(false);

	useEffect(() => {
		if (!open) return;
		setNote(null);
		setConfirmReclaim(false);
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [open, anim]);

	if (!open || !status?.buried) return null;

	const pct = status.total > 0 ? Math.max(0, Math.min(1, status.remaining / status.total)) : 0;
	const dugTotal = status.total - status.remaining;
	const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [screenH, 0] });

	const topUp = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		setConfirmReclaim(false); // a top-up disarms a pending reclaim — re-confirm the new total
		const r = await rpcAction("top_up_truffle", { p_amount: topUpStake });
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote(`Added ${topUpStake} to the pot.`);
			onChanged?.(); // re-fetch — the pot/bar update in place
		} else if (r.reason === "too_poor") {
			setNote(`Need ${topUpStake} snouts to top up.`);
		} else if (r.reason === "none") {
			// Truffle was reclaimed / fully dug elsewhere — nothing charged. Resync + close.
			onChanged?.();
			onClose();
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't top up — try again in a moment.");
		}
	};

	const reclaim = async () => {
		if (busy) return;
		if (!confirmReclaim) {
			// Two-tap guard — closing the truffle is deliberate. Arm + warn.
			setConfirmReclaim(true);
			setNote(null);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			return;
		}
		setBusy(true);
		setNote(null);
		const r = await rpcAction("reclaim_truffle");
		setBusy(false);
		setConfirmReclaim(false);
		if (r.ok || r.reason === "none") {
			// none = already closed elsewhere; either way the truffle's gone.
			if (r.ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onChanged?.(); // status flips to not-buried; the bury spot returns
			onClose();
		} else {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't dig it back up — try again in a moment.");
		}
	};

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

					{/* diggers — capped + scrollable so a long list (re-digs pile up
					    over days) can't push the action buttons off-screen */}
					{status.diggers.length > 0 && (
						<ScrollView style={styles.list} contentContainerStyle={styles.listInner} nestedScrollEnabled>
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
						</ScrollView>
					)}

					{/* Top up — add more snouts to the pot */}
					<View style={styles.divider} />
					<Text style={styles.actLabel}>Add to the pot</Text>
					<View style={styles.stakes}>
						{STAKES.map((s) => {
							const on = s === topUpStake;
							return (
								<Pressable
									key={s}
									onPress={() => {
										setTopUpStake(s);
										setNote(null);
										setConfirmReclaim(false); // disarm a pending reclaim
									}}
									style={[styles.chip, on && styles.chipOn]}
								>
									<SnoutCoin size={14} />
									<Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
								</Pressable>
							);
						})}
					</View>

					{note && <Text style={styles.note}>{note}</Text>}

					<Pressable
						onPress={topUp}
						disabled={busy}
						style={({ pressed }) => [styles.topUpBtn, pressed && { opacity: 0.9 }]}
					>
						<Text style={styles.topUpText}>{busy ? "…" : `Top up · ${topUpStake} snouts`}</Text>
					</Pressable>

					{/* Dig it back up — reclaim the unspent remainder + close the
					    truffle (two-tap; armed state turns red to read as destructive) */}
					<Pressable
						onPress={reclaim}
						disabled={busy}
						style={({ pressed }) => [
							styles.reclaimBtn,
							confirmReclaim && styles.reclaimBtnArmed,
							pressed && { opacity: 0.85 },
						]}
					>
						<Text style={[styles.reclaimText, confirmReclaim && styles.reclaimTextArmed]}>
							{confirmReclaim
								? `Tap again to close it · refund ${status.remaining}`
								: `Dig it back up · refund ${status.remaining}`}
						</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const sticker = SHADOW_SM;
const SCREEN_H = Dimensions.get("window").height;
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
		maxHeight: SCREEN_H * 0.9, // never taller than the screen
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

	list: { marginTop: 14, maxHeight: 150 }, // scrolls internally; keeps actions pinned
	listInner: { gap: 8 },
	digRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	digName: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 14, color: INK },
	digWhen: { fontFamily: FONTS.body, fontSize: 12, color: WHIMSY.mute },
	digAmt: { flexDirection: "row", alignItems: "center", gap: 3 },
	digAmtText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },

	divider: { height: 1.5, backgroundColor: "rgba(42,31,21,0.12)", marginTop: 18, marginBottom: 14 },
	actLabel: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 0.6, color: WHIMSY.mute, marginBottom: 8 },
	stakes: { flexDirection: "row", gap: 10 },
	chip: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
	},
	chipOn: { backgroundColor: WHIMSY.sun },
	chipText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.mute },
	chipTextOn: { color: INK },

	note: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.accent, textAlign: "center", marginTop: 12 },

	topUpBtn: {
		marginTop: 14,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		...sticker,
	},
	topUpText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },

	reclaimBtn: {
		marginTop: 10,
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: WHIMSY.muteSoft,
		borderRadius: 14,
		paddingVertical: 11,
		alignItems: "center",
	},
	reclaimText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.mute },
	// Armed (second-tap) state reads as destructive.
	reclaimBtnArmed: { backgroundColor: WHIMSY.rose, borderColor: INK, ...sticker },
	reclaimTextArmed: { color: WHIMSY.accent },
});
