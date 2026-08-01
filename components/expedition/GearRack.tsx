import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { HAT_IMAGES, RARITY_COLORS } from "@/constants/hats";
import {
	RADII,
	SPACE,
	SHADOW_SM,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

// Four gear slots with the equipped piece's placeholder art (its artHatId PNG),
// the owned-gear chips to equip, and the Bonk/Cushion/Sparkle readout.
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
						<View key={slot} style={styles.slot}>
							{gear ? (
								<Image
									source={HAT_IMAGES[gear.artHatId]}
									resizeMode="contain"
									style={styles.slotArt}
								/>
							) : (
								<Text style={styles.slotEmpty}>—</Text>
							)}
							<Text style={styles.slotLabel}>{label}</Text>
						</View>
					);
				})}
			</View>

			<View style={styles.statsRow}>
				<Stat label="Bonk" value={totals.bonk} />
				<Stat label="Cushion" value={totals.cushion} />
				<Stat label="Sparkle" value={totals.sparkle} />
			</View>

			<Text style={styles.ownedKicker}>★ owned gear</Text>
			<View style={styles.chipWrap}>
				{GEAR_LIST.filter((g) => state.gearOwned.includes(g.id)).map((g) => {
					const equipped = state.loadout[g.slot] === g.id;
					return (
						<Pressable
							key={g.id}
							onPress={() => onEquip(g.id)}
							accessibilityRole="button"
							accessibilityLabel={`Equip ${g.name}`}
							style={({ pressed }) => [
								styles.chip,
								equipped && styles.chipOn,
								pressed && styles.pressed,
							]}
						>
							<Image
								source={HAT_IMAGES[g.artHatId]}
								resizeMode="contain"
								style={styles.chipArt}
							/>
							<View style={styles.chipCopy}>
								<Text style={styles.chipName}>
									{g.name}
								</Text>
								<StatPips
									pips={{ bonk: g.bonk, cushion: g.cushion, sparkle: g.sparkle }}
								/>
								<Text style={styles.chipAbility}>
									{g.ability ? g.ability.flavorLine : "A steady piece of workwear."}
								</Text>
							</View>
							<View
								style={[
									styles.rarityDot,
									{ backgroundColor: RARITY_COLORS[g.rarity] ?? WHIMSY.muteSoft },
								]}
							/>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<View style={styles.stat}>
			<Text style={styles.statValue}>{value}</Text>
			<Text style={styles.statLabel}>{label}</Text>
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
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
	},
	slotArt: { width: 40, height: 40 },
	slotEmpty: {
		...TYPE.cardTitle,
		color: UI_COLORS.textDisabled,
		height: 40,
		lineHeight: 40,
	},
	slotLabel: { ...TYPE.kickerPillSm, color: UI_COLORS.textSecondary },
	statsRow: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	stat: {
		flex: 1,
		alignItems: "center",
		paddingVertical: SPACE.sm,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	statValue: { ...TYPE.sectionTitle, color: UI_COLORS.textPrimary },
	statLabel: { ...TYPE.kickerPillSm, color: UI_COLORS.textSecondary },
	ownedKicker: {
		...TYPE.kicker,
		color: UI_COLORS.action,
		marginTop: SPACE.md,
		marginBottom: SPACE.xs,
	},
	chipWrap: { gap: SPACE.sm },
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		padding: SPACE.sm,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
	},
	chipOn: { backgroundColor: WHIMSY.sun, ...SHADOW_SM },
	chipArt: { width: 34, height: 34 },
	chipCopy: { flex: 1, gap: SPACE.xs },
	chipName: { ...TYPE.cardTitleSm, color: UI_COLORS.textPrimary },
	chipAbility: { ...TYPE.bodySm, color: UI_COLORS.textSecondary },
	rarityDot: {
		width: 12,
		height: 12,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: UI_COLORS.border,
	},
	pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
