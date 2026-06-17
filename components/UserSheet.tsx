// User-detail bottom sheet — opens when you tap another user anywhere
// (currently leaderboard rows). One-shot fetch via public_user_stats
// RPC. Action button is state-aware:
//   self       → no action
//   none       → Add friend
//   pending_outgoing → Cancel request
//   pending_incoming → Accept friend request
//   friends    → an Ask row — pick 1-5, then request_tickles. This
//                is the single door for asking a friend for tickles.
import React, { useEffect, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	ActivityIndicator,
	Animated,
	Easing,
	Dimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { rpc, rpcAction } from "@/utils/rpc";
import { PigAvatar } from "./ui/PigAvatar";
import { Icon } from "./ui/Icon";
import { Sticker } from "./ui/Sticker";
import { BarnVisitModal } from "./BarnVisitModal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { RitualPicker } from "./RitualPicker";
import { AlignmentBar } from "./ui/AlignmentBar";
import type { RitualMode } from "../utils/rituals";
import { type AlignmentLabel } from "@/utils/alignment";
import type { TradeRow } from "@/constants/trade_types";
import type { TitlePlacement } from "@/constants/title_types";
import { formatHM } from "@/utils/time";
import {
	FONTS,
	KICKER_PILL,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import {
	acceptFriendRequest,
	cancelFriendRequest,
	friendActionMessage,
	sendFriendRequest,
	type FriendshipStatus,
} from "@/utils/friendships";

interface UserStats {
	user_id: string;
	username: string | null;
	discriminator: string | null;
	active_hat_id: string | null;
	active_title_id: string | null;
	active_title_name: string | null;
	active_title_placement: TitlePlacement | null;
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

// "2h 15m" / "15m" remaining until an ISO timestamp.
function formatRemaining(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "moments";
	return formatHM(ms);
}

export function UserSheet({ targetUserId, onDismiss, onFriendshipChanged }: Props) {
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	// Barn visiting (social feature) — opens the visit screen for this user.
	const [showVisit, setShowVisit] = useState(false);
	// Whether a visit would actually succeed right now (barn_visit_status). Used
	// to pre-disable the Visit button instead of opening the modal to a dead-end
	// pop-up: locked to a different barn (one friend / 3h), out of tickles, or the
	// pig already at its hourly tap ceiling.
	const [visitGate, setVisitGate] = useState<{
		locked?: boolean;
		resting?: boolean;
		next_at?: string | null;
		balance?: number;
	} | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	// Block + Report dialogs. Apple Guideline 1.2 requires both for
	// any app with user-to-user interactions; they appear as small
	// links at the bottom of the sheet so they're discoverable for
	// review without being prominent enough to feel hostile.
	const [blockOpen, setBlockOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [blockBusy, setBlockBusy] = useState(false);
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
	// Lifetime tickles for the TICKLES stat column. Not part of
	// public_user_stats yet — fetched directly from profiles in
	// parallel so the design's 3-column stats row has the value it
	// needs without expanding the RPC's return shape.
	const [targetTickles, setTargetTickles] = useState<number | null>(null);
	const [curseStatus, setCurseStatus] = useState<{
		cursed: boolean;
		expires_at: string | null;
	} | null>(null);

	// Sheet animation — driven independently of the backdrop so the
	// dim doesn't slide up with the card (the old animationType="slide"
	// dragged the whole grey screen up, which looked broken). Backdrop
	// gets a fade 0→1; the sheet gets a translateY from screen-height
	// → 0. Both driven by the same 0..1 progress value so they finish
	// in lockstep. screenH is captured once on mount — Dimensions reads
	// don't fire on rotation but the sheet is portrait-only so that's
	// fine.
	const screenH = useRef(Dimensions.get("window").height).current;
	const sheetAnim = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		if (!targetUserId) return;
		sheetAnim.setValue(0);
		Animated.timing(sheetAnim, {
			toValue: 1,
			duration: 320,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [targetUserId, sheetAnim]);

	useEffect(() => {
		if (!targetUserId) {
			setStats(null);
			setFeedback(null);
			return;
		}
		setLoading(true);
		setFeedback(null);
		setAskState({ kind: "ready" });
		setTargetTickles(null);
		setVisitGate(null);
		// Can a visit to this person succeed right now? (gates the Visit button)
		rpcAction<{
			locked?: boolean;
			resting?: boolean;
			next_at?: string | null;
			balance?: number;
		}>("barn_visit_status", { p_target: targetUserId }).then((d) => {
			if (d.ok) setVisitGate(d);
		});
		rpc<UserStats[]>("public_user_stats", {
			target_user_id: targetUserId,
		}).then((data) => {
			if (!data) {
				setFeedback("Couldn't load profile.");
				setStats(null);
			} else {
				setStats(data[0] ?? null);
			}
			setLoading(false);
		});
		// Trade state with this user — drives the Ask row.
		rpc<TradeRow[]>("my_tickle_trades").then((data) => {
			setAskState(deriveAskState(targetUserId, data));
		});
		// Lifetime tickle count for the TICKLES stat column. Profiles
		// is readable for visible fields; a failure leaves the column
		// blank rather than blocking the sheet.
		supabase
			.from("profiles")
			.select("tickles_earned")
			.eq("id", targetUserId)
			.maybeSingle()
			.then(({ data }) => {
				const n = (data as { tickles_earned?: number } | null)?.tickles_earned;
				setTargetTickles(typeof n === "number" ? n : null);
			});
	}, [targetUserId]);

	// Curse countdown — when the curse tab is open, surface how long any
	// existing curse on the target still has. Privacy-safe RPC: returns only
	// the soonest expiry, never who cast it.
	useEffect(() => {
		if (actionTab !== "curse" || !targetUserId) {
			setCurseStatus(null);
			return;
		}
		rpc<{ cursed: boolean; expires_at: string | null }>(
			"target_curse_status",
			{ target_id: targetUserId }
		).then((d) => setCurseStatus(d ?? null));
	}, [actionTab, targetUserId]);

	const refreshStats = async () => {
		if (!targetUserId) return;
		const rows = (await rpc<UserStats[]>("public_user_stats", {
			target_user_id: targetUserId,
		})) ?? [];
		setStats(rows[0] ?? null);
	};

	// Why the Visit button is blocked (null = a visit would work). Until the
	// status RPC resolves, visitGate is null → button stays enabled and the
	// modal's own guards remain the backstop.
	const visitBlock: { label: string } | null = !visitGate
		? null
		: visitGate.locked
			? { label: visitGate.next_at ? `Come back in ${formatRemaining(visitGate.next_at)}` : "Come back soon" }
			: (visitGate.balance ?? 1) < 1
				? { label: "Out of tickles to visit" }
				: visitGate.resting
					? { label: "Their pig is resting — come back soon" }
					: null;

	const addFriend = async () => {
		if (!stats || !stats.username) return;
		setBusy(true);
		const r = await sendFriendRequest(
			stats.username,
			stats.discriminator ?? null
		);
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setFeedback("Request sent.");
			await refreshStats();
			onFriendshipChanged?.();
		} else {
			setFeedback(friendActionMessage(r?.reason, r?.cap, stats.username));
		}
	};

	const cancelOutgoing = async () => {
		if (!stats) return;
		setBusy(true);
		await cancelFriendRequest(stats.user_id);
		setBusy(false);
		setFeedback("Request cancelled.");
		await refreshStats();
		onFriendshipChanged?.();
	};

	const acceptIncoming = async () => {
		if (!stats) return;
		setBusy(true);
		const r = await acceptFriendRequest(stats.user_id);
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			setFeedback("You're friends now.");
			await refreshStats();
			onFriendshipChanged?.();
		} else {
			setFeedback(
				friendActionMessage(r?.reason, r?.cap, stats.username ?? null)
			);
		}
	};

	const doBlock = async () => {
		if (!stats || blockBusy) return;
		setBlockBusy(true);
		await rpc("block_user", { target_user_id: stats.user_id });
		setBlockBusy(false);
		setBlockOpen(false);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setFeedback(`${stats.username ?? "User"} blocked. They can no longer interact with you.`);
		onFriendshipChanged?.();
		// Close the sheet after a brief beat so the toast reads.
		setTimeout(onDismiss, 800);
	};

	const doReport = async () => {
		if (!stats || blockBusy) return;
		setBlockBusy(true);
		await rpc("report_user", {
			target_user_id: stats.user_id,
			reason: "user_report",
		});
		setBlockBusy(false);
		setReportOpen(false);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setFeedback("Reported. Our team will review.");
	};

	const sendTickle = async () => {
		if (!stats) return;
		setBusy(true);
		const r = await rpc<{
			ok?: boolean;
			reason?: string;
			hours_remaining?: number;
		}>("request_tickles", {
			target_user_id: stats.user_id,
			amount: askAmount,
		});
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

	// Backdrop fades; sheet translates up from below the screen.
	// Driving both off `sheetAnim` (0..1) keeps them in lockstep
	// without sliding the dim as one body.
	const backdropOpacity = sheetAnim;
	const sheetTranslateY = sheetAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [screenH, 0],
	});

	return (
		<>
			<Modal
				visible
				transparent
				animationType="none"
				onRequestClose={onDismiss}
			>
				{/* Backdrop — static-position Pressable that fades in.
				    Tap outside the sheet to dismiss. */}
				<Animated.View
					style={[styles.backdrop, { opacity: backdropOpacity }]}
					pointerEvents="auto"
				>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={onDismiss}
					/>
				</Animated.View>
				{/* Sheet — slides up over the static backdrop. */}
				<Animated.View
					pointerEvents="box-none"
					style={[
						styles.sheetWrap,
						{ transform: [{ translateY: sheetTranslateY }] },
					]}
				>
					<Pressable onPress={() => {}}>
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
									{/* Drag indicator — the iOS-style grabber pill at
									    the top of bottom sheets, taken straight from
									    the design's Sheet primitive. Purely a visual
									    affordance; the sheet isn't actually draggable
									    here. */}
									<View style={styles.dragIndicator} />
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
										<View style={styles.statsDivider} />
										<StatCol
											label="TICKLES"
											value={targetTickles}
											color={WHIMSY.roseDeep}
										/>
									</View>

									{/* Visit their Barn — see their pig + tickle it for them (social).
									    FRIENDS-ONLY (player decision): visiting mints snouts +
									    leaderboard to both pigs, so it's hidden for non-friends (the
									    server are_friends check is the authoritative backstop).
									    Pre-disabled when a visit can't succeed (locked to another
									    barn / out of tickles / pig resting) so we never open the
									    modal just to show a dead-end pop-up. */}
									{stats.friendship_status !== "friends" ? null : visitBlock ? (
										<View style={[styles.visitBtn, styles.visitBtnDisabled]}>
											<View style={styles.visitBtnRow}>
												<Icon name="tabBarn" size={18} color={WHIMSY.mute} />
												<Text style={[styles.visitBtnText, styles.visitBtnTextDisabled]}>
													{visitBlock.label}
												</Text>
											</View>
										</View>
									) : (
										<Pressable onPress={() => setShowVisit(true)} style={({ pressed }) => [styles.visitBtn, pressed && { opacity: 0.8 }]}>
											<View style={styles.visitBtnRow}>
												<Icon name="tabBarn" size={18} color={WHIMSY.ink} />
												<Text style={styles.visitBtnText}>Visit {formatHandle(stats)}'s Barn</Text>
											</View>
										</Pressable>
									)}

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
											{actionTab === "curse" &&
												curseStatus?.cursed &&
												curseStatus.expires_at && (
													<Text style={styles.curseCountdown}>
														Already cursed — wears off in{" "}
														{formatRemaining(curseStatus.expires_at)}
													</Text>
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

									{/* Block + Report — small footer links. Required by
									    Apple Guideline 1.2 for any app with user-to-user
									    social features. Low-prominence by design so the
									    sheet doesn't feel hostile. */}
									<View style={styles.moderationRow}>
										<Pressable
											onPress={() => setReportOpen(true)}
											hitSlop={8}
										>
											<Text style={styles.moderationLink}>Report</Text>
										</Pressable>
										<Text style={styles.moderationDot}>·</Text>
										<Pressable
											onPress={() => setBlockOpen(true)}
											hitSlop={8}
										>
											<Text style={styles.moderationLink}>Block</Text>
										</Pressable>
									</View>
								</>
							)}
						</Sticker>
					</Pressable>
				</Animated.View>
				<ConfirmDialog
					open={blockOpen}
					title="Block this user?"
					body={`Blocking ${stats?.username ?? "this user"} removes them from your sounder, cancels any pending trades, and prevents future interaction either way. You can unblock from their profile later.`}
					confirmLabel="Block"
					cancelLabel="Cancel"
					destructive
					busy={blockBusy}
					onCancel={() => setBlockOpen(false)}
					onConfirm={doBlock}
				/>
				<ConfirmDialog
					open={reportOpen}
					title="Report this user?"
					body={`Send a report about ${stats?.username ?? "this user"} for our review team. They won't be notified. Use Block to also stop interaction.`}
					confirmLabel="Report"
					cancelLabel="Cancel"
					destructive
					busy={blockBusy}
					onCancel={() => setReportOpen(false)}
					onConfirm={doReport}
				/>
				{/* Barn visit overlay — rendered INSIDE this Modal (a nested
				    Modal won't reliably present over it on iOS), full-screen
				    on top of the sheet. */}
				{showVisit && stats && (
					<BarnVisitModal
						targetUserId={targetUserId}
						targetName={formatHandle(stats)}
						onClose={() => setShowVisit(false)}
					/>
				)}
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
	// Null = data unavailable; renders as "—" so the column still
	// occupies its slot. The TICKLES column uses this path until the
	// public_user_stats RPC carries the field natively.
	value: number | null;
	tier?: string | null;
	color: string;
}) {
	return (
		<View style={styles.statCol}>
			<Text style={styles.statLabel}>{label}</Text>
			<Text style={[styles.statValue, { color: WHIMSY.ink }]}>
				{value == null ? "—" : `${value.toLocaleString()} ♥`}
			</Text>
			{tier ? (
				<View style={[styles.tierChip, { backgroundColor: color }]}>
					<Text style={styles.tierChipText}>{tier}</Text>
				</View>
			) : null}
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
	// Economic hint copy — explains the trade math to the asker BEFORE
	// they tap submit. From the design's RitualPicker.
	const greedyShade = amount > 2 ? "more greedy" : "a little greedy";
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
			<Text style={styles.askHint}>
				★ they spend {amount} from their bank. you pocket {amount * 2}. you
				become {greedyShade}. ★
			</Text>
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
	// Backdrop is now its own Animated.View occupying the full
	// screen — the dim fades in independently of the sheet's slide.
	// flex:1 keeps it covering the screen; no justifyContent here
	// (the sheet sibling positions itself with absolute).
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	// Sheet wrapper now absolutely-positioned at the bottom of the
	// Modal root so the slide-up animation translates it from
	// off-screen → resting at the bottom.
	sheetWrap: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: 16,
		paddingBottom: 32,
	},
	sheet: { padding: 18 },
	loadingWrap: { paddingVertical: 40, alignItems: "center" },
	// iOS-style grabber pill at the top of the sheet — purely a visual
	// affordance per the design's Sheet primitive.
	dragIndicator: {
		alignSelf: "center",
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
		marginBottom: 12,
	},
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
	// Chunky 48×48 squares per the design's RitualPicker —
	// commanding tap targets that look like ink-bordered tiles.
	// Active = lilac-deep with paper text + hard ink shadow.
	askPill: {
		flex: 1,
		minHeight: 48,
		paddingVertical: 0,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	askPillActive: {
		backgroundColor: WHIMSY.lilacDeep,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	askPillText: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	askPillTextActive: { color: WHIMSY.paper },
	// Hand-script tradeoff preview between the pills and the submit
	// button — sets expectations before commit. From the design.
	askHint: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 4,
		marginBottom: 2,
		textAlign: "center",
		lineHeight: 17,
	},
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
	curseCountdown: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 8,
	},
	moderationRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		marginTop: 14,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: WHIMSY.muteSoft,
	},
	moderationLink: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	moderationDot: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
	},
	ritualToggle: {
		flexDirection: "row",
		gap: 6,
		marginTop: 12,
	},
	// 3-tab control (Ask / Bless / Curse) — pill-seg with the
	// ink-on-paper active state per the design's .pill-seg primitive
	// (rounded container, ink-bordered, active button has ink bg +
	// paper text).
	actionTabs: {
		flexDirection: "row",
		marginTop: 12,
		marginBottom: 12,
		backgroundColor: WHIMSY.paper,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		padding: 4,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	actionTab: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 999,
		alignItems: "center",
	},
	actionTabActive: {
		backgroundColor: WHIMSY.ink,
	},
	actionTabText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	actionTabTextActive: {
		color: WHIMSY.paper,
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
	visitBtn: {
		alignSelf: "stretch",
		backgroundColor: WHIMSY.sky,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 10,
		alignItems: "center",
		marginBottom: 12,
	},
	visitBtnRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 7,
	},
	visitBtnText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	// Disabled Visit button — muted fill + ink, reads as "can't right now".
	visitBtnDisabled: {
		backgroundColor: WHIMSY.cream2,
		borderColor: WHIMSY.muteSoft,
		opacity: 0.7,
	},
	visitBtnTextDisabled: { color: WHIMSY.mute },
});
