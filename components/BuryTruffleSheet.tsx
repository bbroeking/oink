// "Bury a truffle" — a bottom-sheet dialogue for staking snouts as a buried
// truffle on your own barn (10/20/50). It lives in a modal (opaque sheet) so it
// reads on ANY equipped background, unlike the old inline band. Opened from the
// truffle spot by the pig's feet. On a successful bury it fires onBuried (the
// parent plays the mound's dig animation + refreshes) and closes itself.
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph, IconText } from "./ui/Glyph";
import { WHIMSY, SHADOW_SM, MODAL_BACKDROP_BG, RADII, SPACE, TYPE, PAGE_PAD } from "@/constants/theme";

const STAKES = [10, 20, 50];

interface Props {
	open: boolean;
	onClose: () => void;
	onBuried: () => void; // fired after a fresh successful bury (parent animates + refreshes)
	onResynced?: () => void; // a truffle was already down — just resync, no celebration
}

export function BuryTruffleSheet({ open, onClose, onBuried, onResynced }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	const [stake, setStake] = useState(20);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setNote(null);
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [open, anim]);

	if (!open) return null;

	const bury = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await rpcAction("bury_truffle", { p_amount: stake });
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onBuried();
			onClose();
		} else if (r.reason === "already_buried") {
			// A truffle's already down (e.g. buried on another device) — nothing was
			// staked, so don't play the fresh-bury celebration. Just resync + close
			// so the existing mound takes over.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			onResynced?.();
			onClose();
		} else if (r.reason === "too_poor") {
			setNote(`Need ${stake} snouts to bury this truffle.`);
		} else if (r.reason === "reclaim_cooldown") {
			// Host dug up their own truffle — 12h settle before the next bury
			// (server-enforced; see 20260738400000_truffle_reclaim_cooldown).
			const nextAt = Date.parse((r as { next_at?: string }).next_at ?? "");
			const hours = Number.isFinite(nextAt)
				? Math.max(1, Math.ceil((nextAt - Date.now()) / 3.6e6))
				: 12;
			setNote(
				`You dug this spot up yourself — the patch needs ${hours}h to settle before another bury.`
			);
		} else {
			// Transient network / SQL failure — keep the sheet open + retryable.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNote("Couldn't bury that truffle — try again in a moment.");
		}
	};

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
						<Text style={styles.title}>Bury a truffle</Text>
					</IconText>

					<Text style={styles.blurb}>
						Leave a truffle on your barn for visitors. The stake becomes a shared pot
						— friends who drop by dig shares of it for snouts.
					</Text>

					<Text style={styles.label}>Stake</Text>
					<View style={styles.stakes}>
						{STAKES.map((s) => {
							const on = s === stake;
							return (
								<Pressable
									key={s}
									onPress={() => {
										setStake(s);
										setNote(null); // drop any stale "need N snouts" note
									}}
									style={[styles.chip, on && styles.chipOn]}
								>
									<SnoutCoin size={16} />
									<Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
								</Pressable>
							);
						})}
					</View>

					{note && <Text style={styles.note}>{note}</Text>}

					<Pressable
						onPress={bury}
						disabled={busy}
						style={({ pressed }) => [styles.buryBtn, pressed && { opacity: 0.9 }]}
					>
						<Text style={styles.buryText}>
							{busy ? "burying…" : `Bury for visitors · ${stake} snouts`}
						</Text>
					</Pressable>
				</View>
			</Animated.View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const sticker = SHADOW_SM;
const styles = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: MODAL_BACKDROP_BG },
	sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACE.md + 2, paddingBottom: SPACE.xl + 4 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.xxl,
		padding: PAGE_PAD,
		paddingTop: SPACE.md - 2,
		...sticker,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: SPACE.md },
	kicker: { ...TYPE.kicker, letterSpacing: 1.2, color: WHIMSY.accent, marginBottom: 2 },
	titleRow: { marginBottom: SPACE.sm + 2 },
	title: { ...TYPE.pageTitle, color: INK },

	blurb: { ...TYPE.body, color: WHIMSY.mute, marginBottom: SPACE.lg - 2 },

	label: { ...TYPE.label, letterSpacing: 0.6, color: WHIMSY.mute, marginBottom: SPACE.sm },
	stakes: { flexDirection: "row", gap: SPACE.md },
	chip: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs + 1,
		paddingVertical: SPACE.sm + 2,
		borderRadius: RADII.lg,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
	},
	chipOn: { backgroundColor: WHIMSY.sun },
	chipText: { ...TYPE.numeral, color: WHIMSY.mute },
	chipTextOn: { color: INK },

	note: { ...TYPE.hand, color: WHIMSY.accent, textAlign: "center", marginTop: SPACE.md },

	buryBtn: {
		marginTop: SPACE.lg + 2,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.md + 1,
		alignItems: "center",
		...sticker,
	},
	buryText: { ...TYPE.numeral, color: INK },
});
