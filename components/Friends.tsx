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
import { FONTS, KICKER_PILL, WHIMSY } from "@/constants/theme";
import { AlignmentBadge } from "./ui/AlignmentBadge";

// Hard cap on the friends list — must match the server-side cap
// enforced in send_friend_request + accept_friend_request (see
// supabase/migrations/20260541000000_friend_cap.sql). Past ~100
// the list slows and the bless/curse cooldowns lose signal.
export const FRIEND_CAP_LIMIT = 100;

interface Profile {
	id: string;
	username: string | null;
	tickles_earned?: number;
	discriminator?: string | null;
	alignment_score?: number | null;
}

// Friend requests live in the Friends-hub Inbox now — this panel is
// just your friend list + add.
type Tab = "friends" | "add";

export default function Friends({ userId }: { userId: string }) {
	const [tab, setTab] = useState<Tab>("friends");
	const [friends, setFriends] = useState<Profile[]>([]);
	// Tapping a friend opens UserSheet — the one door for ask / bless
	// / curse.
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const load = useCallback(async () => {
		// Friends — via friend_ids RPC (returns the accepted set).
		// The server enforces a 100-friend cap (see the friend_cap
		// migration), so this should never return more than 100. The
		// client-side cap below is defense-in-depth in case the
		// migration hasn't been pushed yet — slicing here means we
		// never blow up the list view, and the FRIEND_CAP_LIMIT
		// constant stays the single source of truth in the UI.
		const { data: friendIds } = await supabase.rpc("friend_ids");
		const ids = (friendIds as string[] | null) ?? [];
		const capped = ids.slice(0, FRIEND_CAP_LIMIT);
		if (capped.length > 0) {
			const { data } = await supabase
				.from("profiles")
				.select("id, username, tickles_earned, discriminator, alignment_score")
				.in("id", capped);
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
// Avatar circle palette — picks a deterministic tint per name so the
// list reads as a colorful sounder rather than a wall of cream.
const AVATAR_TINTS = [
	WHIMSY.rose,
	WHIMSY.sun,
	WHIMSY.sky,
	WHIMSY.sage,
	WHIMSY.lilac,
	WHIMSY.peach,
] as const;
function tintFor(name: string | null | undefined): string {
	if (!name) return WHIMSY.cream;
	let h = 0;
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
	return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

function InitialAvatar({ name }: { name: string | null | undefined }) {
	const initial = (name ?? "?")[0]?.toUpperCase() ?? "?";
	return (
		<View style={[styles.avatarCircle, { backgroundColor: tintFor(name) }]}>
			<Text style={styles.avatarInitial}>{initial}</Text>
		</View>
	);
}

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
	// Sort alphabetically so the list reads predictably.
	const sorted = [...friends].sort((a, b) =>
		(a.username ?? "").localeCompare(b.username ?? "")
	);
	const atCap = sorted.length >= FRIEND_CAP_LIMIT;
	return (
	  <>
		<Sticker color="paper" rotate={-0.4} radius={14} style={styles.listSticker}>
			{sorted.map((f, i) => {
				const last = i === sorted.length - 1;
				return (
					<Pressable
						key={f.id}
						onPress={() => onPick(f.id)}
						style={[styles.flatRow, !last && styles.flatRowDivider]}
					>
						<InitialAvatar name={f.username} />
						<View style={{ flex: 1, minWidth: 0 }}>
							<View style={styles.rowNameLine}>
								<Text style={styles.rowName} numberOfLines={1}>
									{f.username ?? "—"}
								</Text>
								{!!f.discriminator && (
									<Text style={styles.rowDisc}>#{f.discriminator}</Text>
								)}
							</View>
							<View style={styles.rowMetaLine}>
								<Text style={styles.rowHeart}>♥</Text>
								<Text style={styles.rowMeta}>
									{(f.tickles_earned ?? 0).toLocaleString()}
								</Text>
								{typeof f.alignment_score === "number" && (
									<>
										<View style={styles.rowMetaDot} />
										<AlignmentBadge
											score={f.alignment_score}
											size="sm"
											compact
										/>
									</>
								)}
							</View>
						</View>
						<Text style={styles.rowChevron}>›</Text>
					</Pressable>
				);
			})}
		</Sticker>
		{/* At-cap notice — surfaces the 100-friend ceiling once it's
		    actually reached. Doesn't render in the (overwhelmingly
		    common) under-cap case, so it never clutters the list. */}
		{atCap && (
			<Text style={styles.atCapFooter}>
				★ you're at the {FRIEND_CAP_LIMIT}-friend cap · remove someone
				to add new friends
			</Text>
		)}
	  </>
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
		const r = data as { ok?: boolean; reason?: string; cap?: number } | null;
		if (error || !r?.ok) {
			const reason = r?.reason;
			setFeedback(
				reason === "self"
					? "That's you."
					: reason === "not_found"
						? "User not found."
						: reason === "at_cap"
							? `You're at the ${r?.cap ?? FRIEND_CAP_LIMIT}-friend cap. Remove someone to add new friends.`
							: reason === "target_at_cap"
								? `${target.username} is at the friend cap.`
								: reason === "already_friends"
									? `You and ${target.username} are already friends.`
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
			{/* Search input with magnifier prefix in a cream container —
			    matches the design's search-as-paper-form look. */}
			<Sticker color="paper" rotate={0} radius={14} style={styles.searchCard}>
				<Text style={styles.kickerSmall}>FIND A FRIEND</Text>
				<View style={styles.searchInputRow}>
					<Text style={styles.searchGlyph}>🔍</Text>
					<TextInput
						style={styles.inputFlat}
						value={query}
						onChangeText={setQuery}
						placeholder="username#1234"
						placeholderTextColor={WHIMSY.mute}
						autoCapitalize="none"
						autoCorrect={false}
					/>
				</View>
			</Sticker>

			{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
			{searching && (
				<View style={styles.searching}>
					<ActivityIndicator size="small" color={WHIMSY.mute} />
					<Text style={styles.searchingText}>searching…</Text>
				</View>
			)}

			{/* Real search results, when the user has typed. */}
			{results.length > 0 && (
				<Sticker color="paper" rotate={-0.3} radius={14} style={styles.listSticker}>
					{results.map((p, i) => {
						const last = i === results.length - 1;
						return (
							<View
								key={p.id}
								style={[styles.flatRow, !last && styles.flatRowDivider]}
							>
								<InitialAvatar name={p.username} />
								<View style={{ flex: 1, minWidth: 0 }}>
									<Text style={styles.rowName} numberOfLines={1}>
										{p.username}
									</Text>
									{!!p.discriminator && (
										<Text style={styles.rowDisc}>
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
							</View>
						);
					})}
				</Sticker>
			)}

			{!searching && query.length >= 1 && results.length === 0 && (
				<Text style={styles.emptyText}>
					No users found. Discriminators (#1234) are auto-assigned;
					ask your friend to share their code from their Account page.
				</Text>
			)}

			{/* Referral footer — share-your-code call to action lives at
			    the bottom of the Add panel per the design. The actual
			    code lives on the Sounder/Account card; this is just a
			    nudge. */}
			{query.length === 0 && (
				<Text style={styles.referralFooter}>
					★ share your code from{" "}
					<Text style={styles.referralFooterBold}>Account</Text>
					{" "}for +100 snouts
				</Text>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	wrap: { marginTop: 16 },
	kicker: { ...KICKER_PILL, marginBottom: 8 },
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
	// Friends list — single flat sticker holding rows separated by
	// dashed bottom borders. From the redesign's single-card scrapbook
	// pattern.
	listSticker: { paddingHorizontal: 0, paddingVertical: 4 },
	flatRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 12,
		gap: 12,
	},
	flatRowDivider: {
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	// Initial-circle avatar — colored disc with the first letter, used
	// in Friends + Add suggestions.
	avatarCircle: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
	},
	rowNameLine: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
	},
	rowName: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	rowDisc: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
	},
	rowMetaLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 4,
	},
	rowHeart: {
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		color: WHIMSY.roseDeep,
	},
	rowMeta: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	rowMetaDot: {
		width: 3,
		height: 3,
		borderRadius: 2,
		backgroundColor: WHIMSY.muteSoft,
	},
	rowChevron: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.mute,
		paddingLeft: 8,
	},
	// Add panel — paper sticker with magnifier + input.
	searchCard: { paddingVertical: 12, paddingHorizontal: 14 },
	kickerSmall: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.4,
		color: WHIMSY.mute,
		marginBottom: 8,
	},
	searchInputRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	searchGlyph: { fontSize: 16, color: WHIMSY.mute },
	inputFlat: {
		flex: 1,
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.ink,
		paddingVertical: 0,
	},
	referralFooter: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 16,
	},
	atCapFooter: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: 14,
	},
	referralFooterBold: {
		fontFamily: FONTS.bodyBlack,
		color: WHIMSY.ink,
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
