// User-detail bottom sheet — opens when you tap another user anywhere
// (leaderboard rows, friend rows, crew rows). One-shot fetch via
// public_user_stats RPC. Action button is state-aware:
//   self       → no action
//   none       → Add friend
//   pending_outgoing → Cancel request
//   pending_incoming → Accept friend request
//   friends    → an Ask row — pick 1-5, then request_tickles. This
//                is the single door for asking a friend for tickles.
//
// Wave-3 conformance pass (area B). This is the most-opened sheet in the app,
// and it carried the area's worst error path plus its own sheet chrome:
//   · **B-02** — a failed profile fetch set `stats = null` and `loading =
//     false`, and the render branch tested `!stats`, so the player watched
//     "peeking in" forever while the written error copy sat in an unreachable
//     branch. The branch is now three-way: `LoadingBeat` while loading,
//     `EmptyState kind="error"` + a retry when the fetch came back empty, and
//     content otherwise. A null fetch is not an empty state.
//   · **B-06 / B-25** — the hand-rolled `Modal` + scrim + slide + grabber (320ms
//     in, no exit tween, no Reduce-Motion path) is the `Sheet` primitive. The
//     nested Block / Report confirms and the Barn visit ride in `Sheet`'s
//     `overlay` slot, inside this sheet's own Modal, because iOS will not
//     reliably present a nested native one.
//   · **B-08** — the blocked Visit control keeps its whole shape (the `DISABLED`
//     chrome a `Sticker disabled` composes) instead of an `opacity: 0.7` crush.
//   · **B-11** — Block and Report name their consequence in `confirmHint` and
//     confirm on the destructive ramp.
//   · **B-13** — the two `›` text chevrons render as art (`Glyph`/`Icon`).
//   · **B-06 / B-12** — the eight hand-rolled shapes are `SegmentedControl`
//     (Ask/Bless/Curse), `Chip` (the 1–5 ask amounts, selected = BORDER.heavy),
//     `Button` (every action, 44pt floor), `Stat` + `Tag` (the season row)
//     and `Tag` (the keepsake).
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { fetchBarnVisitStatus, type BarnVisitStatus } from "@/utils/barnVisit";
import { pairBondWith, bondBreakdown, type PairBondWith } from "@/utils/pairBonds";
import { BarnVisitModal } from "./BarnVisitModal";
import { RitualPicker } from "./RitualPicker";
import { GameIcon } from "./ui/GameIcon";
import { TickleBreakdownSheet } from "./TickleBreakdownSheet";
import { useCrew } from "@/hooks/useCrew";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import { useVisitorEffects } from "@/hooks/useVisitorEffects";
import { useRitualPresentationFor } from "@/hooks/useRitualPresentation";
import type { RitualMode } from "../utils/rituals";
import { type AlignmentLabel } from "@/utils/alignment";
import type { TradeRow } from "@/constants/trade_types";
import type { TitlePlacement } from "@/constants/title_types";
import { formatHM } from "@/utils/duration";
import { blockUser, reportUser } from "@/utils/moderation";
import {
	ART_SIZE,
	BORDER,
	MOTION,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	AlignmentBar,
	Button,
	Chip,
	ConfirmDialog,
	EmptyState,
	Glyph,
	Icon,
	Kicker,
	LoadingBeat,
	PrestigeAvatar,
	ProfileIdentity,
	SegmentedControl,
	Sheet,
	Stat,
	Sticker,
	T,
	Tag,
	useUnmanagedModalHold,
	type ChipTone,
} from "./ui";
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

type ActionTab = "ask" | RitualMode;

const ACTION_TABS = [
	{ value: "ask" as const, label: "Ask" },
	{ value: "bless" as const, label: "Bless" },
	{ value: "curse" as const, label: "Curse" },
];

// The five ask amounts. Hick's law says five is one too many (the audit's P7
// note) — but changing the economy is a product call, not a conformance one.
const ASK_AMOUNTS = [1, 2, 3, 4, 5];

// Avatar diameters for the sheet header: a Wallow-ranked pig gets the bigger
// frame so its aura reads. Drawing geometry.
const HEADER_AVATAR = 56;
const HEADER_AVATAR_PRESTIGE = 76;
// The Barn icon on the one hero control — sized as art, not as a row icon.
const HEADER_ICON = 24;

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

export function UserSheet(props: Props) {
	return <UserSheetSession key={props.targetUserId ?? "closed"} {...props} />;
}

function UserSheetSession({ targetUserId, onDismiss, onFriendshipChanged }: Props) {
	const targetGeneration = useRef(0);
	// Crewmates can be blessed without being friends (send_blessing allows
	// friends OR crewmates) — derive crewmate-ness from the caller's own
	// roster so the sheet can offer the bless panel to non-friend sounder
	// mates. Ask / Curse / Visit stay friends-only.
	const { crew: myCrewState } = useCrew();
	const isCrewmate =
		!!targetUserId &&
		myCrewState.members.some((m) => m.user_id === targetUserId);
	// This sheet nests its own Block/Report ConfirmDialogs + BarnVisitModal in
	// `Sheet`'s overlay slot (kept nested on purpose — iOS presentation
	// ordering). Hold the queue for the whole session so a foreground poll
	// (schism/finale/achievements on AppState "active") can't present a queued
	// popup over it — the #50152 wedge (issue #4). The hold is reference
	// counted, so this composes with the one `Sheet` takes for itself; closing
	// (targetUserId → null) lifts both and a queued achievement re-admits after
	// the handoff gap.
	useUnmanagedModalHold(!!targetUserId);
	// Alignment isn't a thing in Season 1 — its bar retires with S0.
	const s1 = useSeason1Active();
	// The rituals this pig is wearing (weekday rituals, 2026-09-14). The session
	// is keyed by `targetUserId`, so this is ONE read per sheet open, and the
	// portrait takes only the static channels — a profile header is no place for
	// a bob or a firefly.
	const { kinds: targetRitualKinds } = useVisitorEffects(targetUserId);
	const targetPresentation = useRitualPresentationFor(targetRitualKinds);
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	// Bumped by the error state's "Try again" so the profile fetch re-runs
	// without re-keying the whole session. [B-02]
	const [reloadToken, setReloadToken] = useState(0);
	// Barn visiting (social feature) — opens the visit screen for this user.
	const [showVisit, setShowVisit] = useState(false);
	// Whether a visit would actually succeed right now (barn_visit_status). Used
	// to pre-disable the Visit button instead of opening the modal to a dead-end
	// pop-up: locked to a different barn (one friend / 3h), out of tickles, or the
	// pig already at its hourly tap ceiling.
	const [visitGate, setVisitGate] = useState<BarnVisitStatus | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	// Block + Report dialogs. Apple Guideline 1.2 requires both for
	// any app with user-to-user interactions; they appear as small
	// links at the bottom of the sheet so they're discoverable for
	// review without being prominent enough to feel hostile.
	const [blockOpen, setBlockOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [blockBusy, setBlockBusy] = useState(false);
	// 3-tab control for the action area on a friend's sheet (Ask /
	// Bless / Curse). Only one panel is visible at a time.
	const [actionTab, setActionTab] = useState<ActionTab>("ask");
	// Amount for the friends-only Ask row (1-5).
	const [askAmount, setAskAmount] = useState(1);
	// The Ask row is state-aware: a pending trade or a 24h pair
	// cooldown blocks a new request. Derived from my_tickle_trades.
	const [askState, setAskState] = useState<AskState>({ kind: "ready" });
	// THIS-SEASON tickles for the TICKLES stat column. Not part of
	// public_user_stats yet — fetched directly from profiles in
	// parallel so the design's 3-column stats row has the value it
	// needs without expanding the RPC's return shape. Season-only
	// (tickles_earned) by product call: a friend's sheet reads the
	// live race, not the all-time ledger (that stays on your own Me tab).
	const [targetTickles, setTargetTickles] = useState<number | null>(null);
	const [targetWallowCount, setTargetWallowCount] = useState(0);
	const [curseStatus, setCurseStatus] = useState<{
		cursed: boolean;
		expires_at: string | null;
	} | null>(null);
	// The keepsake: the caller's lifetime bond with THIS friend (trades /
	// blessings / visits). Fail-soft — an unpushed migration or any null result
	// leaves this null, and the line renders nothing (never an error).
	const [bond, setBond] = useState<PairBondWith | null>(null);
	// The tickle breakdown receipt (spec 17). Opening it must NOT stack a second
	// native Modal over this sheet (the #50152 wedge), so we HIDE this sheet
	// first (breakdownPending), then present the receipt one handoff beat later
	// (breakdownFor) — the same hide→gap→present handshake the popup queue uses.
	const [breakdownPending, setBreakdownPending] = useState<{ id: string; total: number } | null>(null);
	const [breakdownFor, setBreakdownFor] = useState<{ id: string; total: number } | null>(null);
	const breakdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const openBreakdown = () => {
		if (!stats) return;
		const payload = { id: stats.user_id, total: targetTickles ?? 0 };
		setBreakdownPending(payload); // hides this sheet's Modal this frame
		if (breakdownTimer.current) clearTimeout(breakdownTimer.current);
		breakdownTimer.current = setTimeout(() => {
			setBreakdownPending(null);
			setTargetWallowCount(0);
			setBreakdownFor(payload); // presents the receipt after the handoff gap
		}, MOTION.modalHandoff);
	};
	useEffect(
		() => () => {
			if (breakdownTimer.current) clearTimeout(breakdownTimer.current);
		},
		[]
	);

	useEffect(() => {
		const generation = ++targetGeneration.current;
		const isCurrent = () =>
			targetGeneration.current === generation;
		if (!targetUserId) {
			setStats(null);
			setFeedback(null);
			setBreakdownFor(null);
			setBreakdownPending(null);
			return;
		}
		setLoading(true);
		setStats(null);
		setFeedback(null);
		setAskState({ kind: "ready" });
		setTargetTickles(null);
		setVisitGate(null);
		setBond(null);
		// Keepsake — the caller's bond with this friend. Fail-soft: a null
		// result (unpushed migration / refusal) leaves the line hidden.
		pairBondWith(targetUserId).then((d) => {
			if (!isCurrent()) return;
			// The envelope discriminates on `ok`, so the check narrows it directly.
			setBond(d?.ok ? d : null);
		});
		// Can a visit to this person succeed right now? (gates the Visit button)
		fetchBarnVisitStatus(targetUserId).then((d) => {
			if (isCurrent() && d.ok) setVisitGate(d);
		});
		rpc<UserStats[]>("public_user_stats", {
			target_user_id: targetUserId,
		}).then((data) => {
			if (!isCurrent()) return;
			if (!data) {
				setFeedback("Couldn't load profile.");
				setStats(null);
			} else {
				const row = data[0] ?? null;
				setStats(row);
				// A friend's sheet opens ON the blessing — it's the thing players
				// come here to do, and landing on it makes the sheet path one tap
				// shorter too. Everyone else still opens on Ask.
				setActionTab(row?.friendship_status === "friends" ? "bless" : "ask");
			}
			setLoading(false);
		});
		// Trade state with this user — drives the Ask row.
		rpc<TradeRow[]>("my_tickle_trades").then((data) => {
			if (isCurrent()) setAskState(deriveAskState(targetUserId, data));
		});
		// This-season tickle count for the TICKLES stat column (tickles_earned,
		// the live-season tally the Board is racing on). A friend's sheet shows
		// the current-season figure, not the all-time lifetime — that lives on
		// your own Me tab. Profiles is readable for visible fields; a failure
		// leaves the column blank rather than blocking the sheet.
		supabase
			.from("profiles")
			.select("tickles_earned, wallow_count")
			.eq("id", targetUserId)
			.maybeSingle()
			.then(({ data, error }) => {
				const row = error ? null : data;
				if (!isCurrent()) return;
				setTargetTickles(row ? (row.tickles_earned ?? 0) : null);
				setTargetWallowCount(row?.wallow_count ?? 0);
			});
		return () => {
			if (targetGeneration.current === generation) targetGeneration.current++;
		};
	}, [targetUserId, reloadToken]);

	// Curse countdown — when the curse tab is open, surface how long any
	// existing curse on the target still has. Privacy-safe RPC: returns only
	// the soonest expiry, never who cast it.
	useEffect(() => {
		let cancelled = false;
		if (actionTab !== "curse" || !targetUserId) {
			setCurseStatus(null);
			return;
		}
		rpc<{ cursed: boolean; expires_at: string | null }>(
			"target_curse_status",
			{ target_id: targetUserId }
		).then((d) => {
			if (!cancelled)
				setCurseStatus(d ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, [actionTab, targetUserId]);

	const refreshStats = async () => {
		const expectedTarget = targetUserId;
		const expectedGeneration = targetGeneration.current;
		if (!expectedTarget) return;
		const rows = (await rpc<UserStats[]>("public_user_stats", {
			target_user_id: expectedTarget,
		})) ?? [];
		if (
			targetGeneration.current !== expectedGeneration
		)
			return;
		setStats(rows[0] ?? null);
	};

	// Why the Visit button is blocked (null = a visit would work). Until the
	// status RPC resolves, visitGate is null → button stays enabled and the
	// modal's own guards remain the backstop.
	// A visit no longer spends the visitor's tickle bank (20260661) — the only
	// real blocks are the 3h per-pig nap (locked) and a mid-visit rest (resting).
	// The old "Out of tickles to visit" branch was stale and falsely blocked
	// players with an empty bank, so it's gone.
	const visitBlock: { label: string } | null = !visitGate
		? null
		: visitGate.locked
			? { label: visitGate.next_at ? `Napping · back in ${formatRemaining(visitGate.next_at)}` : "Napping — come back soon" }
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
		const result = await blockUser(stats.user_id);
		setBlockBusy(false);
		setBlockOpen(false);
		if (!result.ok) {
			setFeedback("Couldn't block this user. Try again.");
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setFeedback(`${stats.username ?? "User"} blocked. They can no longer interact with you.`);
		onFriendshipChanged?.();
		// Close the sheet after a brief beat so the toast reads.
		setTimeout(onDismiss, MOTION.beat);
	};

	const doReport = async () => {
		if (!stats || blockBusy) return;
		setBlockBusy(true);
		const result = await reportUser(stats.user_id);
		setBlockBusy(false);
		setReportOpen(false);
		if (!result.ok) {
			setFeedback("Couldn't send this report. Try again.");
			return;
		}
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

	// Three-way, in this order — the fix for B-02. `loading` is the beat;
	// `!stats` after the beat is a FAILURE, not an empty shelf; content is
	// everything else.
	const body = loading ? (
		<LoadingBeat label="peeking in" />
	) : !stats ? (
		<EmptyState
			kind="error"
			title="Couldn't load this pig"
			sub={feedback ?? "We couldn't reach their profile just now."}
			action={
				<Button
					size="sm"
					variant="ghost"
					onPress={() => setReloadToken((n) => n + 1)}
					accessibilityLabel="Try again"
					accessibilityHint="Reloads this pig's profile"
					testID="user-sheet-retry"
				>
					Try again
				</Button>
			}
		/>
	) : (
		<>
			<View style={styles.header}>
				<PrestigeAvatar
					size={targetWallowCount > 0 ? HEADER_AVATAR_PRESTIGE : HEADER_AVATAR}
					hatId={stats.active_hat_id}
					prestigeLevel={targetWallowCount}
					ritual={targetPresentation.pig}
				/>
				<View style={styles.headerCopy}>
					<ProfileIdentity
						username={stats.username}
						title={
							stats.active_title_name && stats.active_title_placement
								? { name: stats.active_title_name, placement: stats.active_title_placement }
								: null
						}
						discriminator={stats.discriminator}
						variant="profile"
					/>
				</View>
			</View>

			{!s1 && (
				<View style={styles.alignBarWrap}>
					<AlignmentBar
						score={stats.alignment_score}
						label={stats.alignment_label}
					/>
				</View>
			)}

			{/* This season's numbers — a friend's sheet reads the
			    live race, not the all-time ledger. */}
			<Kicker style={styles.seasonKicker}>this season</Kicker>
			<Sticker
				color="cream"
				shadow="none"
				rotate={0}
				radius={RADII.lg}
				border={BORDER.thin}
				style={styles.statsRow}
			>
				<StatCol
					label="GIVEN"
					value={stats.given_total}
					tier={stats.generous_tier_name}
					tone="lilac"
				/>
				<View style={styles.statsDivider} />
				<StatCol
					label="RECEIVED"
					value={stats.received_total}
					tier={stats.greedy_tier_name}
					tone="sun"
				/>
				<View style={styles.statsDivider} />
				<StatCol label="TICKLES" value={targetTickles} tone="roseDeep" />
			</Sticker>

			{/* Keepsake — the quiet lifetime bond between the two of
			    you (trades · blessings · visits). Only shows once a
			    bond has actually formed; hidden entirely when the
			    RPC is missing (unpushed migration) or bond is 0. */}
			{bond && bond.bond > 0 && (
				<Tag
					glyph="handshake"
					label={`you two: ${bondBreakdown(bond)}`}
					accessibilityLabel={`Your bond with this pig: ${bondBreakdown(bond)}`}
					style={styles.keepsake}
				/>
			)}

			{/* The tickle receipt (spec 17) — a quiet door into how this
			    pig earned its season tickles. Self and others render
			    identically; the total is already public on the board. */}
			<Button
				variant="handLink"
				onPress={openBreakdown}
				accessibilityLabel="How this pig earned its tickles"
				accessibilityHint="Opens the tickle receipt"
				style={styles.breakdownLink}
			>
				<>
					{"how'd they earn it? "}
					<Glyph name="arrowRight" size={ART_SIZE.mark} />
				</>
			</Button>

			{/* Visit their Barn — see their pig + tickle it for them (social).
			    FRIENDS-ONLY (player decision): visiting mints snouts +
			    leaderboard to both pigs, so it's hidden for non-friends (the
			    server are_friends check is the authoritative backstop).
			    Pre-disabled when a visit can't succeed (locked to another
			    barn / pig resting) so we never open the modal just to show a
			    dead-end pop-up. The blocked state keeps the control's whole
			    shape — muted fill, ink outline, no opacity crush. [B-08] */}
			{stats.friendship_status !== "friends" ? null : (
				<Sticker
					color="sky"
					rotate={0}
					radius={RADII.lg}
					// A resting control is not lifted off the paper.
					shadow={visitBlock ? "none" : true}
					onPress={visitBlock ? undefined : () => setShowVisit(true)}
					disabled={!!visitBlock}
					accessibilityLabel={
						visitBlock ? `Visit Barn — ${visitBlock.label}` : "Visit Barn"
					}
					accessibilityHint={
						visitBlock
							? "You can't visit this barn right now"
							: "Opens their barn so you can tickle their pig"
					}
					style={styles.visitBtn}
				>
					<View style={styles.visitBtnRow}>
						<GameIcon
							name="visit"
							size={visitBlock ? ART_SIZE.glyphSm : HEADER_ICON}
							muted={!!visitBlock}
						/>
						<T
							role="cardTitle"
							tone={visitBlock ? "disabled" : "primary"}
							align="center"
						>
							{visitBlock ? visitBlock.label : "Visit Barn"}
						</T>
					</View>
				</Sticker>
			)}

			{stats.friendship_status === "friends" ? (
				<>
					{/* Ask / Bless / Curse — the system's SegmentedControl, so the
					    third hand-rolled segmented control in this area is gone. */}
					<SegmentedControl<ActionTab>
						options={ACTION_TABS}
						value={actionTab}
						onChange={setActionTab}
						label="What to do with this friend"
						style={styles.actionTabs}
					/>

					{actionTab === "ask" && (
						<AskRow
							amount={askAmount}
							onPick={setAskAmount}
							onAsk={sendTickle}
							busy={busy}
							state={askState}
							name={stats.username ?? "this friend"}
						/>
					)}
					{actionTab === "curse" &&
						curseStatus?.cursed &&
						curseStatus.expires_at && (
							<T
								role="hand"
								tone="secondary"
								align="center"
								style={styles.curseCountdown}
							>
								Already cursed — wears off in{" "}
								{formatRemaining(curseStatus.expires_at)}
							</T>
						)}
					{actionTab !== "ask" && (
						<RitualPicker
							mode={actionTab}
							targetUserId={stats.user_id}
							targetName={stats.username ?? "friend"}
						/>
					)}
				</>
			) : isCrewmate && stats.friendship_status !== "self" ? (
				<>
					{/* Non-friend sounder mate — bless-only panel. The
					    herd you fight beside deserves warmth before the
					    friend request lands; Ask/Curse/Visit stay
					    friends-only. */}
					<Kicker align="center" style={styles.crewmateKicker}>
						rides in your Sounder ★
					</Kicker>
					<RitualPicker
						mode="bless"
						targetUserId={stats.user_id}
						targetName={stats.username ?? "crewmate"}
					/>
					<ActionButton
						status={stats.friendship_status}
						busy={busy}
						name={stats.username ?? "this pig"}
						onAdd={addFriend}
						onCancel={cancelOutgoing}
						onAccept={acceptIncoming}
					/>
				</>
			) : (
				<ActionButton
					status={stats.friendship_status}
					busy={busy}
					name={stats.username ?? "this pig"}
					onAdd={addFriend}
					onCancel={cancelOutgoing}
					onAccept={acceptIncoming}
				/>
			)}

			{!!feedback && (
				<T role="hand" tone="accent" align="center" style={styles.feedback}>
					{feedback}
				</T>
			)}

			{/* Block + Report — small footer links. Required by
			    Apple Guideline 1.2 for any app with user-to-user
			    social features. Low-prominence by design so the
			    sheet doesn't feel hostile. `·` stays typography. */}
			<View style={styles.moderationRow}>
				<Button
					variant="link"
					size="xs"
					onPress={() => setReportOpen(true)}
					accessibilityLabel={`Report ${stats.username ?? "this user"}`}
					accessibilityHint="Asks to confirm, then sends a report to our review team"
				>
					Report
				</Button>
				<T role="hand" tone="secondary">
					·
				</T>
				<Button
					variant="link"
					size="xs"
					onPress={() => setBlockOpen(true)}
					accessibilityLabel={`Block ${stats.username ?? "this user"}`}
					accessibilityHint="Asks to confirm, then stops all interaction either way"
				>
					Block
				</Button>
			</View>
		</>
	);

	return (
		<>
			<Sheet
				open
				onClose={onDismiss}
				// The breakdown handshake: the native Modal drops the frame the
				// receipt is queued, while this session stays MOUNTED so its state
				// survives the handoff gap.
				modalVisible={!breakdownFor && !breakdownPending}
				kicker="profile"
				closeLabel="Close"
				testID="user-sheet"
				overlay={
					<>
						<ConfirmDialog
							open={blockOpen}
							presentation="inline"
							tone="destructive"
							title="Block this user?"
							body={`Blocking ${stats?.username ?? "this user"} removes them from your friends, cancels any pending trades, and prevents future interaction either way. You can unblock from Me → Settings → Blocked users.`}
							confirmLabel="Block"
							confirmHint={`Removes ${stats?.username ?? "this user"} from your friends and cancels pending trades. Only you can undo it, from Me → Settings → Blocked users.`}
							cancelLabel="Cancel"
							cancelHint="Leaves things as they are"
							busy={blockBusy}
							onCancel={() => setBlockOpen(false)}
							onConfirm={doBlock}
						/>
						<ConfirmDialog
							open={reportOpen}
							presentation="inline"
							tone="destructive"
							title="Report this user?"
							body={`Send a report about ${stats?.username ?? "this user"} for our review team. They won't be notified. Use Block to also stop interaction.`}
							confirmLabel="Report"
							confirmHint="Sends this report to our review team. It can't be taken back."
							cancelLabel="Cancel"
							cancelHint="Sends nothing"
							busy={blockBusy}
							onCancel={() => setReportOpen(false)}
							onConfirm={doReport}
						/>
						{/* Barn visit overlay — rendered INSIDE this sheet's Modal
						    (a nested Modal won't reliably present over it on iOS),
						    full-screen on top of the sheet. */}
						{showVisit && stats && (
							<BarnVisitModal
								key={targetUserId}
								targetUserId={targetUserId}
								targetName={formatHandle(stats)}
								onClose={() => setShowVisit(false)}
								onLeaveForCollection={onDismiss}
							/>
						)}
					</>
				}
			>
				{body}
			</Sheet>

			{/* The tickle breakdown receipt — a peer native Modal, presented only
			    after this sheet has hidden (breakdownFor set) so the two never
			    stack. Closing it dismisses the whole flow (onDismiss) rather than
			    re-presenting this sheet in the same commit (which would re-wedge). */}
			<TickleBreakdownSheet
				userId={breakdownFor?.id ?? null}
				fallbackTotal={breakdownFor?.total ?? null}
				onClose={onDismiss}
			/>
		</>
	);
}

function StatCol({
	label,
	value,
	tier,
	tone,
}: {
	label: string;
	// Null = data unavailable; renders as "—" so the column still
	// occupies its slot. The TICKLES column uses this path until the
	// public_user_stats RPC carries the field natively.
	value: number | null;
	tier?: string | null;
	tone: ChipTone;
}) {
	return (
		<View style={styles.statCol}>
			<Stat
				label={label}
				value={value == null ? "—" : value.toLocaleString()}
				glyph={value == null ? undefined : "heart"}
			/>
			{tier ? <Tag label={tier} tone={tone} /> : null}
		</View>
	);
}

// Add / cancel / accept. The "friends" state uses AskRow instead.
function ActionButton({
	status,
	busy,
	name,
	onAdd,
	onCancel,
	onAccept,
}: {
	status: FriendshipStatus;
	busy: boolean;
	name: string;
	onAdd: () => void;
	onCancel: () => void;
	onAccept: () => void;
}) {
	if (status === "self" || status === "friends") return null;

	const config: { label: string; onPress: () => void; hint: string; primary?: boolean } =
		status === "pending_outgoing"
			? {
					label: "Cancel request",
					onPress: onCancel,
					hint: `Withdraws your friend request to ${name}`,
				}
			: status === "pending_incoming"
				? {
						label: "Accept friend request",
						onPress: onAccept,
						hint: `Makes you and ${name} friends`,
						primary: true,
					}
				: {
						label: "Add friend",
						onPress: onAdd,
						hint: `Sends ${name} a friend request`,
						primary: true,
					};

	return (
		<Button
			full
			variant={config.primary ? "lilac" : "ghost"}
			onPress={config.onPress}
			loading={busy}
			accessibilityLabel={config.label}
			accessibilityHint={config.hint}
			testID="user-sheet-friend-action"
		>
			{config.label}
		</Button>
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
	name,
}: {
	amount: number;
	onPick: (n: number) => void;
	onAsk: () => void;
	busy: boolean;
	state: AskState;
	name: string;
}) {
	if (state.kind === "pending") {
		return (
			<AskBlocked
				title="Trade in progress"
				sub="You've already got a trade going with them — answer or withdraw it first."
			/>
		);
	}
	if (state.kind === "cooldown") {
		return (
			<AskBlocked
				title="Cooling off"
				sub={`You traded recently — you can ask again in about ${state.hours}h.`}
			/>
		);
	}
	// Economic hint copy — explains the trade math to the asker BEFORE
	// they tap submit. From the design's RitualPicker.
	const greedyShade = amount > 2 ? "more greedy" : "a little greedy";
	return (
		<View style={styles.askWrap}>
			<View style={styles.askPills}>
				{ASK_AMOUNTS.map((n) => (
					<Chip
						key={n}
						label={String(n)}
						selected={amount === n}
						onPress={() => onPick(n)}
						tone={amount === n ? "lilac" : "paper"}
						accessibilityLabel={`Ask for ${n}`}
						accessibilityHint={`They spend ${n} from their bank; you pocket ${n * 2}`}
						style={styles.askPill}
					/>
				))}
			</View>
			<T role="hand" tone="secondary" align="center" style={styles.askHint}>
				★ they spend {amount} from their bank. you pocket {amount * 2}. you
				become {greedyShade}. ★
			</T>
			<Button
				full
				variant="lilac"
				onPress={onAsk}
				loading={busy}
				accessibilityLabel={`Ask ${name} for ${amount}`}
				accessibilityHint={`Spends nothing now; they give ${amount} from their bank and you become ${greedyShade}`}
				testID="user-sheet-ask"
			>
				<>
					{`Ask for ${amount} `}
					<Glyph name="heart" size={ART_SIZE.mark} />
				</>
			</Button>
		</View>
	);
}

// "Why you can't ask yet" — a cream panel that keeps its shape rather than
// disappearing the control.
function AskBlocked({ title, sub }: { title: string; sub: string }) {
	return (
		<Sticker
			color="cream"
			shadow="none"
			rotate={0}
			radius={RADII.md}
			border={BORDER.thin}
			pad
			style={styles.askBlocked}
		>
			<T role="cardTitleSm" align="center">
				{title}
			</T>
			<T role="hand" tone="secondary" align="center">
				{sub}
			</T>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginBottom: SPACE.lg,
	},
	headerCopy: { flex: 1, minWidth: 0 },
	alignBarWrap: { marginBottom: SPACE.card },
	seasonKicker: { marginBottom: SPACE.xs },
	statsRow: {
		flexDirection: "row",
		alignItems: "stretch",
		paddingVertical: SPACE.card,
		marginBottom: SPACE.lg,
	},
	statsDivider: {
		width: BORDER.thin,
		backgroundColor: WHIMSY.ink,
		marginVertical: SPACE.sm,
	},
	statCol: { flex: 1, alignItems: "center", gap: SPACE.xs },
	// Keepsake line — the quiet, warm note of the two pigs' lifetime bond,
	// sitting just under the stats cluster.
	keepsake: { alignSelf: "center", marginBottom: SPACE.card },
	// The quiet "how'd they earn it?" receipt door.
	breakdownLink: { alignSelf: "center", marginBottom: SPACE.xs },
	visitBtn: {
		alignSelf: "stretch",
		paddingVertical: SPACE.lg,
		alignItems: "center",
		marginBottom: SPACE.md,
	},
	visitBtnRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
	},
	actionTabs: { marginTop: SPACE.md, marginBottom: SPACE.md },
	crewmateKicker: { marginBottom: SPACE.sm },
	askWrap: { gap: SPACE.sm },
	askPills: { flexDirection: "row", gap: SPACE.sm },
	askPill: { flex: 1, justifyContent: "center" },
	// Hand-script tradeoff preview between the pills and the submit
	// button — sets expectations before commit.
	askHint: { marginTop: SPACE.xs, marginBottom: SPACE.xxs },
	askBlocked: { alignItems: "center" },
	feedback: { marginTop: SPACE.sm },
	curseCountdown: { marginBottom: SPACE.sm },
	moderationRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.card,
		paddingTop: SPACE.sm,
		borderTopWidth: BORDER.hair,
		borderTopColor: UI_COLORS.uiMuted,
	},
});
