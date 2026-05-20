import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	Pressable,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { ensurePushPermission } from "../utils/pushNotifications";
import { Sticker } from "./ui/Sticker";
import { FONTS, WHIMSY, ROW_TILTS } from "@/constants/theme";

interface Profile {
	id: string;
	username: string | null;
	tickles_earned?: number;
	discriminator?: string | null;
}

interface PendingIncoming {
	requester_id: string;
	requester: Profile | null;
}

interface PendingOutgoing {
	receiver_id: string;
	receiver: Profile | null;
}

type Tab = "friends" | "pending" | "add";

export default function Friends({ userId }: { userId: string }) {
	const [tab, setTab] = useState<Tab>("friends");
	const [friends, setFriends] = useState<Profile[]>([]);
	const [incoming, setIncoming] = useState<PendingIncoming[]>([]);
	const [outgoing, setOutgoing] = useState<PendingOutgoing[]>([]);
	const [busy, setBusy] = useState<string | null>(null); // user id being acted on

	const load = useCallback(async () => {
		// Friends — via friend_ids RPC (returns the accepted set)
		const { data: friendIds } = await supabase.rpc("friend_ids");
		const ids = (friendIds as string[] | null) ?? [];
		if (ids.length > 0) {
			const { data } = await supabase
				.from("profiles")
				.select("id, username, tickles_earned, discriminator")
				.in("id", ids);
			setFriends((data as Profile[]) ?? []);
		} else {
			setFriends([]);
		}

		// Incoming pending — others sent requests TO me
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
				.select("id, username, discriminator")
				.in("id", incIds);
			const byId = new Map(
				((profs ?? []) as Profile[]).map((p) => [p.id, p])
			);
			setIncoming(incIds.map((id) => ({ requester_id: id, requester: byId.get(id) ?? null })));
		} else {
			setIncoming([]);
		}

		// Outgoing pending — I sent requests TO others
		const { data: outRows } = await supabase
			.from("friendships")
			.select("receiver_id")
			.eq("requester_id", userId)
			.eq("status", "pending");
		const outIds = ((outRows ?? []) as { receiver_id: string }[]).map(
			(r) => r.receiver_id
		);
		if (outIds.length > 0) {
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username, discriminator")
				.in("id", outIds);
			const byId = new Map(
				((profs ?? []) as Profile[]).map((p) => [p.id, p])
			);
			setOutgoing(outIds.map((id) => ({ receiver_id: id, receiver: byId.get(id) ?? null })));
		} else {
			setOutgoing([]);
		}
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			load();
			// First social surface touch — ask for push permission so
			// we can notify incoming requests / fulfills / repays.
			// Idempotent + cheap on re-focus.
			ensurePushPermission();
		}, [load])
	);

	const accept = async (otherId: string) => {
		if (busy) return;
		setBusy(otherId);
		await supabase.rpc("accept_friend_request", { other_user_id: otherId });
		setBusy(null);
		load();
	};
	const cancel = async (otherId: string) => {
		if (busy) return;
		setBusy(otherId);
		await supabase.rpc("cancel_friend_request", { target_user_id: otherId });
		setBusy(null);
		load();
	};

	const pendingCount = incoming.length + outgoing.length;

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ friends</Text>
			<View style={styles.tabsRow}>
				<TabBtn label={`Friends · ${friends.length}`} active={tab === "friends"} onPress={() => setTab("friends")} />
				<TabBtn
					label={`Pending${pendingCount > 0 ? ` · ${pendingCount}` : ""}`}
					active={tab === "pending"}
					onPress={() => setTab("pending")}
				/>
				<TabBtn label="Add" active={tab === "add"} onPress={() => setTab("add")} />
			</View>

			{tab === "friends" && <FriendsList friends={friends} />}

			{tab === "pending" && (
				<PendingList
					incoming={incoming}
					outgoing={outgoing}
					busy={busy}
					onAccept={accept}
					onCancel={cancel}
				/>
			)}

			{tab === "add" && <AddFriend userId={userId} onSent={load} />}
		</View>
	);
}

// ── Tab button ────────────────────────────────────────────────────
function TabBtn({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.tabBtn, active && styles.tabBtnActive]}
		>
			<Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

// ── Friends list ──────────────────────────────────────────────────
function FriendsList({ friends }: { friends: Profile[] }) {
	const [requestingId, setRequestingId] = useState<string | null>(null);

	const requestTickles = (friend: Profile) => {
		// Inline numeric prompt — keep it stupid simple. Native Alert
		// covers iOS + Android, no extra modal needed.
		Alert.prompt(
			`Request tickles`,
			`How many to ask ${friend.username} for? (1-5)\n\nWhen they fulfill, you owe 2× back when you say thanks.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Ask",
					onPress: async (raw) => {
						const n = parseInt(raw ?? "", 10);
						if (Number.isNaN(n) || n < 1 || n > 5) {
							Alert.alert("Pick 1-5.");
							return;
						}
						setRequestingId(friend.id);
						const { data, error } = await supabase.rpc("request_tickles", {
							target_user_id: friend.id,
							amount: n,
						});
						setRequestingId(null);
						const r = data as { ok?: boolean; reason?: string } | null;
						if (error || !r?.ok) {
							const hrs = (r as { hours_remaining?: number } | null)?.hours_remaining;
							Alert.alert(
								"Couldn't request",
								r?.reason === "already_active"
									? "You already have a trade going with them."
									: r?.reason === "not_friends"
										? "Only friends can trade."
										: r?.reason === "cooldown"
											? `Wait ${hrs ?? 24}h to trade with them again.`
											: "Try again."
							);
							return;
						}
						Alert.alert("Sent!", `Asked ${friend.username} for ${n}.`);
					},
				},
			],
			"plain-text",
			"",
			"number-pad"
		);
	};

	if (friends.length === 0) {
		return (
			<Sticker color="paper" rotate={-0.5} radius={12} style={styles.empty}>
				<Text style={styles.emptyText}>
					No friends yet. Tap “Add” to send your first request.
				</Text>
			</Sticker>
		);
	}
	return (
		<View style={styles.list}>
			{friends.map((f, i) => (
				<Sticker
					key={f.id}
					color="paper"
					rotate={ROW_TILTS[i % ROW_TILTS.length]}
					radius={10}
					style={styles.row}
				>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text style={styles.rowName}>{f.username ?? "—"}</Text>
						{typeof f.tickles_earned === "number" && (
							<Text style={styles.rowMeta}>
								{f.tickles_earned.toLocaleString()} ♥
							</Text>
						)}
					</View>
					<Pressable
						onPress={() => requestTickles(f)}
						disabled={requestingId === f.id}
						style={({ pressed }) => [
							styles.actionBtn,
							styles.actionAccept,
							pressed && { opacity: 0.7 },
						]}
					>
						<Text style={styles.actionAcceptText}>
							{requestingId === f.id ? "…" : "Ask"}
						</Text>
					</Pressable>
				</Sticker>
			))}
		</View>
	);
}

// ── Pending list (incoming + outgoing) ─────────────────────────────
function PendingList({
	incoming,
	outgoing,
	busy,
	onAccept,
	onCancel,
}: {
	incoming: PendingIncoming[];
	outgoing: PendingOutgoing[];
	busy: string | null;
	onAccept: (id: string) => void;
	onCancel: (id: string) => void;
}) {
	if (incoming.length === 0 && outgoing.length === 0) {
		return (
			<Sticker color="paper" rotate={-0.5} radius={12} style={styles.empty}>
				<Text style={styles.emptyText}>
					No pending requests. Send one from the “Add” tab.
				</Text>
			</Sticker>
		);
	}
	return (
		<View style={styles.list}>
			{incoming.length > 0 && (
				<>
					<Text style={styles.subKicker}>incoming</Text>
					{incoming.map((p, i) => (
						<Sticker
							key={p.requester_id}
							color="rose"
							rotate={ROW_TILTS[i % ROW_TILTS.length]}
							radius={10}
							style={styles.row}
						>
							<Text style={styles.rowName}>
								{p.requester?.username ?? "—"}
							</Text>
							<Pressable
								onPress={() => onAccept(p.requester_id)}
								disabled={busy === p.requester_id}
								style={({ pressed }) => [
									styles.actionBtn,
									styles.actionAccept,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.actionAcceptText}>
									{busy === p.requester_id ? "…" : "Accept"}
								</Text>
							</Pressable>
						</Sticker>
					))}
				</>
			)}
			{outgoing.length > 0 && (
				<>
					<Text style={styles.subKicker}>outgoing</Text>
					{outgoing.map((p, i) => (
						<Sticker
							key={p.receiver_id}
							color="paper"
							rotate={ROW_TILTS[i % ROW_TILTS.length]}
							radius={10}
							style={styles.row}
						>
							<Text style={styles.rowName}>
								{p.receiver?.username ?? "—"}
							</Text>
							<Pressable
								onPress={() => onCancel(p.receiver_id)}
								disabled={busy === p.receiver_id}
								style={({ pressed }) => [
									styles.actionBtn,
									styles.actionCancel,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.actionCancelText}>
									{busy === p.receiver_id ? "…" : "Cancel"}
								</Text>
							</Pressable>
						</Sticker>
					))}
				</>
			)}
		</View>
	);
}

// ── Add friend with autocomplete ──────────────────────────────────
function AddFriend({ userId, onSent }: { userId: string; onSent: () => void }) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Profile[]>([]);
	const [searching, setSearching] = useState(false);
	const [sending, setSending] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Debounced search-as-you-type. 200ms is short enough to feel
	// live but long enough to avoid hammering the RPC on every keystroke.
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		const q = query.trim();
		if (q.length < 1) {
			setResults([]);
			setSearching(false);
			return;
		}
		setSearching(true);
		debounceRef.current = setTimeout(async () => {
			const { data } = await supabase.rpc("search_users", {
				prefix: q,
				max_results: 10,
			});
			setResults((data as Profile[] | null) ?? []);
			setSearching(false);
		}, 200);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const send = async (target: Profile) => {
		if (sending) return;
		setSending(target.id);
		setFeedback("");
		const { data, error } = await supabase.rpc("send_friend_request", {
			target_username: target.username,
			target_discriminator: target.discriminator ?? null,
		});
		setSending(null);
		const r = data as { ok?: boolean; reason?: string } | null;
		if (error || !r?.ok) {
			const reason = r?.reason;
			setFeedback(
				reason === "self"
					? "That's you."
					: reason === "not_found"
						? "User not found."
						: "Couldn't send. Try again."
			);
			return;
		}
		setFeedback(`Request sent to ${target.username}.`);
		setQuery("");
		setResults([]);
		onSent();
	};

	return (
		<View style={styles.addWrap}>
			<TextInput
				style={styles.input}
				value={query}
				onChangeText={setQuery}
				placeholder="Search by username…"
				placeholderTextColor={WHIMSY.mute}
				autoCapitalize="none"
				autoCorrect={false}
			/>
			{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
			{searching && (
				<View style={styles.searching}>
					<ActivityIndicator size="small" color={WHIMSY.mute} />
					<Text style={styles.searchingText}>searching…</Text>
				</View>
			)}
			{results.length > 0 && (
				<View style={styles.list}>
					{results.map((p, i) => (
						<Sticker
							key={p.id}
							color="paper"
							rotate={ROW_TILTS[i % ROW_TILTS.length]}
							radius={10}
							style={styles.row}
						>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Text style={styles.rowName}>{p.username}</Text>
								{!!p.discriminator && (
									<Text style={styles.discrim}>
										#{p.discriminator}
									</Text>
								)}
							</View>
							<Pressable
								onPress={() => send(p)}
								disabled={sending === p.id}
								style={({ pressed }) => [
									styles.actionBtn,
									styles.actionAccept,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.actionAcceptText}>
									{sending === p.id ? "…" : "Add"}
								</Text>
							</Pressable>
						</Sticker>
					))}
				</View>
			)}
			{!searching && query.length >= 1 && results.length === 0 && (
				<Text style={styles.emptyText}>
					No users found. Discriminators (#1234) are auto-assigned;
					ask your friend to share their code from their Account page.
				</Text>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	wrap: { marginTop: 16 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 1.6,
		marginBottom: 8,
		textTransform: "uppercase",
	},
	subKicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		marginTop: 8,
		marginBottom: 4,
		marginLeft: 4,
	},
	tabsRow: {
		flexDirection: "row",
		backgroundColor: WHIMSY.paper,
		borderRadius: 12,
		padding: 4,
		marginBottom: 12,
		gap: 4,
	},
	tabBtn: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 6,
		borderRadius: 9,
		alignItems: "center",
	},
	tabBtnActive: {
		backgroundColor: WHIMSY.lilac,
	},
	tabBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.mute,
		letterSpacing: 0.4,
	},
	tabBtnTextActive: { color: WHIMSY.ink },
	list: { gap: 8 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 10,
		gap: 10,
	},
	rowName: {
		flex: 1,
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	rowMeta: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	discrim: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	actionBtn: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 10,
		borderWidth: 1.5,
	},
	actionAccept: {
		backgroundColor: WHIMSY.lilac,
		borderColor: WHIMSY.ink,
	},
	actionAcceptText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	actionCancel: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.mute,
	},
	actionCancelText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	empty: {
		paddingHorizontal: 16,
		paddingVertical: 16,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 19,
	},
	addWrap: { gap: 10 },
	input: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		color: WHIMSY.ink,
	},
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		paddingHorizontal: 4,
	},
	searching: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 4,
	},
	searchingText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
	},
});
