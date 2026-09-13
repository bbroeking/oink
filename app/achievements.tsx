// Achievements screen — redesigned per the v1 mockup.
//
// Layout:
//   • Header: "← back · Achievements · ★ N/M unlocked · K ready to claim"
//   • Filter chips: All / Ready (badged) / Generous / Greedy / Social
//   • Per-card states:
//     - Ready (claimed + viewed_at NULL): cream tint, ! badge on icon,
//       "earned · +N snouts" body, gold "Got it ✦" button (calls
//       mark_achievement_viewed → flips to "claimed/viewed" state).
//     - In-progress (not claimed): paper card, description text,
//       category tag top-right, progress bar, "N/G · reward · X" line.
//     - Claimed + viewed: paper card, dim, ✓ badge.
//
// The acknowledgement button on the page is the same one the
// AchievementDigestModal batches on launch; auto-grant of the reward
// itself happens server-side when the threshold is crossed — so the label is
// "Got it", not "Claim" [D-17].
import React, { useCallback, useMemo, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	SafeAreaView,
	Image,
} from "react-native";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { achievementIcon } from "@/constants/emojiArt";
import {
	Avatar,
	Button,
	Chip,
	EmptyState,
	Icon,
	LoadingBeat,
	PageHeader,
	ProgressTrack,
	Sticker,
	T,
} from "../components/ui";
import {
	ART_SIZE,
	AVATAR_SIZE,
	BORDER,
	WHIMSY,
	OPACITY,
	PAGE_PAD,
	TAB_SAFE,
	SPACE,
	RADII,
	UI_COLORS,
} from "@/constants/theme";

interface AchievementRow {
	id: string;
	category: string;
	display_category: string;
	tier: number;
	name: string;
	description: string | null;
	threshold: number;
	reward_title_id: string | null;
	reward_item_id: string | null;
	reward_snouts: number;
	icon: string | null;
	display_order: number;
	is_top_tier: boolean;
	progress: number;
	claimed: boolean;
	level: number;
	viewed_at: string | null;
}

// Filter chip definitions. "ready" is dynamic (no display_category
// match); all others map 1:1 to the achievements.display_category
// column.
const FILTERS = [
	{ key: "all",      label: "All" },
	{ key: "ready",    label: "Ready" },
	{ key: "devotion", label: "Devotion" },
	{ key: "generous", label: "Generous" },
	{ key: "greedy",   label: "Greedy" },
	{ key: "social",   label: "Social" },
	// Server display_category for these rows is "the_dig" (re-themed from the
	// retired "scuffle" key in the co-op-dig rebuild).
	{ key: "the_dig",  label: "The Dig" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const CATEGORY_LABEL: Record<string, string> = {
	devotion: "DEVOTION",
	generous: "GENEROUS",
	greedy:   "GREEDY",
	social:   "SOCIAL",
	the_dig:  "THE DIG",
};

// Drawing geometry — the two corner badges and the icon art inside the card's
// Avatar frame. Sizes, not spacing steps.
const BANG_BADGE = 18;
const DONE_TICK = 14;
const DONE_TICK_STROKE = 2.4;

function catalogName(id: string): string {
	return id
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export default function AchievementsScreen() {
	const [rows, setRows] = useState<AchievementRow[]>([]);
	const [filter, setFilter] = useState<FilterKey>("all");
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const data = await rpc<AchievementRow[]>("my_achievements");
		setRows(data ?? []);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// "Ready" = claimed + not yet viewed. These are the cards that
	// get the cream-tinted ! treatment + gold acknowledge button.
	const readyCount = useMemo(
		() => rows.filter((r) => r.claimed && !r.viewed_at).length,
		[rows]
	);
	const claimedCount = useMemo(() => rows.filter((r) => r.claimed).length, [rows]);

	const filtered = useMemo(() => {
		if (filter === "all") return rows;
		if (filter === "ready") return rows.filter((r) => r.claimed && !r.viewed_at);
		return rows.filter((r) => r.display_category === filter);
	}, [rows, filter]);

	// Acknowledge a single Ready achievement — flips viewed_at on
	// the server + drops the card out of the Ready filter view.
	const ackClaim = async (id: string) => {
		Haptics.selectionAsync().catch(() => {});
		// Optimistic: stamp viewed_at locally so the card flips
		// instantly. Server update is fire-and-forget; if it fails
		// the next focus will re-sync.
		setRows((prev) =>
			prev.map((r) =>
				r.id === id ? { ...r, viewed_at: new Date().toISOString() } : r
			)
		);
		await rpc("mark_achievement_viewed", { target_id: id });
	};

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={styles.safe}>
					<PageHeader
						kicker="achievements"
						title="Achievements"
						onBack={() => router.back()}
						below={
							<T role="kickerPillSm">
								{claimedCount} / {rows.length} unlocked
								{readyCount > 0 && (
									<>
										<T role="kickerPillSm" tone="secondary"> · </T>
										<T role="kickerPillSm" tone="accent">
											{readyCount} ready to claim
										</T>
									</>
								)}
							</T>
						}
					/>

					{/* Filter chip row — flexGrow:0 on the ScrollView so it
					    doesn't claim leftover vertical space (otherwise
					    each chip stretches to the ScrollView's cross-
					    axis size, ending up as a tall pill instead of
					    a pill-shaped chip). */}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						style={styles.chipsScroll}
						contentContainerStyle={styles.chipsRow}
					>
						{FILTERS.map((c) => {
							const active = filter === c.key;
							const showBadge = c.key === "ready" && readyCount > 0;
							return (
								<Chip
									key={c.key}
									label={c.label}
									tone={active ? "lilac" : "paper"}
									selected={active}
									onPress={() => setFilter(c.key)}
									badge={
										showBadge ? (
											<View style={styles.chipBadge}>
												<T role="kickerPillSm" tone="onDark">
													{readyCount}
												</T>
											</View>
										) : undefined
									}
									accessibilityLabel={
										showBadge
											? `${c.label}, ${readyCount} ready`
											: c.label
									}
									accessibilityHint="Filters the trophy list"
								/>
							);
						})}
					</ScrollView>

					<ScrollView
						style={styles.list}
						contentContainerStyle={styles.grid}
						showsVerticalScrollIndicator={false}
					>
						{loading && <LoadingBeat label="counting trophies" />}
						{!loading && filtered.length === 0 && (
							<EmptyState
								glyph="trophy"
								title={
									filter === "ready"
										? "Nothing to claim yet"
										: "No trophies in this category yet"
								}
								sub={
									filter === "ready"
										? "Earn one and it'll wait here for you."
										: "Keep playing — they'll fill in."
								}
								action={
									filter === "all" ? undefined : (
										<Button
											variant="handLink"
											size="sm"
											onPress={() => setFilter("all")}
											accessibilityLabel="Show every trophy"
											accessibilityHint="Clears the category filter"
										>
											Show every trophy ›
										</Button>
									)
								}
							/>
						)}
						{filtered.map((row) => (
							<AchievementCard
								key={row.id}
								row={row}
								onAck={() => ackClaim(row.id)}
							/>
						))}
					</ScrollView>
				</SafeAreaView>
			</View>
		</>
	);
}

// ── Card ──────────────────────────────────────────────────────────
function AchievementCard({
	row,
	onAck,
}: {
	row: AchievementRow;
	onAck: () => void;
}) {
	const ready = row.claimed && !row.viewed_at;
	const done = row.claimed && !!row.viewed_at;
	const categoryTag = CATEGORY_LABEL[row.display_category] ?? "";

	// Reward summary line under the progress bar: lead with title,
	// fall back to hat, then snouts-only. Mirrors the design's
	// "reward · Title: X" line.
	const rewardLabel = (() => {
		if (row.reward_title_id) return `reward · Title: ${catalogName(row.reward_title_id)}`;
		if (row.reward_item_id) return `reward · Item: ${catalogName(row.reward_item_id)}`;
		if (row.reward_snouts > 0) return `reward · +${row.reward_snouts} snouts`;
		return "";
	})();

	return (
		<Sticker
			color={ready ? "cream" : "paper"}
			rotate={0}
			radius={RADII.lg}
			pad
			style={[styles.card, done && styles.cardDone]}
		>
			<View style={styles.cardTop}>
				<View style={styles.iconWrap}>
					<Avatar
						size={AVATAR_SIZE[2]}
						fill={ready ? "sun" : "paper"}
						label={row.name}
					>
						<Image
							source={achievementIcon(row.id)}
							style={styles.iconImg}
						/>
					</Avatar>
					{/* Red "!" badge on the icon for Ready cards — the
					    visual anchor that says "do something with me". */}
					{ready && (
						<View style={styles.bangBadge}>
							<T role="kickerPillSm" tone="onDark">!</T>
						</View>
					)}
				</View>

				<View style={styles.cardBody}>
					<View style={styles.titleRow}>
						<T role="cardTitle" numberOfLines={1} style={styles.cardName}>
							{row.name}
						</T>
						{!!categoryTag && (
							<T role="kickerPillSm" tone="secondary">{categoryTag}</T>
						)}
					</View>
					{!!row.description && (
						<T
							role="hand"
							tone="secondary"
							numberOfLines={2}
							style={styles.cardDesc}
						>
							{row.description}
						</T>
					)}

					{/* Ready state: progress bar is replaced by an earned
					    summary + gold acknowledge button on the right. */}
					{ready ? (
						<View style={styles.readyRow}>
							<T role="hand" tone="secondary" style={styles.earnedText}>
								{row.reward_snouts > 0
									? `earned · +${row.reward_snouts} snouts`
									: "earned · keepsake unlocked"}
							</T>
							<Button
								variant="gold"
								size="sm"
								testID={`achievement-claim-${row.id}`}
								onPress={onAck}
								accessibilityLabel={`Got it — ${row.name}`}
								accessibilityHint="Marks this trophy as seen; the reward is already yours"
							>
								Got it ✦
							</Button>
						</View>
					) : (
						<>
							<ProgressTrack
								value={row.progress}
								max={row.threshold}
								tone={row.claimed ? "sage" : "lilac"}
								height="sm"
								accessibilityLabel={`${row.name} progress`}
								style={styles.progress}
							/>
							<View style={styles.metaRow}>
								<T role="label">
									{Math.min(row.progress, row.threshold).toLocaleString()} /{" "}
									{row.threshold.toLocaleString()}
								</T>
								{!!rewardLabel && (
									<T
										role="hand"
										tone="secondary"
										numberOfLines={1}
										align="right"
										style={styles.metaReward}
									>
										{rewardLabel}
									</T>
								)}
							</View>
						</>
					)}
				</View>
			</View>

			{/* Tiny ✓ badge bottom-right on done cards — quiet
			    acknowledgment that this one's been wrapped up. */}
			{done && (
				<View style={styles.doneTick}>
					<Icon
						name="check"
						size={DONE_TICK}
						color={UI_COLORS.uiMuted}
						strokeWidth={DONE_TICK_STROKE}
					/>
				</View>
			)}
		</Sticker>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	chipsScroll: { flexGrow: 0 },
	chipsRow: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.md,
		gap: SPACE.sm,
		flexDirection: "row",
		// Center on the cross-axis so chips don't stretch vertically
		// when the ScrollView container ends up taller than the chip
		// content. Belt-and-suspenders with the flexGrow:0 on the
		// ScrollView itself.
		alignItems: "center",
	},
	// The count pip on the Ready chip — the design's small dot with a
	// count inside. `Chip badge` owns the corner it hangs off; this is
	// only the drawing. [wave 4]
	chipBadge: {
		minWidth: BANG_BADGE,
		height: BANG_BADGE,
		borderRadius: BANG_BADGE / 2,
		paddingHorizontal: SPACE.xs,
		backgroundColor: WHIMSY.accent,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	list: { flex: 1 },
	grid: { padding: PAGE_PAD, gap: SPACE.md, paddingBottom: TAB_SAFE },
	card: {
		position: "relative",
	},
	cardDone: {
		opacity: OPACITY.pressed,
	},
	cardTop: { flexDirection: "row", gap: SPACE.card, alignItems: "flex-start" },
	iconWrap: { position: "relative" },
	iconImg: {
		width: ART_SIZE.glyph,
		height: ART_SIZE.glyph,
		resizeMode: "contain",
	},
	bangBadge: {
		position: "absolute",
		top: -SPACE.xs,
		right: -SPACE.xs,
		width: BANG_BADGE,
		height: BANG_BADGE,
		borderRadius: BANG_BADGE / 2,
		backgroundColor: WHIMSY.accent,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	cardBody: { flex: 1, minWidth: 0 },
	titleRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	cardName: {
		flexShrink: 1,
	},
	cardDesc: {
		marginTop: SPACE.xxs,
		marginBottom: SPACE.sm,
	},
	progress: { marginTop: SPACE.xs },
	metaRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: SPACE.xs,
		gap: SPACE.sm,
	},
	metaReward: {
		flexShrink: 1,
	},
	// Ready-state body row: earned-N text on left, gold acknowledge on right.
	readyRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: SPACE.sm,
		gap: SPACE.sm,
	},
	earnedText: {
		flexShrink: 1,
	},
	doneTick: {
		position: "absolute",
		bottom: SPACE.sm,
		right: SPACE.sm,
		opacity: OPACITY.dim,
	},
});
