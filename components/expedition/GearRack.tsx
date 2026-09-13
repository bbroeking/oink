import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { HAT_IMAGES } from "@/constants/hats";
import {
	ART_SIZE,
	BORDER,
	RADII,
	RARITY_STRIPE,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Sticker } from "@/components/ui/Sticker";
import { ListRow } from "@/components/ui/ListRow";
import { Stat } from "@/components/ui/Stat";
import { Kicker, T } from "@/components/ui/Text";
import {
	GEAR,
	GEAR_LIST,
	statTotals,
	type ExpeditionState,
	type GearSlot,
} from "@/utils/expedition";
import { StatPips } from "./StatPips";

const SLOTS: { slot: GearSlot; label: string }[] = [
	{ slot: "head", label: "Head" },
	{ slot: "body", label: "Body" },
	{ slot: "held", label: "Held" },
	{ slot: "charm", label: "Charm" },
];

// Drawing geometry, not spacing: the thumbnail a gear row carries. One step
// under `ART_SIZE.glyph` so the row's art reads as a companion to the name
// rather than a portrait. (There is no ART_SIZE step here — see System asks.)
const ROW_ART = 34;

// Four gear slots with the equipped piece's placeholder art (its artHatId PNG),
// the owned-gear rows to equip, and the Bonk/Cushion/Sparkle readout.
export function GearRack({
	state,
	onEquip,
}: {
	state: ExpeditionState;
	onEquip: (gearId: string) => void;
}) {
	const totals = statTotals(state);
	return (
		<View>
			<SectionHeader kicker="the satchel" title="Gear" />
			<View style={styles.slotRow}>
				{SLOTS.map(({ slot, label }) => {
					const id = state.loadout[slot];
					const gear = id ? GEAR[id] : null;
					return (
						<Sticker
							key={slot}
							color="cream"
							rotate={0}
							radius={RADII.md}
							shadow="none"
							style={styles.slot}
						>
							{gear ? (
								<Image
									source={HAT_IMAGES[gear.artHatId]}
									resizeMode="contain"
									style={styles.slotArt}
								/>
							) : (
								<T role="cardTitle" tone="disabled" style={styles.slotEmpty}>
									—
								</T>
							)}
							<T role="kickerPillSm" tone="secondary">
								{label}
							</T>
						</Sticker>
					);
				})}
			</View>

			<View style={styles.statsRow}>
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.md}
					shadow="sm"
					style={styles.stat}
				>
					<Stat value={totals.bonk} label="Bonk" />
				</Sticker>
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.md}
					shadow="sm"
					style={styles.stat}
				>
					<Stat value={totals.cushion} label="Cushion" />
				</Sticker>
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.md}
					shadow="sm"
					style={styles.stat}
				>
					<Stat value={totals.sparkle} label="Sparkle" />
				</Sticker>
			</View>

			<Kicker style={styles.ownedKicker}>owned gear</Kicker>
			<View style={styles.rowWrap}>
				{GEAR_LIST.filter((g) => state.gearOwned.includes(g.id)).map((g, i) => {
					const equipped = state.loadout[g.slot] === g.id;
					return (
						<ListRow
							key={g.id}
							index={i}
							selected={equipped}
							fill={equipped ? "sun" : undefined}
							onPress={() => onEquip(g.id)}
							accessibilityLabel={`${g.name}, ${g.slot} gear`}
							accessibilityHint={
								equipped
									? "Already worn on the road."
									: `Wears it in the ${g.slot} slot for the next ramble.`
							}
							leading={
								<Image
									source={HAT_IMAGES[g.artHatId]}
									resizeMode="contain"
									style={styles.rowArt}
								/>
							}
							title={<T role="cardTitleSm">{g.name}</T>}
							sub={
								<View style={styles.rowCopy}>
									<StatPips
										pips={{
											bonk: g.bonk,
											cushion: g.cushion,
											sparkle: g.sparkle,
										}}
									/>
									<T role="bodySm" tone="secondary">
										{g.ability
											? g.ability.flavorLine
											: "A steady piece of workwear."}
									</T>
								</View>
							}
							trailing={
								<View
									style={[
										styles.rarityDot,
										{
											backgroundColor:
												RARITY_STRIPE[g.rarity] ?? UI_COLORS.uiMuted,
										},
									]}
								/>
							}
						/>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	slotRow: { flexDirection: "row", gap: SPACE.sm },
	slot: {
		flex: 1,
		alignItems: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm,
	},
	slotArt: { width: ART_SIZE.glyph, height: ART_SIZE.glyph },
	// Holds the empty slot open to exactly the height its art would fill.
	slotEmpty: { height: ART_SIZE.glyph, lineHeight: ART_SIZE.glyph },
	statsRow: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	stat: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm },
	ownedKicker: {
		marginTop: SPACE.md,
		marginBottom: SPACE.xs,
	},
	rowWrap: { gap: SPACE.sm },
	rowArt: { width: ROW_ART, height: ROW_ART },
	rowCopy: { gap: SPACE.xs },
	rarityDot: {
		width: ART_SIZE.mark,
		height: ART_SIZE.mark,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
});
