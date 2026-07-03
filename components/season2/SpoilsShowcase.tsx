// "What you can earn" — the Season-2 spoils shelf. A horizontal strip of the
// war-exclusive cosmetics (real HAT_IMAGES art on rarity-tinted cards), the
// Golden Truffle / Truffle Exchange teaser, and the war titles — all framed
// the charter's way: earned in the bog, never sold.
//
// The featured list is a curated subset of WAR_SPOILS_IDS (constants/
// mudFights.ts is the full pool); display names + tiers mirror the rewards
// spec's rarity mapping (docs/wiki/outputs/memos/mudwar-rewards-spec-2026-07).

import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { HAT_IMAGES } from "@/constants/hats";
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

const WAR_TITLES = [
	{ name: "Mud Champion", how: "win a war" },
	{ name: "Mud Veteran", how: "win five" },
	{ name: "Mud Legend", how: "win twenty-five" },
];

export function SpoilsShowcase() {
	return (
		<View>
			{/* The shelf */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.shelf}
			>
				{FEATURED.map((f, i) =>
					HAT_IMAGES[f.id] ? (
						<View
							key={f.id}
							style={[
								styles.itemCard,
								{ backgroundColor: RARITY_BG_SOLID[f.rarity] },
								{ transform: [{ rotate: `${i % 2 === 0 ? -1 : 0.8}deg` }] },
							]}
						>
							<Image
								source={HAT_IMAGES[f.id]}
								style={styles.itemArt}
								resizeMode="contain"
							/>
							<Text style={styles.itemName} numberOfLines={1}>
								{f.name}
							</Text>
							<Text style={styles.itemRarity}>{f.rarity}</Text>
						</View>
					) : null
				)}
			</ScrollView>

			{/* Golden Truffles + the Exchange */}
			<Sticker color="cream" rotate={0.6} radius={RADII.lg} style={styles.truffleCard}>
				{HAT_IMAGES.golden_truffle && (
					<Image
						source={HAT_IMAGES.golden_truffle}
						style={styles.truffleArt}
						resizeMode="contain"
					/>
				)}
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.truffleTitle}>Golden Truffles</Text>
					<Text style={styles.truffleSub}>
						Dig them while he gorges, earn them in every war — then spend them
						at the Truffle Exchange, restocked weekly.
					</Text>
				</View>
			</Sticker>

			{/* Titles */}
			<View style={styles.titlesRow}>
				{WAR_TITLES.map((t) => (
					<View key={t.name} style={styles.titleChip}>
						<Text style={styles.titleName}>{t.name}</Text>
						<Text style={styles.titleHow}>{t.how}</Text>
					</View>
				))}
			</View>

			<Text style={styles.creed}>Earned in the bog. Never sold.</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	shelf: { gap: SPACE.sm, paddingVertical: SPACE.xs, paddingHorizontal: 2 },
	itemCard: {
		width: 108,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
		alignItems: "center",
		...SHADOW_SM,
	},
	itemArt: { width: 56, height: 56 },
	itemName: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		marginTop: SPACE.xs,
	},
	itemRarity: {
		...TYPE.kickerPill,
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	truffleCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		marginTop: SPACE.sm,
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
		marginTop: SPACE.sm,
		justifyContent: "center",
	},
	titleChip: {
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
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
		marginTop: SPACE.md,
	},
});
