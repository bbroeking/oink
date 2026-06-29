// Inbox — the activity-feed segment of the Friends hub. One feed,
// three bands:
//   • "Out to market" — your own pending outgoing trade requests
//   • Actionable      — incoming friend + trade requests, inline
//                        buttons, sorted to the top
//   • Recent          — passive events (blessed/cursed you, your
//                        trade was answered)
// Incoming trade rows are styled as Stockyard pen cards — the theme
// the retired TickleTradeModal carried. See
// docs/season-1-social-redesign.md §"The Inbox feed".
import React, { useCallback, useState } from "react";
import {
	View,
	Text,
	Image,
	StyleSheet,
	Pressable,
	ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { ActiveEffects } from "./ActiveEffects";
import { FONTS, WHIMSY } from "@/constants/theme";
import type { TradeRow } from "@/constants/trade_types";
import { SectionHeader } from "./ui/SectionHeader";
import { Sticker } from "./ui/Sticker";
import { EmptyState, LoadingBeat } from "./ui/EmptyState";
import { FRIEND_CAP_LIMIT } from "@/utils/friendships";

interface FriendReq {
	requester_id: string;
	username: string | null;
}

interface RitualRow {
	id: string;
	kind: string;
	sent_at: string;
	from_username: string | null;
}

// Compact relative age for feed rows: 5m / 3h / 2d / 3w.
function relTime(at: number): string {
	if (!at || Number.isNaN(at)) return "";
	const s = Math.max(0, (Date.now() - at) / 1000);
	if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	if (s < 604800) return `${Math.floor(s / 86400)}d`;
	return `${Math.floor(s / 604800)}w`;
}

interface AcceptedFriend {
	receiver_id: string;
	username: string | null;
	updated_at: string;
}

// Inbox copy mirrors what the SENDER saw when they cast the effect
// (RitualPicker reads ritual.blurb from these same meta tables) +
// what the RECEIVER sees on the ActiveEffects strip + Hoofprints
// sheet + WhileAway modal. Previously the Inbox had its own
// flavor-only label map that drifted — the recipient was getting
// vague poetry while every other surface showed the actual rule
// the effect was applying. Source of truth: utils/rituals.ts.
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";

function blessingDescription(kind: string): string {
	const m = BLESSING_META[kind as BlessingKind];
	return m ? `${m.name} — ${m.blurb}` : kind;
}
function curseDescription(kind: string): string {
	const m = CURSE_META[kind as CurseKind];
	return m ? `${m.name} — ${m.blurb}` : kind;
}

interface Props {
	userId: string;
	onActionableCount?: (n: number) => void;
}

export function Inbox({ userId, onActionableCount }: Props) {
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [feedback, setFeedback] = useState("");

	const [friendReqs, setFriendReqs] = useState<FriendReq[]>([]);
	const [incomingTrades, setIncomingTrades] = useState<TradeRow[]>([]);
	const [outgoingTrades, setOutgoingTrades] = useState<TradeRow[]>([]);
	const [answered, setAnswered] = useState<TradeRow[]>([]);
	// Trades I FULFILLED — surfaces "you gifted X N tickles" rows in
	// the passive band so a gift leaves a visible trail on the giver's
	// side. Mirrors `answered` (trades I requested that got filled).
	const [gifted, setGifted] = useState<TradeRow[]>([]);
	const [blessings, setBlessings] = useState<RitualRow[]>([]);
	const [curses, setCurses] = useState<RitualRow[]>([]);
	const [acceptedFriends, setAcceptedFriends] = useState<AcceptedFriend[]>([]);
	// Caller's tickle balance — drives "Give N" → "Need N more" on
	// incoming trade cards when they can't afford to fulfill. Polled
	// on every load(), so post-action refreshes catch the deduction.
	const [balance, setBalance] = useState<number | null>(null);
	// What-happened pagination: newest 10, then "Load more" pages by 10.
	const [shownCount, setShownCount] = useState(10);

	const load = useCallback(async () => {
		// Trades — one RPC covers incoming / outgoing / answered.
		const trades = (await rpc<TradeRow[]>("my_tickle_trades")) ?? [];
		setIncomingTrades(
			trades.filter((t) => t.status === "pending" && t.target_id === userId)
		);
		setOutgoingTrades(
			trades.filter((t) => t.status === "pending" && t.requester_id === userId)
		);
		setAnswered(
			trades.filter(
				(t) => t.status === "fulfilled" && t.requester_id === userId
			)
		);
		setGifted(
			trades.filter(
				(t) => t.status === "fulfilled" && t.target_id === userId
			)
		);

		// Incoming friend requests.
		const { data: incRows } = await supabase
			.from("friendships")
			.select("requester_id")
			.eq("receiver_id", userId)
			.eq("status", "pending");
		const incIds = ((incRows ?? []) as { requester_id: string }[]).map(
			(r) => r.requester_id
		);
		if (incIds.length > 0) {
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username")
				.in("id", incIds);
			const byId = new Map(
				((profs ?? []) as { id: string; username: string | null }[]).map(
					(p) => [p.id, p.username]
				)
			);
			setFriendReqs(
				incIds.map((id) => ({
					requester_id: id,
					username: byId.get(id) ?? null,
				}))
			);
		} else {
			setFriendReqs([]);
		}

		// Blessings / curses received — recent, for the passive band.
		const hydrate = async (
			table: "blessings" | "curses"
		): Promise<RitualRow[]> => {
			const { data } = await supabase
				.from(table)
				.select("id, kind, sent_at, sender_id")
				.eq("receiver_id", userId)
				.order("sent_at", { ascending: false })
				// Pull up to 100 so the What-happened feed's "load more up to
				// 100" has enough history (was 40 — capped what could be paged).
				.limit(100);
			const rows = (data ?? []) as {
				id: string;
				kind: string;
				sent_at: string;
				sender_id: string;
			}[];
			if (rows.length === 0) return [];
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username")
				.in(
					"id",
					rows.map((r) => r.sender_id)
				);
			const byId = new Map(
				((profs ?? []) as { id: string; username: string | null }[]).map(
					(p) => [p.id, p.username]
				)
			);
			return rows.map((r) => ({
				id: r.id,
				kind: r.kind,
				sent_at: r.sent_at,
				from_username: byId.get(r.sender_id) ?? null,
			}));
		};
		setBlessings(await hydrate("blessings"));
		setCurses(await hydrate("curses"));

		// Tickle balance — for the Give-vs-Need affordance on
		// incoming trade cards. tickle_info returns the
		// regen-catchup balance, which is what the player can
		// actually spend right now.
		const t = await rpc<{ balance?: number }>("tickle_info", {
			uid: userId,
		});
		setBalance(typeof t?.balance === "number" ? t.balance : null);

		// Recently-accepted outgoing friend requests — surfaced in the
		// passive band as "X accepted your request" cards. Bounded to
		// the last 7 days so the band doesn't accumulate forever; once
		// the friend is in your list, the card is just an echo.
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		const { data: accRows } = await supabase
			.from("friendships")
			.select("receiver_id, updated_at")
			.eq("requester_id", userId)
			.eq("status", "accepted")
			.gt("updated_at", sevenDaysAgo)
			.order("updated_at", { ascending: false })
			.limit(10);
		const accList = (accRows ?? []) as { receiver_id: string; updated_at: string }[];
		if (accList.length === 0) {
			setAcceptedFriends([]);
		} else {
			const { data: accProfs } = await supabase
				.from("profiles")
				.select("id, username")
				.in("id", accList.map((r) => r.receiver_id));
			const accById = new Map(
				((accProfs ?? []) as { id: string; username: string | null }[]).map(
					(p) => [p.id, p.username]
				)
			);
			setAcceptedFriends(
				accList.map((r) => ({
					receiver_id: r.receiver_id,
					username: accById.get(r.receiver_id) ?? null,
					updated_at: r.updated_at,
				}))
			);
		}

		setLoading(false);
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// Realtime: subscribe to the four social tables, scoped to
	// rows the caller is party to. Any event re-runs load() so
	// the inbox repopulates without needing a tab swipe.
	//
	// `tickle_trades` + `friendships` have two columns the caller
	// could be in (requester/receiver), so we register two filters
	// per table and let either fire load().
	React.useEffect(() => {
		if (!userId) return;
		const ch = supabase
			.channel(`realtime:inbox:${userId}`)
			// Incoming blessings → "blessed you" passive row
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "blessings",
					filter: `receiver_id=eq.${userId}`,
				},
				() => load()
			)
			// Incoming curses → "cursed you" passive row + hoofprints panel
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "curses",
					filter: `receiver_id=eq.${userId}`,
				},
				() => load()
			)
			// New incoming trade request (someone asked you)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "tickle_trades",
					filter: `target_id=eq.${userId}`,
				},
				() => load()
			)
			// Your outgoing trade was fulfilled / cancelled (target side wrote)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "tickle_trades",
					filter: `requester_id=eq.${userId}`,
				},
				() => load()
			)
			// New friend request landed (you're the receiver)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "friendships",
					filter: `receiver_id=eq.${userId}`,
				},
				() => load()
			)
			// Your outgoing request was accepted (you're the requester,
			// status flipped pending → accepted)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "friendships",
					filter: `requester_id=eq.${userId}`,
				},
				() => load()
			)
			.subscribe();
		return () => {
			supabase.removeChannel(ch);
		};
	}, [userId, load]);

	// Report the actionable count (friend + trade requests) upward so
	// the hub can badge the Inbox segment.
	React.useEffect(() => {
		onActionableCount?.(friendReqs.length + incomingTrades.length);
	}, [friendReqs.length, incomingTrades.length, onActionableCount]);

	const doRpc = async (
		rpcName: string,
		args: Record<string, unknown>,
		id: string,
		ok: string
	) => {
		if (busy) return;
		setBusy(id);
		const r = await rpc<{
			ok?: boolean;
			reason?: string;
			cap?: number;
			balance?: number;
			needed?: number;
		}>(rpcName, args);
		setBusy(null);
		if (!r || r.ok === false) {
			// Surface specific reasons — they tell the user what to do
			// instead of a vague retry.
			if (r?.reason === "at_cap") {
				setFeedback(
					`You're at the ${r.cap ?? FRIEND_CAP_LIMIT}-friend cap. Remove someone first.`
				);
			} else if (r?.reason === "target_at_cap") {
				setFeedback("They're at the friend cap.");
			} else if (r?.reason === "insufficient_bank") {
				// Lost the race with regen / a different action. Refresh
				// balance so the UI catches up to whatever the actual
				// number is, and tell the user how short they were.
				const have = r.balance ?? 0;
				const need = r.needed ?? 0;
				setFeedback(
					`Not enough tickles — you have ${have}, they asked for ${need}.`
				);
				load();
			} else {
				setFeedback("That didn't take — try again.");
			}
			return;
		}
		setFeedback(ok);
		Haptics.notificationAsync(
			Haptics.NotificationFeedbackType.Success
		).catch(() => {});
		load();
	};

	const acceptFriend = (r: FriendReq) =>
		doRpc(
			"accept_friend_request",
			{ other_user_id: r.requester_id },
			r.requester_id,
			`${r.username ?? "Friend"} added.`
		);
	// Decline = remove the incoming pending row. Must use remove_friendship
	// (direction-agnostic), NOT cancel_friend_request — the decliner is the
	// receiver, so cancel_* matches zero rows and the request reappears.
	const declineFriend = (r: FriendReq) =>
		doRpc(
			"remove_friendship",
			{ other_user_id: r.requester_id },
			r.requester_id,
			"Request declined."
		);
	const giveTrade = (t: TradeRow) =>
		doRpc(
			"fulfill_tickle_trade",
			{ trade_id: t.id },
			t.id,
			`Gave ${t.amount} — ${t.partner_username ?? "they"} pocket ${t.amount * 2}.`
		);
	const passTrade = (t: TradeRow) =>
		doRpc("cancel_tickle_trade", { trade_id: t.id }, t.id, "Passed.");
	const withdrawTrade = (t: TradeRow) =>
		doRpc("cancel_tickle_trade", { trade_id: t.id }, t.id, "Lot withdrawn.");

	const actionableCount = friendReqs.length + incomingTrades.length;
	// What-happened feed: every row names WHO it happened with, carries its
	// timestamp, and renders newest-first. Pagination below (10 + Load more).
	const passive = [
		...answered.map((t) => ({
			id: `ans-${t.id}`,
			text: `${t.partner_username ?? "A friend"} answered your trade — +${t.amount * 2} tickles`,
			kind: "answered" as const,
			at: Date.parse(t.fulfilled_at ?? t.created_at),
		})),
		...gifted.map((t) => ({
			id: `gft-${t.id}`,
			text: `you gifted ${t.partner_username ?? "a friend"} ${t.amount * 2} tickles`,
			kind: "gifted" as const,
			at: Date.parse(t.fulfilled_at ?? t.created_at),
		})),
		...acceptedFriends.map((a) => ({
			id: `frd-${a.receiver_id}`,
			text: `${a.username ?? "A friend"} accepted your request`,
			kind: "friended" as const,
			at: Date.parse(a.updated_at),
		})),
		...blessings.map((b) => ({
			id: `bl-${b.id}`,
			text: `${b.from_username ?? "A friend"} blessed you — ${blessingDescription(b.kind)}`,
			kind: "blessed" as const,
			at: Date.parse(b.sent_at),
		})),
		...curses.map((c) => ({
			id: `cu-${c.id}`,
			text: `${c.from_username ?? "Someone"} cursed you — ${curseDescription(c.kind)}`,
			kind: "cursed" as const,
			at: Date.parse(c.sent_at),
		})),
	].sort((a, b) => (b.at || 0) - (a.at || 0));
	// "Up to 100 in the past" — start at shownCount (10), Load-more grows it,
	// capped at FEED_CAP. Display-only depth; no event is ever deleted.
	const FEED_CAP = 100;
	const passiveShown = passive.slice(0, shownCount);
	const hasMorePassive =
		passiveShown.length < Math.min(passive.length, FEED_CAP);

	if (loading) {
		return (
			<View style={styles.center}>
				<LoadingBeat label="checking the yard" />
			</View>
		);
	}

	const empty =
		actionableCount === 0 && outgoingTrades.length === 0 && passive.length === 0;

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

			{/* Receiver bless/curse status — what's active on you now. */}
			<ActiveEffects />

			{empty && (
				<EmptyState
					glyph="bell"
					title="The yard's quiet"
					sub="Trade or bless a friend and the news lands here."
				/>
			)}

			{/* Out to market — your pending outgoing trade requests */}
			{outgoingTrades.length > 0 && (
				<>
					<View style={styles.headerWrap}>
						<SectionHeader
							kicker="out to market"
							title="Your trades"
							ruleWidth={88}
						/>
					</View>
					{/* Flat paper sticker with dashed-divided rows so the
					    list reads as one card rather than loose lines
					    nudging against the screen edge. */}
					<Sticker
						color="paper"
						rotate={-0.3}
						radius={14}
						style={styles.flatList}
					>
						{outgoingTrades.map((t, i) => {
							const last = i === outgoingTrades.length - 1;
							return (
								<View
									key={t.id}
									style={[styles.marketRow, !last && styles.flatRowDivider]}
								>
									<Text style={styles.marketText} numberOfLines={1}>
										{t.partner_username ?? "—"}
										{t.partner_discriminator && (
											<Text style={styles.marketDisc}>
												{" "}
												#{t.partner_discriminator}
											</Text>
										)}{" "}
										· you'd pocket {t.amount * 2}
									</Text>
									<Pressable
										onPress={() => withdrawTrade(t)}
										disabled={busy === t.id}
										hitSlop={8}
									>
										<Text style={styles.withdraw}>
											{busy === t.id ? "…" : "withdraw"}
										</Text>
									</Pressable>
								</View>
							);
						})}
					</Sticker>
				</>
			)}

			{/* Actionable — friend + trade requests */}
			{actionableCount > 0 && (
				<>
					<View style={styles.headerWrap}>
						<SectionHeader
							kicker="needs you"
							title="Pen cards"
							ruleWidth={70}
						/>
					</View>
					{friendReqs.map((r) => (
						<View key={`fr-${r.requester_id}`} style={styles.card}>
							<Image
								source={require("../assets/images/emoji/friend-request.png")}
								style={styles.cardIcon}
							/>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Text style={styles.cardTitle} numberOfLines={1}>
									{r.username ?? "Someone"}
								</Text>
								<Text style={styles.cardSub}>wants to be friends</Text>
							</View>
							<Pressable
								onPress={() => acceptFriend(r)}
								disabled={busy === r.requester_id}
								style={styles.primaryBtn}
							>
								<Text style={styles.primaryBtnText}>
									{busy === r.requester_id ? "…" : "Accept"}
								</Text>
							</Pressable>
							<Pressable
								onPress={() => declineFriend(r)}
								disabled={busy === r.requester_id}
								hitSlop={6}
								style={styles.declineGhost}
							>
								<Text style={styles.declineGhostText}>✕</Text>
							</Pressable>
						</View>
					))}
					{incomingTrades.map((t) => {
						// Affordance: can we actually pay this trade right
						// now? Disable + relabel "Need N more" when the
						// balance is short, so the player isn't tapping a
						// button just to get a rejection toast back.
						const canAfford = balance !== null && balance >= t.amount;
						const shortBy =
							balance !== null && balance < t.amount
								? t.amount - balance
								: 0;
						return (
							<View key={`tr-${t.id}`} style={styles.pen}>
								<View style={styles.penHeader}>
									<Image
										source={require("../assets/images/emoji/pig.png")}
										style={styles.cardIcon}
									/>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.cardTitle} numberOfLines={1}>
											{t.partner_username ?? "A friend"}
											{t.partner_discriminator && (
												<Text style={styles.cardTitleDisc}>
													{" "}
													#{t.partner_discriminator}
												</Text>
											)}
										</Text>
										<Text style={styles.cardSub}>
											asks for {t.amount} tickles
											{balance !== null && (
												<Text
													style={
														canAfford
															? styles.balanceHint
															: styles.balanceHintShort
													}
												>
													{"  ·  you have "}
													{balance}
												</Text>
											)}
										</Text>
									</View>
								</View>
								<View style={styles.penActions}>
									<Pressable
										onPress={() => canAfford && giveTrade(t)}
										disabled={busy === t.id || !canAfford}
										style={[
											styles.penBtn,
											canAfford ? styles.penBtnPrimary : styles.penBtnLocked,
										]}
									>
										<Text
											style={
												canAfford
													? styles.penBtnPrimaryText
													: styles.penBtnLockedText
											}
										>
											{busy === t.id
												? "…"
												: canAfford
													? `Give ${t.amount}`
													: `Need ${shortBy} more`}
										</Text>
									</Pressable>
									<Pressable
										onPress={() => passTrade(t)}
										disabled={busy === t.id}
										style={[styles.penBtn, styles.penBtnGhost]}
									>
										<Text style={styles.penBtnGhostText}>Pass</Text>
									</Pressable>
								</View>
							</View>
						);
					})}
				</>
			)}

			{/* Recent — passive events */}
			{passive.length > 0 && (
				<>
					<View style={styles.headerWrap}>
						<SectionHeader
							kicker="recent"
							title="What happened"
							ruleWidth={96}
						/>
					</View>
					{/* Flat paper sticker with dashed-divided rows — the
					    What-happened list reads as one bordered card,
					    matching Out-to-market above. */}
					<Sticker
						color="paper"
						rotate={-0.3}
						radius={14}
						style={styles.flatList}
					>
						{passiveShown.map((p, i) => {
							// Last row only when nothing follows — keep the divider
							// when a Load-more footer sits below it.
							const last =
								i === passiveShown.length - 1 && !hasMorePassive;
							// Per-kind avatar bubble: small ink-outlined
							// circle with a glyph + tinted background.
							const bubbleStyle =
								p.kind === "answered"
									? styles.passiveBubbleAnswered
									: p.kind === "gifted"
										? styles.passiveBubbleGifted
										: p.kind === "friended"
											? styles.passiveBubbleFriended
											: p.kind === "blessed"
												? styles.passiveBubbleBlessed
												: styles.passiveBubbleCursed;
							const glyph =
								p.kind === "answered"
									? "♥"
									: p.kind === "gifted"
										? "★"
										: p.kind === "friended"
											? "+"
											: p.kind === "blessed"
												? "✦"
												: "☁";
							const glyphStyle =
								p.kind === "cursed"
									? styles.passiveBubbleGlyphInverted
									: styles.passiveBubbleGlyph;
							return (
								<View
									key={p.id}
									style={[
										styles.passiveRow,
										!last && styles.flatRowDivider,
									]}
								>
									<View style={[styles.passiveBubble, bubbleStyle]}>
										<Text style={glyphStyle}>{glyph}</Text>
									</View>
									<Text style={styles.passiveText}>{p.text}</Text>
									{!!relTime(p.at) && (
										<Text style={styles.passiveTime}>
											{relTime(p.at)}
										</Text>
									)}
								</View>
							);
						})}
						{hasMorePassive && (
							<Pressable
								style={styles.loadMoreRow}
								onPress={() =>
									setShownCount((n) => Math.min(n + 10, FEED_CAP))
								}
							>
								<Text style={styles.loadMoreText}>Load more</Text>
							</Pressable>
						)}
					</Sticker>

				</>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { paddingHorizontal: 14, paddingBottom: 110 },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		paddingVertical: 8,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 21,
		paddingVertical: 28,
	},
	// Wrap SectionHeaders so they get the same vertical breathing room
	// the old band labels did.
	headerWrap: {
		marginTop: 14,
		marginBottom: 4,
	},
	// Decline ghost — small ✕ button next to Accept on friend requests.
	declineGhost: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		alignItems: "center",
		justifyContent: "center",
	},
	declineGhostText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.mute,
	},
	// Wraps Out-to-market + Recent rows in a single flat sticker.
	// Padding 0 inside (rows manage their own horizontal padding) so
	// dividers run the full card width.
	flatList: { paddingVertical: 4, paddingHorizontal: 0 },
	// Dashed bottom divider used between rows in flatList. Suppressed
	// on the last row so the bottom border doesn't double up against
	// the sticker's own ink edge.
	// Right-aligned compact age on each What-happened row.
	passiveTime: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		marginLeft: 8,
	},
	// "Load more" footer row inside the What-happened sticker.
	loadMoreRow: {
		paddingVertical: 11,
		alignItems: "center",
	},
	loadMoreText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
	},
	flatRowDivider: {
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	// Out-to-market row — now a flat row inside the flatList Sticker
	// wrapper, so it drops its old standalone bg + border + margin
	// and just contributes horizontal padding to keep content off
	// the sticker's ink edge.
	marketRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 14,
		paddingVertical: 12,
		gap: 8,
	},
	marketText: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.ink, flex: 1 },
	withdraw: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	// actionable card (friend request)
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: WHIMSY.paper,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 6,
	},
	cardIcon: { width: 30, height: 30, resizeMode: "contain" },
	cardTitle: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	// Inline "you have N" hint after "asks for N tickles". Mute when
	// affordable, accent when short — pre-warns the player before
	// they even reach the disabled button.
	balanceHint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
	},
	balanceHintShort: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
	},
	cardSub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	primaryBtn: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 7,
	},
	primaryBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	declineText: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	// Trade pen card — peach paper sticker with Avatar+ask body and
	// stacked Give/Pass row beneath. Replaces the old Stockyard rail
	// look so the trade card sits inside the rest of the redesign's
	// paper-sticker DNA. Diagonal stripe overlay isn't worth the SVG
	// cost — flat peach + ink border captures the look.
	pen: {
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 8,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 3, height: 3 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 3,
	},
	penHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	penActions: {
		flexDirection: "row",
		gap: 8,
		marginTop: 10,
	},
	penBtn: {
		flex: 1,
		paddingVertical: 9,
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	penBtnPrimary: {
		backgroundColor: WHIMSY.lilacDeep,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	penBtnPrimaryText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.paper,
	},
	penBtnGhost: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.muteSoft,
	},
	penBtnGhostText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	// "Need N more" — the trade is unaffordable. Muted fill + dashed
	// ink border so the button reads as locked-but-still-meaningful,
	// not greyed-out-and-broken. Companion to the balance hint on the
	// row's "asks for N · you have M" line.
	// Cream fill + mute (not muteSoft) text/border so the locked button
	// clears contrast — the old muteSoft-on-paper text washed out. Still
	// disabled; reads as locked-but-legible, not greyed-out-and-broken.
	penBtnLocked: {
		backgroundColor: WHIMSY.cream,
		borderColor: WHIMSY.mute,
	},
	penBtnLockedText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	// Recent / passive row — lives inside the flatList Sticker so
	// horizontal padding mirrors the marketRow above. Bumped from 4
	// to 14 so the bubble doesn't kiss the sticker's ink border.
	passiveRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 10,
		paddingHorizontal: 14,
	},
	// Recent feed bubble — small ink-outlined circle with a glyph,
	// per kind: rose ♥ for answered, lilac ✦ for blessed, ink ☁ for
	// cursed. Replaces the PNG icon to match the design.
	passiveBubble: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	passiveBubbleAnswered: { backgroundColor: WHIMSY.rose },
	passiveBubbleGifted:   { backgroundColor: WHIMSY.sun },
	passiveBubbleFriended: { backgroundColor: WHIMSY.sage },
	passiveBubbleBlessed:  { backgroundColor: WHIMSY.lilac },
	passiveBubbleCursed:   { backgroundColor: WHIMSY.ink },
	passiveBubbleGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	passiveBubbleGlyphInverted: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.paper,
	},
	// Discriminator suffix on trade rows + outgoing market rows.
	marketDisc: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.mute,
	},
	cardTitleDisc: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
	},
	passiveText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
		flex: 1,
		lineHeight: 18,
	},
});
