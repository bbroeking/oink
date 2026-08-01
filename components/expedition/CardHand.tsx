import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { RARITY_COLORS } from "@/constants/hats";
import {
	RADII,
	ROW_TILTS,
	SPACE,
	SHADOW_SM,
	STICKER_SHADOW,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CARDS, drawHand, type ExpeditionState } from "@/utils/expedition";
import { StatPips, abilityPips } from "./StatPips";

// The daily 3-card draw: pick one to TUCK in the satchel (its passive shapes the
// trip; it can be played in a fight instead). The hand is seeded stable per day.
export function CardHand({
	state,
	dateKey,
	onTuck,
}: {
	state: ExpeditionState;
	dateKey: string;
	onTuck: (cardId: string) => void;
}) {
	const hand = useMemo(() => drawHand(state, dateKey), [state, dateKey]);

	return (
		<View>
			<SectionHeader kicker="draw three, tuck one" title="Tricks" />
			{hand.length === 0 ? (
				<EmptyState
					glyph="sparkle"
					title="No Tricks yet"
					sub="Find cards on the road to build your deck."
				/>
			) : (
				<View style={styles.hand}>
					{hand.map((id, i) => {
						const card = CARDS[id];
						if (!card) return null;
						const tucked = state.tuckedCardId === id;
						return (
							<Pressable
								key={`${id}-${i}`}
								onPress={() => onTuck(id)}
								accessibilityRole="button"
								accessibilityLabel={`Tuck ${card.name}`}
								// Light hand-drawn scrapbook angle, cycled like the shared row
								// tilts so no two cards sit at the same tidy angle.
								style={({ pressed }) => [
									styles.card,
									{ transform: [{ rotate: `${ROW_TILTS[i % ROW_TILTS.length]}deg` }] },
									tucked && styles.cardTucked,
									pressed && styles.pressed,
								]}
							>
								<View
									style={[
										styles.rarityStripe,
										{ backgroundColor: RARITY_COLORS[card.rarity] ?? WHIMSY.muteSoft },
									]}
								/>
								<Text style={styles.cardName}>
									{card.name}
								</Text>
								<StatPips pips={abilityPips(card.ability)} />
								<Text style={styles.cardBody}>
									{card.ability.flavorLine}
								</Text>
								<Text style={styles.tuckTag}>
									{tucked ? "TUCKED" : "tap to tuck"}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	hand: { flexDirection: "row", gap: SPACE.sm },
	card: {
		flex: 1,
		minHeight: 140,
		padding: SPACE.sm,
		paddingLeft: SPACE.md,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		...SHADOW_SM,
	},
	cardTucked: { backgroundColor: WHIMSY.sun, ...STICKER_SHADOW },
	rarityStripe: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		width: 6,
	},
	cardName: { ...TYPE.cardTitleSm, color: UI_COLORS.textPrimary },
	cardBody: {
		...TYPE.bodySm,
		color: UI_COLORS.textSecondary,
		marginTop: SPACE.xs,
		flex: 1,
	},
	tuckTag: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.action,
		marginTop: SPACE.xs,
	},
	pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
