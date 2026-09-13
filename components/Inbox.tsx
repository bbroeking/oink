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
//
// Wave-3 conformance pass (2026-09-11): every band row is a `ListRow`, every
// event mark is a shared drawing inside an `Avatar` (the six kinds each carry their own
// fill, so no two events read alike) [B-07], and every control is a `Button`
// with a role, a label and a hint [B-04, B-12].
import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { rpc, type RpcName } from "@/utils/rpc";
import { usePostgresChanges } from "@/hooks/usePostgresChanges";
import { ActiveEffects } from "./ActiveEffects";
import { GameIcon } from "./ui/GameIcon";
import {
	AVATAR_SIZE,
	PAGE_PAD,
	SPACE,
	TAB_SAFE,
} from "@/constants/theme";
import type { TradeRow } from "@/constants/trade_types";
import {
	Avatar,
	Button,
	CardTitle,
	EmptyState,
	IconButton,
	Label,
	ListRow,
	LoadingBeat,
	SectionHeader,
	Sticker,
	T,
	type AvatarFill,
	type GlyphName,
} from "@/components/ui";
import { FRIEND_CAP_LIMIT } from "@/utils/friendships";
import { fetchUsernamesById } from "@/utils/profiles";
import type { TickleInfo } from "@/utils/tickles";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
	type RitualMeta,
	type RitualMode,
} from "../utils/rituals";
import { DigPostcardInbox } from "./DigPostcardInbox";
import {
	fetchSounderMessages,
	type SounderMessageRow,
} from "@/utils/sounderMessages";

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

type PassiveKind =
	| "answered"
	| "gifted"
	| "friended"
	| "blessed"
	| "cursed"
	| "sounder";

type PassiveEvent = {
	id: string;
	text: string;
	kind: PassiveKind;
	at: number;
};

// The feed's mark vocabulary: ONE drawing per event kind — a hand-drawn mark
// in an `Avatar` frame — and a fill nobody else wears, so two kinds are never
// told apart by their glyph alone (the Gestalt-similarity failure the audit
// found when `gifted` and `sounder` were both sun). [B-07] (2026-09-11)
const KIND_MARK: Record<
	PassiveKind,
	{ glyph?: GlyphName; gameIcon?: RitualMode; fill: AvatarFill; word: string }
> = {
	answered: { glyph: "heart", fill: "rose", word: "trade answered" },
	gifted: { glyph: "gift", fill: "sun", word: "gift given" },
	friended: { glyph: "handshake", fill: "sage", word: "new friend" },
	blessed: { gameIcon: "bless", fill: "lilac", word: "blessing" },
	cursed: { gameIcon: "curse", fill: "curseSurface", word: "curse" },
	sounder: { glyph: "crown", fill: "sky", word: "Sounder oink" },
};

// Inbox copy mirrors what the SENDER saw when they cast the effect
// (RitualPicker reads ritual.blurb from these same meta tables) +
// what the RECEIVER sees on the ActiveEffects strip + Hoofprints
// sheet + WhileAway modal. Previously the Inbox had its own
// flavor-only label map that drifted — the recipient was getting
// vague poetry while every other surface showed the actual rule
// the effect was applying. Source of truth: utils/rituals.ts.
function blessingDescription(kind: string): string {
	// Raw server string → the lookup can miss; annotate so the fallback below
	// is type-visible instead of looking like dead code.
	const m: RitualMeta | undefined = BLESSING_META[kind as BlessingKind];
	return m ? `${m.name} — ${m.blurb}` : kind;
}
function curseDescription(kind: string): string {
	const m: RitualMeta | undefined = CURSE_META[kind as CurseKind];
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
	const [sounderMessages, setSounderMessages] = useState<SounderMessageRow[]>([]);
	// Caller's tickle balance — drives "Give N" → "Need N more" on
	// incoming trade cards when they can't afford to fulfill. Polled
	// on every load(), so post-action refreshes catch the deduction.
	const [balance, setBalance] = useState<number | null>(null);
	// What-happened pagination: newest 10, then "Load more" pages by 10.
	const [shownCount, setShownCount] = useState(10);
	const [hasPostcards, setHasPostcards] = useState(false);

	const load = useCallback(async () => {
		// Trades — one RPC covers incoming / outgoing / answered.
		const trades = (await rpc<TradeRow[]>("my_tickle_trades")) ?? [];
		setIncomingTrades(trades.filter((t) => t.status === "pending" && t.target_id === userId));
		setOutgoingTrades(trades.filter((t) => t.status === "pending" && t.requester_id === userId));
		setAnswered(trades.filter((t) => t.status === "fulfilled" && t.requester_id === userId));
		setGifted(trades.filter((t) => t.status === "fulfilled" && t.target_id === userId));
		setSounderMessages(await fetchSounderMessages(100));

		// Incoming friend requests.
		const { data: incRows } = await supabase
			.from("friendships")
			.select("requester_id")
			.eq("receiver_id", userId)
			.eq("status", "pending");
		const incIds = (incRows ?? []).map((r) => r.requester_id);
		if (incIds.length > 0) {
			const byId = await fetchUsernamesById(incIds);
			setFriendReqs(
				incIds.map((id) => ({
					requester_id: id,
					username: byId.get(id) ?? null
				}))
			);
		} else {
			setFriendReqs([]);
		}

		// Blessings / curses received — recent, for the passive band.
		const hydrate = async (table: "blessings" | "curses"): Promise<RitualRow[]> => {
			const { data } = await supabase
				.from(table)
				.select("id, kind, sent_at, sender_id")
				.eq("receiver_id", userId)
				.order("sent_at", { ascending: false })
				// Pull up to 100 so the What-happened feed's "load more up to
				// 100" has enough history (was 40 — capped what could be paged).
				.limit(100);
			const rows = data ?? [];
			if (rows.length === 0) return [];
			const byId = await fetchUsernamesById(rows.map((r) => r.sender_id));
			return rows.map((r) => ({
				id: r.id,
				kind: r.kind,
				sent_at: r.sent_at,
				from_username: byId.get(r.sender_id) ?? null
			}));
		};
		setBlessings(await hydrate("blessings"));
		setCurses(await hydrate("curses"));

		// Tickle balance — for the Give-vs-Need affordance on
		// incoming trade cards. tickle_info returns the
		// regen-catchup balance, which is what the player can
		// actually spend right now.
		const t = await rpc<TickleInfo>("tickle_info", { uid: userId });
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
		const accList = accRows ?? [];
		if (accList.length === 0) {
			setAcceptedFriends([]);
		} else {
			const accById = await fetchUsernamesById(
				accList.map((r) => r.receiver_id)
			);
			setAcceptedFriends(
				accList.map((r) => ({
					receiver_id: r.receiver_id,
					username: accById.get(r.receiver_id) ?? null,
					updated_at: r.updated_at
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
	// per table and let either fire load(). uid is the userId prop
	// (already resolved) — a falsy prop skips the subscribe. Lifecycle
	// owned by usePostgresChanges.
	usePostgresChanges({
		topic: "inbox",
		uid: userId,
		specs: (uid) => [
			// Incoming blessings → "blessed you" passive row
			{
				event: "INSERT",
				table: "blessings",
				filter: `receiver_id=eq.${uid}`,
				callback: () => load()
			},
			// Incoming curses → "cursed you" passive row + hoofprints panel
			{
				event: "INSERT",
				table: "curses",
				filter: `receiver_id=eq.${uid}`,
				callback: () => load()
			},
			// New incoming trade request (someone asked you)
			{
				event: "INSERT",
				table: "tickle_trades",
				filter: `target_id=eq.${uid}`,
				callback: () => load()
			},
			// Your outgoing trade was fulfilled / cancelled (target side wrote)
			{
				event: "UPDATE",
				table: "tickle_trades",
				filter: `requester_id=eq.${uid}`,
				callback: () => load()
			},
			// New friend request landed (you're the receiver)
			{
				event: "INSERT",
				table: "friendships",
				filter: `receiver_id=eq.${uid}`,
				callback: () => load()
			},
			// Your outgoing request was accepted (you're the requester,
			// status flipped pending → accepted)
			{
				event: "UPDATE",
				table: "friendships",
				filter: `requester_id=eq.${uid}`,
				callback: () => load()
			}
		],
		deps: [userId, load]
	});

	// Report the actionable count (friend + trade requests) upward so
	// the hub can badge the Inbox segment.
	React.useEffect(() => {
		onActionableCount?.(friendReqs.length + incomingTrades.length);
	}, [friendReqs.length, incomingTrades.length, onActionableCount]);

	const doRpc = async (rpcName: RpcName, args: Record<string, unknown>, id: string, ok: string) => {
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
				setFeedback(`You're at the ${r.cap ?? FRIEND_CAP_LIMIT}-friend cap. Remove someone first.`);
			} else if (r?.reason === "target_at_cap") {
				setFeedback("They're at the friend cap.");
			} else if (r?.reason === "insufficient_bank") {
				// Lost the race with regen / a different action. Refresh
				// balance so the UI catches up to whatever the actual
				// number is, and tell the user how short they were.
				const have = r.balance ?? 0;
				const need = r.needed ?? 0;
				setFeedback(`Not enough tickles — you have ${have}, they asked for ${need}.`);
				load();
			} else {
				setFeedback("That didn't take — try again.");
			}
			return;
		}
		setFeedback(ok);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
	const passive = useMemo<PassiveEvent[]>(
		() =>
			[
		...answered.map((t) => ({
			id: `ans-${t.id}`,
			text: `${t.partner_username ?? "A friend"} answered your trade — +${t.amount * 2} tickles`,
			kind: "answered" as const,
					at: Date.parse(t.fulfilled_at ?? t.created_at)
		})),
		...gifted.map((t) => ({
			id: `gft-${t.id}`,
			text: `you gifted ${t.partner_username ?? "a friend"} ${t.amount * 2} tickles`,
			kind: "gifted" as const,
					at: Date.parse(t.fulfilled_at ?? t.created_at)
		})),
		...acceptedFriends.map((a) => ({
			id: `frd-${a.receiver_id}`,
			text: `${a.username ?? "A friend"} accepted your request`,
			kind: "friended" as const,
					at: Date.parse(a.updated_at)
		})),
		...blessings.map((b) => ({
			id: `bl-${b.id}`,
			text: `${b.from_username ?? "A friend"} blessed you — ${blessingDescription(b.kind)}`,
			kind: "blessed" as const,
					at: Date.parse(b.sent_at)
		})),
		...curses.map((c) => ({
			id: `cu-${c.id}`,
			text: `${c.from_username ?? "Someone"} cursed you — ${curseDescription(c.kind)}`,
			kind: "cursed" as const,
					at: Date.parse(c.sent_at)
				})),
		...sounderMessages.map((message) => ({
			id: `sounder-${message.id}`,
			text: `${message.sender_username ?? "A crewmate"} Oinked ${message.crew_name} — ${message.body}`,
			kind: "sounder" as const,
			at: Date.parse(message.created_at),
		}))
			].sort((a, b) => (b.at || 0) - (a.at || 0)),
		[answered, gifted, acceptedFriends, blessings, curses, sounderMessages]
	);
	// "Up to 100 in the past" — start at shownCount (10), Load-more grows it,
	// capped at FEED_CAP. Display-only depth; no event is ever deleted.
	const FEED_CAP = 100;
	const passiveShown = passive.slice(0, shownCount);
	const hasMorePassive = passiveShown.length < Math.min(passive.length, FEED_CAP);

	if (loading) {
		return (
			<View style={styles.center}>
				<LoadingBeat label="checking the yard" />
			</View>
		);
	}

	const empty =
		actionableCount === 0 &&
		outgoingTrades.length === 0 &&
		passive.length === 0 &&
		!hasPostcards;

	return (
		<FlatList
			style={styles.scroll}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			data={passiveShown}
			keyExtractor={(event) => event.id}
			initialNumToRender={10}
			maxToRenderPerBatch={8}
			windowSize={7}
			removeClippedSubviews
			ListHeaderComponent={
				<>
					{!!feedback && (
						<T role="kicker" tone="accent" align="center" style={styles.feedback}>
							{feedback}
						</T>
					)}

					{/* Receiver bless/curse status — what's active on you now. */}
					<ActiveEffects />
					<DigPostcardInbox userId={userId} onPresence={setHasPostcards} />

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
							<SectionHeader
								kicker="out to market"
								title="Your trades"
								style={styles.bandHeader}
							/>
							{outgoingTrades.map((t, i) => (
								<ListRow
									key={t.id}
									index={i}
									title={
										<T role="kicker" numberOfLines={1}>
											{t.partner_username ?? "—"}
											{t.partner_discriminator ? (
												<Label tone="secondary"> #{t.partner_discriminator}</Label>
											) : null}
											{` · you'd pocket ${t.amount * 2}`}
										</T>
									}
									accessibilityLabel={`Your trade with ${t.partner_username ?? "a friend"} — you'd pocket ${t.amount * 2} tickles`}
									trailing={
										<Button
											variant="handLink"
											size="xs"
											onPress={() => withdrawTrade(t)}
											loading={busy === t.id}
											accessibilityLabel={`Withdraw your trade with ${t.partner_username ?? "a friend"}`}
											accessibilityHint="Takes the lot off the market; nothing is spent"
										>
											withdraw
										</Button>
									}
								/>
							))}
						</>
					)}

					{/* Actionable — friend + trade requests */}
					{actionableCount > 0 && (
						<>
							<SectionHeader
								kicker="needs you"
								title="Pen cards"
								style={styles.bandHeader}
							/>
							{friendReqs.map((r, i) => {
								const who = r.username ?? "Someone";
								return (
									<ListRow
										key={`fr-${r.requester_id}`}
										index={i}
										leading={
											<Avatar
												size={AVATAR_SIZE[0]}
												fill="sage"
												glyph="handshake"
												label="Friend request"
											/>
										}
										title={who}
										sub="wants to be friends"
										accessibilityLabel={`${who} wants to be friends`}
										trailing={
											<View style={styles.rowActions}>
												<Button
													variant="lilac"
													size="xs"
													onPress={() => acceptFriend(r)}
													loading={busy === r.requester_id}
													accessibilityLabel={`Accept ${who}'s friend request`}
													accessibilityHint="Adds them to your friends list"
												>
													Accept
												</Button>
												<IconButton
													name="x"
													variant="none"
													iconSize={SPACE.card}
													label={`Decline ${who}'s friend request`}
													accessibilityHint="Removes the request; they aren't told"
													disabled={busy === r.requester_id}
													onPress={() => declineFriend(r)}
												/>
											</View>
										}
									/>
								);
							})}
							{incomingTrades.map((t) => {
								// Affordance: can we actually pay this trade right
								// now? Disable + relabel "Need N more" when the
								// balance is short, so the player isn't tapping a
								// button just to get a rejection toast back.
								const canAfford = balance !== null && balance >= t.amount;
								const shortBy = balance !== null && balance < t.amount ? t.amount - balance : 0;
								const who = t.partner_username ?? "A friend";
								return (
									<Sticker key={`tr-${t.id}`} color="peach" style={styles.pen}>
										<View style={styles.penHeader}>
											<Avatar
												size={AVATAR_SIZE[0]}
												fill="cream"
												glyph="pigface"
												label="Tickle trade"
											/>
											<View style={styles.penBody}>
												<CardTitle numberOfLines={1}>
													{who}
													{t.partner_discriminator ? (
														<Label tone="secondary"> #{t.partner_discriminator}</Label>
													) : null}
												</CardTitle>
												<T role="hand" tone="secondary">
													asks for {t.amount} tickles
													{balance !== null && (
														<T role="hand" tone={canAfford ? "secondary" : "primary"}>
															{"  ·  you have "}
															{balance}
														</T>
													)}
												</T>
											</View>
										</View>
										<View style={styles.penActions}>
											<Button
												variant="purple"
												size="sm"
												style={styles.penBtn}
												onPress={() => giveTrade(t)}
												disabled={!canAfford}
												loading={busy === t.id}
												accessibilityLabel={
													canAfford
														? `Give ${t.amount} tickles to ${who}`
														: `Need ${shortBy} more tickles to answer ${who}`
												}
												accessibilityHint={
													canAfford
														? `Spends ${t.amount} of your tickles; they pocket ${t.amount * 2}.`
														: "Earn more tickles and come back to this pen card."
												}
											>
												{canAfford ? `Give ${t.amount}` : `Need ${shortBy} more`}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												style={styles.penBtn}
												onPress={() => passTrade(t)}
												disabled={busy === t.id}
												accessibilityLabel={`Pass on ${who}'s ask`}
												accessibilityHint="Closes the pen card; nothing is spent and they aren't told"
											>
												Pass
											</Button>
										</View>
									</Sticker>
								);
							})}
						</>
					)}

					{/* Recent — passive events */}
					{passive.length > 0 && (
						<SectionHeader
							kicker="recent"
							title="What happened"
							style={styles.bandHeader}
						/>
					)}
				</>
			}
			renderItem={({ item: event, index }) => {
				const mark = KIND_MARK[event.kind];
				const age = relTime(event.at);
				return (
					<ListRow
						index={index}
						leading={
							<Avatar
								size={AVATAR_SIZE[0]}
								fill={mark.fill}
								glyph={mark.glyph}
								label={mark.word}
							>
								{mark.gameIcon ? <GameIcon name={mark.gameIcon} size={20} /> : null}
							</Avatar>
						}
						title={<T role="kicker">{event.text}</T>}
						accessibilityLabel={age ? `${event.text}, ${age} ago` : event.text}
						trailing={
							age ? (
								<T role="kickerPillSm" tone="secondary">
									{age}
								</T>
							) : undefined
						}
					/>
				);
			}}
			ListFooterComponent={
				hasMorePassive ? (
					<View style={styles.loadMore}>
						<Button
							variant="ghost"
							size="sm"
							onPress={() => setShownCount((n) => Math.min(n + 10, FEED_CAP))}
							accessibilityLabel="Load more of what happened"
							accessibilityHint="Shows ten older events"
						>
							Load more
						</Button>
					</View>
				) : null
			}
		/>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	// PAGE_PAD, same as the hub header and the Friends segment — the band used
	// to sit 4pt wider than its own header, which jogged on a segment switch.
	// [B-14] (2026-09-11)
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: TAB_SAFE,
		gap: SPACE.sm,
	},
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	feedback: { paddingVertical: SPACE.sm },
	// Band crowns get the same breathing room the old hand-rolled labels did.
	bandHeader: { marginTop: SPACE.sm, marginBottom: 0 },
	rowActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
	},
	// Trade pen card — peach paper sticker with Avatar+ask body and stacked
	// Give/Pass row beneath, and the segment's ONE full sticker shadow (the
	// loudest thing on screen is the thing to do).
	pen: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
	},
	penHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	penBody: { flex: 1, minWidth: 0 },
	penActions: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	penBtn: { flex: 1 },
	loadMore: { alignItems: "center", marginTop: SPACE.sm },
});
