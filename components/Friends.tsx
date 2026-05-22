import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	Pressable,
	ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { ensurePushPermission } from "../utils/pushNotifications";
import { Sticker } from "./ui/Sticker";
import { UserSheet } from "./UserSheet";
import { FONTS, WHIMSY, ROW_TILTS } from "@/constants/theme";

interface Profile {
	id: string;
	username: string | null;
	tickles_earned?: number;
	discriminator?: string | null;
}

// Friend requests live in the Friends-hub Inbox now — this panel is
// just your friend list + add. (Season-1 social redesign, Phase B.)
type Tab = "friends" | "add";

export default function Friends({ userId }: { userId: string }) {
	const [tab, setTab] = useState<Tab>("friends");
	const [friends, setFriends] = useState<Profile[]>([]);
	// Tapping a friend opens UserSheet — the one door for ask / bless
	// / curse (Season-1 social redesign, Phase C).
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
	}, [userId]);

	useFocusEffect(
		useCallback(() => {
			load();
			// First social surface touch — ask for push permission so
			// we can notify incoming requests + fulfills.
			// Idempotent + cheap on re-focus.
			ensurePushPermission();
		}, [load])
	);

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ friends</Text>
			<View style={styles.tabsRow}>
				<TabBtn label={`Friends · ${friends.length}`} active={tab === "friends"} onPress={() => setTab("friends")} />
				<TabBtn label="Add" active={tab === "add"} onPress={() => setTab("add")} />
			</View>

			{tab === "friends" && (
				<FriendsList friends={friends} onPick={setSelectedUserId} />
			)}

			{tab === "add" && <AddFriend userId={userId} onSent={load} />}

			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={load}
			/>
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
// Each row taps through to UserSheet — the one door for asking
// tickles / blessing / cursing. No inline action button.
function FriendsList({
	friends,
	onPick,
}: {
	friends: Profile[];
	onPick: (id: string) => void;
}) {
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
				<Pressable key={f.id} onPress={() => onPick(f.id)}>
					<Sticker
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
						<Text style={styles.rowChevron}>›</Text>
					</Sticker>
				</Pressable>
			))}
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
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	rowMeta: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	rowChevron: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.mute,
		paddingLeft: 8,
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
