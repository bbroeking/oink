// User-detail bottom sheet — opens when you tap another user anywhere
// (currently leaderboard rows). One-shot fetch via public_user_stats
// RPC. Action button is state-aware:
//   self       → no action
//   none       → Add friend
//   pending_outgoing → Cancel request
//   pending_incoming → Accept friend request
//   friends    → Request 1 tickle (inline request_tickles call; the
//                Friends screen remains the surface for custom amounts)
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
import type { RitualMode } from "../utils/rituals";
import {
	alignmentDisplay,
	alignmentEmblem,
	alignmentLabel,
	type AlignmentLabel,
} from "@/utils/alignment";
import {
	FONTS,
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

	useEffect(() => {
		if (!targetUserId) {
			setStats(null);
			setFeedback(null);
			return;
		}
		setLoading(true);
		setFeedback(null);
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
			amount: 1,
		});
		const r = data as { ok?: boolean; reason?: string; hours?: number } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setFeedback("Requested 1 ♥ — they'll see your ask.");
		} else if (r?.reason === "cooldown") {
			setFeedback(`Cooldown — wait ${r.hours ?? 24}h.`);
		} else if (r?.reason === "already_pending") {
			setFeedback("You already have a trade going with them.");
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

									<AlignmentChip
										score={stats.alignment_score}
										label={stats.alignment_label}
									/>

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

									<ActionButton
										status={stats.friendship_status}
										busy={busy}
										onAdd={addFriend}
										onCancel={cancelOutgoing}
										onAccept={acceptIncoming}
										onTickle={sendTickle}
									/>

									{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

									{stats.friendship_status === "friends" && (
										<View style={{ marginTop: 6 }}>
											<View style={styles.ritualToggle}>
												{(["bless", "curse"] as RitualMode[]).map((m) => (
													<Pressable
														key={m}
														onPress={() => setRitualMode(m)}
														style={[
															styles.ritualToggleBtn,
															ritualMode === m && styles.ritualToggleActive,
														]}
													>
														<Text
															style={[
																styles.ritualToggleText,
																ritualMode === m && styles.ritualToggleTextActive,
															]}
														>
															{m === "bless" ? "☀ Bless" : "🟢 Curse"}
														</Text>
													</Pressable>
												))}
											</View>
											<RitualPicker
												mode={ritualMode}
												targetUserId={stats.user_id}
												targetName={stats.username ?? "friend"}
											/>
										</View>
									)}
								</>
							)}
						</Sticker>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

// Compact alignment chip — emblem + label + numeric score. Sits
// above the stats row in the sheet. Background tinted by alignment
// (warm for angel, mossy for goblin, neutral for pilgrim).
function AlignmentChip({
	score,
	label,
}: {
	score: number;
	label: AlignmentLabel;
}) {
	const bg =
		label === "angel" ? WHIMSY.sun :
		label === "goblin" ? "#D5E4C9" :
		WHIMSY.paper;
	const formatted = score > 0 ? `+${score}` : `${score}`;
	return (
		<View style={[styles.alignChip, { backgroundColor: bg }]}>
			<Text style={styles.alignEmblem}>{alignmentEmblem(label)}</Text>
			<Text style={styles.alignLabel}>{alignmentDisplay(label)}</Text>
			<Text style={styles.alignScore}>({formatted})</Text>
		</View>
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

function ActionButton({
	status,
	busy,
	onAdd,
	onCancel,
	onAccept,
	onTickle,
}: {
	status: FriendshipStatus;
	busy: boolean;
	onAdd: () => void;
	onCancel: () => void;
	onAccept: () => void;
	onTickle: () => void;
}) {
	if (status === "self") return null;

	const config: { label: string; onPress: () => void; primary?: boolean } =
		status === "friends"
			? { label: "Request 1 tickle ♥", onPress: onTickle, primary: true }
			: status === "pending_outgoing"
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

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: MODAL_BACKDROP_BG,
	},
	sheetWrap: { padding: 16, paddingBottom: 32 },
	sheet: { padding: 18 },
	loadingWrap: { paddingVertical: 40, alignItems: "center" },
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
	alignChip: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		marginBottom: 12,
	},
	alignEmblem: { fontSize: 16 },
	alignLabel: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	alignScore: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
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
