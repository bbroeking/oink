// Achievements screen — redesigned per the v1 mockup.
//
// Layout:
//   • Header: "← back · Achievements · ★ N/M unlocked · K ready to claim"
//   • Filter chips: All / Ready (badged) / Generous / Greedy / Social
//   • Per-card states:
//     - Ready (claimed + viewed_at NULL): cream tint, ! badge on icon,
//       "earned · +N snouts" body, gold Claim ✦ button (calls
//       mark_achievement_viewed → flips to "claimed/viewed" state).
//     - In-progress (not claimed): paper card, description text,
//       category tag top-right, progress bar, "N/G · reward · X" line.
//     - Claimed + viewed: paper card, dim, ✓ badge.
//
// The "Claim" button on the page is the same acknowledgment the
// AchievementDigestModal batches on launch; auto-grant of the reward
// itself happens server-side when the threshold is crossed.
import React, { useCallback, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	SafeAreaView,
	Pressable,
	Image,
} from "react-native";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { achievementIcon } from "@/constants/emojiArt";
import { Icon } from "../components/ui/Icon";
import {
	FONTS,
	WHIMSY,
	KICKER_PILL,
	PAGE_PAD,
	TAB_SAFE,
	STICKER_SHADOW,
	SHADOW_SM,
	SPACE,
	RADII,
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
	// get the cream-tinted ! treatment + gold Claim button.
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
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="achievements"
						title="Achievements"
						onBack={() => router.back()}
						below={
							<Text style={styles.statsLine}>
								<Text style={styles.statsUnlocked}>
									{claimedCount} / {rows.length} unlocked
								</Text>
								{readyCount > 0 && (
									<>
										<Text style={styles.statsDot}> · </Text>
										<Text style={styles.statsReady}>
											{readyCount} ready to claim
										</Text>
									</>
								)}
							</Text>
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
						style={{ flexGrow: 0 }}
						contentContainerStyle={styles.chipsRow}
					>
						{FILTERS.map((c) => {
							const active = filter === c.key;
							const showBadge = c.key === "ready" && readyCount > 0;
							return (
								<Pressable
									key={c.key}
									onPress={() => setFilter(c.key)}
									style={({ pressed }) => [
										styles.chip,
										active && styles.chipActive,
										pressed && { opacity: 0.7 },
									]}
								>
									<Text
										style={[
											styles.chipText,
											active && styles.chipTextActive,
										]}
									>
										{c.label}
									</Text>
									{showBadge && (
										<View style={styles.chipBadge}>
											<Text style={styles.chipBadgeText}>{readyCount}</Text>
										</View>
									)}
								</Pressable>
							);
						})}
					</ScrollView>

					<ScrollView
						style={{ flex: 1 }}
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
	const pct = Math.min(100, Math.round((row.progress / row.threshold) * 100));
	const ready = row.claimed && !row.viewed_at;
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
		<View
			style={[
				styles.card,
				ready && styles.cardReady,
				row.claimed && row.viewed_at && styles.cardDone,
			]}
		>
			<View style={styles.cardTop}>
				<View style={styles.iconWrap}>
					<View
						style={[styles.iconBubble, ready && styles.iconBubbleReady]}
					>
						<Image
							source={achievementIcon(row.id)}
							style={styles.iconImg}
						/>
					</View>
					{/* Red "!" badge on the icon for Ready cards — the
					    visual anchor that says "do something with me". */}
					{ready && (
						<View style={styles.bangBadge}>
							<Text style={styles.bangBadgeText}>!</Text>
						</View>
					)}
				</View>

				<View style={styles.cardBody}>
					<View style={styles.titleRow}>
						<Text style={styles.cardName} numberOfLines={1}>
							{row.name}
						</Text>
						{!!categoryTag && (
							<Text style={styles.categoryTag}>{categoryTag}</Text>
						)}
					</View>
					{!!row.description && (
						<Text style={styles.cardDesc} numberOfLines={2}>
							{row.description}
						</Text>
					)}

					{/* Ready state: progress bar is replaced by an earned
					    summary + gold Claim button on the right. */}
					{ready ? (
						<View style={styles.readyRow}>
							<Text style={styles.earnedText}>
								{row.reward_snouts > 0
									? `earned · +${row.reward_snouts} snouts`
									: "earned · keepsake unlocked"}
							</Text>
							<Pressable
								testID={`achievement-claim-${row.id}`}
								onPress={onAck}
								style={({ pressed }) => [
									styles.claimBtn,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.claimBtnText}>Claim ✦</Text>
							</Pressable>
						</View>
					) : (
						<>
							<View style={styles.progressTrack}>
								<View
									style={[
										styles.progressFill,
										{ width: `${pct}%` },
										row.claimed && styles.progressFillDone,
									]}
								/>
							</View>
							<View style={styles.metaRow}>
								<Text style={styles.metaCount}>
									{Math.min(row.progress, row.threshold).toLocaleString()} /{" "}
									{row.threshold.toLocaleString()}
								</Text>
								{!!rewardLabel && (
									<Text style={styles.metaReward} numberOfLines={1}>
										{rewardLabel}
									</Text>
								)}
							</View>
						</>
					)}
				</View>
			</View>

			{/* Tiny ✓ badge bottom-right on done cards — quiet
			    acknowledgment that this one's been wrapped up. */}
			{row.claimed && row.viewed_at && (
				<View style={styles.doneTick}>
					<Icon name="check" size={14} color={WHIMSY.mute} strokeWidth={2.4} />
				</View>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	statsLine: {},
	statsUnlocked: {
		...KICKER_PILL,
		color: WHIMSY.ink,
	},
	statsDot: { ...KICKER_PILL, color: WHIMSY.mute },
	statsReady: {
		...KICKER_PILL,
		color: WHIMSY.accent,
	},
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
	chip: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: SPACE.sm,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	chipActive: { backgroundColor: WHIMSY.lilac },
	chipText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.mute },
	chipTextActive: { color: WHIMSY.ink },
	// Red badge on the Ready chip — matches the design's small
	// dot with a count inside.
	chipBadge: {
		marginLeft: 6,
		minWidth: 18,
		height: 18,
		borderRadius: 9,
		paddingHorizontal: 4,
		backgroundColor: WHIMSY.accent,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	chipBadgeText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.paper,
	},
	grid: { padding: PAGE_PAD, gap: SPACE.md, paddingBottom: TAB_SAFE },
	card: {
		backgroundColor: WHIMSY.paper,
		borderRadius: RADII.lg,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 14,
		paddingVertical: 14,
		marginVertical: 0,
		...STICKER_SHADOW,
		position: "relative",
	},
	// Ready: cream-tinted card so the eye lands here first when
	// scanning the list.
	cardReady: {
		backgroundColor: WHIMSY.cream,
	},
	cardDone: {
		opacity: 0.86,
	},
	cardTop: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
	iconWrap: { position: "relative" },
	iconBubble: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	iconBubbleReady: { backgroundColor: WHIMSY.sun },
	iconImg: { width: 40, height: 40, resizeMode: "contain" },
	bangBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: WHIMSY.accent,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	bangBadgeText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.paper,
		fontWeight: "900",
	},
	cardBody: { flex: 1, minWidth: 0 },
	titleRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	categoryTag: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1,
		color: WHIMSY.mute,
	},
	cardDesc: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 2,
		marginBottom: 8,
	},
	progressTrack: {
		height: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
		marginTop: SPACE.xs,
	},
	progressFill: {
		height: "100%",
		backgroundColor: WHIMSY.lilacDeep,
	},
	progressFillDone: { backgroundColor: WHIMSY.sage },
	metaRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 6,
		gap: 8,
	},
	metaCount: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	metaReward: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		flexShrink: 1,
		textAlign: "right",
	},
	// Ready-state body row: earned-N text on left, gold Claim on right.
	readyRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 8,
		gap: 10,
	},
	earnedText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		flexShrink: 1,
	},
	claimBtn: {
		paddingHorizontal: 18,
		paddingVertical: 9,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		...SHADOW_SM,
	},
	claimBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	doneTick: {
		position: "absolute",
		bottom: 8,
		right: 10,
		opacity: 0.5,
	},
});
