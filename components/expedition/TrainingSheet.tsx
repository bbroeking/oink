import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import {
	MODAL_BACKDROP_BG,
	PAGE_PAD,
	RADII,
	SPACE,
	SHADOW_SM,
	STICKER_SHADOW,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Sticker } from "@/components/ui/Sticker";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
// ceremony: pick a dupe, then pick the stat it teaches. In-screen overlay (v0).
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
		<View style={styles.backdrop}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}
			>
				<Sticker color="paper" rotate={-0.8} radius={RADII.md} style={styles.card}>
					<Text style={styles.kicker}>★ training</Text>
					<Text style={styles.title}>Tuck a dupe under Rosie</Text>
					<Text style={styles.sub}>
						{state.training.length}/{TRAINING_CAP} tucks used · a permanent +1 to
						one stat.
					</Text>

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
							<Text style={styles.step}>1 · pick a duplicate</Text>
							<View style={styles.dupes}>
								{dupes.map((id) => {
									const on = picked === id;
									return (
										<Pressable
											key={id}
											onPress={() => setPicked(id)}
											style={({ pressed }) => [
												styles.dupe,
												on && styles.dupeOn,
												pressed && styles.pressed,
											]}
										>
											<Text style={styles.dupeName}>{CARDS[id].name}</Text>
											<Text style={styles.dupeCount}>×{state.deck[id]}</Text>
										</Pressable>
									);
								})}
							</View>

							<Text style={styles.step}>2 · pick a stat</Text>
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
									>
										+1 {label}
									</Button>
								))}
							</View>
						</>
					)}

					<Button variant="ghost" full onPress={onClose} style={styles.close}>
						Done
					</Button>
				</Sticker>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		zIndex: 50,
	},
	scroll: {
		padding: PAGE_PAD,
		paddingVertical: SPACE.xl,
		flexGrow: 1,
		justifyContent: "center",
	},
	card: { padding: SPACE.lg, ...STICKER_SHADOW },
	kicker: { ...TYPE.kicker, color: UI_COLORS.action, textAlign: "center" },
	title: {
		...TYPE.sectionTitle,
		color: UI_COLORS.textPrimary,
		textAlign: "center",
	},
	sub: {
		...TYPE.bodySm,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
		marginTop: SPACE.xs,
		marginBottom: SPACE.md,
	},
	step: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.action,
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
	},
	dupes: { gap: SPACE.sm },
	dupe: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: SPACE.md,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
	},
	dupeOn: { backgroundColor: WHIMSY.sun, ...SHADOW_SM },
	dupeName: { ...TYPE.cardTitleSm, color: UI_COLORS.textPrimary },
	dupeCount: { ...TYPE.label, color: UI_COLORS.textSecondary },
	stats: { flexDirection: "row", gap: SPACE.sm },
	statBtn: { flex: 1 },
	close: { marginTop: SPACE.lg },
	pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
