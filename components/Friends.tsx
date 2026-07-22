import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	Pressable,
	ActivityIndicator,
	ScrollView,
	Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { rpcAction } from "@/utils/rpc";
import {
	FRIEND_CAP_LIMIT,
	getFriendIds,
	getSuggestedUsers,
	searchUsers,
	sendFriendRequest,
	type Profile,
} from "@/utils/friendships";
import { ensurePushPermission } from "../utils/pushNotifications";
import { fetchFriendsCrews } from "@/utils/crews";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { type UseCrew } from "@/hooks/useCrew";
import { Sticker } from "./ui/Sticker";
import { UserSheet } from "./UserSheet";
import { BarnVisitModal } from "./BarnVisitModal";
import { useUnmanagedModalHold } from "./ui/PopupQueue";
import { FONTS, KICKER_PILL, PAGE_PAD, RADII, SHADOW_SM, SPACE, TAB_SAFE, TYPE, WHIMSY } from "@/constants/theme";
import { AlignmentBadge } from "./ui/AlignmentBadge";
import { PrestigeAvatar } from "./ui/PrestigeAvatar";
import { Icon } from "./ui/Icon";
import { Glyph } from "./ui/Glyph";

// PostgREST returns 1:1 joins either as an object or a length-1
// array. Flatten so consumers can read .name directly.
function hatName(p: Profile): string | null {
	const h = Array.isArray(p.active_hat) ? p.active_hat[0] : p.active_hat;
	return h?.name ?? null;
}

// Friend requests live in the Friends-hub Inbox now — this panel is
// just your friend list + add.
type Tab = "friends" | "add";

export default function Friends({
	userId,
	crewHook,
	onViewSounder,
}: {
	userId: string;
	crewHook?: UseCrew;
	onViewSounder?: () => void;
}) {
	const [tab, setTab] = useState<Tab>("friends");
	const [friends, setFriends] = useState<Profile[]>([]);
	// friend_id → Sounder name, so each row can say which herd a friend
	// rides with (friends_crews — empty until the migration is live).
	const [crewNames, setCrewNames] = useState<Map<string, string>>(new Map());

	// Tapping a friend opens UserSheet — the one door for ask / bless
	// / curse.
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// The row's barn button jumps straight into the visit (its own Modal —
	// unlike UserSheet's inline overlay, nothing here is already modal).
	const [visiting, setVisiting] = useState<{ id: string; name: string } | null>(null);
	// The barn-visit overlay is wrapped in this screen's own unmanaged native Modal
	// (see below) — hold the popup queue while visiting so a foreground poll can't
	// present a queued popup over it — the #50152 wedge (issue #4). (The UserSheet
	// path to BarnVisitModal is covered by UserSheet's own hold.)
	useUnmanagedModalHold(!!visiting);

	// Shared barn-visit budget for the whole window: 3 distinct barns per 3h.
	// It's window-global (target-independent in barn_visit_status), so we read
	// it ONCE per list load — not per row — and use it to gate every visit
	// button. null until fetched → treat as available (don't gate on unknown).
	const [visitsLeft, setVisitsLeft] = useState<number | null>(null);
	// visits_refresh_at is still fetched (it's part of the status envelope) but
	// no longer drives any copy: the day-rhythm ruling retired the "resets in Xh"
	// countdown from this surface. Kept so the fetch shape stays intact and a
	// future non-countdown use can read it without re-plumbing.
	const [visitsRefreshAt, setVisitsRefreshAt] = useState<string | null>(null);
	const noVisitsLeft = visitsLeft === 0;

	// The caller's pinned friends (friend_favorites). Direct table read under
	// RLS — fail-soft to empty if the migration is dark (pre-push) so the list
	// still renders, just unsorted-by-favorite. Optimistic on toggle.
	const [favorites, setFavorites] = useState<Set<string>>(new Set());

	// Pin / unpin a friend. Optimistic: flip the local set first so the star
	// snaps + the row re-sorts immediately (the world responds now), then
	// insert/delete; revert the local flip if the write fails.
	const toggleFavorite = useCallback(
		async (friendId: string) => {
			const wasFav = favorites.has(friendId);
			setFavorites((prev) => {
				const next = new Set(prev);
				if (wasFav) next.delete(friendId);
				else next.add(friendId);
				return next;
			});
			const { error } = wasFav
				? await supabase
						.from("friend_favorites")
						.delete()
						.eq("user_id", userId)
						.eq("friend_id", friendId)
				: await supabase
						.from("friend_favorites")
						.insert({ user_id: userId, friend_id: friendId });
			if (error) {
				// Revert the optimistic flip — the pin didn't stick.
				setFavorites((prev) => {
					const next = new Set(prev);
					if (wasFav) next.add(friendId);
					else next.delete(friendId);
					return next;
				});
			}
		},
		[favorites, userId]
	);

	// Per-friend (pairwise) barn lock: the set of friend ids you've already
	// tickled out this 24h window. barn_pair_locks returns the SAME pairwise
	// lock the arrival modal computes, so a locked row disables its visit door
	// instead of letting the player tap into the "Tickled!" dead-end. Empty
	// until fetched, and stays empty if the RPC is dark (migration unpushed) →
	// fail soft to today's behavior (no per-row gating).
	const [pairLocked, setPairLocked] = useState<Set<string>>(new Set());

	const load = useCallback(async () => {
		// Friends — via friend_ids RPC (returns the accepted set).
		// The server enforces a 100-friend cap (see the friend_cap
		// migration), so this should never return more than 100. The
		// client-side cap below is defense-in-depth in case the
		// migration hasn't been pushed yet — slicing here means we
		// never blow up the list view, and the FRIEND_CAP_LIMIT
		// constant stays the single source of truth in the UI.
		const ids = (await getFriendIds()) ?? [];
		const capped = ids.slice(0, FRIEND_CAP_LIMIT);
		if (capped.length > 0) {
			const [profileRes, friendCrews, favRes] = await Promise.all([
				(async () => {
					const rich = await supabase
						.from("profiles")
						.select("id, username, tickles_earned, discriminator, alignment_score, active_hat_id, wallow_count, active_hat:hats!profiles_active_hat_id_fkey(name)")
						.in("id", capped);
					if (!rich.error) return rich;
					return supabase
						.from("profiles")
						.select("id, username, tickles_earned, discriminator, alignment_score, active_hat_id, active_hat:hats!profiles_active_hat_id_fkey(name)")
						.in("id", capped);
				})(),
				fetchFriendsCrews(),
				// Pinned set — one owner-only select. Fail-soft to empty (a dark
				// migration / RLS miss just leaves the list unsorted-by-favorite).
				supabase
					.from("friend_favorites")
					.select("friend_id")
					.eq("user_id", userId),
			]);
			const list = (profileRes.data as Profile[]) ?? [];
			setFriends(list);
			setCrewNames(new Map(friendCrews.map((fc) => [fc.friend_id, fc.crew_name])));
			setFavorites(
				favRes.error
					? new Set()
					: new Set(
							((favRes.data as { friend_id: string }[] | null) ?? []).map(
								(r) => r.friend_id
							)
						)
			);

			// Read the shared visit budget once. barn_visit_status's
			// visits_left / visits_refresh_at are window-global (they count
			// distinct barns opened this 3h window, not this pair), so any
			// friend's id returns the same budget — we just need a non-self
			// target to satisfy the RPC. Gates every row's visit button.
			const probe = list[0];
			if (probe) {
				// Two reads in parallel: the window-global budget (one probe id,
				// any non-self target returns the same visits_left → the global
				// gate) and the per-pair locks for every visible friend (the
				// per-row gate). Both fail soft — a dark migration leaves the
				// state at its permissive default (null budget / empty lock set).
				const [st, locks] = await Promise.all([
					rpcAction<{
						visits_left?: number | null;
						visits_refresh_at?: string | null;
					}>("barn_visit_status", { p_target: probe.id }),
					rpcAction<{
						pairs?: { target_id: string; locked: boolean }[];
					}>("barn_pair_locks", { p_targets: list.map((p) => p.id) }),
				]);
				if (st.ok) {
					setVisitsLeft(st.visits_left ?? null);
					setVisitsRefreshAt(st.visits_refresh_at ?? null);
				}
				setPairLocked(
					locks.ok
						? new Set(
								(locks.pairs ?? [])
									.filter((p) => p.locked)
									.map((p) => p.target_id)
							)
						: new Set()
				);
			} else {
				setVisitsLeft(null);
				setVisitsRefreshAt(null);
				setPairLocked(new Set());
			}
		} else {
			setFriends([]);
			setCrewNames(new Map());
			setVisitsLeft(null);
			setVisitsRefreshAt(null);
			setPairLocked(new Set());
			setFavorites(new Set());
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
			{/* No inline kicker or rule — the Friends hub header owns the
			    per-segment kicker, title, AND title rule; anything here
			    doubles it. */}
			<View style={styles.tabsRow}>
				<TabBtn label={`Friends · ${friends.length}`} active={tab === "friends"} onPress={() => setTab("friends")} />
				<TabBtn label="Add" active={tab === "add"} onPress={() => setTab("add")} />
			</View>

			{/* Scrollable list area — at 100-friend cap the sticker
			    would otherwise overflow off the bottom of the screen
			    with no way to reach the lower rows. paddingBottom on
			    the contentContainer keeps the last row clear of the
			    hanging-signs tab bar. */}
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Your own Sounder — pinned to the top of the friends list so the
				    hub shows the herd you ride with, not just the people you follow.
				    Taps through to the Sounder segment. Only when you're in a crew. */}
				{tab === "friends" && crewHook?.crew.crew && (
					<Pressable
						onPress={onViewSounder}
						accessibilityRole="button"
						accessibilityLabel={`Your Sounder, ${crewHook.crew.crew.name}`}
						style={styles.sounderBanner}
					>
						<Icon name="crown" size={20} color={WHIMSY.ink} strokeWidth={2} />
						<View style={styles.sounderText}>
							<Text style={styles.sounderKicker}>★ your Sounder</Text>
							<Text style={styles.sounderName} numberOfLines={1}>
								{crewHook.crew.crew.name}
							</Text>
						</View>
						<Text style={styles.sounderView}>View ›</Text>
					</Pressable>
				)}

				{tab === "friends" && (
					<FriendsList
						friends={friends}
						crewNames={crewNames}
						visitsSpent={noVisitsLeft}
						pairLocked={pairLocked}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
						onPick={setSelectedUserId}
						onVisit={(f) =>
							setVisiting({ id: f.id, name: f.username ?? "friend" })
						}
					/>
				)}

				{tab === "add" && <AddFriend userId={userId} onSent={load} />}
			</ScrollView>

			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={load}
			/>

			{/* Barn visit from the row button. BarnVisitModal is a plain
			    absolute-fill overlay (it can't nest a Modal under UserSheet's),
			    so from this non-modal screen it needs its own Modal to cover
			    the tab bar. */}
			{visiting && (
				<Modal
					visible
					animationType="slide"
					onRequestClose={() => setVisiting(null)}
				>
					<BarnVisitModal
						targetUserId={visiting.id}
						targetName={visiting.name}
						onClose={() => {
							setVisiting(null);
							// Returning from a visit may have just tickled this
							// friend out — reload so the row's pair-lock (and the
							// window-global budget) reflects the fresh state.
							load();
						}}
					/>
				</Modal>
			)}
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
	crewNames,
	visitsSpent,
	pairLocked,
	favorites,
	onToggleFavorite,
	onPick,
	onVisit,
}: {
	friends: Profile[];
	crewNames: Map<string, string>;
	// You've spent your window-global barn budget → every row's visit button
	// dims + disables, with a single day-rhythm hint above the list (never per
	// row, and never a countdown). This is the GLOBAL "tickled out" state.
	visitsSpent: boolean;
	// Friend ids you've already tickled today (per-pair 24h lock). These rows
	// dim + disable their visit door individually with a "tickled today" tag —
	// the PER-PAIR state. Composes with visitsSpent, but the global gate wins
	// (uniform dim + header hint, no per-row tags — avoid tag spam).
	pairLocked: Set<string>;
	// The caller's pinned friends — sorted to the top, star lit sun-gold.
	favorites: Set<string>;
	onToggleFavorite: (friendId: string) => void;
	onPick: (id: string) => void;
	onVisit: (friend: Profile) => void;
}) {
	// Alignment isn't a thing in Season 1 — the badge retires with S0.
	const s1 = useFeatureFlag("world_boss") || __DEV__;
	if (friends.length === 0) {
		return (
			<Sticker color="paper" rotate={-0.5} radius={12} style={styles.empty}>
				<Text style={styles.emptyText}>
					No friends yet. Tap “Add” to send your first request.
				</Text>
			</Sticker>
		);
	}
	// Favorites first (alphabetical within), then everyone else alphabetically —
	// the existing predictable order, just with pinned friends floated up.
	const sorted = [...friends].sort((a, b) => {
		const fa = favorites.has(a.id) ? 0 : 1;
		const fb = favorites.has(b.id) ? 0 : 1;
		if (fa !== fb) return fa - fb;
		return (a.username ?? "").localeCompare(b.username ?? "");
	});
	const atCap = sorted.length >= FRIEND_CAP_LIMIT;
	return (
	  <>
		{/* Global "tickled out" — you've spent your whole barn budget. One
		    day-rhythm hint above the list (no countdown, no reset time — the
		    charter never punishes the hours between). Every visit button below
		    dims + disables to match; no per-row tags in this state. */}
		{visitsSpent && (
			<View style={styles.visitsSpentHint}>
				<Icon name="tabBarn" size={14} color={WHIMSY.accent} />
				<Text style={styles.visitsSpentText}>
					all tickled out — your snout needs a rest
				</Text>
			</View>
		)}
		{/* rotate 0: on a tall list even a fraction of a degree shears the
		    bottom corners sideways out of the scroll clip — tilt is for
		    small stickers only. */}
		<Sticker color="paper" rotate={0} radius={14} style={styles.listSticker}>
			{sorted.map((f, i) => {
				const last = i === sorted.length - 1;
				const wears = hatName(f);
				const crewName = crewNames.get(f.id);
				// This pair is tickled today (per-pair 24h lock). Compose with
				// the global gate: the row's door disables if EITHER is spent.
				const pairSpent = pairLocked.has(f.id);
				const rowSpent = visitsSpent || pairSpent;
				// Show the compact per-row "tickled today" tag only when it's
				// THIS pair's lock and the global gate is NOT spent — when the
				// global hint is up it speaks for the whole list, so tags down
				// every row would just be spam (global wins).
				const showPairHint = pairSpent && !visitsSpent;
				const isFav = favorites.has(f.id);
				return (
					<Pressable
						key={f.id}
						onPress={() => onPick(f.id)}
						style={[styles.flatRow, !last && styles.flatRowDivider]}
					>
						{/* PigAvatar instead of the initial circle — the
						    equipped hat shows up as an inline icon on
						    the pig sprite, so the sounder reads what
						    each friend is currently wearing at a glance. */}
						<View style={styles.rowPigWrap}>
							<PrestigeAvatar
								size={(f.wallow_count ?? 0) > 0 ? 48 : 36}
								hatId={f.active_hat_id ?? null}
								prestigeLevel={f.wallow_count}
							/>
						</View>
						<View style={{ flex: 1, minWidth: 0 }}>
							<View style={styles.rowNameLine}>
								<Text style={styles.rowName} numberOfLines={1}>
									{f.username ?? "—"}
								</Text>
								{!!f.discriminator && (
									<Text style={styles.rowDisc}>#{f.discriminator}</Text>
								)}
							</View>
							{/* Second line — "wears X" when a hat is equipped.
							    Falls back to the ♥ + alignment meta so naked
							    pigs aren't blank rows. */}
							{wears ? (
								<Text style={styles.rowWearsText} numberOfLines={1}>
									wears {wears}
								</Text>
							) : (
							<View style={styles.rowMetaLine}>
								<Glyph name="heart" size={12} />
								<Text style={styles.rowMeta}>
									{(f.tickles_earned ?? 0).toLocaleString()}
								</Text>
								{!s1 && typeof f.alignment_score === "number" && (
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
							)}
							{/* Which herd they ride with — the Sounder is part of a
							    pig's identity now, so it reads at a glance. */}
							{!!crewName && (
								<Text style={styles.rowCrewText} numberOfLines={1}>
									in {crewName}
								</Text>
							)}
						</View>
						{/* Favorite star — pins this friend to the top. Its own
						    Pressable (a sibling to the row's profile-door press), so
						    tapping the star toggles the pin without opening the sheet.
						    Sun-gold + filled when pinned; muted outline when not. */}
						<Pressable
							onPress={() => onToggleFavorite(f.id)}
							hitSlop={10}
							accessibilityRole="button"
							accessibilityLabel={
								isFav
									? `Unpin ${f.username ?? "friend"} from the top`
									: `Pin ${f.username ?? "friend"} to the top`
							}
							style={({ pressed }) => [
								styles.rowFavBtn,
								pressed && styles.rowFavBtnPressed,
							]}
						>
							<Icon
								name="star"
								size={18}
								filled={isFav}
								color={isFav ? WHIMSY.ink : WHIMSY.muteSoft}
								strokeWidth={2}
							/>
						</Pressable>
						{/* Per-pair "tickled today" — you've already visited this
						    friend's barn today (implicitly: it returns tomorrow).
						    Short (the row is small), and suppressed when the global
						    hint is already up. */}
						{showPairHint && (
							<Text
								style={styles.rowTickledOut}
								accessibilityLabel={`You've tickled ${f.username ?? "this friend"}'s barn today — come back tomorrow.`}
							>
								tickled today
							</Text>
						)}
						{/* Visit their Barn — a one-tap door on the row itself so
						    visiting never depends on opening the profile sheet
						    first. Every row here is a friend (the server's
						    are_friends gate always passes); the modal handles
						    napping/resting itself. Disabled when the global budget
						    is spent OR this pair is tickled out. */}
						<Pressable
							onPress={() => onVisit(f)}
							disabled={rowSpent}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityState={{ disabled: rowSpent }}
							accessibilityLabel={
								visitsSpent
									? "All tickled out — your snout needs a rest"
									: pairSpent
										? `You've tickled ${f.username ?? "friend"}'s barn today — come back tomorrow.`
										: `Visit ${f.username ?? "friend"}'s barn`
							}
							style={({ pressed }) => [
								styles.rowVisitBtn,
								rowSpent && styles.rowVisitBtnSpent,
								pressed && !rowSpent && styles.rowVisitBtnPressed,
							]}
						>
							<Icon name="tabBarn" size={18} color={WHIMSY.ink} />
						</Pressable>
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
	const [suggestions, setSuggestions] = useState<Profile[]>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Load 3 suggested users on mount so the Add tab isn't a blank
	// search box. Uses suggested_users RPC: non-friends, no pending
	// requests, ordered random.
	useEffect(() => {
		getSuggestedUsers(3).then((data) => {
			setSuggestions(data ?? []);
		});
	}, []);

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
			const data = await searchUsers(q, 10);
			setResults(data ?? []);
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
		const r = await sendFriendRequest(
			target.username,
			target.discriminator ?? null
		);
		setSending(null);
		if (!r?.ok) {
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
		// Drop the suggestion you just added so the row visually
		// confirms the action + doesn't re-show the same name.
		setSuggestions((prev) => prev.filter((s) => s.id !== target.id));
		onSent();
	};

	return (
		<View style={styles.addWrap}>
			{/* Search input with magnifier prefix in a cream container —
			    matches the design's search-as-paper-form look. */}
			<Sticker color="paper" rotate={0} radius={14} style={styles.searchCard}>
				<Text style={styles.kickerSmall}>FIND A FRIEND</Text>
				<View style={styles.searchInputRow}>
					<Icon name="search" size={16} color={WHIMSY.mute} />
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
				<Sticker color="paper" rotate={0} radius={14} style={styles.listSticker}>
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

			{/* Suggestions — 3 fresh non-friends served only when the
			    user isn't actively searching. Lets the Add tab feel
			    populated even before a search. From the redesign. */}
			{query.length === 0 && suggestions.length > 0 && (
				<>
					<Text style={styles.kickerSmall}>SUGGESTIONS</Text>
					<Sticker color="paper" rotate={0} radius={14} style={styles.listSticker}>
						{suggestions.map((p, i) => {
							const last = i === suggestions.length - 1;
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
										<Text style={styles.rowDisc}>
											{p.discriminator ? `#${p.discriminator} · ` : ""}suggested
										</Text>
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
				</>
			)}

			{/* Referral footer — share-your-code call to action lives at
			    the bottom of the Add panel per the design. The actual
			    code lives on the Sounder/Account card; this is just a
			    nudge. */}
			{query.length === 0 && (
				<Text style={styles.referralFooter}>
					★ share your code from{" "}
					<Text style={styles.referralFooterBold}>Account</Text>
						{" "}for 100 tickles
				</Text>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	wrap: { flex: 1, marginTop: 16, paddingHorizontal: PAGE_PAD },
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: TAB_SAFE },
	// "Your Sounder" banner pinned above the friends list.
	sounderBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
		marginBottom: SPACE.md,
		...SHADOW_SM,
	},
	sounderText: { flex: 1 },
	sounderKicker: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
	},
	sounderName: { ...TYPE.cardTitle, color: WHIMSY.ink },
	sounderView: { fontFamily: FONTS.display, fontSize: 13, color: WHIMSY.ink },
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
		borderRadius: 8,
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
		borderRadius: RADII.pill,
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
		...TYPE.label,
		color: WHIMSY.mute,
	},
	// PigAvatar wrapper — a small ink-bordered tile so the sprite
	// reads as an avatar slot inside the flat row rather than a
	// floating pig. Matches the leaderboard ClippingRow's treatment.
	rowPigWrap: {
		width: 40,
		height: 40,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	rowWearsText: {
		...TYPE.label,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	rowCrewText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		marginTop: 2,
	},
	rowMetaLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 4,
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
	// Favorite star — a small tap target beside the visit door. No chip chrome
	// (the star itself IS the affordance); a light press dim matches the house
	// pressed-feedback pattern without competing with the sun visit circle.
	rowFavBtn: {
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	rowFavBtnPressed: { opacity: 0.55 },
	// Per-row barn door — small sun circle so "visit" reads as the row's
	// action while the row itself stays the profile door.
	rowVisitBtn: {
		width: 34,
		height: 34,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		marginLeft: 8,
	},
	rowVisitBtnPressed: { backgroundColor: WHIMSY.cream2 },
	// Out-of-visits: keep the button's shape (the taste standard's "a button,
	// asleep" — mute the fill, never dissolve the outline), just muted + dimmed.
	rowVisitBtnSpent: { backgroundColor: WHIMSY.cream2, opacity: 0.55 },
	// Per-row "tickled out" tag — compact, muted, sits just left of the dimmed
	// visit door so the row reads its own pairwise lock at a glance.
	rowTickledOut: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		marginLeft: SPACE.xs,
	},
	// One-time "out of visits" hint above the list.
	visitsSpentHint: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginBottom: SPACE.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		backgroundColor: WHIMSY.slopBand,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		...SHADOW_SM,
	},
	visitsSpentText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	// Add panel — paper sticker with magnifier + input.
	searchCard: { paddingVertical: 12, paddingHorizontal: 14 },
	kickerSmall: {
		...KICKER_PILL,
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
		borderRadius: 12,
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
