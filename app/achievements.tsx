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
// AchievementUnlockModal does on launch; auto-grant of the reward
// itself happens server-side when the threshold is crossed.
import React, { useCallback, useMemo, useState } from "react";
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
import { Sticker } from "../components/ui/Sticker";
import { SnoutCoin } from "../components/ui/SnoutCoin";
import { HAT_IMAGES } from "@/constants/hats";
import { achievementIcon } from "@/constants/emojiArt";
import {
	FONTS,
	WHIMSY,
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
	{ key: "generous", label: "Generous" },
	{ key: "greedy",   label: "Greedy" },
	{ key: "social",   label: "Social" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const CATEGORY_LABEL: Record<string, string> = {
	generous: "GENEROUS",
	greedy:   "GREEDY",
	social:   "SOCIAL",
};

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
					<View style={styles.header}>
						<Pressable onPress={() => router.back()} hitSlop={12}>
							<Text style={styles.backBtnText}>‹ back</Text>
						</Pressable>
						<Text style={styles.title}>Achievements</Text>
						<View style={{ width: 50 }} />
					</View>
					<Text style={styles.statsLine}>
						<Text style={styles.statsStar}>★ </Text>
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
									style={[styles.chip, active && styles.chipActive]}
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
						{loading && <Text style={styles.empty}>Loading…</Text>}
						{!loading && filtered.length === 0 && (
							<Text style={styles.empty}>
								{filter === "ready"
									? "No achievements waiting to be claimed."
									: "No achievements in this category yet."}
							</Text>
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
	const itemImage = row.reward_item_id ? HAT_IMAGES[row.reward_item_id] : null;
	const categoryTag = CATEGORY_LABEL[row.display_category] ?? "";

	// Reward summary line under the progress bar: lead with title,
	// fall back to hat, then snouts-only. Mirrors the design's
	// "reward · Title: X" line.
	const rewardLabel = (() => {
		if (row.reward_title_id) return `reward · Title: ${row.name}`;
		if (row.reward_item_id) return `reward · Item: ${row.reward_item_id.replace(/_/g, " ")}`;
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

					{/* Ready state: progress bar is replaced by the
					    "earned · +N snouts" badge text + gold Claim
					    button on the right. */}
					{ready ? (
						<View style={styles.readyRow}>
							<Text style={styles.earnedText}>
								earned · +{row.reward_snouts} snouts
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
					<Text style={styles.doneTickText}>✓</Text>
				</View>
			)}
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 18,
		paddingTop: 8,
		paddingBottom: 4,
	},
	backBtnText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	title: { fontFamily: FONTS.whimsy, fontSize: 26, color: WHIMSY.ink },
	statsLine: {
		paddingHorizontal: 18,
		marginBottom: 10,
		textAlign: "center",
	},
	statsStar: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.accent,
	},
	statsUnlocked: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	statsDot: { color: WHIMSY.mute, fontSize: 13 },
	statsReady: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
	},
	chipsRow: {
		paddingHorizontal: 18,
		paddingBottom: 8,
		gap: 8,
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
		paddingVertical: 7,
		borderRadius: 999,
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
		fontSize: 10,
		color: WHIMSY.paper,
	},
	grid: { padding: 18, gap: 12, paddingBottom: 80 },
	card: {
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 14,
		paddingVertical: 14,
		marginVertical: 6,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 3, height: 3 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 3,
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
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: 8,
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	categoryTag: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
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
		height: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		marginTop: 4,
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
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
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
	doneTickText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.mute,
	},
	empty: {
		textAlign: "center",
		padding: 40,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
});
