import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SPACE } from "@/constants/theme";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Tag } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { T } from "@/components/ui/Text";
import {
	CARDS,
	TRAINING_CAP,
	type ExpeditionState,
	type StatKey,
} from "@/utils/expedition";

const STATS: { stat: StatKey; label: string }[] = [
	{ stat: "bonk", label: "Bonk" },
	{ stat: "cushion", label: "Cushion" },
	{ stat: "sparkle", label: "Sparkle" },
];

// Training — slide a DUPLICATE card under Rosie for a permanent +1. Dupe-only
// (you always keep the last copy), capped at TRAINING_CAP tucks. The tabletop
// ceremony: pick a dupe, then pick the stat it teaches. It is a bottom sheet, so
// it mounts `Sheet` — the panel owns the grabber, the title block and the close.
export function TrainingSheet({
	state,
	onTrain,
	onClose,
}: {
	state: ExpeditionState;
	onTrain: (cardId: string, stat: StatKey) => void;
	onClose: () => void;
}) {
	const [picked, setPicked] = useState<string | null>(null);
	const dupes = Object.keys(state.deck).filter(
		(id) => (state.deck[id] ?? 0) > 1 && CARDS[id]
	);
	const atCap = state.training.length >= TRAINING_CAP;

	return (
		<Sheet
			open
			onClose={onClose}
			kicker="training"
			title="Tuck a dupe under Rosie"
			subtitle={`${state.training.length}/${TRAINING_CAP} tucks used · a permanent +1 to one stat.`}
			closeLabel="Close training"
			footer={
				<Button variant="ghost" full onPress={onClose}>
					Done
				</Button>
			}
		>
			{atCap ? (
				<EmptyState
					glyph="trophy"
					title="Rosie's satchel is full"
					sub="She's carried all the training she can this chapter."
				/>
			) : dupes.length === 0 ? (
				<EmptyState
					glyph="sparkle"
					title="No duplicates yet"
					sub="Find a second copy of a Trick, then slide it under Rosie."
				/>
			) : (
				<>
					<T role="kickerPillSm" tone="accent" style={styles.step}>
						1 · pick a duplicate
					</T>
					<View style={styles.dupes}>
						{dupes.map((id, i) => {
							const on = picked === id;
							const copies = state.deck[id] ?? 0;
							return (
								<ListRow
									key={id}
									index={i}
									selected={on}
									fill={on ? "sun" : undefined}
									onPress={() => setPicked(id)}
									accessibilityLabel={`${CARDS[id].name}, ${copies} copies`}
									accessibilityHint="Picks this duplicate to tuck under Rosie."
									title={<T role="cardTitleSm">{CARDS[id].name}</T>}
									trailing={<Tag label={`×${copies}`} />}
								/>
							);
						})}
					</View>

					<T role="kickerPillSm" tone="accent" style={styles.step}>
						2 · pick a stat
					</T>
					<View style={styles.stats}>
						{STATS.map(({ stat, label }) => (
							<Button
								key={stat}
								variant={picked ? "primary" : "locked"}
								size="sm"
								disabled={!picked}
								onPress={() => {
									if (picked) {
										onTrain(picked, stat);
										setPicked(null);
									}
								}}
								style={styles.statBtn}
								accessibilityLabel={`Teach +1 ${label}`}
								accessibilityHint={
									picked
										? `Spends the duplicate ${CARDS[picked].name} for a permanent +1 ${label}.`
										: "Pick a duplicate above first."
								}
							>
								+1 {label}
							</Button>
						))}
					</View>
				</>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	step: {
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
	},
	dupes: { gap: SPACE.sm },
	stats: { flexDirection: "row", gap: SPACE.sm },
	statBtn: { flex: 1 },
});
