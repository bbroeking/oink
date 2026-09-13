import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Animated,
	LayoutAnimation,
	Platform,
	StyleSheet,
	UIManager,
	View,
	Image,
	ScrollView,
	FlatList,
	type ImageSourcePropType
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { supabase } from "../utils/supabase";
import { rpcAction } from "@/utils/rpc";
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
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { type UseCrew } from "@/hooks/useCrew";
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
	Kicker,
	KickerPill,
	Label,
	ListRow,
	LoadingBeat,
	PrestigeAvatar,
	SegmentedControl,
	Sticker,
	T,
	Tag,
	TextField,
	type AvatarFill,
	type SegmentOption,
} from "@/components/ui";
import { UserSheet } from "./UserSheet";
import { GameIcon } from "./ui/GameIcon";
import { BarnVisitModal } from "./BarnVisitModal";
import {
	AVATAR_SIZE,
	BORDER,
	FONTS,
	MOTION,
	MOTION_SPRING,
	PAGE_PAD,
	RADII,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	MOTION_DURATION,
	useMotionPolicy,
	type MotionPolicy,
} from "@/hooks/useMotionPolicy";
import { PorchRoundLaunchCard } from "./PorchRoundLaunchCard";
import { showToast } from "@/components/ui/Toast";
import {
	useRitualCaster,
	type CastOutcome,
	type UseRitualCaster,
} from "@/hooks/useRitualCaster";
import {
	RITUAL_DOOR,
	useRitualDoor,
	type RitualDoorView,
} from "@/hooks/useRitualDoor";
import { untilDailyReset, type RitualMode } from "@/utils/rituals";
import {
	fetchFriendVisitStreaks,
	type FriendVisitStreak,
} from "@/utils/visitStreaks";

// Android's old architecture keeps LayoutAnimation behind an opt-in flag (the
// same guard `BarnUpdatesTray` carried). Harmless everywhere else.
if (
	Platform.OS === "android" &&
	typeof UIManager.setLayoutAnimationEnabledExperimental === "function"
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// Drawing geometry for the row's pig tile and its one small round control.
// Diameters, not spacing steps: the tile is a frame the sprite is drawn inside
// (the `Avatar` precedent), and the control restores the 44pt frame with
// hitSlop rather than by inflating the circle.
const PIG_TILE = AVATAR_SIZE[1];
const PIG_SPRITE = 36;
const PIG_SPRITE_PRESTIGE = 48;
const ROW_CONTROL = SPACE.xxl;
// The chevron that opens the tray. `Icon`'s box, not a spacing step.
const ROW_CHEVRON = SPACE.lg;

const RAIL_GAP = SPACE.sm; // between the blessing door and the chevron
// The identity stays compact; the expanded actions can wrap at large text sizes.
const ROW_TYPE_CAP = 1.3;

export default function Friends({
	userId,
	crewHook,
	onViewSounder
}: {
	userId: string;
	crewHook?: UseCrew;
	onViewSounder?: () => void;
}) {
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
	const [porchRefreshKey, setPorchRefreshKey] = useState(0);

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
				const [st, locks, streaks] = await Promise.all([
					rpcAction<{
						visits_left?: number | null;
						visits_refresh_at?: string | null;
					}>("barn_visit_status", { p_target: probe.id }),
					rpcAction<{
						pairs?: { target_id: string; locked: boolean }[];
					}>("barn_pair_locks", { p_targets: list.map((p) => p.id) }),
					fetchFriendVisitStreaks(list.map((p) => p.id)),
				]);
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
			}
		} else {
			setFriends([]);
			setCrewNames(new Map());
			setVisitsLeft(null);
			setPairLocked(new Set());
			setFavorites(new Set());
			setVisitStreaks(new Map());
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
					favorites={favorites}
					onToggleFavorite={toggleFavorite}
					onPick={setSelectedUserId}
					onVisit={(f) => setVisiting({ id: f.id, name: f.username ?? "friend" })}
					header={
						<>
							<PorchRoundLaunchCard refreshKey={porchRefreshKey} />
							{crewHook?.crew.crew ? (
								<ListRow
									fill="sun"
									tilt={false}
									onPress={onViewSounder}
									accessibilityLabel={`Your Sounder, ${crewHook.crew.crew.name}`}
									accessibilityHint="Opens your Sounder"
									leading={
										<Icon
											name="crown"
											size={SPACE.xl}
											color={UI_COLORS.textPrimary}
											strokeWidth={BORDER.ink}
										/>
									}
									title={
										<>
											<Kicker>your Sounder</Kicker>
											<CardTitle numberOfLines={1}>
												{crewHook.crew.crew.name}
											</CardTitle>
										</>
									}
									trailing={
										<Icon
											name="chevronRight"
											size={SPACE.lg}
											color={UI_COLORS.textSecondary}
										/>
									}
								/>
							) : null}
						</>
					}
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
							setPorchRefreshKey((key) => key + 1);
						}}
					/>
				) : null}
			</Ceremony>
		</View>
	);
}

// ── Friends list ──────────────────────────────────────────────────
// Each row reveals its quick actions below the friend's identity.
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
			size={PIG_TILE}
			fill={tintFor(name)}
			label={name ?? "Unknown pig"}
		>
			<CardTitle align="center">{initial}</CardTitle>
		</Avatar>
	);
}

// ── The one ritual door that stays out ────────────────────────────
// There is exactly ONE blessing and ONE curse a day, so the picker never picked
// anything — the only decision is WHO. Today's blessing keeps a round door on
// the rail (one tap, always reachable); the curse moved into the tray, where it
// has room to say what it is before it fires. Both are `useRitualDoor`.
function RitualDoor({
	mode,
	targetUserId,
	door,
}: {
	mode: RitualMode;
	targetUserId: string;
	door: RitualDoorView;
}) {
	return (
		<Sticker
			color={door.copy.fill}
			rotate={0}
			radius={RADII.pill}
			// Armed is the row's "selected" chrome — a heavier outline, never a
			// color change alone (design-system spec §3.3).
			border={door.armed ? BORDER.heavy : BORDER.ink}
			shadow="none"
			disabled={door.disabled}
			onPress={door.press}
			hitSlop={SPACE.sm}
			accessibilityLabel={door.label}
			accessibilityHint={door.hint}
			accessibilityState={{ disabled: door.disabled, expanded: door.armed || undefined }}
			testID={`ritual-door-${mode}-${targetUserId}`}
			style={styles.rowVisitBtn}
		>
			{door.icon ? (
				<Image source={door.icon} style={styles.rowRitualIcon} />
			) : (
				<GameIcon name={mode} size={SPACE.xl} muted={door.disabled} />
			)}
		</Sticker>
	);
}

// The chevron that opens the tray — the row's one "there is more here" mark.
// It flips 180° rather than swapping art, so open and closed are the same
// object seen from two sides. Instant under Reduce Motion.
function RowChevron({ expanded, policy, name, onPress }: {
	expanded: boolean;
	policy: MotionPolicy;
	name: string;
	onPress: () => void;
}) {
	const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current;
	useEffect(() => {
		const to = expanded ? 1 : 0;
		if (!policy.allowDecorativeMotion) {
			spin.setValue(to);
			return;
		}
		const anim = Animated.spring(spin, {
			toValue: to,
			...MOTION_SPRING.settle,
			useNativeDriver: true,
		});
		anim.start();
		return () => anim.stop();
	}, [expanded, policy.allowDecorativeMotion, spin]);
	return (
		<Animated.View
			style={{
				transform: [
					{
						rotate: spin.interpolate({
							inputRange: [0, 1],
							outputRange: ["0deg", "180deg"],
						}),
					},
				],
			}}
		>
			<IconButton
				name="chevronDown"
				iconSize={ROW_CHEVRON}
				visualSize={ROW_CONTROL}
				variant="none"
				color={UI_COLORS.textSecondary}
				label={`${expanded ? "Hide" : "Show"} quick actions for ${name}`}
				onPress={onPress}
			/>
		</Animated.View>
	);
}

// The two main actions share a full-width row. Their status stays readable at
// every phone width, and the text can grow with Dynamic Type.
function TrayCell({
	fill,
	action,
	art,
	label,
	sub,
	onPress,
	disabled,
	armed,
	accessibilityLabel,
	accessibilityHint,
	testID,
}: {
	fill: string;
	action: "visit" | "curse";
	art?: ImageSourcePropType | null;
	label: string;
	sub: string;
	onPress: () => void;
	disabled?: boolean;
	armed?: boolean;
	accessibilityLabel: string;
	accessibilityHint?: string;
	testID?: string;
}) {
	return (
		<Sticker
			color={fill}
			rotate={0}
			radius={RADII.md}
			border={armed ? BORDER.heavy : BORDER.ink}
			shadow="none"
			disabled={disabled}
			onPress={onPress}
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: !!disabled, expanded: armed || undefined }}
			testID={testID}
			style={styles.trayCell}
		>
			{art ? (
				<Image source={art} style={styles.trayArt} />
			) : (
				<GameIcon name={action} size={SPACE.xl} muted={disabled} />
			)}
			<View style={styles.trayCopy}>
				<T role="body" tone={disabled ? "secondary" : "primary"}>{label}</T>
				{sub ? <T role="bodySm" tone="secondary">{sub}</T> : null}
			</View>
		</Sticker>
	);
}

function RowTray({ open, testID, children }: {
	open: boolean;
	testID: string;
	children: React.ReactNode;
}) {
	if (!open) return null;
	return <View testID={testID} style={styles.tray}>{children}</View>;
}

// The friend's identity and blessing stay visible while the actions unfold.
function FriendRow({
	friend,
	index,
	crewName,
	s1,
	caster,
	onRitualOutcome,
	expanded,
	onToggle,
	onClose,
	policy,
	visitsSpent,
	visitsLeft,
	pairSpent,
	visitStreak,
	isFav,
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
	expanded: boolean;
	onToggle: () => void;
	onClose: () => void;
	policy: MotionPolicy;
	visitsSpent: boolean;
	visitsLeft: number | null | undefined;
	pairSpent: boolean;
	visitStreak: FriendVisitStreak | undefined;
	isFav: boolean;
	onToggleFavorite: (friendId: string) => void;
	onPick: (id: string) => void;
	onVisit: (friend: Profile) => void;
}) {
	const f = friend;
	const name = f.username ?? "friend";
	const wears = hatName(f);
	// This pair is tickled today (per-pair 24h lock). Compose with the global
	// gate: the visit cell disables if EITHER is spent.
	const rowSpent = visitsSpent || pairSpent;
	// Show the compact per-row "tickled today" tag only when it's THIS pair's
	// lock and the global gate is NOT spent — when the global hint is up it
	// speaks for the whole list, so tags down every row would just be spam.
	const showPairHint = pairSpent && !visitsSpent;

	const bless = useRitualDoor({
		mode: "bless",
		name,
		targetUserId: f.id,
		caster,
		onOutcome: onRitualOutcome,
	});
	const curse = useRitualDoor({
		mode: "curse",
		name,
		targetUserId: f.id,
		caster,
		onOutcome: onRitualOutcome,
	});

	// Closing the tray drops an armed curse. An arm you can no longer see is an
	// arm that fires by surprise.
	const { disarm } = curse;
	useEffect(() => {
		if (!expanded) disarm();
	}, [expanded, disarm]);

	// A tray action closes the row once it has fired — except the curse's FIRST
	// tap, which only arms and has to stay on screen to be tapped again.
	const runAndClose = (action: () => void) => {
		action();
		onClose();
	};
	const pressCurse = () => {
		const casts = curse.armed;
		curse.press();
		if (casts) onClose();
	};

	const visitSub = visitsSpent
		? "None left"
		: pairSpent
			? "Tickled today"
			: typeof visitsLeft === "number"
				? `${visitsLeft} left`
				: "";

	return (
		<ListRow
			index={index}
			onPress={onToggle}
			expanded={expanded}
			testID={`friend-row-${f.id}`}
			accessibilityLabel={`${name}${f.discriminator ? ` #${f.discriminator}` : ""}${
				isFav ? ", pinned" : ""
			}`}
			accessibilityHint={expanded ? "Hides quick actions" : "Shows quick actions"}
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
					{/* The same pushpin marks a friend kept at the top of the list. */}
					{isFav ? (
						<GameIcon name="pin" size={SPACE.lg} />
					) : null}
				</View>
			}
			sub={expanded ? (
				f.discriminator ? (
					<Label tone="secondary" maxFontSizeMultiplier={ROW_TYPE_CAP}>
						#{f.discriminator}
					</Label>
				) : undefined
			) : (
				<View style={styles.rowSub}>
					{/* The friend code rides the sub line, not the name line: the
					    name is the identity, the code is a lookup. (2026-09-12) */}
					{!!f.discriminator && (
						<Label
							tone="secondary"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
							style={styles.rowSubItem}
						>
							#{f.discriminator}
						</Label>
					)}
					{/* Second line — "wears X" when a hat is equipped. Falls back to
					    the ♥ + alignment meta so naked pigs aren't blank rows. */}
					{wears ? (
						<Label
							tone="secondary"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
							style={styles.rowSubItem}
						>
							wears {wears}
						</Label>
					) : (
						<View style={[styles.rowMetaLine, styles.rowSubItem]}>
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
								<>
									<View style={styles.rowMetaDot} />
									<AlignmentBadge score={f.alignment_score} size="sm" compact />
								</>
							)}
						</View>
					)}
					{/* Which herd they ride with — the Sounder is part of a pig's
					    identity now, so it reads at a glance. */}
					{!!crewName && (
						<T
							role="kicker"
							tone="accent"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
							style={styles.rowSubItem}
						>
							in {crewName}
						</T>
					)}
					{/* Per-pair "tickled today" — you've already visited this
					    friend's barn today. Suppressed when the global hint is up. */}
					{showPairHint && (
						<T
							role="kicker"
							tone="secondary"
							numberOfLines={1}
							maxFontSizeMultiplier={ROW_TYPE_CAP}
							style={styles.rowSubItem}
						>
							tickled today
						</T>
					)}
					{visitStreak && visitStreak.longest_streak > 0 ? (
						<Tag
							tone={visitStreak.active ? "sun" : "muted"}
							glyph="flame"
							label={
								visitStreak.active
									? `${visitStreak.current_streak} day${visitStreak.current_streak === 1 ? "" : "s"}`
									: `resting · best ${visitStreak.longest_streak}`
							}
							accessibilityLabel={
								visitStreak.active
									? `Visit streak with ${name}, ${visitStreak.current_streak} days; longest ${visitStreak.longest_streak} days.`
									: `Visit streak with ${name} is resting; longest ${visitStreak.longest_streak} days.`
							}
							style={styles.visitStreak}
						/>
					) : null}
				</View>
			)}
			footer={
				<RowTray open={expanded} testID={`friend-tray-${f.id}`}>
					<View style={styles.trayPrimary}>
						<TrayCell
							fill={WHIMSY.sky}
							action="visit"
							label="Visit"
							sub={visitSub}
							disabled={rowSpent}
							onPress={() => runAndClose(() => onVisit(f))}
							accessibilityLabel={
								visitsSpent
									? "All tickled out — your snout needs a rest"
									: pairSpent
										? `You've tickled ${name}'s barn today — come back tomorrow.`
										: `Visit ${name}'s barn`
							}
							accessibilityHint={
								rowSpent
									? "Your barn visits come back later today"
									: "Opens their barn so you can tickle their pig"
							}
							testID={`friend-visit-${f.id}`}
						/>
						<TrayCell
							fill={curse.copy.fill}
							action="curse"
							art={curse.icon}
							label={curse.copy.action}
							sub={
								curse.state === "capped" ? "None left"
									: curse.state === "settled" ? "Sent today"
										: curse.state === "busy" ? "Sending…"
											: curse.armed ? "Tap again" : "Tap twice"
							}
							disabled={curse.disabled}
							armed={curse.armed}
							onPress={pressCurse}
							accessibilityLabel={curse.label}
							accessibilityHint={curse.hint}
							testID={`ritual-door-curse-${f.id}`}
						/>
					</View>
					<View style={styles.traySecondary}>
						<Button
							variant="link"
							size="sm"
							icon={<GameIcon name="pin" size={SPACE.lg} />}
							style={styles.trayLink}
							onPress={() => runAndClose(() => onToggleFavorite(f.id))}
							accessibilityLabel={isFav ? `Unpin ${name} from the top` : `Pin ${name} to the top`}
							accessibilityHint={isFav ? "Returns them to alphabetical order" : "Floats them to the top of your list"}
							testID={`friend-pin-${f.id}`}
						>
							{isFav ? "Unpin" : "Pin"}
						</Button>
						<Button
							variant="link"
							size="sm"
							style={styles.trayLink}
							onPress={() => runAndClose(() => onPick(f.id))}
							accessibilityLabel={`Open ${name}'s profile`}
							accessibilityHint="Ask for tickles, visit their barn, or block them"
							testID={`friend-profile-${f.id}`}
						>
							Profile
						</Button>
					</View>
				</RowTray>
			}
			trailing={
				<View style={styles.rowActions}>
					{/* Today's blessing is the one option that stays out: one tap,
					    no arming, the thing you came to do. */}
					<View style={styles.rowBlessTarget}>
						<RitualDoor mode="bless" targetUserId={f.id} door={bless} />
					</View>
					<RowChevron expanded={expanded} policy={policy} name={name} onPress={onToggle} />
				</View>
			}
		/>
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
	favorites,
	onToggleFavorite,
	onPick,
	onVisit,
	header
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
	// The caller's pinned friends — sorted to the top, star lit sun-gold.
	favorites: Set<string>;
	onToggleFavorite: (friendId: string) => void;
	onPick: (id: string) => void;
	onVisit: (friend: Profile) => void;
	header?: React.ReactNode;
}) {
	// Alignment isn't a thing in Season 1 — the badge retires with S0.
	const s1 = useFeatureFlag("world_boss") || __DEV__;
	// One caster for the whole list: one `ritual_status` read, one allowance
	// every door and the strip agree on, one memory of who's already had today's
	// ritual from you.
	const caster = useRitualCaster();
	// Exactly one row's tray is open at a time — opening another closes the
	// first, so the list never carries two sets of live actions.
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const policy = useMotionPolicy();
	// A reload is a new list: whatever was open is about to be re-sorted or
	// re-stated under the thumb, so it closes.
	useEffect(() => {
		setExpandedId(null);
	}, [friends]);
	const toggleExpanded = useCallback(
		(id: string) => {
			// Ease the rows below into place as this friend's actions unfold.
			if (policy.allowDecorativeMotion) {
				LayoutAnimation.configureNext(
					LayoutAnimation.create(
						MOTION_DURATION.state,
						LayoutAnimation.Types.easeInEaseOut,
						LayoutAnimation.Properties.opacity
					)
				);
			}
			setExpandedId((current) => (current === id ? null : id));
		},
		[policy.allowDecorativeMotion]
	);
	// Every cast answers out loud in the one transient surface the app has.
	const onRitualOutcome = useCallback(
		(mode: RitualMode, name: string, outcome: CastOutcome) => {
			const door = RITUAL_DOOR[mode];
			if (outcome.kind === "sent") {
				showToast({ tone: "success", title: outcome.text });
			} else if (outcome.kind === "done") {
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
	const sorted = useMemo(
		() =>
			[...friends].sort((a, b) => {
				const fa = favorites.has(a.id) ? 0 : 1;
				const fb = favorites.has(b.id) ? 0 : 1;
				if (fa !== fb) return fa - fb;
				return (a.username ?? "").localeCompare(b.username ?? "");
			}),
		[favorites, friends]
	);
	if (friends.length === 0) {
		return (
			<View style={styles.scroll}>
				{header}
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
	// Favorites first (alphabetical within), then everyone else alphabetically —
	// the existing predictable order, just with pinned friends floated up.
	const atCap = sorted.length >= FRIEND_CAP_LIMIT;
	return (
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
			ListHeaderComponent={
				<>
					{header}
					{/* Today's two rituals, named once. The row doors are
					    glyph-only — this strip is where the glyphs learn their
					    names, and where the day's allowance counts down. */}
					<View style={styles.ritualStrip}>
						{(["bless", "curse"] as const).map((mode) => {
							const ritual = caster.today(mode);
							const left = caster.usage(mode)?.remaining;
							const door = RITUAL_DOOR[mode];
							return (
								<Tag
									key={mode}
									tone={mode === "bless" ? "sun" : "sage"}
									art={ritual.icon}
									label={
										left === undefined
											? ritual.name
											: `${ritual.name} · ${left} left`
									}
									accessibilityLabel={
										left === undefined
											? `Today's ${door.word} is ${ritual.name}`
											: `Today's ${door.word} is ${ritual.name}; ${left} left`
									}
									testID={`ritual-strip-${mode}`}
								/>
							);
						})}
					</View>
					{visitsSpent && (
						<Sticker
							color={WHIMSY.slopBand}
							rotate={0}
							shadow="sm"
							style={styles.visitsSpentHint}
						>
							<GameIcon name="visit" size={SPACE.card} muted />
							<T role="kicker">all tickled out — your snout needs a rest</T>
						</Sticker>
					)}
				</>
			}
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
					expanded={expandedId === f.id}
					onToggle={() => toggleExpanded(f.id)}
					onClose={() => toggleExpanded(f.id)}
					policy={policy}
					visitsSpent={visitsSpent}
					visitsLeft={visitsLeft}
					pairSpent={pairLocked.has(f.id)}
					visitStreak={visitStreaks.get(f.id)}
					isFav={favorites.has(f.id)}
					onToggleFavorite={onToggleFavorite}
					onPick={onPick}
					onVisit={onVisit}
				/>
			)}
		/>
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
	wrap: { flex: 1, marginTop: SPACE.lg, paddingHorizontal: PAGE_PAD },
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: TAB_SAFE },
	// Each row is its own tilted sticker now, so the stack needs a gutter
	// rather than a shared card edge.
	listContent: { paddingBottom: TAB_SAFE, gap: SPACE.sm },
	rowStack: { gap: SPACE.sm },
	tabsRow: { marginBottom: SPACE.md },
	rowNameLine: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.sm
	},
	rowName: { flexShrink: 1 },
	rowSub: { gap: SPACE.xs, alignItems: "flex-start" },
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
	visitStreak: { alignSelf: "flex-start" },
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
	rowActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: RAIL_GAP
	},
	// Today's two rituals, named above the list so the glyph-only doors are
	// explained once rather than on every row.
	ritualStrip: {
		// Two named tags; under a large text setting the second one ran off the
		// edge, so the strip wraps instead of clipping. (2026-09-12)
		flexWrap: "wrap",
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginBottom: SPACE.md
	},
	// The cast ritual's own art, riding the door once it's been sent — the
	// same size as the glyph it replaces.
	rowRitualIcon: {
		width: SPACE.xl,
		height: SPACE.xl,
		resizeMode: "contain"
	},
	tray: {
		gap: SPACE.xs,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.hair,
		borderTopColor: UI_COLORS.separator,
	},
	trayPrimary: { flexDirection: "row", alignItems: "stretch", gap: SPACE.sm },
	traySecondary: { flexDirection: "row", gap: SPACE.sm },
	trayCell: {
		flex: 1,
		minWidth: 0,
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		padding: SPACE.sm,
	},
	trayArt: { width: SPACE.xl, height: SPACE.xl, resizeMode: "contain" },
	trayCopy: { flex: 1, minWidth: 0 },
	trayLink: { flex: 1, minWidth: 0, minHeight: TAP_MIN },
	rowBlessTarget: {
		width: TAP_MIN,
		height: TAP_MIN,
		alignItems: "center",
		justifyContent: "center",
	},
	rowVisitBtn: {
		width: ROW_CONTROL,
		height: ROW_CONTROL,
		alignItems: "center",
		justifyContent: "center"
	},
	// One-time "out of visits" hint above the list.
	visitsSpentHint: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		marginBottom: SPACE.md,
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
