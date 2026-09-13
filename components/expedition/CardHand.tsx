import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
	BORDER,
	RADII,
	RARITY_STRIPE,
	ROW_TILTS,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sticker } from "@/components/ui/Sticker";
import { T } from "@/components/ui/Text";
import { CARDS, drawHand, type ExpeditionState } from "@/utils/expedition";
import { StatPips, abilityPips } from "./StatPips";

// Drawing geometry, not spacing: the height a dealt card holds open so three
// cards in a hand stay the same size whatever their copy, and the rarity stripe
// down a card's spine. Neither is a SPACE step — they are the card's shape.
const CARD_MIN_H = 140;
const SPINE_W = 6;

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
							<Sticker
								key={`${id}-${i}`}
								color={tucked ? "sun" : "paper"}
								// Light hand-drawn scrapbook angle, cycled like the shared row
								// tilts so no two cards sit at the same tidy angle. A tucked
								// card sits straight, the way a pinned row does.
								rotate={tucked ? 0 : ROW_TILTS[i % ROW_TILTS.length]}
								radius={RADII.md}
								border={tucked ? BORDER.heavy : BORDER.ink}
								shadow={tucked ? "sticker" : "sm"}
								onPress={() => onTuck(id)}
								accessibilityLabel={`${card.name}, ${card.rarity} Trick`}
								accessibilityHint={
									tucked
										? "Already tucked in the satchel for this trip."
										: "Tucks it in the satchel for the road."
								}
								accessibilityState={{ selected: tucked }}
								style={styles.card}
							>
								<View
									style={[
										styles.spine,
										{
											backgroundColor:
												RARITY_STRIPE[card.rarity] ?? UI_COLORS.uiMuted,
										},
									]}
								/>
								<T role="cardTitleSm">{card.name}</T>
								<StatPips pips={abilityPips(card.ability)} />
								<T role="bodySm" tone="secondary" style={styles.cardBody}>
									{card.ability.flavorLine}
								</T>
								<T role="kickerPillSm" tone="accent" style={styles.tuckTag}>
									{tucked ? "TUCKED" : "tap to tuck"}
								</T>
							</Sticker>
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
		minHeight: CARD_MIN_H,
		padding: SPACE.sm,
		paddingLeft: SPACE.md,
		overflow: "hidden",
	},
	spine: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		width: SPINE_W,
	},
	cardBody: {
		marginTop: SPACE.xs,
		flex: 1,
	},
	tuckTag: {
		marginTop: SPACE.xs,
	},
});
