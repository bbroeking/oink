import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	BackHandler,
	InteractionManager,
	Platform,
	Pressable,
	StyleSheet,
	View,
	Image,
	ScrollView,
	FlatList,
	findNodeHandle,
	useWindowDimensions,
	type GestureResponderEvent
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { supabase } from "../utils/supabase";
import { rpcAction } from "@/utils/rpc";
import { fetchBarnVisitStatus } from "@/utils/barnVisit";
import {
	FRIEND_CAP_LIMIT,
	getFriendIds,
	getSuggestedUsers,
	searchUsers,
	sendFriendRequest,
	type Profile
} from "@/utils/friendships";
import { ensurePushPermission } from "../utils/pushNotifications";
import { fetchFriendsCrews } from "@/utils/crews";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import {
	AlignmentBadge,
	Avatar,
	Button,
	CardTitle,
	Ceremony,
	EmptyState,
	Glyph,
	Icon,
	IconButton,
	KickerPill,
	Label,
	ListRow,
	LoadingBeat,
	PrestigeAvatar,
	SegmentedControl,
	Sticker,
	T,
	TextField,
	type AvatarFill,
	type SegmentOption,
} from "@/components/ui";
import { UserSheet } from "./UserSheet";
import { GameIcon } from "./ui/GameIcon";
import { BarnVisitModal } from "./BarnVisitModal";
import { RitualExplainSheet } from "./RitualExplainSheet";
import {
	AVATAR_SIZE,
	BORDER,
	BUTTON_SIZE,
	FONTS,
	MOTION,
	MOTION_SPRING,
	PAGE_PAD,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	ACTION_PANEL_INSETS,
	ROW_MIN_H,
	actionCellTier,
	ACTION_PANEL_TRAVEL,
	type ActionCellTier,
} from "@/constants/layoutBreakpoints";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { showToast } from "@/components/ui/Toast";
import {
	useRitualCaster,
	type CastOutcome,
	type RitualUsage,
	type UseRitualCaster,
} from "@/hooks/useRitualCaster";
import {
	RITUAL_DOOR,
	useRitualDoor,
	type RitualDoorView,
} from "@/hooks/useRitualDoor";
import { untilDailyReset, type RitualMode } from "@/utils/rituals";
import { compareFriends } from "@/utils/friendOrder";
import {
	fetchFriendVisitStreaks,
	type FriendVisitStreak,
} from "@/utils/visitStreaks";
import { bagHasWishFor, fetchFriendWishes, fetchMySatchel, type FriendWish, type SatchelItem } from "@/utils/satchel";
import { satchelFind } from "@/constants/satchel";
import { FindArt } from "./satchel/FindArt";

// PostgREST returns 1:1 joins either as an object or a length-1
// array. Flatten so consumers can read .name directly.
function hatName(p: Profile): string | null {
	const h = Array.isArray(p.active_hat) ? p.active_hat[0] : p.active_hat;
	return h?.name ?? null;
}

// Friend requests live in the Friends-hub Inbox now — this panel is
// just your friend list + add.
type Tab = "friends" | "add";

const TAB_OPTIONS = (friendCount: number): SegmentOption<Tab>[] => [
	{
		value: "friends",
		label: `Friends · ${friendCount}`,
		accessibilityLabel: `Friends list, ${friendCount}`,
		accessibilityHint: "Shows the pigs you already ride with",
	},
	{
		value: "add",
		label: "Add",
		accessibilityLabel: "Add a friend",
		accessibilityHint: "Opens the search for a new friend",
	},
];

// Drawing geometry for the row's pig tile. Diameters, not spacing steps: the
// tile is a frame the sprite is drawn inside (the `Avatar` precedent). The
// actions live in a panel the trigger opens now, not in a bar under the
// identity, so the tile returns to the mid avatar frame — the pig sits level
// with the name and the one meta line. (2026-09-14)
const PIG_TILE = AVATAR_SIZE[1];
const PIG_SPRITE = 36;
const PIG_SPRITE_PRESTIGE = 48;
// The Add tab's letter disc is not a portrait — it keeps the smaller frame.
const INITIAL_TILE = AVATAR_SIZE[1];

// The identity stays compact; the panel's cells are fixed-height, so their type
// takes the row's ceiling rather than wrapping out of the row. (2026-09-12
// chrome cap; the cells' shrink-to-fit retired 2026-09-14 — see `ActionCell`)
const ROW_TYPE_CAP = 1.3;

// The count line is one quiet kicker, so its 44pt target comes from `hitSlop`
// rather than from inflating the line — the IconButton visual/frame split, in
// text. Half above and half below the line it sits on.
const COUNT_HIT = (TAP_MIN - TYPE.kicker.lineHeight) / 2;

// Zero to ten in words; past ten the numeral is the shorter read. The counts
// are single digits in practice (today's cap is 3) — the numeral tail is there
// so a raised cap can never render "Thirteen".
const COUNT_WORDS = [
	"No",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
] as const;

function countWord(n: number): string {
	return COUNT_WORDS[n] ?? String(n);
}

export default function Friends({ userId }: { userId: string }) {
	const [tab, setTab] = useState<Tab>("friends");
	const [friends, setFriends] = useState<Profile[]>([]);
	// A null `friend_ids` is "we don't know", not "you have none" — spec §3.4.
	// The list renders an error with a retry instead of telling the player a
	// factual untruth about their own sounder. [B-09, B-14]
	const [loadFailed, setLoadFailed] = useState(false);
	// Until the first read lands, the list is UNKNOWN — it must not render "No
	// friends yet", which is the same lie as rendering a failed fetch as empty.
	const [loaded, setLoaded] = useState(false);
	// friend_id → Sounder name, so each row can say which herd a friend
	// rides with (friends_crews — empty until the migration is live).
	const [crewNames, setCrewNames] = useState<Map<string, string>>(new Map());

	// Tapping a friend opens UserSheet — the one door for ask / bless
	// / curse.
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// The row's barn button jumps straight into the visit (its own Modal —
	// unlike UserSheet's inline overlay, nothing here is already modal).
	const [visiting, setVisiting] = useState<{ id: string; name: string } | null>(null);
	// The barn visit mounts as a `Ceremony` (below), which owns the native Modal
	// AND the popup-queue latch — so a foreground poll can't present a queued
	// popup over the visit (the #50152 wedge, issue #4). (The UserSheet path to
	// BarnVisitModal is covered by UserSheet's own hold.)

	// Shared barn-visit budget for the whole window: 3 distinct barns per 3h.
	// It's window-global (target-independent in barn_visit_status), so we read
	// it ONCE per list load — not per row — and use it to gate every visit
	// button. null until fetched → treat as available (don't gate on unknown).
	const [visitsLeft, setVisitsLeft] = useState<number | null>(null);
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
				: await supabase.from("friend_favorites").insert({ user_id: userId, friend_id: friendId });
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
	const [visitStreaks, setVisitStreaks] = useState<Map<string, FriendVisitStreak>>(new Map());
	// The Satchel's wish marks (docs/satchel-spec.md step 2): each friend's
	// pig's wish, and my bag, so a row can say "you have what they want".
	// Both fail soft — a server without the bag leaves every row unmarked.
	const [friendWishes, setFriendWishes] = useState<Map<string, FriendWish>>(new Map());
	const [myBag, setMyBag] = useState<SatchelItem[]>([]);

	const load = useCallback(async () => {
		// Friends — via friend_ids RPC (returns the accepted set).
		// The server enforces a 100-friend cap (see the friend_cap
		// migration), so this should never return more than 100. The
		// client-side cap below is defense-in-depth in case the
		// migration hasn't been pushed yet — slicing here means we
		// never blow up the list view, and the FRIEND_CAP_LIMIT
		// constant stays the single source of truth in the UI.
		const ids = await getFriendIds();
		if (ids === null) {
			// Unknown, not empty: keep whatever is on screen and raise the error
			// state so the player gets a retry rather than "no friends yet".
			setLoadFailed(true);
			setLoaded(true);
			return;
		}
		setLoadFailed(false);
		setLoaded(true);
		const capped = ids.slice(0, FRIEND_CAP_LIMIT);
		if (capped.length > 0) {
			const [profileRes, friendCrews, favRes] = await Promise.all([
				(async () => {
					const rich = await supabase
						.from("profiles")
						.select(
							"id, username, tickles_earned, discriminator, alignment_score, active_hat_id, wallow_count, active_hat:hats!profiles_active_hat_id_fkey(name)"
						)
						.in("id", capped);
					if (!rich.error) return rich;
					return supabase
						.from("profiles")
						.select(
							"id, username, tickles_earned, discriminator, alignment_score, active_hat_id, active_hat:hats!profiles_active_hat_id_fkey(name)"
						)
						.in("id", capped);
				})(),
				fetchFriendsCrews(),
				// Pinned set — one owner-only select. Fail-soft to empty (a dark
				// migration / RLS miss just leaves the list unsorted-by-favorite).
				supabase.from("friend_favorites").select("friend_id").eq("user_id", userId)
			]);
			const list = profileRes.data ?? [];
			setFriends(list);
			setCrewNames(new Map(friendCrews.map((fc) => [fc.friend_id, fc.crew_name])));
			setFavorites(
				favRes.error
					? new Set()
					: new Set((favRes.data ?? []).map((r) => r.friend_id))
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
				const [st, locks, streaks, wishes, bag] = await Promise.all([
					fetchBarnVisitStatus(probe.id),
					rpcAction<{
						pairs?: { target_id: string; locked: boolean }[];
					}>("barn_pair_locks", { p_targets: list.map((p) => p.id) }),
					fetchFriendVisitStreaks(list.map((p) => p.id)),
					fetchFriendWishes(list.map((p) => p.id)),
					fetchMySatchel(),
				]);
				setFriendWishes(
					wishes.ok ? new Map(wishes.wishes.map((w) => [w.target_id, w])) : new Map(),
				);
				setMyBag(bag.ok ? bag.state.items : []);
				if (st.ok) {
					setVisitsLeft(st.visits_left ?? null);
				}
				setPairLocked(
					locks.ok
						? new Set((locks.pairs ?? []).filter((p) => p.locked).map((p) => p.target_id))
						: new Set()
				);
				setVisitStreaks(
					streaks.ok
						? new Map(streaks.streaks.map((entry) => [entry.target_id, entry]))
						: new Map(),
				);
			} else {
				setVisitsLeft(null);
				setPairLocked(new Set());
				setVisitStreaks(new Map());
				setFriendWishes(new Map());
				setMyBag([]);
			}
		} else {
			setFriends([]);
			setCrewNames(new Map());
			setVisitsLeft(null);
			setPairLocked(new Set());
			setFavorites(new Set());
			setVisitStreaks(new Map());
			setFriendWishes(new Map());
			setMyBag([]);
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
			<SegmentedControl
				label="Friends panel"
				options={TAB_OPTIONS(friends.length)}
				value={tab}
				onChange={setTab}
				style={styles.tabsRow}
			/>

			{tab === "friends" ? (
				<FriendsList
					friends={friends}
					crewNames={crewNames}
					loaded={loaded}
					loadFailed={loadFailed}
					onRetry={load}
					visitsSpent={noVisitsLeft}
					visitsLeft={visitsLeft}
					pairLocked={pairLocked}
					visitStreaks={visitStreaks}
					friendWishes={friendWishes}
					myBag={myBag}
					favorites={favorites}
					onToggleFavorite={toggleFavorite}
					onPick={setSelectedUserId}
					onVisit={(f) => setVisiting({ id: f.id, name: f.username ?? "friend" })}
				/>
			) : (
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					<AddFriend userId={userId} onSent={load} />
				</ScrollView>
			)}

			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={load}
			/>

			{/* Barn visit from the row button — a full-screen scene, so it
			    mounts as a `Ceremony`: BarnVisitModal is a plain absolute-fill
			    overlay (it can't nest a Modal under UserSheet's), and from this
			    non-modal screen it needs a Modal of its own to cover the tab bar. */}
			<Ceremony
				open={!!visiting}
				entrance="slide"
				onRequestClose={() => setVisiting(null)}
			>
				{visiting ? (
					<BarnVisitModal
						key={visiting.id}
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
				) : null}
			</Ceremony>
		</View>
	);
}

// ── Friends list ──────────────────────────────────────────────────
// Each row shows its identity and every action it can take, at rest.
// Avatar circle palette — picks a deterministic tint per name so the
// list reads as a colorful sounder rather than a wall of cream.
const AVATAR_TINTS: AvatarFill[] = [
	"rose",
	"sun",
	"sky",
	"sage",
	"lilac",
	"peach"
];
function tintFor(name: string | null | undefined): AvatarFill {
	if (!name) return "cream";
	let h = 0;
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
	return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

// The Add tab's rows are NOT profile doors (the sheet's selection lives on the
// Friends panel above them, and a search result is something you act on rather
// than visit), so they deliberately wear a letter disc instead of the pig
// portrait a friend row carries — differentiated rather than falsely tappable.
// [B-16] (2026-09-11)
function InitialAvatar({ name }: { name: string | null | undefined }) {
	const initial = (name ?? "?")[0]?.toUpperCase() ?? "?";
	return (
		<Avatar
			size={INITIAL_TILE}
			fill={tintFor(name)}
			label={name ?? "Unknown pig"}
		>
			<CardTitle align="center">{initial}</CardTitle>
		</Avatar>
	);
}

// ── The row's actions menu ────────────────────────────────────────
// A kebab on every friend row opens ONE anchored panel that slides over that
// row's text column. Nothing navigates, nothing changes height, and only one
// panel is ever open — a single id at the list level. The cells are the same
// equal-width `Sticker` cells the action bar drew, now behind the trigger that
// names them. (2026-09-14)

/**
 * The open panel's two boxes, handed up to the list. An outside touch is a hit
 * test against these — never a full-screen scrim, which on the new
 * architecture swallows every tap in the tab (the build-99 dead Barn).
 */
export interface OpenMenuRefs {
	panel: React.MutableRefObject<View | null>;
	trigger: React.MutableRefObject<View | null>;
}

/** The panel's id — `aria-controls` on the trigger points at it on web. */
const menuNativeId = (friendId: string) => `friend-menu-${friendId}`;

/**
 * react-native-web forwards every `aria-*` attribute to the DOM node; React
 * Native has no prop mirror for `haspopup` / `controls`, and neither means
 * anything to VoiceOver (which reads `accessibilityRole` + `expanded`).
 */
function webMenuAria(
	friendId: string
): Record<`aria-${string}`, string> | undefined {
	if (Platform.OS !== "web") return undefined;
	return { "aria-haspopup": "menu", "aria-controls": menuNativeId(friendId) };
}

/** Web-only key handling — react-native-web's DOM props, inert on native. */
type WebKeyProps = { onKeyDown?: (event: KeyboardEvent) => void };

/**
 * Send accessibility focus to a host view — VoiceOver on native, DOM focus on
 * web. Guarded: a host that has already unmounted gets nothing.
 */
function focusHost(host: View | null | undefined) {
	if (!host) return;
	if (Platform.OS === "web") {
		(host as unknown as { focus?: () => void }).focus?.();
		return;
	}
	const tag = findNodeHandle(host);
	if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
}

/**
 * One action in a row's menu. The row builds its own list from its own props,
 * and every handler here closes over that row's friend id — nothing reads a
 * list-level "current friend". (spec §1)
 */
interface RowAction {
	key: "visit" | "bless" | "curse" | "pin" | "profile";
	label: string;
	/** The one-line state, shown on regular phones and spoken on narrow ones. */
	sub?: string;
	/** The cell's drawing — the cast ritual's own art, a GameIcon or an Icon. */
	art: React.ReactNode;
	fill: string;
	disabled?: boolean;
	/** Curse only — the armed cell takes the heavy outline. */
	armed?: boolean;
	/** The curse's FIRST tap keeps the panel open; everything else closes it. */
	closesOnPress: boolean;
	onPress: () => void;
	accessibilityLabel: string;
	accessibilityHint?: string;
	testID: string;
}

function ActionCell({
	fill,
	art,
	label,
	sub,
	tier,
	onPress,
	disabled,
	armed,
	accessibilityLabel,
	accessibilityHint,
	testID,
	cellRef,
}: {
	fill: string;
	art: React.ReactNode;
	label: string;
	sub?: string;
	tier: ActionCellTier;
	onPress: () => void;
	disabled?: boolean;
	armed?: boolean;
	accessibilityLabel: string;
	accessibilityHint?: string;
	testID?: string;
	cellRef?: (host: View | null) => void;
}) {
	// No tier draws the state line — it is what pushed the row's floor to 98pt.
	// The copy is not dropped, it moves into the hint, so a screen reader hears
	// it either way. (2026-09-14)
	const hint = !sub
		? accessibilityHint
		: accessibilityHint
			? `${sub}. ${accessibilityHint}`
			: sub;
	return (
		<Sticker
			ref={cellRef}
			color={fill}
			rotate={0}
			radius={RADII.md}
			// Armed is the cell's "selected" chrome — a heavier outline, never a
			// color change alone (design-system spec §3.3).
			border={armed ? BORDER.heavy : BORDER.ink}
			shadow="none"
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="menuitem"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={hint}
			accessibilityState={{ disabled: !!disabled, expanded: armed || undefined }}
			testID={testID}
			style={styles.actionCell}
		>
			{art}
			{/* One word, one line, at the tier's own size. The cells used to
			    shrink their type to fit; measured against the 39.8pt content box
			    a 375pt phone gives a cell, the shrink rescued three labels and
			    still truncated "Profile" — so the tier drops the tracked caps
			    instead, and every label fits at full size. (2026-09-14) */}
			<T
				role={tier.labelRole}
				tone={disabled ? "secondary" : "primary"}
				align="center"
				numberOfLines={1}
				maxFontSizeMultiplier={ROW_TYPE_CAP}
			>
				{label}
			</T>
		</Sticker>
	);
}

// A ritual cell's drawing: the cast ritual's own art once this friend has
// today's ritual from you, the glyph-only door until then.
function ritualArt(
	mode: RitualMode,
	door: RitualDoorView,
	tier: ActionCellTier
): React.ReactNode {
	const box = { width: tier.glyph, height: tier.glyph };
	return door.icon ? (
		<Image source={door.icon} style={[styles.actionArt, box]} />
	) : (
		<GameIcon name={mode} size={tier.glyph} muted={door.disabled} />
	);
}

/**
 * The trigger. The same icon whether the panel is out or not — "open" is the
 * panel beside it, never a glyph swap — with a 44pt frame around the sanctioned
 * small visual and `expanded` on its accessibility state.
 */
const RowMenuTrigger = React.forwardRef<
	View,
	{ friendId: string; name: string; expanded: boolean; onPress: () => void }
>(function RowMenuTrigger({ friendId, name, expanded, onPress }, ref) {
	return (
		<IconButton
			ref={ref}
			name="more"
			visualSize={BUTTON_SIZE.xs.minH}
			label={expanded ? `Hide actions for ${name}` : `Actions for ${name}`}
			accessibilityHint={
				expanded
					? "Closes this friend's actions"
					: "Opens visit, bless, curse, pin and profile for this friend"
			}
			expanded={expanded}
			onPress={onPress}
			webAria={webMenuAria(friendId)}
			testID={`friend-menu-trigger-${friendId}`}
		/>
	);
});

/**
 * The panel. Absolutely positioned inside the row, so the row's height is set
 * by its identity and the list never reflows; mounted only while open, and
 * unmounted after the exit so the accessibility tree never holds a hidden menu.
 */
function RowActionsPanel({
	friendId,
	name,
	actions,
	open,
	tier,
	panelRef,
	onRequestClose,
	onReturnFocus,
}: {
	friendId: string;
	name: string;
	actions: RowAction[];
	open: boolean;
	tier: ActionCellTier;
	panelRef: React.MutableRefObject<View | null>;
	onRequestClose: () => void;
	onReturnFocus: () => void;
}) {
	const motion = useMotionPolicy();
	// `useState`'s initializer, not a ref: the value is created once and is
	// never read during render, which is what the panel's driver needs.
	const [slide] = useState(() => new Animated.Value(ACTION_PANEL_TRAVEL));
	const [mounted, setMounted] = useState(open);
	const cellHosts = useRef<(View | null)[]>([]);

	useEffect(() => {
		if (open) setMounted(true);
	}, [open]);

	// In from the trigger side on a spring, out the same way, then unmount.
	// Reduce Motion takes the rest pose immediately — no travel, no spring.
	useEffect(() => {
		if (!mounted) return;
		const to = open ? 0 : ACTION_PANEL_TRAVEL;
		if (!motion.allowDecorativeMotion) {
			slide.setValue(to);
			if (!open) setMounted(false);
			return;
		}
		const anim = Animated.spring(slide, {
			toValue: to,
			useNativeDriver: true,
			...MOTION_SPRING.settle,
			// The house spring lands with a bounce; a panel that bounces past
			// its rest and back reads as a jiggle, and past its rest is past
			// the row's edge. Clamped, it eases in and stops. (2026-09-14)
			overshootClamping: true,
		});
		anim.start(({ finished }) => {
			if (finished && !open) setMounted(false);
		});
		return () => anim.stop();
	}, [motion.allowDecorativeMotion, mounted, open, slide]);

	const firstEnabled = actions.findIndex((a) => !a.disabled);

	// Focus the first cell you can actually press, once the entrance is on its
	// way (an immediate call lands before the node exists).
	useEffect(() => {
		if (!open || !mounted) return;
		const task = InteractionManager.runAfterInteractions(() => {
			focusHost(cellHosts.current[firstEnabled < 0 ? 0 : firstEnabled]);
		});
		return () => task.cancel();
	}, [firstEnabled, mounted, open]);

	if (!mounted) return null;

	// Web keyboard: Escape closes and hands focus back, the arrows walk the
	// cells, Home/End jump. iOS needs none of it (VoiceOver swipes).
	const webKeys: WebKeyProps =
		Platform.OS === "web"
			? {
					onKeyDown: (event) => {
						const hosts = actions
							.map((a, i) => (a.disabled ? null : cellHosts.current[i]))
							.filter((h): h is View => !!h);
						if (event.key === "Escape") {
							event.preventDefault();
							onRequestClose();
							onReturnFocus();
							return;
						}
						if (hosts.length === 0) return;
						const at = hosts.indexOf(
							document.activeElement as unknown as View
						);
						const step =
							event.key === "ArrowRight"
								? at + 1
								: event.key === "ArrowLeft"
									? at - 1
									: event.key === "Home"
										? 0
										: event.key === "End"
											? hosts.length - 1
											: null;
						if (step === null) return;
						event.preventDefault();
						focusHost(hosts[(step + hosts.length) % hosts.length]);
					},
				}
			: {};

	return (
		<View
			ref={panelRef}
			nativeID={menuNativeId(friendId)}
			accessibilityRole="menu"
			accessibilityLabel={`Actions for ${name}`}
			testID={menuNativeId(friendId)}
			// The panel sits ON the identity, so it owns every touch inside its
			// outline: the cells claim theirs first (responder negotiation runs
			// child-first), and the paper between them stops here rather than
			// falling through to "open their profile" underneath.
			onStartShouldSetResponder={() => true}
			// No clip here: the slide is `ACTION_PANEL_TRAVEL`, shorter than the
			// trigger's clearance, so the whole panel stays inside the row and
			// fully visible from the first frame to the last. (2026-09-14)
			style={styles.actionPanelLayer}
			{...webKeys}
		>
			<Animated.View
				style={[
					styles.actionPanelSlide,
					{
						// Fades as it travels, so the short slide reads as arriving
						// rather than as a shutter.
						opacity: slide.interpolate({
							inputRange: [0, ACTION_PANEL_TRAVEL],
							outputRange: [1, 0],
						}),
						transform: [{ translateX: slide }],
					},
				]}
			>
			<Sticker
				color="cream2"
				rotate={0}
				radius={RADII.md}
				border={BORDER.ink}
				shadow="none"
				style={styles.actionPanel}
			>
				{actions.map((action, i) => (
					<ActionCell
						key={action.key}
						fill={action.fill}
						art={action.art}
						label={action.label}
						sub={action.sub}
						tier={tier}
						disabled={action.disabled}
						armed={action.armed}
						onPress={() => {
							action.onPress();
							if (action.closesOnPress) {
								onRequestClose();
								onReturnFocus();
							}
						}}
						accessibilityLabel={action.accessibilityLabel}
						accessibilityHint={action.accessibilityHint}
						testID={action.testID}
						cellRef={(host) => {
							cellHosts.current[i] = host;
						}}
					/>
				))}
			</Sticker>
			</Animated.View>
		</View>
	);
}

// The friend's identity, and behind the kebab every action it can take.
// The row's answer to a cast: "blessed · Cloud Nine" on the friend's meta line,
// arriving on a short fade so the eye finds the row that changed. It reads from
// the caster's memory, not from the outcome event, so a friend who already had
// today's ritual before this session says the same thing as one you just cast
// on — both mean the same. Under Reduce Motion it is simply there.
function RitualCastNotice({
	mode,
	name,
	caster,
}: {
	mode: RitualMode;
	name: string;
	caster: UseRitualCaster;
}) {
	const door = RITUAL_DOOR[mode];
	const ritual = caster.today(mode);
	const { reduceMotion } = useMotionPolicy();
	const [opacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
	useEffect(() => {
		if (reduceMotion) return;
		Animated.timing(opacity, {
			toValue: 1,
			duration: MOTION.fade,
			useNativeDriver: true,
		}).start();
	}, [opacity, reduceMotion]);
	return (
		<>
			<View style={styles.rowMetaDot} />
			<Animated.View
				style={[styles.rowMetaLine, { opacity }]}
				accessible
				accessibilityLabel={`${door.done} ${name} with ${ritual.name} today`}
				testID={`ritual-notice-${mode}`}
			>
				<Glyph name={door.glyph} size={SPACE.md} />
				<T
					role="kicker"
					tone="accent"
					numberOfLines={1}
					maxFontSizeMultiplier={ROW_TYPE_CAP}
					style={styles.rowSubItem}
				>
					{door.done.toLowerCase()} · {ritual.name}
				</T>
			</Animated.View>
		</>
	);
}

const FriendRow = React.memo(function FriendRow({
	friend,
	index,
	crewName,
	s1,
	caster,
	onRitualOutcome,
	visitsSpent,
	visitsLeft,
	pairSpent,
	visitStreak,
	wish,
	haveWish,
	isFav,
	menuOpen,
	onToggleMenu,
	onCloseMenu,
	onOpenRefs,
	onToggleFavorite,
	onPick,
	onVisit,
}: {
	friend: Profile;
	index: number;
	crewName: string | undefined;
	s1: boolean;
	caster: UseRitualCaster;
	onRitualOutcome: (mode: RitualMode, name: string, outcome: CastOutcome) => void;
	visitsSpent: boolean;
	visitsLeft: number | null | undefined;
	pairSpent: boolean;
	visitStreak: FriendVisitStreak | undefined;
	/** Their pig's wish, and whether my Satchel holds it (the wish mark). */
	wish: FriendWish | undefined;
	haveWish: boolean;
	isFav: boolean;
	/** This row's panel is the one panel that's out. */
	menuOpen: boolean;
	onToggleMenu: (friendId: string) => void;
	onCloseMenu: () => void;
	/** Hands the open panel + trigger to the list, for the outside-tap test. */
	onOpenRefs: (friendId: string, refs: OpenMenuRefs | null) => void;
	onToggleFavorite: (friendId: string) => void;
	onPick: (id: string) => void;
	onVisit: (friend: Profile) => void;
}) {
	const f = friend;
	const id = f.id;
	const name = f.username ?? "friend";
	const wears = hatName(f);
	// The cells' type tier follows the window, never a stored breakpoint.
	const { width } = useWindowDimensions();
	const tier = actionCellTier(width);
	// This pair is tickled today (per-pair 24h lock). Compose with the global
	// gate: the visit cell disables if EITHER is spent.
	const rowSpent = visitsSpent || pairSpent;

	const triggerRef = useRef<View | null>(null);
	const panelRef = useRef<View | null>(null);

	const bless = useRitualDoor({
		mode: "bless",
		name,
		targetUserId: id,
		caster,
		onOutcome: onRitualOutcome,
	});
	const curse = useRitualDoor({
		mode: "curse",
		name,
		targetUserId: id,
		caster,
		onOutcome: onRitualOutcome,
	});

	// An arm you cannot see is an arm that fires by surprise: the curse drops
	// its arm with the panel, as well as on the hook's own timer.
	const { disarm } = curse;
	useEffect(() => {
		if (!menuOpen) disarm();
	}, [disarm, menuOpen]);

	// While this row's panel is out, the list holds its two boxes so a touch
	// anywhere else can close it without a full-screen scrim.
	useEffect(() => {
		if (!menuOpen) return;
		onOpenRefs(id, { panel: panelRef, trigger: triggerRef });
		return () => onOpenRefs(id, null);
	}, [id, menuOpen, onOpenRefs]);

	const focusTrigger = useCallback(() => focusHost(triggerRef.current), []);
	const toggleMenu = useCallback(() => onToggleMenu(id), [id, onToggleMenu]);
	const pickProfile = useCallback(() => onPick(id), [id, onPick]);
	const visitBarn = useCallback(() => onVisit(f), [f, onVisit]);
	const togglePin = useCallback(
		() => onToggleFavorite(id),
		[id, onToggleFavorite]
	);
	const pressCurse = curse.press;

	const visitSub = visitsSpent
		? "None left"
		: pairSpent
			? "Tickled today"
			: typeof visitsLeft === "number"
				? `${visitsLeft} left`
				: "";

	const actions = useMemo<RowAction[]>(
		() => [
			{
				key: "visit",
				label: "Visit",
				sub: visitSub,
				art: <GameIcon name="visit" size={tier.glyph} muted={rowSpent} />,
				fill: WHIMSY.sky,
				disabled: rowSpent,
				closesOnPress: true,
				onPress: visitBarn,
				accessibilityLabel: visitsSpent
					? "All tickled out — your snout needs a rest"
					: pairSpent
						? `You've tickled ${name}'s barn today — come back tomorrow.`
						: `Visit ${name}'s barn`,
				accessibilityHint: rowSpent
					? "Your barn visits come back later today"
					: "Opens their barn so you can tickle their pig",
				testID: `friend-menu-visit-${id}`,
			},
			// Today's blessing and today's curse — the same machine, at the same
			// scale as everything else the row can do.
			{
				key: "bless",
				label: bless.copy.action,
				sub: bless.sub,
				art: ritualArt("bless", bless, tier),
				fill: bless.copy.fill,
				disabled: bless.disabled,
				closesOnPress: true,
				onPress: bless.press,
				accessibilityLabel: bless.label,
				accessibilityHint: bless.hint,
				testID: `friend-menu-bless-${id}`,
			},
			{
				key: "curse",
				// The arm has to be visible without a state line: the label flips
				// with the heavy border, so "tap twice" reads as Curse → Again.
				label: curse.armed ? "Again" : curse.copy.action,
				sub: curse.sub,
				art: ritualArt("curse", curse, tier),
				fill: curse.copy.fill,
				disabled: curse.disabled,
				armed: curse.armed,
				// The first tap arms and the panel stays out; the second casts
				// and closes.
				closesOnPress: curse.armed,
				onPress: pressCurse,
				accessibilityLabel: curse.label,
				accessibilityHint: curse.hint,
				testID: `friend-menu-curse-${id}`,
			},
			{
				key: "pin",
				label: isFav ? "Unpin" : "Pin",
				art: <GameIcon name="pin" size={tier.glyph} />,
				fill: "paper",
				closesOnPress: true,
				onPress: togglePin,
				accessibilityLabel: isFav
					? `Unpin ${name} from the top`
					: `Pin ${name} to the top`,
				accessibilityHint: isFav
					? "Returns them to alphabetical order"
					: "Floats them to the top of your list",
				testID: `friend-menu-pin-${id}`,
			},
			{
				key: "profile",
				label: "Profile",
				art: (
					<Icon
						name="user"
						size={tier.glyph}
						color={UI_COLORS.textPrimary}
						strokeWidth={BORDER.ink}
					/>
				),
				fill: "paper",
				closesOnPress: true,
				onPress: pickProfile,
				accessibilityLabel: `Open ${name}'s profile`,
				accessibilityHint: "Ask for tickles or block them",
				testID: `friend-menu-profile-${id}`,
			},
		],
		[
			bless,
			curse,
			id,
			isFav,
			name,
			pairSpent,
			pickProfile,
			pressCurse,
			rowSpent,
			tier,
			togglePin,
			visitBarn,
			visitSub,
			visitsSpent,
		]
	);

	return (
		<ListRow
			index={index}
			// The identity IS the profile door — the same place the menu's Profile
			// cell goes. A name you can read is a name you can tap.
			onPress={pickProfile}
			// A pinned row straightens and takes the heavy outline (ListRow's own
			// selected chrome).
			selected={isFav}
			testID={`friend-row-${id}`}
			accessibilityLabel={`${name}${f.discriminator ? ` #${f.discriminator}` : ""}${
				isFav ? ", pinned" : ""
			}`}
			accessibilityHint="Opens their profile"
			style={styles.friendRow}
			leading={
				/* PigAvatar instead of the initial circle — the equipped hat shows
				   up as an inline icon on the pig sprite, so the sounder reads what
				   each friend is currently wearing at a glance. */
				<View style={styles.rowPigWrap}>
					<PrestigeAvatar
						size={(f.wallow_count ?? 0) > 0 ? PIG_SPRITE_PRESTIGE : PIG_SPRITE}
						hatId={f.active_hat_id ?? null}
						prestigeLevel={f.wallow_count}
					/>
				</View>
			}
			title={
				<View style={styles.rowNameLine}>
					<T
						role="numeral"
						numberOfLines={1}
						maxFontSizeMultiplier={ROW_TYPE_CAP}
						style={styles.rowName}
					>
						{f.username ?? "—"}
					</T>
					{/* The friend code rides the name line as a lookup, one tier
					    down in secondary ink: the name is the identity. */}
					{!!f.discriminator && (
						<Label
							tone="secondary"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
						>
							#{f.discriminator}
						</Label>
					)}
					{/* Pinned is visible without opening anything — the pushpin the
					    menu's Pin cell drives, sitting on the name it kept. */}
					{isFav && <GameIcon name="pin" size={SPACE.lg} />}
				</View>
			}
			sub={
				/* ONE line under the name — tickles · live streak · wears · herd —
				   dotted apart and free to wrap when a herd name runs long. A
				   resting streak says nothing here: a flame labelled "resting"
				   read as nonsense on the row, and the profile sheet keeps the
				   longest run. The row is two lines, build 179's height.
				   (2026-09-14) */
				<View style={styles.rowMeta}>
					<View style={styles.rowMetaLine}>
						<Glyph name="heart" size={SPACE.md} />
						<T
							role="kicker"
							tone="secondary"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
						>
							{(f.tickles_earned ?? 0).toLocaleString()}
						</T>
						{!s1 && typeof f.alignment_score === "number" && (
							<AlignmentBadge score={f.alignment_score} size="sm" compact />
						)}
					</View>
					{visitStreak?.active && visitStreak.current_streak > 0 ? (
						<>
							<View style={styles.rowMetaDot} />
							<View
								style={styles.rowMetaLine}
								accessible
								accessibilityLabel={`Visit streak with ${name}, ${visitStreak.current_streak} days; longest ${visitStreak.longest_streak} days.`}
							>
								<Glyph name="flame" size={SPACE.md} />
								<T
									role="kicker"
									tone="secondary"
									numberOfLines={1}
									maxFontSizeMultiplier={ROW_TYPE_CAP}
								>
									{`${visitStreak.current_streak} day${visitStreak.current_streak === 1 ? "" : "s"}`}
								</T>
							</View>
						</>
					) : null}
					{/* The wish mark: their pig wants a thing you are carrying. The
					    entire discovery surface for the Satchel — no list of who
					    wants what, just the rows where you can act. */}
					{haveWish && wish ? (
						<>
							<View style={styles.rowMetaDot} />
							<View
								style={styles.rowMetaLine}
								accessible
								accessibilityLabel={`Their pig is hoping for ${satchelFind(wish.find_id)?.withArticle ?? "a find"} — you have one.`}
								testID="friend-wish-mark"
							>
								<FindArt id={wish.find_id} size={SPACE.lg} />
								<T
									role="kicker"
									tone="accent"
									numberOfLines={1}
									maxFontSizeMultiplier={ROW_TYPE_CAP}
								>
									you have it
								</T>
							</View>
						</>
					) : null}
					{!!wears && (
						<>
							<View style={styles.rowMetaDot} />
							<T
								role="kicker"
								tone="secondary"
								numberOfLines={1}
								maxFontSizeMultiplier={ROW_TYPE_CAP}
								style={styles.rowSubItem}
							>
								wears {wears}
							</T>
						</>
					)}
					{!!crewName && (
						<>
							<View style={styles.rowMetaDot} />
							<T
								role="kicker"
								tone="accent"
								numberOfLines={1}
								maxFontSizeMultiplier={ROW_TYPE_CAP}
								style={styles.rowSubItem}
							>
								in {crewName}
							</T>
						</>
					)}
					{/* The cast's answer, on the row it landed on: once this friend
					    has today's ritual from you the line says so, and keeps
					    saying so until the day resets. (2026-09-14) */}
					{bless.state === "settled" && (
						<RitualCastNotice mode="bless" name={name} caster={caster} />
					)}
					{curse.state === "settled" && (
						<RitualCastNotice mode="curse" name={name} caster={caster} />
					)}
				</View>
			}
			trailing={
				<RowMenuTrigger
					ref={triggerRef}
					friendId={id}
					name={name}
					expanded={menuOpen}
					onPress={toggleMenu}
				/>
			}
			// After the rail, never before it: focus order is tree order, so a
			// screen reader reaches the trigger and then what it opened. (req 4)
			after={
				<RowActionsPanel
					friendId={id}
					name={name}
					actions={actions}
					open={menuOpen}
					tier={tier}
					panelRef={panelRef}
					onRequestClose={onCloseMenu}
					onReturnFocus={focusTrigger}
				/>
			}
		/>
	);
});

// ── Today's two allowances, in one line ───────────────────────────
// "Three glimmer left · three truffle left" — the whole of what the list needs
// to say about today's rituals. The names of the day's blessing and curse, their
// art and what they do to a friend live where a player has asked for them: the
// explain sheet each half opens, the row's action panel, and the row's own cast
// notice. Above the list they were two chips and two captions of copy nobody
// asked for. (2026-09-14)
//
// "glimmer" is the day's blessing and "truffle" the day's curse — the founder's
// words, and the only place in the app that abbreviates a ritual to its feel.
function CountHalf({
	mode,
	text,
	onPress,
}: {
	mode: RitualMode;
	text: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			// The line stays a line; the frame reaches TAP_MIN around it.
			hitSlop={{ top: COUNT_HIT, bottom: COUNT_HIT }}
			accessibilityRole="button"
			accessibilityLabel={text}
			accessibilityHint={`Opens what today's ${RITUAL_DOOR[mode].word} does`}
			testID={`ritual-strip-${mode}`}
			style={({ pressed }) => (pressed ? PRESSED_FLAT : undefined)}
		>
			<T role="kicker" tone="secondary">
				{text}
			</T>
		</Pressable>
	);
}

// The one-time "out of visits" hint. The global gate, said once above the list
// rather than on every row.
function VisitsSpentHint() {
	return (
		<Sticker
			color={WHIMSY.slopBand}
			rotate={0}
			shadow="sm"
			style={styles.visitsSpentHint}
		>
			<GameIcon name="visit" size={SPACE.card} muted />
			<T role="kicker">all tickled out — your snout needs a rest</T>
		</Sticker>
	);
}

function RitualCountLine({
	bless,
	curse,
	onExplain,
}: {
	bless: RitualUsage;
	curse: RitualUsage;
	onExplain: (mode: RitualMode) => void;
}) {
	return (
		<View style={styles.countLine}>
			<CountHalf
				mode="bless"
				text={`${countWord(bless.remaining)} glimmer left`}
				onPress={() => onExplain("bless")}
			/>
			{/* `·` is typography, not an icon (the 2026-07-13 dingbat ruling). */}
			<T role="kicker" tone="secondary">
				·
			</T>
			<CountHalf
				mode="curse"
				text={`${countWord(curse.remaining).toLowerCase()} truffle left`}
				onPress={() => onExplain("curse")}
			/>
		</View>
	);
}

// Exported for the friend-row ritual-door tests, which drive the list directly
// rather than through the whole Friends hub.
export function FriendsList({
	friends,
	crewNames,
	loaded,
	loadFailed,
	onRetry,
	visitsSpent,
	visitsLeft,
	pairLocked,
	visitStreaks,
	friendWishes,
	myBag,
	favorites,
	onToggleFavorite,
	onPick,
	onVisit
}: {
	friends: Profile[];
	crewNames: Map<string, string>;
	// The first read has landed. Before it does, the list is unknown.
	loaded: boolean;
	// The last `friend_ids` read came back null — unknown, not empty.
	loadFailed: boolean;
	onRetry: () => void;
	// You've spent your window-global barn budget → every row's visit button
	// dims + disables, with a single day-rhythm hint above the list (never per
	// row, and never a countdown). This is the GLOBAL "tickled out" state.
	visitsSpent: boolean;
	// The window-global budget, when it's known — the Visit cell's state line
	// says how many barns are left rather than making the player count.
	visitsLeft?: number | null;
	// Friend ids you've already tickled today (per-pair 24h lock). These rows
	// dim + disable their visit door individually with a "tickled today" tag —
	// the PER-PAIR state. Composes with visitsSpent, but the global gate wins
	// (uniform dim + header hint, no per-row tags — avoid tag spam).
	pairLocked: Set<string>;
	visitStreaks: Map<string, FriendVisitStreak>;
	friendWishes: Map<string, FriendWish>;
	myBag: SatchelItem[];
	// The caller's pinned friends — sorted to the top, star lit sun-gold.
	favorites: Set<string>;
	onToggleFavorite: (friendId: string) => void;
	onPick: (id: string) => void;
	onVisit: (friend: Profile) => void;
}) {
	// Alignment isn't a thing in Season 1 — the badge retires with S0.
	const s1 = useSeason1Active();
	// One caster for the whole list: one `ritual_status` read, one allowance
	// every door and the strip agree on, one memory of who's already had today's
	// ritual from you.
	const caster = useRitualCaster();
	// A cast that LANDS is answered on the row itself — the friend's line grows
	// a "blessed · Cloud Nine" notice (see `RitualCastNotice`), so the toast
	// would only say the same thing somewhere else. Only a refusal still needs
	// the transient surface, because the row has nothing new to show for it.
	// (2026-09-14)
	const onRitualOutcome = useCallback(
		(mode: RitualMode, name: string, outcome: CastOutcome) => {
			const door = RITUAL_DOOR[mode];
			if (outcome.kind === "sent") return;
			if (outcome.kind === "done") {
				showToast({
					tone: "fail",
					title: `${name} already has today's ${door.word}`,
					text: `Next ${door.word} in ${untilDailyReset()} — one per friend a day.`,
				});
			} else if (outcome.kind === "capped") {
				showToast({
					tone: "fail",
					title: `Today's ${door.word}s are spent`,
					text: `Your next is in ${untilDailyReset()}.`,
				});
			} else {
				showToast({ tone: "fail", title: outcome.text });
			}
		},
		[]
	);
	// Pins first, then names the way a person reads them, then two tie-breakers
	// so no two rows can ever swap places between renders. The rules live in
	// `utils/friendOrder` where they can be tested without a list.
	const sorted = useMemo(
		() => [...friends].sort((a, b) => compareFriends(a, b, favorites)),
		[favorites, friends]
	);

	// ── The one open menu ─────────────────────────────────────────
	// One value for the whole list, never one per row: "only one open" and
	// "switching rows switches the panel" both fall out of the type.
	const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
	const toggleMenu = useCallback(
		(friendId: string) =>
			setOpenMenuFor((cur) => (cur === friendId ? null : friendId)),
		[]
	);
	const closeMenu = useCallback(() => setOpenMenuFor(null), []);

	// Which of today's two rituals has its sheet open — the strip's capsules
	// are its doors. One value, like the menu: the sheet is one panel.
	const [explain, setExplain] = useState<RitualMode | null>(null);
	const closeExplain = useCallback(() => setExplain(null), []);

	// A reload or a re-sort under the thumb must not carry an open panel.
	useEffect(() => setOpenMenuFor(null), [friends]);
	// Leaving the tab closes it too — nothing stays out behind your back.
	useFocusEffect(useCallback(() => () => setOpenMenuFor(null), []));

	// Android's back button closes the panel before it leaves the screen.
	useEffect(() => {
		if (!openMenuFor) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			closeMenu();
			return true;
		});
		return () => sub.remove();
	}, [closeMenu, openMenuFor]);

	// The open row hands up its panel + trigger; a touch outside both closes.
	const openRefs = useRef<(OpenMenuRefs & { id: string }) | null>(null);
	const onOpenRefs = useCallback(
		(friendId: string, refs: OpenMenuRefs | null) => {
			if (!refs) {
				// A switch registers B before A tears down, so only the row that
				// still owns the slot may clear it.
				if (openRefs.current?.id === friendId) openRefs.current = null;
				return;
			}
			openRefs.current = { id: friendId, ...refs };
		},
		[]
	);

	// Native: a capture-phase hit test on the list's own root. The touch is
	// never claimed and never prevented, so a tap on ANOTHER row's trigger
	// closes this one and opens that one in the same gesture.
	const onListTouchStart = useCallback(
		(event: GestureResponderEvent) => {
			const open = openRefs.current;
			if (!open) return;
			const { pageX, pageY } = event.nativeEvent;
			const hosts = [open.panel.current, open.trigger.current].filter(
				(h): h is View => !!h
			);
			if (hosts.length === 0) {
				closeMenu();
				return;
			}
			let pending = hosts.length;
			let inside = false;
			for (const host of hosts) {
				host.measureInWindow((x, y, w, h) => {
					if (pageX >= x && pageX <= x + w && pageY >= y && pageY <= y + h) {
						inside = true;
					}
					pending -= 1;
					if (pending === 0 && !inside) closeMenu();
				});
			}
		},
		[closeMenu]
	);

	// Web has no touch responder to ride, so the same hit test runs as a
	// capture-phase `pointerdown` with `contains`.
	useEffect(() => {
		if (Platform.OS !== "web" || !openMenuFor) return;
		const onDown = (event: Event) => {
			const open = openRefs.current;
			if (!open) return;
			const target = event.target as Node | null;
			const boxes = [open.panel.current, open.trigger.current].map(
				(h) => h as unknown as HTMLElement | null
			);
			if (target && boxes.some((b) => b?.contains(target))) return;
			closeMenu();
		};
		document.addEventListener("pointerdown", onDown, true);
		return () => document.removeEventListener("pointerdown", onDown, true);
	}, [closeMenu, openMenuFor]);

	if (friends.length === 0) {
		return (
			<View style={styles.scroll}>
				{!loaded ? (
					<LoadingBeat label="rounding up your pals" />
				) : loadFailed ? (
					<EmptyState
						kind="error"
						title="Couldn't reach your sounder"
						sub="The bog ate that one. Give it another go."
						action={
							<Button
								variant="ghost"
								size="sm"
								onPress={onRetry}
								accessibilityLabel="Try loading your friends again"
								accessibilityHint="Re-reads your friend list"
							>
								Try again
							</Button>
						}
					/>
				) : (
					<EmptyState
						glyph="friends"
						title="No friends yet"
						sub="Tap Add to send your first request."
					/>
				)}
			</View>
		);
	}
	const atCap = sorted.length >= FRIEND_CAP_LIMIT;
	// Until `ritual_status` answers, today's allowance is UNKNOWN — so the line
	// is not there at all. A "— left" placeholder that fills in under the thumb
	// is the same lie as rendering a failed fetch as empty. (spec §3.4)
	const blessLeft = caster.usage("bless");
	const curseLeft = caster.usage("curse");
	// Nothing to say → no header at all, so the list's own gap doesn't open a
	// step of paper above the first row for an empty box.
	const listHeader =
		blessLeft && curseLeft ? (
			<>
				<RitualCountLine
					bless={blessLeft}
					curse={curseLeft}
					onExplain={setExplain}
				/>
				{visitsSpent && <VisitsSpentHint />}
			</>
		) : visitsSpent ? (
			<VisitsSpentHint />
		) : null;
	// The list's own root carries the outside-touch hit test: a capture-phase
	// read of every touch in the list, never a scrim over it.
	return (
		<View style={styles.listWrap} onTouchStart={onListTouchStart}>
			<FlatList
				style={styles.scroll}
				contentContainerStyle={styles.listContent}
				data={sorted}
				keyExtractor={(friend) => friend.id}
				initialNumToRender={10}
				maxToRenderPerBatch={8}
				windowSize={7}
				removeClippedSubviews
				showsVerticalScrollIndicator={false}
				// An anchored panel must not float off its row.
				onScrollBeginDrag={closeMenu}
				// The one thing that changes on the list when a menu opens; `memo`
				// prunes every row whose own `menuOpen` did not flip. (req 6)
				extraData={openMenuFor}
				ListHeaderComponent={listHeader}
				ListFooterComponent={
					atCap ? (
						<T role="kicker" tone="accent" align="center" style={styles.footerNote}>
							★ you're at the {FRIEND_CAP_LIMIT}-friend cap · remove someone to add new friends
						</T>
					) : null
				}
				renderItem={({ item: f, index: i }) => (
					<FriendRow
						friend={f}
						index={i}
						crewName={crewNames.get(f.id)}
						s1={s1}
						caster={caster}
						onRitualOutcome={onRitualOutcome}
						visitsSpent={visitsSpent}
						visitsLeft={visitsLeft}
						pairSpent={pairLocked.has(f.id)}
						visitStreak={visitStreaks.get(f.id)}
						wish={friendWishes.get(f.id)}
						haveWish={bagHasWishFor(myBag, friendWishes.get(f.id))}
						isFav={favorites.has(f.id)}
						menuOpen={openMenuFor === f.id}
						onToggleMenu={toggleMenu}
						onCloseMenu={closeMenu}
						onOpenRefs={onOpenRefs}
						onToggleFavorite={onToggleFavorite}
						onPick={onPick}
						onVisit={onVisit}
					/>
				)}
			/>
			<RitualExplainSheet mode={explain} caster={caster} onClose={closeExplain} />
		</View>
	);
}

// ── Add friend with autocomplete ──────────────────────────────────
function AddFriend({ userId, onSent }: { userId: string; onSent: () => void }) {
	const [query, setQuery] = useState("");
	// null = the search failed (unknown), [] = it ran and found nobody. Only []
	// gets the empty state. [B-09, spec §3.4]
	const [results, setResults] = useState<Profile[] | null>([]);
	const [searching, setSearching] = useState(false);
	const [sending, setSending] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");
	const [suggestions, setSuggestions] = useState<Profile[]>([]);
	const [searchNonce, setSearchNonce] = useState(0);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Load 3 suggested users on mount so the Add tab isn't a blank
	// search box. Uses suggested_users RPC: non-friends, no pending
	// requests, ordered random.
	useEffect(() => {
		getSuggestedUsers(3).then((data) => {
			setSuggestions(data ?? []);
		});
	}, []);

	// Debounced search-as-you-type. MOTION.debounce is short enough to feel
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
			setResults(data);
			setSearching(false);
		}, MOTION.debounce);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query, searchNonce]);

	const send = async (target: Profile) => {
		if (sending) return;
		setSending(target.id);
		setFeedback("");
		const r = await sendFriendRequest(target.username, target.discriminator ?? null);
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

	const addRow = (p: Profile, sub: string | undefined, index: number) => (
		<ListRow
			key={p.id}
			index={index}
			leading={<InitialAvatar name={p.username} />}
			title={
				<View style={styles.rowNameLine}>
					<T role="numeral" numberOfLines={1} style={styles.rowName}>
						{p.username}
					</T>
					{!!p.discriminator && <Label tone="secondary">#{p.discriminator}</Label>}
				</View>
			}
			sub={sub}
			trailing={
				<Button
					variant="lilac"
					size="xs"
					onPress={() => send(p)}
					loading={sending === p.id}
					accessibilityLabel={`Send ${p.username ?? "this pig"} a friend request`}
					accessibilityHint="They'll see it in their Inbox"
				>
					Add
				</Button>
			}
		/>
	);

	return (
		<View style={styles.addWrap}>
			{/* Search input in a cream container — matches the design's
			    search-as-paper-form look. */}
			<Sticker color="paper" rotate={0} style={styles.searchCard}>
				<TextField
					label="find a friend"
					icon="search"
					value={query}
					onChangeText={setQuery}
					placeholder="username#1234"
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</Sticker>

			{!!feedback && (
				<T role="kicker" tone="accent" style={styles.feedback}>
					{feedback}
				</T>
			)}
			{searching && <LoadingBeat label="asking around" />}

			{/* Real search results, when the user has typed. */}
			{!searching && !!results && results.length > 0 && (
				<View style={styles.rowStack}>
					{results.map((p, i) => addRow(p, undefined, i))}
				</View>
			)}

			{!searching && query.length >= 1 && results === null && (
				<EmptyState
					kind="error"
					title="The search didn't come back"
					sub="That one got lost in the bog. Try it again."
					action={
						<Button
							variant="ghost"
							size="sm"
							onPress={() => setSearchNonce((n) => n + 1)}
							accessibilityLabel="Search again"
							accessibilityHint="Re-runs the search for that username"
						>
							Try again
						</Button>
					}
				/>
			)}

			{!searching && query.length >= 1 && results !== null && results.length === 0 && (
				<EmptyState
					glyph="search"
					title="No users found"
					sub="Discriminators (#1234) are auto-assigned; ask your friend to share their code from their Account page."
				/>
			)}

			{/* Suggestions — 3 fresh non-friends served only when the
			    user isn't actively searching. Lets the Add tab feel
			    populated even before a search. From the redesign. */}
			{query.length === 0 && suggestions.length > 0 && (
				<>
					<KickerPill star={false} style={styles.sectionKicker}>
						suggestions
					</KickerPill>
					<View style={styles.rowStack}>
						{suggestions.map((p, i) => addRow(p, "suggested", i))}
					</View>
				</>
			)}

			{/* Referral footer — share-your-code call to action lives at
			    the bottom of the Add panel per the design. The actual
			    code lives on the Sounder/Account card; this is just a
			    nudge. */}
			{query.length === 0 && (
				<T role="kicker" tone="secondary" align="center" style={styles.footerNote}>
					★ share your code from{" "}
					<T role="kicker" style={styles.referralFooterBold}>
						Account
					</T>{" "}
					for 100 tickles
				</T>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	// No top margin: the hub's `PageHeader` already breathes under its rule, and
	// a second breath here is what put four stacked gaps between the crown and
	// the first friend. (2026-09-14)
	wrap: { flex: 1, paddingHorizontal: PAGE_PAD },
	// The list's own root, and the surface the outside-tap hit test listens on.
	listWrap: { flex: 1 },
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: TAB_SAFE },
	// Each row is its own tilted sticker now, so the stack needs a gutter
	// rather than a shared card edge.
	listContent: { paddingBottom: TAB_SAFE, gap: SPACE.sm },
	rowStack: { gap: SPACE.sm },
	// One step under the segment, and the list's own gap is the same step under
	// the count line: segment → counts → first row, all SPACE.sm. (2026-09-14)
	tabsRow: { marginBottom: SPACE.sm },
	rowNameLine: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.sm
	},
	rowName: { flexShrink: 1 },
	// The row's floor, so the open panel's cells always fit inside the height
	// the identity sets. Derived in `constants/layoutBreakpoints.ts`.
	friendRow: { minHeight: ROW_MIN_H },
	// Every sub-line child yields before the card edge does. Without this the
	// widest of them (the streak Tag, the ♥ meta line) sets the name column's
	// minimum width and shoves the rail off the row — the cut-off doors.
	rowSubItem: { flexShrink: 1, maxWidth: "100%" },
	// PigAvatar wrapper — a small ink-bordered tile so the sprite
	// reads as an avatar slot inside the row rather than a floating pig.
	// Matches the leaderboard ClippingRow's treatment.
	rowPigWrap: {
		width: PIG_TILE,
		height: PIG_TILE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden"
	},
	// The one meta line: count · streak · wears. It wraps rather than clips,
	// and every child yields before the card edge does.
	rowMeta: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: SPACE.sm
	},
	rowMetaLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm
	},
	rowMetaDot: {
		width: BORDER.heavy,
		height: BORDER.heavy,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.uiMuted
	},
	// Today's two allowances, in one line. No margins of its own: the segment's
	// bottom step sits above it and the list's own gap below, so the rhythm from
	// the segment to the first row is one SPACE.sm three times over. It wraps
	// rather than clips when Dynamic Type runs the two halves past the edge.
	countLine: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: SPACE.xs
	},
	// The sliding layer the panel rides. Absolute inside the row, so the row's
	// height is the identity's and the list never reflows. Yoga measures an
	// inset-positioned child against the parent's PADDING BOX (its border, not
	// its padding), which is what `ACTION_PANEL_INSETS.right` clears: the row's
	// own side pad plus the 44pt trigger plus a gap. It may cover the avatar;
	// it may never cover the trigger.
	actionPanelLayer: {
		position: "absolute",
		top: ACTION_PANEL_INSETS.top,
		bottom: ACTION_PANEL_INSETS.bottom,
		left: ACTION_PANEL_INSETS.left,
		right: ACTION_PANEL_INSETS.right
	},
	// The moving part: fills the clip box and carries the translate.
	actionPanelSlide: { flex: 1 },
	// The panel itself — five equal cells on cream paper, and a hard clip so a
	// cell can never paint past the outline.
	actionPanel: {
		flex: 1,
		flexDirection: "row",
		alignItems: "stretch",
		gap: SPACE.xs,
		padding: SPACE.xs,
		overflow: "hidden"
	},
	actionCell: {
		flex: 1,
		minWidth: 0,
		minHeight: TAP_MIN,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xxs,
		padding: SPACE.xxs
	},
	// The cast ritual's own art, riding the cell once it's been sent — sized by
	// the cell's tier, so only the fit lives here.
	actionArt: { resizeMode: "contain" },
	// One-time "out of visits" hint above the list. Its gap BELOW is the list's
	// own; only the step off the count line is its own to spend.
	visitsSpentHint: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm
	},
	// Add panel — paper sticker holding the one labelled field.
	searchCard: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.card },
	sectionKicker: { marginTop: SPACE.sm },
	footerNote: { marginTop: SPACE.lg },
	referralFooterBold: {
		fontFamily: FONTS.bodyBlack
	},
	addWrap: { gap: SPACE.md },
	feedback: {
		paddingHorizontal: SPACE.xs
	}
});
