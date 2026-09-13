// "What you can earn" — the Season-1 earnables shelf. A horizontal strip of the
// exchange-exclusive cosmetics (real HAT_IMAGES art on rarity-tinted cards), the
// Golden Truffle / Truffle Exchange teaser, and the herd dig-milestone titles —
// all framed the charter's way: earned at the feedings, never sold.
//
// The featured list is a curated subset of EXCHANGE_ITEM_IDS (constants/dig.ts
// is the full pool); display names + tiers mirror the rewards spec's rarity
// mapping (docs/wiki/outputs/memos/mudwar-rewards-spec-2026-07).

import { View, Image, ScrollView, StyleSheet } from "react-native";
import { CardTitle, Hand, Sticker, T } from "../ui";
import { cosmeticImage } from "@/utils/rewardArt";
import {
	BORDER,
	RADII,
	RARITY_BG_SOLID,
	SPACE,
	TILT,
} from "@/constants/theme";

// The shelf's drawing geometry — the width of a spoils card and the two art
// boxes on it. Art sizes, not spacing steps: `ART_SIZE` has no 56/44 step, so
// they are named here with the surface that draws them. (2026-09-11)
const SHELF_CARD_WIDTH = 124;
const SHELF_ART = 56;
const TRUFFLE_ART = 44;

// Curated shelf — one per tier band, marquee first. Ids must exist in
// HAT_IMAGES (all 25 war spoils are bundled since build 101).
const FEATURED: { id: string; name: string; rarity: keyof typeof RARITY_BG_SOLID }[] = [
	{ id: "swamp_crown", name: "Swamp Crown", rarity: "legendary" },
	{ id: "heirloom_mire_aura", name: "Heirloom Mire Aura", rarity: "legendary" },
	{ id: "golden_bog_aura", name: "Golden Bog Aura", rarity: "epic" },
	{ id: "golden_truffle", name: "Golden Truffle", rarity: "rare" },
	{ id: "firefly_aura", name: "Firefly Aura", rarity: "rare" },
	{ id: "prize_sash", name: "Prize Sash", rarity: "uncommon" },
	{ id: "crew_pennant", name: "Crew Pennant", rarity: "uncommon" },
	{ id: "muddy_cap", name: "Muddy Cap", rarity: "common" },
];

// Herd dig-milestone titles — granted to every member as the whole Sounder's
// lifetime finds cross each threshold (mirrors MILESTONE_TITLES in utils/dig).
const HERD_TITLES = [
	{ name: "Root Rustler", how: "150 herd finds" },
	{ name: "Truffle Baron", how: "600 herd finds" },
	{ name: "Hunger's Bane", how: "1,800 herd finds" },
];

export function SpoilsShowcase() {
	const truffleArt = cosmeticImage("golden_truffle");
	return (
		<View>
			{/* The shelf */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.shelf}
			>
				{FEATURED.map((f, i) => {
					const art = cosmeticImage(f.id);
					return art ? (
						<Sticker
							key={f.id}
							color={RARITY_BG_SOLID[f.rarity]}
							rotate={i % 2 === 0 ? TILT.card : -TILT.card}
							radius={RADII.lg}
							shadow="sm"
							style={styles.itemCard}
						>
							<Image
								source={art}
								style={styles.itemArt}
								resizeMode="contain"
							/>
							<T
								role="bodySm"
								align="center"
								numberOfLines={2}
								style={styles.itemName}
							>
								{f.name}
							</T>
							<T role="kickerPill" tone="secondary">
								{f.rarity}
							</T>
						</Sticker>
					) : null;
				})}
			</ScrollView>

			{/* Golden Truffles + the Exchange */}
			<Sticker
				color="cream"
				rotate={-TILT.card}
				radius={RADII.lg}
				style={styles.truffleCard}
			>
				{truffleArt && (
					<Image
						source={truffleArt}
						style={styles.truffleArt}
						resizeMode="contain"
					/>
				)}
				<View style={styles.truffleText}>
					<CardTitle>Golden Truffles</CardTitle>
					<T role="bodySm" tone="secondary" style={styles.truffleSub}>
						Dig them at every feeding while he gorges — then spend them at the
						Truffle Exchange, restocked weekly.
					</T>
				</View>
			</Sticker>

			{/* Herd milestone titles */}
			<View style={styles.titlesRow}>
				{HERD_TITLES.map((t) => (
					<Sticker
						key={t.name}
						color="paper"
						rotate={0}
						radius={RADII.pill}
						border={BORDER.thin}
						shadow="sm"
						style={styles.titleChip}
						accessibilityRole="text"
						accessibilityLabel={`${t.name} — ${t.how}`}
					>
						<T role="cardTitleSm">{t.name}</T>
						<T role="kicker" tone="secondary">
							{t.how}
						</T>
					</Sticker>
				))}
			</View>

			<Hand tone="accent" align="center" style={styles.creed}>
				Earned at the feedings. Never sold.
			</Hand>
		</View>
	);
}

const styles = StyleSheet.create({
	shelf: {
		gap: SPACE.sm,
		paddingVertical: SPACE.xs,
		// Left gutter clears the card tilt; right gutter leaves a consistent
		// ~24pt peek so the last card reads as "keep scrolling".
		paddingLeft: SPACE.xxs,
		paddingRight: SPACE.xl,
	},
	itemCard: {
		width: SHELF_CARD_WIDTH,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		alignItems: "center",
	},
	itemArt: { width: SHELF_ART, height: SHELF_ART },
	itemName: { marginTop: SPACE.xs },
	truffleCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		marginTop: SPACE.lg,
	},
	truffleArt: { width: TRUFFLE_ART, height: TRUFFLE_ART },
	truffleText: { flex: 1, minWidth: 0 },
	truffleSub: { marginTop: SPACE.xxs },
	titlesRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
		marginTop: SPACE.lg,
		justifyContent: "center",
	},
	titleChip: {
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		alignItems: "center",
	},
	creed: { marginTop: SPACE.lg },
});
