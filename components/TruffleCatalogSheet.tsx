// TruffleCatalogSheet — a catalog of the 25 exchange-exclusive cosmetics,
// grouped by rarity, with owned items lit + a check and unearned ones dimmed.
// Earn them by digging Golden Truffles at the feedings and trading at the
// Truffle Exchange. Catalog comes from the hats table (keyed by
// EXCHANGE_ITEM_IDS); owned state from user_hats.
//
// Wave-4 conformance pass: the panel is the `Sheet` primitive (kicker / title /
// subtitle / pinned footer) rather than a hand-rolled paper card inside
// SlideUpSheet, each tile is a `Sticker`, the rarity word rides `RARITY_BADGE`
// ink, and the locked tile keeps its shape on a muted fill instead of being
// dissolved to 0.32 opacity. [C-07, C-09, C-17, C-18]
import { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { supabase } from "@/utils/supabase";
import {
	Button,
	Icon,
	LoadingBeat,
	Sheet,
	Sticker,
	T,
} from "@/components/ui";
import { HAT_IMAGES, type Rarity } from "@/constants/hats";
import { EXCHANGE_ITEM_IDS } from "@/constants/dig";
import {
	BORDER,
	RADII,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

interface SpoilRow {
	id: string;
	name: string;
	rarity: Rarity;
	owned: boolean;
}

const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

// Drawing geometry for the grid, not spacing: three tiles to a row, and the
// owned tick's corner well. Named so the numbers stop being loose literals.
const TILE_WIDTH = "31%";
const TILE_ART = "78%";
const CHECK_WELL = 20;
const CHECK_MARK = 13;
const LOCK_MARK = 14;

interface Props {
	open: boolean;
	onClose: () => void;
}

export function TruffleCatalogSheet({ open, onClose }: Props) {
	const [rows, setRows] = useState<SpoilRow[] | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		(async () => {
			const ids: string[] = [...EXCHANGE_ITEM_IDS];
			const { data: auth } = await supabase.auth.getUser();
			const uid = auth.user?.id;
			const [catRes, ownedRes] = await Promise.all([
				supabase.from("hats").select("id, name, rarity").in("id", ids),
				uid ? supabase.from("user_hats").select("hat_id").eq("user_id", uid) : Promise.resolve({ data: [] as { hat_id: string }[] }),
			]);
			if (cancelled) return;
			const ownedSet = new Set((ownedRes.data ?? []).map((r) => r.hat_id));
			const cat = (catRes.data ?? []) as { id: string; name: string; rarity: Rarity }[];
			const ordered = cat
				.map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, owned: ownedSet.has(c.id) }))
				.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
			setRows(ordered);
		})();
		return () => {
			cancelled = true;
		};
	}, [open]);

	if (!open) return null;

	const ownedCount = rows ? rows.filter((r) => r.owned).length : 0;
	const total = rows ? rows.length : EXCHANGE_ITEM_IDS.length;

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="exclusives"
			title="What you can earn"
			footer={
				<Button
					full
					variant="gold"
					onPress={onClose}
					accessibilityLabel="Done"
					accessibilityHint="Closes the trophy case"
					testID="truffle-catalog-done"
				>
					Done
				</Button>
			}
			testID="truffle-catalog-sheet"
		>
			<T role="hand" tone="secondary" style={styles.sub}>
				Dig at the feedings for Golden Truffles, then trade them for these exclusives at the Exchange.
				{"  "}
				<T role="bodySm" style={styles.count}>
					{ownedCount}/{total} earned
				</T>
			</T>

			{/* The Sheet body already scrolls; a nested vertical ScrollView here
			    would fight it, so the grid is a plain wrapping row. */}
			<View style={styles.grid}>
				{rows === null ? (
					<LoadingBeat label="fetching the trophy case" />
				) : (
					rows.map((r) => {
						const badge = RARITY_BADGE[r.rarity] ?? RARITY_BADGE.common;
						const fill = RARITY_BG_SOLID[r.rarity] ?? WHIMSY.cream;
						const img = HAT_IMAGES[r.id];
						return (
							<Sticker
								key={r.id}
								// An unearned tile keeps its whole shape on the muted
								// fill — never an opacity crush. [C-07]
								color={r.owned ? "cream" : UI_COLORS.surfaceStrong}
								rotate={0}
								radius={RADII.lg}
								border={BORDER.ink}
								shadow="sm"
								accessibilityRole="text"
								accessibilityLabel={`${r.name}, ${r.rarity}, ${r.owned ? "earned" : "not earned yet"}`}
								style={[styles.tile, { borderColor: badge.ink }]}
							>
								<View style={[styles.thumbWrap, { backgroundColor: fill }]}>
									{img ? (
										<Image source={img} style={styles.thumb} resizeMode="contain" />
									) : null}
									{r.owned ? (
										<View style={[styles.check, { backgroundColor: badge.bg }]}>
											<Icon name="check" size={CHECK_MARK} color={WHIMSY.ink} strokeWidth={2.4} />
										</View>
									) : (
										<View style={styles.lock}>
											<Icon name="lock" size={LOCK_MARK} color={UI_COLORS.uiMuted} strokeWidth={1.8} />
										</View>
									)}
								</View>
								<T role="kickerPillSm" align="center" numberOfLines={1} style={styles.name}>
									{r.name}
								</T>
								<T role="kicker" align="center" style={[styles.rarity, { color: badge.ink }]}>
									{r.rarity}
								</T>
							</Sticker>
						);
					})
				)}
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	sub: { marginBottom: SPACE.md },
	count: { color: UI_COLORS.textPrimary },

	grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, justifyContent: "space-between" },

	tile: {
		width: TILE_WIDTH,
		paddingBottom: SPACE.xs,
		overflow: "hidden",
	},
	thumbWrap: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
	thumb: { width: TILE_ART, height: TILE_ART },
	check: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		width: CHECK_WELL,
		height: CHECK_WELL,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	lock: { position: "absolute", top: SPACE.xs, right: SPACE.xs },
	name: { textTransform: "none", marginTop: SPACE.xs, paddingHorizontal: SPACE.xxs },
	rarity: { textTransform: "capitalize" },
});
