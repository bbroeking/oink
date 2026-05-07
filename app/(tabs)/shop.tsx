import { useCallback, useEffect, useMemo, useState } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Image,
	Platform,
	SafeAreaView,
	Alert,
	Text,
	Pressable,
	ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import { Button } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { SnoutCoin } from "../../components/ui/SnoutCoin";
import {
	HAT_IMAGES,
	HatRow,
	RARITY_COLORS,
	CATEGORY_EMOJI,
	HIDDEN_CATEGORIES,
} from "@/constants/hats";
import { COLORS, FONTS, SHADOWS, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { RarityFx } from "../../components/ui/RarityFx";
import * as Haptics from "expo-haptics";

const RARITY_GRADIENT: Record<string, [string, string]> = {
	common: ["#FAF7F3", "#EFEAE3"],
	uncommon: ["#E8F5E0", "#CFE8C0"],
	rare: ["#E0EBFF", "#B7CFFA"],
	epic: ["#EFE9FF", "#CFC4FF"],
	legendary: ["#FFF3D0", "#FFD96B"],
};

const RARITY_RANK: Record<string, number> = {
	common: 1,
	uncommon: 2,
	rare: 3,
	epic: 4,
	legendary: 5,
};

const RARITY_ORDER: Array<HatRow["rarity"] & string> = [
	"legendary",
	"epic",
	"rare",
	"uncommon",
	"common",
];

const RARITY_LABELS: Record<string, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	epic: "Epic",
	legendary: "Legendary",
};

const CATEGORY_LABELS: Record<string, string> = {
	hat: "Hats",
	glasses: "Glasses",
	bow: "Bows",
	scarf: "Scarves",
	mask: "Masks",
	cape: "Capes",
	necklace: "Necklaces",
	aura: "Auras",
	held: "Held",
	background: "BGs",
};

const CATEGORY_DISPLAY_ORDER = [
	"hat",
	"glasses",
	"bow",
	"scarf",
	"mask",
	"necklace",
	"cape",
	"held",
	"aura",
	"background",
];

type ListRow =
	| { type: "header"; key: string; title: string; rarity?: string }
	| { type: "row"; key: string; items: HatRow[] };

function buildRowsByRarity(items: HatRow[]): ListRow[] {
	const groups: Record<string, HatRow[]> = {};
	for (const i of items) {
		const r = i.rarity ?? "common";
		(groups[r] ??= []).push(i);
	}
	const rows: ListRow[] = [];
	for (const r of RARITY_ORDER) {
		const arr = groups[r];
		if (!arr?.length) continue;
		rows.push({
			type: "header",
			key: `h-${r}`,
			title: RARITY_LABELS[r],
			rarity: r,
		});
		for (let i = 0; i < arr.length; i += 2) {
			rows.push({
				type: "row",
				key: `r-${r}-${i}`,
				items: arr.slice(i, i + 2),
			});
		}
	}
	return rows;
}

function buildRowsByCategory(items: HatRow[]): ListRow[] {
	const groups: Record<string, HatRow[]> = {};
	for (const i of items) {
		const c = i.category ?? "hat";
		(groups[c] ??= []).push(i);
	}
	const rows: ListRow[] = [];
	const seen = new Set<string>();
	const order = [
		...CATEGORY_DISPLAY_ORDER.filter((c) => groups[c]?.length),
		...Object.keys(groups).filter(
			(c) => !CATEGORY_DISPLAY_ORDER.includes(c) && groups[c]?.length
		),
	];
	for (const c of order) {
		if (seen.has(c)) continue;
		seen.add(c);
		const arr = groups[c];
		// Inside a category, sort by rarity descending then cost descending
		arr.sort((a, b) => {
			const dr =
				(RARITY_RANK[b.rarity ?? "common"] ?? 0) -
				(RARITY_RANK[a.rarity ?? "common"] ?? 0);
			if (dr !== 0) return dr;
			return b.cost - a.cost;
		});
		rows.push({
			type: "header",
			key: `h-${c}`,
			title: CATEGORY_LABELS[c] ?? c,
		});
		for (let i = 0; i < arr.length; i += 2) {
			rows.push({
				type: "row",
				key: `r-${c}-${i}`,
				items: arr.slice(i, i + 2),
			});
		}
	}
	return rows;
}

function formatCountdown(secs: number): string {
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function HatThumb({
	item,
	size = 100,
}: {
	item: HatRow;
	size?: number;
}) {
	const hatSrc = HAT_IMAGES[item.id];
	if (hatSrc) {
		return (
			<Image
				source={hatSrc}
				style={{ width: size, height: size }}
				resizeMode="contain"
			/>
		);
	}
	return (
		<Text style={{ fontSize: size * 0.55 }}>
			{item.emoji ?? CATEGORY_EMOJI[item.category ?? "hat"] ?? "?"}
		</Text>
	);
}

function ItemCard({
	item,
	owned,
	active,
	canAfford,
	busy,
	wardrobeMode,
	buyable = true,
	onBuy,
	onEquip,
	onUnequip,
	onPreview,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	busy: boolean;
	wardrobeMode?: boolean;
	buyable?: boolean;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
	onPreview?: () => void;
}) {
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	const isPremium = rarity === "epic" || rarity === "legendary";

	return (
		<Pressable
			onPress={onPreview}
			style={[
				styles.card,
				{
					borderColor: rarityColor,
					shadowColor: isPremium ? rarityColor : "#000",
					shadowOpacity: isPremium ? 0.4 : 0.06,
					shadowRadius: isPremium ? 14 : 6,
					shadowOffset: { width: 0, height: isPremium ? 6 : 2 },
					elevation: isPremium ? 6 : 2,
				},
			]}
		>
			<RarityFx rarity={rarity} style={styles.cardThumbWrap}>
				<LinearGradient
					colors={RARITY_GRADIENT[rarity]}
					style={styles.cardThumb}
				>
					<HatThumb item={item} size={86} />
					<View
						style={[
							styles.rarityBadge,
							{ backgroundColor: rarityColor },
						]}
					>
						<Text style={styles.rarityText}>{rarity.toUpperCase()}</Text>
					</View>
				</LinearGradient>
			</RarityFx>
			<View style={styles.cardBody}>
				<Text style={styles.cardName} numberOfLines={1}>
					{item.name}
				</Text>
				<View style={styles.priceRow}>
					{owned ? (
						<Text
							style={[
								styles.cardOwnedTag,
								active && { color: COLORS.successText },
							]}
						>
							{active ? "✓ WEARING" : "OWNED"}
						</Text>
					) : (
						<>
							<SnoutCoin size={14} />
							<Text style={styles.cardPrice}>
								{item.cost.toLocaleString()}
							</Text>
						</>
					)}
				</View>
				{active ? (
					<Button size="sm" variant="ghost" full onPress={onUnequip}>
						Take off
					</Button>
				) : owned ? (
					<Button size="sm" variant="primary" full onPress={onEquip}>
						Wear
					</Button>
				) : wardrobeMode ? null : !buyable ? (
					<Button size="sm" variant="locked" full disabled>
						Today only
					</Button>
				) : !canAfford ? (
					<Button size="sm" variant="locked" full disabled>
						Not enough
					</Button>
				) : (
					<Button
						size="sm"
						variant="primary"
						full
						onPress={onBuy}
						disabled={busy}
					>
						Buy
					</Button>
				)}
			</View>
		</Pressable>
	);
}

function FeaturedCard({
	item,
	owned,
	active,
	canAfford,
	busy,
	onBuy,
	onEquip,
	onUnequip,
}: {
	item: HatRow;
	owned: boolean;
	active: boolean;
	canAfford: boolean;
	busy: boolean;
	onBuy: () => void;
	onEquip: () => void;
	onUnequip: () => void;
}) {
	const rarity = item.rarity ?? "common";
	const rarityColor = RARITY_COLORS[rarity];
	return (
		<View
			style={[
				styles.featured,
				{
					borderColor: rarityColor,
					shadowColor: rarityColor,
				},
			]}
		>
			<LinearGradient
				colors={RARITY_GRADIENT[rarity]}
				style={styles.featuredBg}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
			/>
			<View style={styles.featuredRow}>
				<View style={styles.featuredThumbWrap}>
					<HatThumb item={item} size={110} />
				</View>
				<View style={styles.featuredText}>
					<View
						style={[
							styles.rarityBadge,
							{
								position: "relative",
								top: 0,
								right: 0,
								alignSelf: "flex-start",
								backgroundColor: rarityColor,
								marginBottom: 6,
							},
						]}
					>
						<Text style={styles.rarityText}>
							{rarity.toUpperCase()}
						</Text>
					</View>
					<Text style={styles.featuredName} numberOfLines={1}>
						{item.name}
					</Text>
					{item.description && (
						<Text style={styles.featuredDesc} numberOfLines={2}>
							{item.description}
						</Text>
					)}
					<View style={styles.featuredCtaRow}>
						{!owned && (
							<View style={styles.featuredPriceWrap}>
								<SnoutCoin size={16} />
								<Text style={styles.featuredPrice}>
									{item.cost.toLocaleString()}
								</Text>
							</View>
						)}
						{active ? (
							<Button size="sm" variant="ghost" onPress={onUnequip}>
								Take off
							</Button>
						) : owned ? (
							<Button size="sm" variant="primary" onPress={onEquip}>
								Wear
							</Button>
						) : !canAfford ? (
							<Button size="sm" variant="locked" disabled>
								Not enough
							</Button>
						) : (
							<Button
								size="sm"
								variant={
									rarity === "legendary" ? "gold" : "primary"
								}
								onPress={onBuy}
								disabled={busy}
							>
								Buy now
							</Button>
						)}
					</View>
				</View>
			</View>
		</View>
	);
}

export default function ShopScreen() {
	const [daily, setDaily] = useState<HatRow[]>([]);
	const [allItems, setAllItems] = useState<HatRow[]>([]);
	const [owned, setOwned] = useState<Set<string>>(new Set());
	const [activeId, setActiveId] = useState<string | null>(null);
	const [counter, setCounter] = useState<number>(0);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
	const [resetsIn, setResetsIn] = useState<number>(0);
	const [view, setView] = useState<"daily" | "browse" | "wardrobe">("daily");
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

	const load = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		const [dailyRes, allRes, ownedRes, profRes, resetsRes] = await Promise.all([
			supabase.rpc("daily_shop"),
			supabase
				.from("hats")
				.select("id, name, cost, display_order, emoji, image_path, category, rarity, description")
				.order("display_order"),
			supabase.from("user_hats").select("hat_id").eq("user_id", user.id),
			supabase
				.from("profiles")
				.select("counter, active_hat_id")
				.eq("id", user.id)
				.single(),
			supabase.rpc("shop_resets_in_seconds"),
		]);
		const filterPlaceable = (rows: HatRow[]) =>
			rows.filter(
				(r) => !r.category || !HIDDEN_CATEGORIES.has(r.category)
			);
		setDaily(filterPlaceable((dailyRes.data as HatRow[]) ?? []));
		setAllItems(filterPlaceable((allRes.data as HatRow[]) ?? []));
		setOwned(
			new Set(
				((ownedRes.data ?? []) as { hat_id: string }[]).map((r) => r.hat_id)
			)
		);
		setCounter(profRes.data?.counter ?? 0);
		setActiveId(profRes.data?.active_hat_id ?? null);
		setResetsIn((resetsRes.data as number) ?? 0);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	useEffect(() => {
		if (resetsIn <= 0) return;
		const t = setInterval(() => setResetsIn((s) => Math.max(0, s - 1)), 1000);
		return () => clearInterval(t);
	}, [resetsIn]);

	const handleBuy = async (hat: HatRow) => {
		if (busyId) return;
		if (!daily.some((d) => d.id === hat.id)) {
			Alert.alert("Today only", "This item is only available in today's shop.");
			return;
		}
		setBusyId(hat.id);
		const { data, error } = await supabase.rpc("buy_hat", {
			target_hat_id: hat.id,
		});
		setBusyId(null);
		if (error) return Alert.alert("Couldn't buy", "Try again.");
		const r = data as {
			ok: boolean;
			reason?: string;
			need?: number;
			have?: number;
		};
		if (!r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
				() => {}
			);
			if (r.reason === "insufficient")
				return Alert.alert(
					"Not enough snouts",
					`Need ${r.need}, you have ${r.have}.`
				);
			if (r.reason === "already_owned") return Alert.alert("Owned", "Already yours.");
			return Alert.alert("Couldn't buy", r.reason ?? "");
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		load();
	};

	const handleEquip = async (hatId: string | null) => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		Haptics.selectionAsync().catch(() => {});
		await supabase
			.from("profiles")
			.update({ active_hat_id: hatId })
			.eq("id", user.id);
		setActiveId(hatId);
	};

	// Featured = highest-rarity item in today's shop
	const featured = useMemo(() => {
		if (!daily.length) return null;
		return [...daily].sort(
			(a, b) =>
				(RARITY_RANK[b.rarity ?? "common"] ?? 0) -
				(RARITY_RANK[a.rarity ?? "common"] ?? 0)
		)[0];
	}, [daily]);

	const dailyRest = useMemo(
		() => (featured ? daily.filter((d) => d.id !== featured.id) : daily),
		[daily, featured]
	);

	const dailyIds = useMemo(() => new Set(daily.map((d) => d.id)), [daily]);

	const browseItems = useMemo(() => {
		if (!categoryFilter) return allItems;
		return allItems.filter((i) => i.category === categoryFilter);
	}, [allItems, categoryFilter]);

	const browseRows = useMemo(() => buildRowsByRarity(browseItems), [browseItems]);

	const ownedItems = useMemo(
		() => allItems.filter((i) => owned.has(i.id)),
		[allItems, owned]
	);

	const wardrobeRows = useMemo(
		() => buildRowsByCategory(ownedItems),
		[ownedItems]
	);

	const categories = useMemo(() => {
		const set = new Set<string>();
		allItems.forEach((i) => i.category && set.add(i.category));
		return Array.from(set).sort((a, b) => {
			const ai = CATEGORY_DISPLAY_ORDER.indexOf(a);
			const bi = CATEGORY_DISPLAY_ORDER.indexOf(b);
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
	}, [allItems]);

	const renderItem = ({ item }: { item: HatRow }) => (
		<ItemCard
			item={item}
			owned={owned.has(item.id)}
			active={activeId === item.id}
			canAfford={counter >= item.cost}
			busy={busyId === item.id}
			onBuy={() => handleBuy(item)}
			onEquip={() => handleEquip(item.id)}
			onUnequip={() => handleEquip(null)}
			onPreview={() => setPreviewItem(item)}
		/>
	);

	const renderListRow = (wardrobeMode: boolean) => ({ item }: { item: ListRow }) => {
		if (item.type === "header") {
			const rarity = item.rarity;
			const accent = rarity ? RARITY_COLORS[rarity] : COLORS.ink4;
			return (
				<View style={styles.sectionHeader}>
					<View style={[styles.sectionDot, { backgroundColor: accent }]} />
					<Text
						style={[
							styles.sectionHeaderText,
							rarity && { color: accent },
						]}
					>
						{item.title.toUpperCase()}
					</Text>
					<View style={[styles.sectionRule, { backgroundColor: accent + "33" }]} />
				</View>
			);
		}
		const [a, b] = item.items;
		return (
			<View style={styles.rowWrap}>
				<View style={styles.rowSlot}>
					<ItemCard
						item={a}
						owned={owned.has(a.id)}
						active={activeId === a.id}
						canAfford={counter >= a.cost}
						busy={busyId === a.id}
						wardrobeMode={wardrobeMode}
						buyable={false}
						onBuy={() => handleBuy(a)}
						onEquip={() => handleEquip(a.id)}
						onUnequip={() => handleEquip(null)}
						onPreview={() => setPreviewItem(a)}
					/>
				</View>
				<View style={styles.rowSlot}>
					{b ? (
						<ItemCard
							item={b}
							owned={owned.has(b.id)}
							active={activeId === b.id}
							canAfford={counter >= b.cost}
							busy={busyId === b.id}
							wardrobeMode={wardrobeMode}
							buyable={false}
							onBuy={() => handleBuy(b)}
							onEquip={() => handleEquip(b.id)}
							onUnequip={() => handleEquip(null)}
							onPreview={() => setPreviewItem(b)}
						/>
					) : null}
				</View>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					<Text style={styles.title}>Shop</Text>
					<View style={styles.balance}>
						<SnoutCoin size={20} />
						<Text style={styles.balanceText}>{counter.toLocaleString()}</Text>
					</View>
				</View>

				<View style={styles.viewToggle}>
					{(["daily", "browse", "wardrobe"] as const).map((v) => {
						const active = v === view;
						const label =
							v === "daily" ? "Today" : v === "browse" ? "Browse" : "Wardrobe";
						return (
							<Pressable
								key={v}
								onPress={() => setView(v)}
								style={[
									styles.viewToggleBtn,
									active && styles.viewToggleBtnActive,
								]}
							>
								<Text
									style={[
										styles.viewToggleText,
										active && styles.viewToggleTextActive,
									]}
								>
									{label}
									{v === "wardrobe" && owned.size > 0 ? ` · ${owned.size}` : ""}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{view === "daily" ? (
					<FlatList
						key="daily"
						data={dailyRest}
						renderItem={renderItem}
						keyExtractor={(item) => item.id}
						numColumns={2}
						contentContainerStyle={styles.grid}
						columnWrapperStyle={styles.columnWrap}
						ListHeaderComponent={
							<>
								<View style={styles.countdownStrip}>
									<Icon name="bell" size={14} color={COLORS.pinkDeep} strokeWidth={2} />
									<Text style={styles.countdownText}>
										New shop in {formatCountdown(resetsIn)}
									</Text>
								</View>
								{featured && (
									<FeaturedCard
										item={featured}
										owned={owned.has(featured.id)}
										active={activeId === featured.id}
										canAfford={counter >= featured.cost}
										busy={busyId === featured.id}
										onBuy={() => handleBuy(featured)}
										onEquip={() => handleEquip(featured.id)}
										onUnequip={() => handleEquip(null)}
									/>
								)}
								{dailyRest.length > 0 && (
									<Text style={styles.sectionLabel}>Also today</Text>
								)}
							</>
						}
						ListEmptyComponent={
							!featured ? (
								<Text style={styles.empty}>
									Empty shop. Come back tomorrow.
								</Text>
							) : null
						}
					/>
				) : view === "browse" ? (
					<FlatList
						key="browse"
						data={browseRows}
						renderItem={renderListRow(false)}
						keyExtractor={(r) => r.key}
						contentContainerStyle={styles.grid}
						ListHeaderComponent={
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.chipsRow}
							>
								<Pressable
									onPress={() => setCategoryFilter(null)}
									style={[
										styles.chip,
										!categoryFilter && styles.chipActive,
									]}
								>
									<Text
										style={[
											styles.chipText,
											!categoryFilter && styles.chipTextActive,
										]}
									>
										All
									</Text>
								</Pressable>
								{categories.map((c) => {
									const active = categoryFilter === c;
									return (
										<Pressable
											key={c}
											onPress={() =>
												setCategoryFilter(active ? null : c)
											}
											style={[
												styles.chip,
												active && styles.chipActive,
											]}
										>
											<Text
												style={[
													styles.chipText,
													active && styles.chipTextActive,
												]}
											>
												{CATEGORY_LABELS[c] ?? c}
											</Text>
										</Pressable>
									);
								})}
							</ScrollView>
						}
						ListEmptyComponent={
							<Text style={styles.empty}>Nothing here.</Text>
						}
					/>
				) : (
					<FlatList
						key="wardrobe"
						data={wardrobeRows}
						renderItem={renderListRow(true)}
						keyExtractor={(r) => r.key}
						contentContainerStyle={styles.grid}
						ListHeaderComponent={
							ownedItems.length > 0 ? (
								<View style={styles.wardrobeIntro}>
									<Text style={styles.wardrobeIntroTitle}>
										Your closet
									</Text>
									<Text style={styles.wardrobeIntroSub}>
										Tap an item to dress your pig.
										{activeId ? "" : " Nothing equipped right now."}
									</Text>
								</View>
							) : null
						}
						ListEmptyComponent={
							<View style={styles.wardrobeEmpty}>
								<Text style={styles.wardrobeEmptyEmoji}>🐷</Text>
								<Text style={styles.wardrobeEmptyTitle}>
									Your closet is bare
								</Text>
								<Text style={styles.wardrobeEmptySub}>
									Buy items in Today or Browse to dress up your pig.
								</Text>
								<View style={{ marginTop: 14 }}>
									<Button
										size="sm"
										variant="primary"
										onPress={() => setView("daily")}
									>
										Visit shop
									</Button>
								</View>
							</View>
						}
					/>
				)}
			</SafeAreaView>

			<ItemPreviewModal
				item={previewItem}
				owned={previewItem ? owned.has(previewItem.id) : false}
				active={previewItem ? activeId === previewItem.id : false}
				canAfford={previewItem ? counter >= previewItem.cost : false}
				balance={counter}
				busy={previewItem ? busyId === previewItem.id : false}
				buyable={previewItem ? dailyIds.has(previewItem.id) : true}
				onClose={() => setPreviewItem(null)}
				onBuy={() => {
					if (previewItem) {
						handleBuy(previewItem);
					}
				}}
				onEquip={() => {
					if (previewItem) {
						handleEquip(previewItem.id);
						setPreviewItem(null);
					}
				}}
				onUnequip={() => {
					handleEquip(null);
					setPreviewItem(null);
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	title: { fontSize: 32, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	balance: {
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		...STICKER_SHADOW,
		transform: [{ rotate: "1.5deg" }],
	},
	balanceText: {
		fontSize: 17,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	viewToggle: {
		flexDirection: "row",
		marginHorizontal: 18,
		marginTop: 8,
		marginBottom: 8,
		backgroundColor: WHIMSY.paper,
		borderRadius: 22,
		padding: 4,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
	},
	viewToggleBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 18,
		alignItems: "center",
	},
	viewToggleBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	viewToggleText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	viewToggleTextActive: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	countdownStrip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 18,
		paddingBottom: 10,
	},
	countdownText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
	},
	sectionLabel: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		letterSpacing: 0.4,
		paddingHorizontal: 18,
		paddingTop: 14,
		paddingBottom: 8,
	},
	chipsRow: {
		paddingHorizontal: 14,
		paddingBottom: 10,
		gap: 8,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 14,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	chipActive: {
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
	},
	chipText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	chipTextActive: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	grid: { paddingHorizontal: 12, paddingBottom: 100 },
	columnWrap: { gap: 10 },
	rowWrap: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 12,
	},
	rowSlot: {
		flex: 1,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 6,
		paddingTop: 14,
		paddingBottom: 10,
	},
	sectionDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	sectionHeaderText: {
		fontSize: 14,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	sectionRule: {
		flex: 1,
		height: 1.5,
		borderRadius: 1,
	},
	card: {
		flex: 1,
		backgroundColor: WHIMSY.paper,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		...STICKER_SHADOW,
	},
	cardThumbWrap: {},
	cardThumb: {
		height: 120,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	cardBody: {
		padding: 10,
	},
	cardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 4,
	},
	priceRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		marginBottom: 8,
		minHeight: 18,
	},
	cardPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	cardOwnedTag: {
		fontSize: 11,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		letterSpacing: 0.5,
	},
	rarityBadge: {
		position: "absolute",
		top: 8,
		right: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
	},
	rarityText: {
		fontSize: 8,
		fontFamily: FONTS.bodyExtra,
		color: "#fff",
		letterSpacing: 0.5,
	},
	featured: {
		marginHorizontal: 14,
		marginBottom: 16,
		borderRadius: 22,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		...STICKER_SHADOW,
		transform: [{ rotate: "-1deg" }],
	},
	featuredBg: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.5,
	},
	featuredRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
	},
	featuredThumbWrap: {
		width: 130,
		height: 130,
		borderRadius: 18,
		backgroundColor: "rgba(255,255,255,0.7)",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 14,
	},
	featuredText: {
		flex: 1,
		minWidth: 0,
	},
	featuredName: {
		fontSize: 20,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 22,
	},
	featuredDesc: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginTop: 2,
		lineHeight: 17,
	},
	featuredCtaRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 10,
		gap: 8,
	},
	featuredPriceWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
	},
	featuredPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
	},
	empty: {
		textAlign: "center",
		padding: 40,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
	wardrobeIntro: {
		paddingHorizontal: 6,
		paddingTop: 6,
		paddingBottom: 4,
	},
	wardrobeIntroTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	wardrobeIntroSub: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	wardrobeEmpty: {
		alignItems: "center",
		paddingVertical: 60,
		paddingHorizontal: 24,
	},
	wardrobeEmptyEmoji: {
		fontSize: 56,
		marginBottom: 14,
	},
	wardrobeEmptyTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		marginBottom: 6,
	},
	wardrobeEmptySub: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 18,
	},
});
