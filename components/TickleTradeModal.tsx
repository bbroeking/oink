// The Tickle Stockyard — a 1920s livestock-yard reskin of the trade
// modal. Trade MECHANICS are unchanged (fulfill / cancel RPCs, the
// pending-trade filtering); this is presentation only.
//
//   "At the Gate"    — incoming requests: a friend asked YOU. Give / pass.
//   "Out to Market"  — your outgoing requests, awaiting an answer. Withdraw.
//
// There is no repay step — fulfilling means the asker pockets 2N and
// you get only a social promise. See trade-interface-design.md and
// migrations/20260520010000_tickle_trades.sql.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	ScrollView,
	Animated,
	Easing,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { FONTS, MODAL_BACKDROP_BG, STICKER_SHADOW, WHIMSY } from "@/constants/theme";

// ── Stockyard palette — warm aged wood, cream paper, chalk. Local to
// this surface; the season alignment tints still ride on the cards.
const YARD = {
	board:     "#8A5E34", // the plank board behind everything
	plankLine: "#6E4A28", // groove between planks
	sign:      "#C68A4E", // the hanging sign face
	signEdge:  "#6E4A28",
	rail:      "#7A5230", // fence rail
	brass:     "#C99B23", // the GIVE button
	chalk:     "#33402F", // chalkboard footer
	chalkInk:  "#EDE6D6", // chalk lettering
};

export interface TickleTrade {
	id: string;
	requester_id: string;
	target_id: string;
	amount: number;
	status: "pending" | "fulfilled";
	created_at: string;
	fulfilled_at: string | null;
	partner_username: string | null;
	partner_discriminator: string | null;
}

// Public hook other components (Barn) use to surface the unread count.
export function useTickleTrades(userId: string | null) {
	const [trades, setTrades] = useState<TickleTrade[]>([]);
	const load = useCallback(async () => {
		if (!userId) return;
		const { data } = await supabase.rpc("my_tickle_trades");
		setTrades(((data as TickleTrade[] | null) ?? []));
	}, [userId]);
	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);
	// Actionable = incoming pending requests (fulfill or decline).
	// Fulfilled trades are terminal — there's no repay step to chase.
	const actionableCount = useMemo(() => {
		if (!userId) return 0;
		return trades.filter(
			(t) => t.status === "pending" && t.target_id === userId
		).length;
	}, [trades, userId]);
	return { trades, actionableCount, reload: load };
}

interface Props {
	visible: boolean;
	onClose: () => void;
	userId: string;
	trades: TickleTrade[];
	onChanged: () => void;
}

export function TickleTradeModal({
	visible,
	onClose,
	userId,
	trades,
	onChanged,
}: Props) {
	const [busy, setBusy] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");

	const incomingPending = trades.filter(
		(t) => t.status === "pending" && t.target_id === userId
	);
	const outgoingPending = trades.filter(
		(t) => t.status === "pending" && t.requester_id === userId
	);

	// Gentle sway on the hanging sign.
	const sway = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		if (!visible) return;
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sway, {
					toValue: 1,
					duration: 2600,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
				Animated.timing(sway, {
					toValue: -1,
					duration: 2600,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true,
				}),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [visible, sway]);
	const swayDeg = sway.interpolate({
		inputRange: [-1, 1],
		outputRange: ["-2.2deg", "2.2deg"],
	});

	useEffect(() => {
		if (visible) setFeedback("");
	}, [visible]);

	const doRpc = async (rpc: string, args: object, id: string, ok: string) => {
		if (busy) return;
		setBusy(id);
		const { data, error } = await supabase.rpc(rpc, args);
		setBusy(null);
		const r = data as { ok?: boolean; reason?: string } | null;
		if (error || !r?.ok) {
			setFeedback(reasonMessage(r?.reason ?? "error"));
			return;
		}
		setFeedback(ok);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		onChanged();
	};

	const fulfill = (t: TickleTrade) =>
		doRpc(
			"fulfill_tickle_trade",
			{ trade_id: t.id },
			t.id,
			`Gate opened — ${t.partner_username} takes ${t.amount * 2}.`
		);
	const cancel = (t: TickleTrade) =>
		doRpc("cancel_tickle_trade", { trade_id: t.id }, t.id, "Lot withdrawn.");

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					{/* the plank board */}
					<View style={styles.board}>
						{/* hanging sign */}
						<View style={styles.signWrap}>
							<View style={styles.chain} />
							<View style={styles.chain} />
							<Animated.View
								style={[styles.sign, { transform: [{ rotate: swayDeg }] }]}
							>
								<Text style={styles.signText}>THE TICKLE STOCKYARD</Text>
								<Text style={styles.signSub}>est. 1924</Text>
							</Animated.View>
							<Pressable
								onPress={onClose}
								hitSlop={12}
								style={styles.closeBtn}
							>
								<Text style={styles.closeX}>✕</Text>
							</Pressable>
						</View>

						{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

						<ScrollView
							style={{ maxHeight: 460 }}
							showsVerticalScrollIndicator={false}
						>
							{trades.length === 0 && (
								<Text style={styles.emptyText}>
									The yard's quiet — no lots at the gate today.{"\n"}
									Visit a friend's profile to put a request to market.
								</Text>
							)}

							{incomingPending.length > 0 && (
								<>
									<Text style={styles.sectionLabel}>At the Gate</Text>
									{incomingPending.map((t) => (
										<PenCard
											key={t.id}
											t={t}
											lotLine={`wants ${t.amount} · costs you ${t.amount}`}
											primaryLabel={`GIVE ${t.amount}`}
											onPrimary={() => fulfill(t)}
											passLabel="pass"
											onPass={() => cancel(t)}
											busy={busy === t.id}
										/>
									))}
								</>
							)}

							{outgoingPending.length > 0 && (
								<>
									<Text style={styles.sectionLabel}>Out to Market</Text>
									{outgoingPending.map((t) => (
										<PenCard
											key={t.id}
											t={t}
											lotLine={`consigned · you'd pocket ${t.amount * 2}`}
											primaryLabel="withdraw"
											primaryQuiet
											onPrimary={() => cancel(t)}
											busy={busy === t.id}
										/>
									))}
								</>
							)}
						</ScrollView>

						{/* chalkboard tally */}
						<View style={styles.chalkboard}>
							<Text style={styles.chalkText}>
								{incomingPending.length} at the gate ·{" "}
								{outgoingPending.length} out to market
							</Text>
						</View>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function reasonMessage(reason: string): string {
	switch (reason) {
		case "insufficient_bank":
			return "Not enough tickles in your bank to open the gate.";
		case "already_active":
			return "You've already a lot going with that friend.";
		case "cooldown":
			return "The yard rests — wait 24h to trade them again.";
		case "not_friends":
			return "Only friends trade at this yard.";
		case "bad_amount":
			return "Lots run 1-5 tickles.";
		case "bad_status":
			return "That lot's already moved on.";
		case "self":
			return "Can't consign a lot to yourself.";
		case "not_target":
		case "not_requester":
		case "not_involved":
			return "That's not your lot.";
		case "not_found":
			return "Lot not found.";
		default:
			return "The auctioneer fumbled — try again.";
	}
}

// A pen at the yard — a friend penned behind a fence rail, a chalk
// lot tag, and the action(s). Used for both incoming + outgoing.
function PenCard({
	t,
	lotLine,
	primaryLabel,
	primaryQuiet,
	onPrimary,
	passLabel,
	onPass,
	busy,
}: {
	t: TickleTrade;
	lotLine: string;
	primaryLabel: string;
	primaryQuiet?: boolean;
	onPrimary: () => void;
	passLabel?: string;
	onPass?: () => void;
	busy: boolean;
}) {
	return (
		<View style={styles.penWrap}>
			{/* fence rail across the top of the pen */}
			<View style={styles.rail}>
				<View style={styles.railBar} />
				<View style={styles.railBar} />
			</View>
			<View style={styles.penBody}>
				<View style={styles.stall}>
					<Text style={styles.stallPig}>🐷</Text>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.penName} numberOfLines={1}>
						{t.partner_username ?? "—"}
					</Text>
					<Text style={styles.lotTag} numberOfLines={1}>
						lot · {lotLine}
					</Text>
				</View>
				<View style={styles.penActions}>
					<Pressable
						onPress={onPrimary}
						disabled={busy}
						style={({ pressed }) => [
							primaryQuiet ? styles.quietBtn : styles.brassBtn,
							(pressed || busy) && { opacity: 0.7 },
						]}
					>
						<Text
							style={primaryQuiet ? styles.quietBtnText : styles.brassBtnText}
						>
							{busy ? "…" : primaryLabel}
						</Text>
					</Pressable>
					{!!passLabel && onPass && (
						<Pressable onPress={onPass} disabled={busy} hitSlop={8}>
							<Text style={styles.passText}>· {passLabel} ·</Text>
						</Pressable>
					)}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		alignItems: "center",
		justifyContent: "center",
		padding: 18,
	},
	card: { width: "100%", maxWidth: 420 },
	board: {
		backgroundColor: YARD.board,
		borderRadius: 16,
		borderWidth: 3,
		borderColor: YARD.plankLine,
		paddingHorizontal: 14,
		paddingTop: 18,
		paddingBottom: 12,
		...STICKER_SHADOW,
	},

	// hanging sign
	signWrap: { alignItems: "center", marginBottom: 12 },
	chain: {
		position: "absolute",
		top: -10,
		width: 2,
		height: 12,
		backgroundColor: YARD.signEdge,
	},
	sign: {
		backgroundColor: YARD.sign,
		borderWidth: 2.5,
		borderColor: YARD.signEdge,
		borderRadius: 10,
		paddingHorizontal: 18,
		paddingVertical: 8,
		alignItems: "center",
	},
	signText: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		letterSpacing: 0.5,
		textAlign: "center",
	},
	signSub: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: YARD.signEdge,
		marginTop: -1,
	},
	closeBtn: { position: "absolute", top: -4, right: 0, padding: 6 },
	closeX: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.cream },

	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.cream,
		textAlign: "center",
		marginBottom: 8,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.cream,
		textAlign: "center",
		lineHeight: 21,
		paddingVertical: 18,
	},
	sectionLabel: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.cream,
		letterSpacing: 0.6,
		marginTop: 10,
		marginBottom: 6,
	},

	// pen card
	penWrap: { marginBottom: 8 },
	rail: {
		gap: 3,
		paddingHorizontal: 10,
		paddingTop: 5,
		paddingBottom: 4,
		backgroundColor: YARD.rail,
		borderTopLeftRadius: 10,
		borderTopRightRadius: 10,
	},
	railBar: {
		height: 3,
		borderRadius: 2,
		backgroundColor: "rgba(255,255,255,0.22)",
	},
	penBody: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: YARD.plankLine,
		borderTopWidth: 0,
		borderBottomLeftRadius: 12,
		borderBottomRightRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 9,
	},
	stall: {
		width: 38,
		height: 38,
		borderRadius: 9,
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: YARD.plankLine,
		alignItems: "center",
		justifyContent: "center",
	},
	stallPig: { fontSize: 20 },
	penName: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	lotTag: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	penActions: { alignItems: "flex-end", gap: 3 },
	brassBtn: {
		backgroundColor: YARD.brass,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	brassBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	quietBtn: {
		backgroundColor: "transparent",
		borderWidth: 1.5,
		borderColor: WHIMSY.mute,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 7,
	},
	quietBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.mute },
	passText: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },

	// chalkboard footer
	chalkboard: {
		marginTop: 10,
		backgroundColor: YARD.chalk,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: YARD.plankLine,
		paddingVertical: 7,
		alignItems: "center",
	},
	chalkText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: YARD.chalkInk,
		letterSpacing: 0.3,
	},
});
