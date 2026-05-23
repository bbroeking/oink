// User-detail bottom sheet — opens when you tap another user anywhere
// (currently leaderboard rows). One-shot fetch via public_user_stats
// RPC. Action button is state-aware:
//   self       → no action
//   none       → Add friend
//   pending_outgoing → Cancel request
//   pending_incoming → Accept friend request
//   friends    → an Ask row — pick 1-5, then request_tickles. This
//                is the single door for asking a friend for tickles.
import React, { useEffect, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { PigAvatar } from "./ui/PigAvatar";
import { Sticker } from "./ui/Sticker";
import { RitualPicker } from "./RitualPicker";
import { AlignmentBar } from "./ui/AlignmentBar";
import type { RitualMode } from "../utils/rituals";
import { type AlignmentLabel } from "@/utils/alignment";
import type { TradeRow } from "@/constants/trade_types";
import {
	FONTS,
	KICKER_PILL,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

type FriendshipStatus =
	| "self"
	| "none"
	| "pending_outgoing"
	| "pending_incoming"
	| "friends";

interface UserStats {
	user_id: string;
	username: string | null;
	discriminator: string | null;
	active_hat_id: string | null;
	active_title_id: string | null;
	active_title_name: string | null;
	active_title_placement: "pre" | "post" | null;
	given_total: number;
	received_total: number;
	generous_tier_name: string | null;
	greedy_tier_name: string | null;
	friendship_status: FriendshipStatus;
	alignment_score: number;
	// Server returns this via alignment_label(score). We could derive
	// it client-side but using the server value avoids any drift if
	// thresholds ever change in only one place.
	alignment_label: AlignmentLabel;
}

interface Props {
	targetUserId: string | null;
	onDismiss: () => void;
	// Notifies caller when friendship state changed so the parent can
	// refresh any lists that depend on it (e.g., leaderboard friend filter).
	onFriendshipChanged?: () => void;
}

// The Ask row's state — a pending trade or a 24h pair cooldown blocks
// a new request. Derived from my_tickle_trades.
type AskState =
	| { kind: "ready" }
	| { kind: "pending" }
	| { kind: "cooldown"; hours: number };

// Mirror the server's pair-cooldown rule (trade_cooldown.sql): a
// request is blocked while a trade is pending, and for 24h after the
// most recent trade's created_at. my_tickle_trades omits 'cancelled'
// rows — a cancel-then-retry cooldown still falls back to the
// reactive check in sendTickle, which is an acceptable edge case.
function deriveAskState(
	targetId: string,
	trades: TradeRow[] | null
): AskState {
	const mine = (trades ?? []).filter(
		(t) => t.requester_id === targetId || t.target_id === targetId
	);
	if (mine.some((t) => t.status === "pending")) return { kind: "pending" };
	let newest = 0;
	for (const t of mine) {
		const ts = new Date(t.created_at).getTime();
		if (ts > newest) newest = ts;
	}
	const elapsedH = newest ? (Date.now() - newest) / 3_600_000 : Infinity;
	if (elapsedH < 24) {
		return {
			kind: "cooldown",
			hours: Math.max(1, Math.ceil(24 - elapsedH)),
		};
	}
	return { kind: "ready" };
}

function formatHandle(s: UserStats): string {
	const name = s.username ?? "Anonymous";
	const disc = s.discriminator ? `#${s.discriminator}` : "";
	if (!s.active_title_name) return `${name}${disc}`;
	return s.active_title_placement === "post"
		? `${name} ${s.active_title_name}`
		: `${s.active_title_name} ${name}`;
}

export function UserSheet({ targetUserId, onDismiss, onFriendshipChanged }: Props) {
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	// When friends, the sheet shows a daily-ritual panel. This toggles
	// which ritual (bless / curse) the panel is currently showing.
	const [ritualMode, setRitualMode] = useState<RitualMode>("bless");
	// 3-tab control for the action area on a friend's sheet (Ask /
	// Bless / Curse). Only one panel is visible at a time; matches
	// the design's segmented control.
	const [actionTab, setActionTab] = useState<"ask" | "bless" | "curse">("ask");
	// Amount for the friends-only Ask row (1-5).
	const [askAmount, setAskAmount] = useState(1);
	// The Ask row is state-aware: a pending trade or a 24h pair
	// cooldown blocks a new request. Derived from my_tickle_trades.
	const [askState, setAskState] = useState<AskState>({ kind: "ready" });

	useEffect(() => {
		if (!targetUserId) {
			setStats(null);
			setFeedback(null);
			return;
		}
		setLoading(true);
		setFeedback(null);
		setAskState({ kind: "ready" });
		supabase
			.rpc("public_user_stats", { target_user_id: targetUserId })
			.then(({ data, error }) => {
				if (error) {
					setFeedback("Couldn't load profile.");
					setStats(null);
				} else {
					const rows = (data as UserStats[] | null) ?? [];
					setStats(rows[0] ?? null);
				}
				setLoading(false);
			});
		// Trade state with this user — drives the Ask row.
		supabase.rpc("my_tickle_trades").then(({ data }) => {
			setAskState(deriveAskState(targetUserId, data as TradeRow[] | null));
		});
	}, [targetUserId]);

	const refreshStats = async () => {
		if (!targetUserId) return;
		const { data } = await supabase.rpc("public_user_stats", {
			target_user_id: targetUserId,
		});
		const rows = (data as UserStats[] | null) ?? [];
		setStats(rows[0] ?? null);
	};

	const addFriend = async () => {
		if (!stats || !stats.username) return;
		setBusy(true);
		const { data } = await supabase.rpc("send_friend_request", {
			target_username: stats.username,
			target_discriminator: stats.discriminator ?? null,
		});
		const r = data as { ok?: boolean; reason?: string } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setFeedback("Request sent.");
			await refreshStats();
			onFriendshipChanged?.();
		} else {
			setFeedback(r?.reason ?? "Couldn't send.");
		}
	};

	const cancelOutgoing = async () => {
		if (!stats) return;
		setBusy(true);
		await supabase.rpc("cancel_friend_request", { target_user_id: stats.user_id });
		setBusy(false);
		setFeedback("Request cancelled.");
		await refreshStats();
		onFriendshipChanged?.();
	};

	const acceptIncoming = async () => {
		if (!stats) return;
		setBusy(true);
		await supabase.rpc("accept_friend_request", { other_user_id: stats.user_id });
		setBusy(false);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setFeedback("You're friends now.");
		await refreshStats();
		onFriendshipChanged?.();
	};

	const sendTickle = async () => {
		if (!stats) return;
		setBusy(true);
		const { data } = await supabase.rpc("request_tickles", {
			target_user_id: stats.user_id,
			amount: askAmount,
		});
		const r = data as {
			ok?: boolean;
			reason?: string;
			hours_remaining?: number;
		} | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setFeedback(`Asked for ${askAmount} ♥ — they'll see it.`);
			// The request is now a pending trade — flip the Ask state.
			setAskState({ kind: "pending" });
		} else if (r?.reason === "cooldown") {
			const h = Math.max(1, Math.ceil(r.hours_remaining ?? 24));
			setFeedback(`Cooldown — wait ${h}h.`);
			setAskState({ kind: "cooldown", hours: h });
		} else if (r?.reason === "already_active") {
			setFeedback("You already have a trade going with them.");
			setAskState({ kind: "pending" });
		} else {
			setFeedback("Couldn't request. Try again.");
		}
	};

	if (!targetUserId) return null;

	return (
		<>
			<Modal
				visible
				transparent
				animationType="slide"
				onRequestClose={onDismiss}
			>
				<Pressable style={styles.backdrop} onPress={onDismiss}>
					<Pressable style={styles.sheetWrap} onPress={() => {}}>
						<Sticker
							color="paper"
							rotate={-0.6}
							radius={20}
							style={[styles.sheet, STICKER_SHADOW]}
						>
							{loading || !stats ? (
								<View style={styles.loadingWrap}>
									<ActivityIndicator color={WHIMSY.ink} />
								</View>
							) : (
								<>
									{/* Kicker label above the handle so the sheet's purpose
									    ("profile") reads at a glance, matching the kicker
									    treatment on the other screens. */}
									<Text style={styles.sheetKicker}>★ profile</Text>
									<View style={styles.header}>
										<View style={styles.avatarBubble}>
											<PigAvatar size={56} hatId={stats.active_hat_id} />
										</View>
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text style={styles.name} numberOfLines={1}>
												{formatHandle(stats)}
											</Text>
											{stats.active_title_name && (
												<Text style={styles.titleSub}>
													"{stats.active_title_name}"
												</Text>
											)}
										</View>
									</View>

									<View style={styles.alignBarWrap}>
										<AlignmentBar
											score={stats.alignment_score}
											label={stats.alignment_label}
										/>
									</View>

									<View style={styles.statsRow}>
										<StatCol
											label="GIVEN"
											value={stats.given_total}
											tier={stats.generous_tier_name}
											color={WHIMSY.lilac}
										/>
										<View style={styles.statsDivider} />
										<StatCol
											label="RECEIVED"
											value={stats.received_total}
											tier={stats.greedy_tier_name}
											color={WHIMSY.sun}
										/>
									</View>

									{stats.friendship_status === "friends" ? (
										<>
											{/* 3-tab segmented control: Ask / Bless / Curse.
											    Only one action panel is visible at a time —
											    matches the design's tabbed sheet. */}
											<View style={styles.actionTabs}>
												{(["ask", "bless", "curse"] as const).map((tab) => {
													const active = tab === actionTab;
													return (
														<Pressable
															key={tab}
															onPress={() => {
																setActionTab(tab);
																if (tab !== "ask") {
																	setRitualMode(tab as RitualMode);
																}
															}}
															style={[
																styles.actionTab,
																active && styles.actionTabActive,
															]}
														>
															<Text
																style={[
																	styles.actionTabText,
																	active && styles.actionTabTextActive,
																]}
															>
																{tab === "ask"
																	? "Ask"
																	: tab === "bless"
																		? "Bless"
																		: "Curse"}
															</Text>
														</Pressable>
													);
												})}
											</View>

											{actionTab === "ask" && (
												<AskRow
													amount={askAmount}
													onPick={setAskAmount}
													onAsk={sendTickle}
													busy={busy}
													state={askState}
												/>
											)}
											{(actionTab === "bless" || actionTab === "curse") && (
												<RitualPicker
													mode={actionTab as RitualMode}
													targetUserId={stats.user_id}
													targetName={stats.username ?? "friend"}
												/>
											)}
										</>
									) : (
										<ActionButton
											status={stats.friendship_status}
											busy={busy}
											onAdd={addFriend}
											onCancel={cancelOutgoing}
											onAccept={acceptIncoming}
										/>
									)}

									{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
								</>
							)}
						</Sticker>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

function StatCol({
	label,
	value,
	tier,
	color,
}: {
	label: string;
	value: number;
	tier: string | null;
	color: string;
}) {
	return (
		<View style={styles.statCol}>
			<Text style={styles.statLabel}>{label}</Text>
			<Text style={[styles.statValue, { color: WHIMSY.ink }]}>
				{value.toLocaleString()} ♥
			</Text>
			{tier ? (
				<View style={[styles.tierChip, { backgroundColor: color }]}>
					<Text style={styles.tierChipText}>{tier}</Text>
				</View>
			) : (
				<Text style={styles.tierNone}>no tier yet</Text>
			)}
		</View>
	);
}

// Add / cancel / accept. The "friends" state uses AskRow instead.
function ActionButton({
	status,
	busy,
	onAdd,
	onCancel,
	onAccept,
}: {
	status: FriendshipStatus;
	busy: boolean;
	onAdd: () => void;
	onCancel: () => void;
	onAccept: () => void;
}) {
	if (status === "self" || status === "friends") return null;

	const config: { label: string; onPress: () => void; primary?: boolean } =
		status === "pending_outgoing"
			? { label: "Cancel request", onPress: onCancel }
			: status === "pending_incoming"
				? { label: "Accept friend request", onPress: onAccept, primary: true }
				: { label: "Add friend", onPress: onAdd, primary: true };

	return (
		<Pressable
			onPress={config.onPress}
			disabled={busy}
			style={({ pressed }) => [
				styles.actionBtn,
				config.primary ? styles.actionPrimary : styles.actionSecondary,
				(pressed || busy) && { opacity: 0.7 },
			]}
		>
			<Text
				style={[
					styles.actionText,
					config.primary ? styles.actionTextPrimary : styles.actionTextSecondary,
				]}
			>
				{busy ? "…" : config.label}
			</Text>
		</Pressable>
	);
}

// Friends-only: pick 1-5, then ask. The single door for asking
// tickles — and state-aware: a pending trade or a 24h pair cooldown
// replaces the picker with a clear "why you can't ask yet" panel.
function AskRow({
	amount,
	onPick,
	onAsk,
	busy,
	state,
}: {
	amount: number;
	onPick: (n: number) => void;
	onAsk: () => void;
	busy: boolean;
	state: AskState;
}) {
	if (state.kind === "pending") {
		return (
			<View style={styles.askBlocked}>
				<Text style={styles.askBlockedTitle}>Trade in progress</Text>
				<Text style={styles.askBlockedSub}>
					You've already got a trade going with them — answer or
					withdraw it first.
				</Text>
			</View>
		);
	}
	if (state.kind === "cooldown") {
		return (
			<View style={styles.askBlocked}>
				<Text style={styles.askBlockedTitle}>Cooling off</Text>
				<Text style={styles.askBlockedSub}>
					You traded recently — you can ask again in about{" "}
					{state.hours}h.
				</Text>
			</View>
		);
	}
	return (
		<View style={styles.askWrap}>
			<View style={styles.askPills}>
				{[1, 2, 3, 4, 5].map((n) => (
					<Pressable
						key={n}
						onPress={() => onPick(n)}
						style={[styles.askPill, amount === n && styles.askPillActive]}
					>
						<Text
							style={[
								styles.askPillText,
								amount === n && styles.askPillTextActive,
							]}
						>
							{n}
						</Text>
					</Pressable>
				))}
			</View>
			<Pressable
				onPress={onAsk}
				disabled={busy}
				style={({ pressed }) => [
					styles.actionBtn,
					styles.actionPrimary,
					(pressed || busy) && { opacity: 0.7 },
				]}
			>
				<Text style={[styles.actionText, styles.actionTextPrimary]}>
					{busy ? "…" : `Ask for ${amount} ♥`}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: { padding: 16, paddingBottom: 32 },
	sheet: { padding: 18 },
	loadingWrap: { paddingVertical: 40, alignItems: "center" },
	sheetKicker: { ...KICKER_PILL, marginBottom: 8 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	avatarBubble: {
		borderRadius: 32,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		padding: 2,
	},
	name: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink },
	titleSub: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	alignBarWrap: { marginBottom: 14 },
	statsRow: {
		flexDirection: "row",
		alignItems: "stretch",
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 14,
		marginBottom: 16,
	},
	statsDivider: { width: 1.5, backgroundColor: WHIMSY.ink, marginVertical: 6 },
	statCol: { flex: 1, alignItems: "center", gap: 4 },
	statLabel: { ...KICKER_TEXT, fontSize: 10 },
	statValue: { fontFamily: FONTS.whimsy, fontSize: 22 },
	tierChip: {
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		marginTop: 4,
	},
	tierChipText: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.ink,
	},
	tierNone: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	actionBtn: {
		paddingVertical: 12,
		borderRadius: 14,
		alignItems: "center",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	actionPrimary: { backgroundColor: WHIMSY.lilac },
	actionSecondary: { backgroundColor: WHIMSY.paper },
	actionText: { fontFamily: FONTS.whimsy, fontSize: 16 },
	actionTextPrimary: { color: WHIMSY.ink },
	actionTextSecondary: { color: WHIMSY.mute },
	askWrap: { gap: 8 },
	askPills: { flexDirection: "row", gap: 6 },
	askPill: {
		flex: 1,
		paddingVertical: 9,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
	},
	askPillActive: { backgroundColor: WHIMSY.sun },
	askPillText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.mute },
	askPillTextActive: { color: WHIMSY.ink },
	askBlocked: {
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		alignItems: "center",
	},
	askBlockedTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	askBlockedSub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 2,
	},
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 10,
	},
	ritualToggle: {
		flexDirection: "row",
		gap: 6,
		marginTop: 12,
	},
	// 3-tab control (Ask / Bless / Curse) — the redesign's
	// segmented control inside the friend sheet.
	actionTabs: {
		flexDirection: "row",
		gap: 6,
		marginTop: 12,
		marginBottom: 12,
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		padding: 3,
	},
	actionTab: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 10,
		alignItems: "center",
	},
	actionTabActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	actionTabText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	actionTabTextActive: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	ritualToggleBtn: {
		flex: 1,
		paddingVertical: 7,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
	},
	ritualToggleActive: { backgroundColor: WHIMSY.cream },
	ritualToggleText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.mute },
	ritualToggleTextActive: { color: WHIMSY.ink },
});
