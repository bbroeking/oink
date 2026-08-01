// "Check on your truffle" — a bottom sheet showing how much of your buried
// truffle is left and which visitors have been digging it up, plus two host
// actions: top up the pot, or dig it back up (reclaim the unspent remainder).
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet, Dimensions, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph, IconText } from "./ui/Glyph";
import { WHIMSY, FONTS, SHADOW_SM, MODAL_BACKDROP_BG, RADII, SPACE, TYPE, PAGE_PAD } from "@/constants/theme";
import { maxTopUp, POT_CAP } from "@/utils/burySnouts";
import { usePotStake } from "@/hooks/usePotStake";
import type { TruffleStatus } from "@/hooks/useBuriedTruffle";

// The two fixed chips; the third chip is "Max" (tops the pot to the 50-snout
// cap, bounded by the host's balance — resolved live in maxTopUp).
const FIXED_STAKES = [10, 20];

interface Props {
	open: boolean;
	balance: number; // live snout balance (profiles.counter) — bounds the "Max" chip
	// Queue-slotted (id 'truffleSheet', pri 5). `open` is the MOUNT gate and
	// must stay true through the POPUP_TEARDOWN_MS beat so this native Modal
	// stays mounted while its dismissal runs (PopupQueue "keep it mounted"
	// contract); `visible` drives the native Modal's visible so release() hides
	// it the same frame. Defaults to `open` if omitted.
	visible?: boolean;
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

export function BuriedTruffleSheet({ open, balance, visible, onClose, status, onChanged }: Props) {
	const screenH = useRef(Dimensions.get("window").height).current;
	const anim = useRef(new Animated.Value(0)).current;
	const [confirmReclaim, setConfirmReclaim] = useState(false);
	// Fires onClose exactly once per open-session so the two-phase teardown
	// below isn't re-triggered every render while `open` lingers through the beat.
	const closingRef = useRef(false);

	// A chip is either a fixed amount or "max" (resolves to a concrete number
	// against balance + headroom) — the top-up button always restates the number.
	// Computed null-safe so the shared stake hook can be called unconditionally
	// (before the not-buried early return); the values below are unused when the
	// sheet renders null. floor = 1 (any positive top-up), ceiling = whatever
	// fits both the pot's headroom and the live balance, Max = maxTopUp.
	const remaining = status?.buried ? status.remaining : 0;
	const headroom = POT_CAP - remaining; // how many more snouts fit (cap 50)
	const maxTop = maxTopUp(balance, remaining); // Max = min(balance, headroom)
	const { sel, select, busy, setBusy, note, setNote, stake: topUpStake, maxOk, canSubmit: canTopUp } =
		usePotStake({ defaultSel: 10, maxStake: maxTop, floor: 1, ceiling: Math.min(headroom, balance) });

	useEffect(() => {
		if (!open) return;
		setNote(null);
		setConfirmReclaim(false);
		anim.setValue(0);
		Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [open, anim]);

	// The slot (id 'truffleSheet', pri 5 — highest in the app) may never sit
	// PRESENTED while this sheet renders null: that wedges the queue and silently
	// suppresses every other popup for the session (issue #3). If we're open but
	// there's nothing buried to show — reclaimed / fully dug elsewhere, or a
	// fail-soft truffle_status fetch (useBuriedTruffle → buried:false on RPC
	// failure) — close quietly through the normal onClose so the slot releases.
	// onClose is two-phase (release() now, clears `open` a POPUP_TEARDOWN_MS beat
	// later); we DON'T cut `open` here same-frame. The ref latches it to one fire.
	useEffect(() => {
		if (!open) {
			closingRef.current = false;
			return;
		}
		if (!status?.buried && !closingRef.current) {
			closingRef.current = true;
			onClose();
		}
	}, [open, status?.buried, onClose]);

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
		} else if (r.reason === "max_reached") {
			setNote(`The pot maxes out at ${POT_CAP} snouts.`);
		} else if (r.reason === "bad_amount") {
			// A new client can outrun the server: the range-relaxing migration
			// isn't pushed yet, so a Max amount off the old {10,20,50} whitelist
			// bounces. Nudge back to a set stake — ship order stays harmless.
			setNote("Couldn't add that amount — pick a set stake for now.");
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
		<Modal visible={visible ?? open} transparent animationType="none" onRequestClose={onClose}>
			<Animated.View style={[styles.backdrop, { opacity: anim }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View pointerEvents="box-none" style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
				<View style={styles.sheet}>
					<View style={styles.grabber} />
					<IconText right={<Glyph name="pigface" size={20} />} gap={6} style={styles.titleRow}>
						<Text style={styles.title}>Your buried truffle</Text>
					</IconText>

					{/* remaining pot — one glanceable line + bar */}
					<View style={styles.potRow}>
						<SnoutCoin size={22} />
						<Text style={styles.potNum}>{status.remaining}</Text>
						<Text style={styles.potCap}>of {status.total} snouts left</Text>
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

					{/* Top up — add more snouts to the pot, capped at 50 */}
					<View style={styles.divider} />
					{headroom < 1 ? (
						<Text style={styles.maxNote}>Pot's at the {POT_CAP}-snout max.</Text>
					) : (
						<>
							<Text style={styles.actLabel}>Add to the pot · up to {POT_CAP}</Text>
							<View style={styles.stakes}>
								{FIXED_STAKES.map((s) => {
									const on = sel === s;
									const tooMuch = s > headroom || s > balance; // past the cap, or can't afford
									return (
										<Pressable
											key={s}
											disabled={tooMuch}
											onPress={() => {
												select(s); // select clears any stale note
												setConfirmReclaim(false); // disarm a pending reclaim
											}}
											style={[styles.chip, on && styles.chipOn, tooMuch && styles.chipOff]}
										>
											<SnoutCoin size={14} />
											<Text style={[styles.chipText, on && styles.chipTextOn, tooMuch && styles.chipTextOff]}>{s}</Text>
										</Pressable>
									);
								})}
								{/* Max — tops the pot to exactly 50, bounded by balance; dims
								    when there's nothing to add. */}
								<Pressable
									disabled={!maxOk}
									onPress={() => {
										select("max");
										setConfirmReclaim(false);
									}}
									style={[styles.chip, sel === "max" && styles.chipOn, !maxOk && styles.chipOff]}
								>
									<SnoutCoin size={14} />
									<Text style={[styles.chipText, sel === "max" && styles.chipTextOn, !maxOk && styles.chipTextOff]}>Max</Text>
								</Pressable>
							</View>

							<Pressable
								onPress={topUp}
								disabled={busy || !canTopUp}
								style={({ pressed }) => [
									styles.topUpBtn,
									!canTopUp && styles.topUpBtnOff,
									pressed && { opacity: 0.9 },
								]}
							>
								<Text style={styles.topUpText}>{busy ? "…" : `Top up · ${topUpStake} snouts`}</Text>
							</Pressable>
						</>
					)}

					{note && <Text style={styles.note}>{note}</Text>}

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
								? `Tap again · refund ${status.remaining}, no bury for 12h`
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
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: MODAL_BACKDROP_BG },
	sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACE.md + 2, paddingBottom: SPACE.xl + 4 },
	sheet: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.xxl,
		padding: PAGE_PAD,
		paddingTop: SPACE.md - 2,
		maxHeight: SCREEN_H * 0.9, // never taller than the screen
		...sticker,
	},
	grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: WHIMSY.muteSoft, marginBottom: SPACE.md },
	titleRow: { marginBottom: SPACE.lg - 2 },
	title: { ...TYPE.pageTitle, color: INK },

	potRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2 },
	potNum: { ...TYPE.sectionTitle, color: INK, marginLeft: 2 },
	potCap: { ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: WHIMSY.mute },
	track: {
		height: 12,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: INK,
		backgroundColor: WHIMSY.cream2,
		marginTop: SPACE.sm,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: WHIMSY.goblin, borderRadius: RADII.pill },
	sub: { ...TYPE.hand, color: WHIMSY.mute, marginTop: SPACE.sm + 2 },

	list: { marginTop: SPACE.lg - 2, maxHeight: 150 }, // scrolls internally; keeps actions pinned
	listInner: { gap: SPACE.sm },
	digRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	digName: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 14, color: INK },
	digWhen: { ...TYPE.bodySm, fontSize: 12, color: WHIMSY.mute },
	digAmt: { flexDirection: "row", alignItems: "center", gap: 3 },
	digAmtText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },

	divider: { height: 1.5, backgroundColor: INK, opacity: 0.12, marginTop: SPACE.lg + 2, marginBottom: SPACE.lg - 2 },
	actLabel: { ...TYPE.label, letterSpacing: 0.6, color: WHIMSY.mute, marginBottom: SPACE.sm },
	stakes: { flexDirection: "row", gap: SPACE.md },
	chip: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm + 1,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
	},
	chipOn: { backgroundColor: WHIMSY.sun },
	chipOff: { opacity: 0.4, borderColor: WHIMSY.muteSoft }, // would exceed the 50 cap
	chipText: { ...TYPE.numeral, color: WHIMSY.mute },
	chipTextOn: { color: INK },
	chipTextOff: { color: WHIMSY.mute },

	maxNote: { ...TYPE.body, color: WHIMSY.mute, textAlign: "center", paddingVertical: SPACE.xs },
	note: { ...TYPE.hand, color: WHIMSY.accent, textAlign: "center", marginTop: SPACE.md },

	topUpBtn: {
		marginTop: SPACE.lg - 2,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.md,
		alignItems: "center",
		...sticker,
	},
	topUpBtnOff: { opacity: 0.45 },
	topUpText: { ...TYPE.numeral, color: INK },

	reclaimBtn: {
		marginTop: SPACE.sm + 2,
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: WHIMSY.muteSoft,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm + 3,
		alignItems: "center",
	},
	reclaimText: { ...TYPE.body, fontFamily: FONTS.whimsy, color: WHIMSY.mute },
	// Armed (second-tap) state reads as destructive.
	reclaimBtnArmed: { backgroundColor: WHIMSY.rose, borderColor: INK, ...sticker },
	reclaimTextArmed: { color: WHIMSY.accent },
});
