// "What you can earn" — the Season-1 earnables shelf. A horizontal strip of the
// exchange-exclusive cosmetics (real HAT_IMAGES art on rarity-tinted cards), the
// Golden Truffle / Truffle Exchange teaser, and the herd dig-milestone titles —
// all framed the charter's way: earned at the feedings, never sold.
//
// The featured list is a curated subset of EXCHANGE_ITEM_IDS (constants/dig.ts
// is the full pool); display names + tiers mirror the rewards spec's rarity
// mapping (docs/wiki/outputs/memos/mudwar-rewards-spec-2026-07).

import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { cosmeticImage } from "@/utils/rewardArt";
import {
	FONTS,
	RADII,
	RARITY_BG_SOLID,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

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
						<View
							key={f.id}
							style={[
								styles.itemCard,
								{ backgroundColor: RARITY_BG_SOLID[f.rarity] },
								{ transform: [{ rotate: `${i % 2 === 0 ? -1 : 0.8}deg` }] },
							]}
						>
							<Image
								source={art}
								style={styles.itemArt}
								resizeMode="contain"
							/>
							<Text style={styles.itemName} numberOfLines={2}>
								{f.name}
							</Text>
							<Text style={styles.itemRarity}>{f.rarity}</Text>
						</View>
					) : null;
				})}
			</ScrollView>

			{/* Golden Truffles + the Exchange */}
			<Sticker color="cream" rotate={0.6} radius={RADII.lg} style={styles.truffleCard}>
				{truffleArt && (
					<Image
						source={truffleArt}
						style={styles.truffleArt}
						resizeMode="contain"
					/>
				)}
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.truffleTitle}>Golden Truffles</Text>
					<Text style={styles.truffleSub}>
						Dig them at every feeding while he gorges — then spend them at the
						Truffle Exchange, restocked weekly.
					</Text>
				</View>
			</Sticker>

			{/* Herd milestone titles */}
			<View style={styles.titlesRow}>
				{HERD_TITLES.map((t) => (
					<View key={t.name} style={styles.titleChip}>
						<Text style={styles.titleName}>{t.name}</Text>
						<Text style={styles.titleHow}>{t.how}</Text>
					</View>
				))}
			</View>

			<Text style={styles.creed}>Earned at the feedings. Never sold.</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	shelf: {
		gap: SPACE.sm,
		paddingVertical: SPACE.xs,
		// Left gutter clears the card tilt; right gutter leaves a consistent
		// ~24pt peek so the last card reads as "keep scrolling".
		paddingLeft: 2,
		paddingRight: SPACE.xl,
	},
	itemCard: {
		width: 124,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		alignItems: "center",
		...SHADOW_SM,
	},
	itemArt: { width: 56, height: 56 },
	itemName: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	// Bumped off the 9px floor to 10 — the rarity caption stays a quiet tracked
	// kicker but clears the squint-small legibility floor.
	itemRarity: {
		...TYPE.kickerPill,
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	truffleCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		marginTop: SPACE.lg,
	},
	truffleArt: { width: 44, height: 44 },
	truffleTitle: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	truffleSub: {
		...TYPE.bodySm,
		fontFamily: FONTS.body,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	titlesRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
		marginTop: SPACE.lg,
		justifyContent: "center",
	},
	titleChip: {
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		alignItems: "center",
	},
	titleName: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	titleHow: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute, fontSize: 11 },
	creed: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.lg,
	},
});
