import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
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
import {
	BESTIARY_IDS,
	BESTIARY_NAMES,
	ENEMIES,
	BRAMBLE_ID,
	type ExpeditionState,
} from "@/utils/expedition";
import { EnemySilhouette, type SilhouetteId } from "./EnemySilhouette";

// The Bestiary — four entries, silhouette → met → defeated. An unseen page hides
// behind a question, a met page shows the silhouette + behavior, a defeated page
// dims it (real art lands later). In-screen overlay for v0.
export function BestiaryShelf({
	state,
	onClose,
}: {
	state: ExpeditionState;
	onClose: () => void;
}) {
	return (
		<View style={styles.backdrop}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}
			>
				<Sticker color="paper" rotate={-0.6} radius={RADII.md} style={styles.card}>
					<Text style={styles.kicker}>★ bestiary</Text>
					<Text style={styles.title}>Who's on the road</Text>

					<View style={styles.grid}>
						{BESTIARY_IDS.map((id) => {
							const status = state.bestiary[id] ?? "unseen";
							const enemy = ENEMIES[id];
							const line =
								id === BRAMBLE_ID
									? "A tangle that wants Cushion to pass."
									: enemy?.behaviorLine ?? "";
							return (
								<View key={id} style={styles.entry}>
									<View style={styles.art}>
										{status === "unseen" ? (
											<Text style={styles.unknown}>?</Text>
										) : (
											<EnemySilhouette
												id={id as SilhouetteId}
												size={64}
												defeated={status === "defeated"}
											/>
										)}
									</View>
									<Text style={styles.name}>
										{status === "unseen" ? "Unknown" : BESTIARY_NAMES[id]}
									</Text>
									<Text style={styles.status}>
										{status === "unseen"
											? "not yet met"
											: status === "defeated"
												? "defeated"
												: "met"}
									</Text>
									{status !== "unseen" && (
										<Text style={styles.line}>
											{line}
										</Text>
									)}
								</View>
							);
						})}
					</View>

					<Button variant="ghost" full onPress={onClose} style={styles.close}>
						Close the book
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
		marginBottom: SPACE.md,
	},
	grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	entry: {
		width: "47%",
		flexGrow: 1,
		alignItems: "center",
		padding: SPACE.sm,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		...SHADOW_SM,
	},
	art: {
		height: 68,
		justifyContent: "center",
		alignItems: "center",
	},
	unknown: { ...TYPE.display, color: UI_COLORS.textDisabled },
	name: { ...TYPE.cardTitleSm, color: UI_COLORS.textPrimary },
	status: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.action,
		marginTop: 2,
	},
	line: {
		...TYPE.bodySm,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	close: { marginTop: SPACE.lg },
});
