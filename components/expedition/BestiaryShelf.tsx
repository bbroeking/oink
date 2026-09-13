import React from "react";
import { View, StyleSheet } from "react-native";
import { ART_SIZE, RADII, SPACE } from "@/constants/theme";
import { Sheet } from "@/components/ui/Sheet";
import { Sticker } from "@/components/ui/Sticker";
import { Tag } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { T } from "@/components/ui/Text";
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
// dims it (real art lands later). A browse shelf opened from the journal, so it
// rides the same bottom-sheet panel the training ceremony does.

// Drawing geometry: the ink silhouette inside an entry's art well.
const SILHOUETTE = 64;

const STATUS_WORD = {
	unseen: "not yet met",
	met: "met",
	defeated: "defeated",
} as const;

export function BestiaryShelf({
	state,
	onClose,
}: {
	state: ExpeditionState;
	onClose: () => void;
}) {
	return (
		<Sheet
			open
			onClose={onClose}
			kicker="bestiary"
			title="Who's on the road"
			closeLabel="Close the book"
			footer={
				<Button variant="ghost" full onPress={onClose}>
					Close the book
				</Button>
			}
		>
			<View style={styles.grid}>
				{BESTIARY_IDS.map((id) => {
					const status = state.bestiary[id] ?? "unseen";
					const enemy = ENEMIES[id];
					const line =
						id === BRAMBLE_ID
							? "A tangle that wants Cushion to pass."
							: enemy?.behaviorLine ?? "";
					const name = status === "unseen" ? "Unknown" : BESTIARY_NAMES[id];
					return (
						<Sticker
							key={id}
							color="cream"
							radius={RADII.md}
							shadow="sm"
							rotate={0}
							accessibilityLabel={`${name}, ${STATUS_WORD[status]}`}
							style={styles.entry}
						>
							<View style={styles.art}>
								{status === "unseen" ? (
									<T role="display" tone="disabled">
										?
									</T>
								) : (
									<EnemySilhouette
										id={id as SilhouetteId}
										size={SILHOUETTE}
										defeated={status === "defeated"}
									/>
								)}
							</View>
							<T role="cardTitleSm" align="center">
								{name}
							</T>
							<Tag
								label={STATUS_WORD[status]}
								tone={status === "defeated" ? "sage" : "paper"}
								style={styles.status}
							/>
							{status !== "unseen" && (
								<T
									role="bodySm"
									tone="secondary"
									align="center"
									style={styles.line}
								>
									{line}
								</T>
							)}
						</Sticker>
					);
				})}
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	entry: {
		width: "47%",
		flexGrow: 1,
		alignItems: "center",
		padding: SPACE.sm,
	},
	art: {
		height: ART_SIZE.thumb,
		justifyContent: "center",
		alignItems: "center",
	},
	status: { marginTop: SPACE.xxs },
	line: { marginTop: SPACE.xs },
});
