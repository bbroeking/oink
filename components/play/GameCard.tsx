// One of the five games on the hub: its painted icon, its title, the one
// sentence that is the whole rule (the charter's legibility test), and small
// tags for how many pigs, how fast, and co-op: statuses, so they are printed
// flat (a hard shadow means "press me"; the card is the thing to press). A
// tap opens its sheet. A game the server has switched off shows as resting
// rather than vanishing, so a pig who loves it can see it will be back.

import { Image, StyleSheet, View } from "react-native";
import { CardTitle, Hand, Sticker, Tag } from "@/components/ui";
import { OPACITY, ROW_TILTS, SPACE, UI_COLORS } from "@/constants/theme";
import type { CatalogEntry } from "@/multiplayer/protocol";
import { gameUi } from "./gameUi";
import { GAME_ICONS } from "./playArt";
import { GAME_ICON_CARD } from "./layout";
import { GAME_COPY, fill, gameTags } from "./playCopy";

export interface GameCardProps {
	entry: CatalogEntry;
	index: number;
	asleep: boolean;
	asyncAllowed: boolean;
	onPress: () => void;
}

/** The game's one sentence: the board's how-to, else the catalog tagline. */
export function gameSentence(entry: Pick<CatalogEntry, "id" | "tagline">): string {
	return gameUi(entry.id)?.howTo.sentence ?? entry.tagline;
}

export function GameCard({ entry, index, asleep, asyncAllowed, onPress }: GameCardProps) {
	const sentence = gameSentence(entry);
	const tags = gameTags(entry, asyncAllowed);
	return (
		<Sticker
			color={asleep ? UI_COLORS.surfaceStrong : "paper"}
			rotate={ROW_TILTS[index % ROW_TILTS.length]}
			pad
			onPress={onPress}
			accessibilityLabel={`${entry.title}${asleep ? `, ${GAME_COPY.asleepTag}` : ""}. ${sentence}`}
			accessibilityHint={fill(GAME_COPY.open, { game: entry.title })}
			style={styles.card}
			testID={`game-card-${entry.id}`}
		>
			<Image source={GAME_ICONS[entry.id]} resizeMode="contain" style={[styles.icon, asleep ? styles.sleepy : null]} />
			<View style={styles.body}>
				<View style={styles.titleRow}>
					{/* Wraps at large text: a name is never cut ("Fence the P…"). */}
					<CardTitle style={styles.title}>{entry.title}</CardTitle>
					{asleep ? <Tag flat label={GAME_COPY.asleepTag} tone="muted" glyph="zzz" testID={`game-asleep-${entry.id}`} /> : null}
				</View>
				<Hand tone="secondary">{sentence}</Hand>
				<View style={styles.tags}>
					{tags.map((tag) => (
						<Tag key={tag} flat label={tag} tone={tag === GAME_COPY.coop ? "sage" : "paper"} />
					))}
				</View>
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
	icon: { width: GAME_ICON_CARD, height: GAME_ICON_CARD },
	sleepy: { opacity: OPACITY.dim },
	body: { flex: 1, minWidth: 0, gap: SPACE.xs },
	titleRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" },
	title: { flexShrink: 1 },
	tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
});
