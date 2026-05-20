// Tickle Trade — bottom-right pill on Barn + modal listing every
// actionable trade (fulfill incoming / repay your debts) plus passive
// (waiting on someone else).
//
// Behavior is paired with migrations/20260520010000_tickle_trades.sql.
// Each trade row carries the partner's username so the UI doesn't need
// a second profiles fetch.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

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
	// Actionable = trades the user can act on right now:
	//   - incoming pending (need to fulfill or cancel)
	//   - outgoing fulfilled (need to thank/repay)
	const actionableCount = useMemo(() => {
		if (!userId) return 0;
		return trades.filter((t) => {
			if (t.status === "pending" && t.target_id === userId) return true;
			if (t.status === "fulfilled" && t.requester_id === userId) return true;
			return false;
		}).length;
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
	const owedRepayments = trades.filter(
		(t) => t.status === "fulfilled" && t.requester_id === userId
	);
	const outgoingPending = trades.filter(
		(t) => t.status === "pending" && t.requester_id === userId
	);
	const awaitingThanks = trades.filter(
		(t) => t.status === "fulfilled" && t.target_id === userId
	);

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
			const reason = r?.reason ?? "error";
			setFeedback(reasonMessage(reason));
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
			`Sent ${t.amount} to ${t.partner_username}.`
		);
	const repay = (t: TickleTrade) =>
		doRpc(
			"repay_tickle_trade",
			{ trade_id: t.id },
			t.id,
			`Repaid ${t.amount * 2} to ${t.partner_username}.`
		);
	const cancel = (t: TickleTrade) =>
		doRpc("cancel_tickle_trade", { trade_id: t.id }, t.id, "Trade cancelled.");

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Sticker color="paper" rotate={-0.6} radius={18} style={styles.sticker}>
						<View style={styles.headerRow}>
							<Text style={styles.kicker}>★ tickle trade</Text>
							<Pressable onPress={onClose} hitSlop={10}>
								<Text style={styles.closeX}>✕</Text>
							</Pressable>
						</View>
						{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

						<ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
							{trades.length === 0 && (
								<Text style={styles.emptyText}>
									No active trades. Open a friend's profile to request tickles —
									or wait for one of yours to send a request your way.
								</Text>
							)}

							{owedRepayments.length > 0 && (
								<>
									<Text style={styles.subKicker}>thank them ↩</Text>
									{owedRepayments.map((t) => (
										<TradeRow
											key={t.id}
											t={t}
											actionLabel={`Send ${t.amount * 2}`}
											actionVariant="primary"
											busy={busy === t.id}
											onAction={() => repay(t)}
											description={`You owe ${t.amount * 2} (2× repay)`}
										/>
									))}
								</>
							)}

							{incomingPending.length > 0 && (
								<>
									<Text style={styles.subKicker}>their requests ↘</Text>
									{incomingPending.map((t) => (
										<TradeRow
											key={t.id}
											t={t}
											actionLabel={`Fulfill ${t.amount}`}
											actionVariant="primary"
											secondaryLabel="Decline"
											secondaryVariant="danger"
											busy={busy === t.id}
											onAction={() => fulfill(t)}
											onSecondary={() => cancel(t)}
											description={`Wants ${t.amount} tickles · pays back ${t.amount * 2}`}
										/>
									))}
								</>
							)}

							{outgoingPending.length > 0 && (
								<>
									<Text style={styles.subKicker}>you asked ↗</Text>
									{outgoingPending.map((t) => (
										<TradeRow
											key={t.id}
											t={t}
											actionLabel="Cancel"
											actionVariant="danger"
											busy={busy === t.id}
											onAction={() => cancel(t)}
											description={`Waiting on them to send ${t.amount}`}
										/>
									))}
								</>
							)}

							{awaitingThanks.length > 0 && (
								<>
									<Text style={styles.subKicker}>awaiting thanks ⌛</Text>
									{awaitingThanks.map((t) => (
										<TradeRow
											key={t.id}
											t={t}
											actionLabel=""
											busy={false}
											onAction={() => {}}
											description={`Owed ${t.amount * 2} back from them`}
										/>
									))}
								</>
							)}
						</ScrollView>
					</Sticker>
				</View>
			</View>
		</Modal>
	);
}

function reasonMessage(reason: string): string {
	switch (reason) {
		case "insufficient_bank":
			return "Not enough tickles in your bank.";
		case "already_active":
			return "You already have a trade going with that friend.";
		case "cooldown":
			return "Wait 24h between trades with the same friend.";
		case "not_friends":
			return "Only friends can trade.";
		case "bad_amount":
			return "Pick 1-5 tickles.";
		case "bad_status":
			return "This trade already moved on.";
		case "self":
			return "Can't trade with yourself.";
		case "not_target":
		case "not_requester":
		case "not_involved":
			return "You're not part of this trade.";
		case "not_found":
			return "Trade not found.";
		default:
			return "Try again.";
	}
}

function TradeRow({
	t,
	actionLabel,
	actionVariant = "primary",
	secondaryLabel,
	secondaryVariant,
	busy,
	onAction,
	onSecondary,
	description,
}: {
	t: TickleTrade;
	actionLabel: string;
	actionVariant?: "primary" | "danger";
	secondaryLabel?: string;
	secondaryVariant?: "primary" | "danger";
	busy: boolean;
	onAction: () => void;
	onSecondary?: () => void;
	description: string;
}) {
	return (
		<View style={styles.row}>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text style={styles.rowName}>{t.partner_username ?? "—"}</Text>
				<Text style={styles.rowDesc}>{description}</Text>
			</View>
			<View style={styles.rowActions}>
				{!!secondaryLabel && (
					<Pressable
						onPress={onSecondary}
						disabled={busy}
						style={({ pressed }) => [
							styles.actionBtn,
							secondaryVariant === "danger" ? styles.danger : styles.primary,
							pressed && { opacity: 0.7 },
						]}
					>
						<Text style={styles.actionText}>{secondaryLabel}</Text>
					</Pressable>
				)}
				{actionLabel ? (
					<Pressable
						onPress={onAction}
						disabled={busy}
						style={({ pressed }) => [
							styles.actionBtn,
							actionVariant === "danger" ? styles.danger : styles.primary,
							pressed && { opacity: 0.7 },
						]}
					>
						<Text style={styles.actionText}>{busy ? "…" : actionLabel}</Text>
					</Pressable>
				) : null}
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
	sticker: {
		paddingHorizontal: 16,
		paddingVertical: 16,
		...STICKER_SHADOW,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	kicker: KICKER_TEXT,
	closeX: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.mute,
		paddingHorizontal: 6,
	},
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		marginBottom: 8,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 21,
		paddingVertical: 14,
	},
	subKicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		marginTop: 10,
		marginBottom: 6,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 10,
		backgroundColor: WHIMSY.paper,
		borderRadius: 12,
		marginBottom: 6,
	},
	rowName: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	rowDesc: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	rowActions: {
		flexDirection: "row",
		gap: 6,
	},
	actionBtn: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 10,
		borderWidth: 1.5,
	},
	primary: {
		backgroundColor: WHIMSY.lilac,
		borderColor: WHIMSY.ink,
	},
	danger: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.mute,
	},
	actionText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
});
