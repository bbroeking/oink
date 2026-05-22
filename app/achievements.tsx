// Achievements screen — grid of cards, each showing tier rewards
// (item icon, title chip, snouts) + a progress bar. Reachable from
// Account → "Achievements · N / M" link.
//
// Future: this surface absorbs the existing Sounder titles + Lucky
// drop titles + Shop title purchases via a Phase 1.5 retrofit so
// the user sees all their accomplishments in one place.
import React, { useCallback, useState } from "react";
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
import { supabase } from "../utils/supabase";
import { Sticker } from "../components/ui/Sticker";
import { SnoutCoin } from "../components/ui/SnoutCoin";
import { HAT_IMAGES } from "@/constants/hats";
import { achievementIcon } from "@/constants/emojiArt";
import {
	FONTS,
	KICKER_TEXT,
	WHIMSY,
	ROW_TILTS,
} from "@/constants/theme";

interface AchievementRow {
	id: string;
	category: string;
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
}

const CATEGORIES = [
	{ key: "all",            label: "All" },
	{ key: "trade_giver",    label: "Generous" },
	{ key: "trade_receiver", label: "Greedy" },
];

export default function AchievementsScreen() {
	const [rows, setRows] = useState<AchievementRow[]>([]);
	const [filter, setFilter] = useState<string>("all");
	const [loading, setLoading] = useState(true);

	useFocusEffect(
		useCallback(() => {
			supabase.rpc("my_achievements").then(({ data }) => {
				setRows((data as AchievementRow[] | null) ?? []);
				setLoading(false);
			});
		}, [])
	);

	const filtered = rows.filter((r) => filter === "all" || r.category === filter);
	const claimedCount = rows.filter((r) => r.claimed).length;
	const totalCount = rows.length;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<View style={styles.header}>
						<Pressable onPress={() => router.back()} hitSlop={12}>
							<Text style={styles.backBtnText}>← back</Text>
						</Pressable>
						<Text style={styles.title}>Achievements</Text>
						<View style={{ width: 50 }} />
					</View>
					<Text style={styles.kicker}>
						★ {claimedCount} / {totalCount} unlocked
					</Text>

					{/* Category filter chips */}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.chipsRow}
					>
						{CATEGORIES.map((c) => (
							<Pressable
								key={c.key}
								onPress={() => setFilter(c.key)}
								style={[
									styles.chip,
									filter === c.key && styles.chipActive,
								]}
							>
								<Text
									style={[
										styles.chipText,
										filter === c.key && styles.chipTextActive,
									]}
								>
									{c.label}
								</Text>
							</Pressable>
						))}
					</ScrollView>

					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={styles.grid}
						showsVerticalScrollIndicator={false}
					>
						{loading && <Text style={styles.empty}>Loading…</Text>}
						{!loading && filtered.length === 0 && (
							<Text style={styles.empty}>No achievements in this category yet.</Text>
						)}
						{filtered.map((row, i) => (
							<AchievementCard key={row.id} row={row} tilt={ROW_TILTS[i % ROW_TILTS.length]} />
						))}
					</ScrollView>
				</SafeAreaView>
			</View>
		</>
	);
}

// ── Card ──────────────────────────────────────────────────────────
function AchievementCard({ row, tilt }: { row: AchievementRow; tilt: number }) {
	const pct = Math.min(100, Math.round((row.progress / row.threshold) * 100));
	const ready = row.progress >= row.threshold && !row.claimed;
	const itemImage = row.reward_item_id ? HAT_IMAGES[row.reward_item_id] : null;

	return (
		<Sticker
			color={row.claimed ? "paper" : "cream"}
			rotate={tilt}
			radius={14}
			style={[styles.card, row.claimed && styles.cardClaimed]}
		>
			<View style={styles.cardHeader}>
				<View style={styles.iconBubble}>
					<Image
						source={achievementIcon(row.id)}
						style={styles.iconImg}
					/>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<View style={styles.nameRow}>
						<Text style={styles.cardName} numberOfLines={1}>
							{row.name}
						</Text>
						{row.is_top_tier && row.level > 0 && (
							<Text style={styles.levelBadge}>· L{row.level + 1}</Text>
						)}
					</View>
					{!!row.description && (
						<Text style={styles.cardDesc} numberOfLines={2}>
							{row.description}
						</Text>
					)}
				</View>
			</View>

			{/* Reward chips */}
			<View style={styles.rewards}>
				{itemImage && (
					<View style={styles.rewardItem}>
						<Image source={itemImage} style={styles.rewardImg} resizeMode="contain" />
						<Text style={styles.rewardLabel} numberOfLines={1}>
							{row.reward_item_id}
						</Text>
					</View>
				)}
				{!!row.reward_title_id && (
					<View style={styles.rewardChip}>
						<Text style={styles.rewardChipIcon}>"</Text>
						<Text style={styles.rewardChipText}>{row.name}</Text>
					</View>
				)}
				{row.reward_snouts > 0 && (
					<View style={styles.rewardChip}>
						<SnoutCoin size={14} />
						<Text style={styles.rewardChipText}>{row.reward_snouts}</Text>
					</View>
				)}
			</View>

			{/* Progress */}
			<View style={styles.progressRow}>
				<View style={styles.progressTrack}>
					<View style={[styles.progressFill, { width: `${pct}%` }]} />
				</View>
				<Text style={styles.progressText}>
					{row.progress.toLocaleString()} / {row.threshold.toLocaleString()}
				</Text>
			</View>

			{ready && (
				<View style={styles.readyTag}>
					<Text style={styles.readyTagText}>Ready ✓</Text>
				</View>
			)}
		</Sticker>
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
	kicker: { ...KICKER_TEXT, paddingHorizontal: 18, marginBottom: 8 },
	chipsRow: {
		paddingHorizontal: 18,
		paddingBottom: 10,
		gap: 8,
		flexDirection: "row",
	},
	chip: {
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
	grid: { padding: 18, gap: 12, paddingBottom: 80 },
	card: {
		paddingHorizontal: 14,
		paddingVertical: 12,
		position: "relative",
	},
	cardClaimed: { opacity: 0.92 },
	cardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
	iconBubble: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	iconImg: { width: 34, height: 34, resizeMode: "contain" },
	nameRow: { flexDirection: "row", alignItems: "baseline" },
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
	},
	levelBadge: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		marginLeft: 4,
	},
	cardDesc: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	rewards: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginTop: 10,
	},
	rewardItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: WHIMSY.paper,
		borderRadius: 10,
		paddingHorizontal: 6,
		paddingVertical: 3,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
	},
	rewardImg: { width: 24, height: 24 },
	rewardLabel: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.ink,
		maxWidth: 80,
	},
	rewardChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: WHIMSY.paper,
		borderRadius: 10,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
	},
	rewardChipIcon: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	rewardChipText: {
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	progressRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 10,
	},
	progressTrack: {
		flex: 1,
		height: 6,
		backgroundColor: WHIMSY.paper,
		borderRadius: 3,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: WHIMSY.ink,
	},
	progressFill: {
		height: "100%",
		backgroundColor: WHIMSY.lilac,
	},
	progressText: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		minWidth: 60,
		textAlign: "right",
	},
	readyTag: {
		position: "absolute",
		top: 6,
		right: 8,
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	readyTagText: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.ink,
	},
	empty: {
		textAlign: "center",
		padding: 40,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
});
