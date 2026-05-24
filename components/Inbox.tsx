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
	ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { ActiveEffects } from "./ActiveEffects";
import { FONTS, WHIMSY } from "@/constants/theme";
import type { TradeRow } from "@/constants/trade_types";
import { SectionHeader } from "./ui/SectionHeader";

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

const BLESSING_LABEL: Record<string, string> = {
	warm_tea: "warm tea — faster tickles",
	sun_beam: "a sun beam — luckier next pig",
	halo_kiss: "a halo kiss — a soft glow",
	bountiful_snouts: "bountiful snouts — +5",
};
const CURSE_LABEL: Record<string, string> = {
	sluggish_snout: "a sluggish snout — slower tickles",
	phantom_itch: "a phantom itch",
	goblin_whisper: "a goblin whisper",
	coin_pinch: "a coin pinch — snouts nicked",
};

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
	const [blessings, setBlessings] = useState<RitualRow[]>([]);
	const [curses, setCurses] = useState<RitualRow[]>([]);

	const load = useCallback(async () => {
		// Trades — one RPC covers incoming / outgoing / answered.
		const { data: tradeData } = await supabase.rpc("my_tickle_trades");
		const trades = (tradeData as TradeRow[] | null) ?? [];
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
				.limit(8);
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

		setLoading(false);
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// Report the actionable count (friend + trade requests) upward so
	// the hub can badge the Inbox segment.
	React.useEffect(() => {
		onActionableCount?.(friendReqs.length + incomingTrades.length);
	}, [friendReqs.length, incomingTrades.length, onActionableCount]);

	const doRpc = async (
		rpc: string,
		args: object,
		id: string,
		ok: string
	) => {
		if (busy) return;
		setBusy(id);
		const { data, error } = await supabase.rpc(rpc, args);
		setBusy(null);
		const r = data as { ok?: boolean; reason?: string } | null;
		if (error || (r && r.ok === false)) {
			setFeedback("That didn't take — try again.");
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
	const declineFriend = (r: FriendReq) =>
		doRpc(
			"cancel_friend_request",
			{ target_user_id: r.requester_id },
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
	const passive = [
		...answered.map((t) => ({
			id: `ans-${t.id}`,
			text: `your trade was answered — +${t.amount * 2} tickles`,
			kind: "answered" as const,
		})),
		...blessings.map((b) => ({
			id: `bl-${b.id}`,
			text: `${b.from_username ?? "A friend"} blessed you — ${BLESSING_LABEL[b.kind] ?? b.kind}`,
			kind: "blessed" as const,
		})),
		...curses.map((c) => ({
			id: `cu-${c.id}`,
			text: `${c.from_username ?? "Someone"} cursed you — ${CURSE_LABEL[c.kind] ?? c.kind}`,
			kind: "cursed" as const,
		})),
	];

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={WHIMSY.ink} />
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
				<Text style={styles.emptyText}>
					The yard's quiet — no requests, no news. Trade or bless a
					friend and the activity lands here.
				</Text>
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
					{outgoingTrades.map((t) => (
						<View key={t.id} style={styles.marketRow}>
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
					))}
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
					{incomingTrades.map((t) => (
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
									</Text>
								</View>
							</View>
							<View style={styles.penActions}>
								<Pressable
									onPress={() => giveTrade(t)}
									disabled={busy === t.id}
									style={[styles.penBtn, styles.penBtnPrimary]}
								>
									<Text style={styles.penBtnPrimaryText}>
										{busy === t.id ? "…" : `Give ${t.amount}`}
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
					))}
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
					{passive.map((p) => {
						// Per-kind avatar bubble: small ink-outlined circle
						// with a glyph + tinted background. Replaces the
						// PNG icon row to match the design's recent-feed
						// treatment.
						const bubbleStyle =
							p.kind === "answered"
								? styles.passiveBubbleAnswered
								: p.kind === "blessed"
									? styles.passiveBubbleBlessed
									: styles.passiveBubbleCursed;
						const glyph =
							p.kind === "answered" ? "♥" : p.kind === "blessed" ? "✦" : "☁";
						const glyphStyle =
							p.kind === "cursed"
								? styles.passiveBubbleGlyphInverted
								: styles.passiveBubbleGlyph;
						return (
							<View key={p.id} style={styles.passiveRow}>
								<View style={[styles.passiveBubble, bubbleStyle]}>
									<Text style={glyphStyle}>{glyph}</Text>
								</View>
								<Text style={styles.passiveText}>{p.text}</Text>
							</View>
						);
					})}
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
	// out-to-market strip
	marketRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: WHIMSY.paper,
		borderRadius: 9,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginBottom: 5,
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
	// passive row
	passiveRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 9,
		paddingVertical: 7,
		paddingHorizontal: 4,
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
	passiveBubbleBlessed: { backgroundColor: WHIMSY.lilac },
	passiveBubbleCursed: { backgroundColor: WHIMSY.ink },
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
