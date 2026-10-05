// A game's sheet, opened from its card on the hub: how it goes (the one
// sentence, then two or three steps), then the ways to play it. With real
// pigs: Find a pig (the live queue), Play by post (a table that starts now
// and waits for its pig, when the game and the server allow it), Invite
// friends. Then Practice: you and one to three bot pigs, picked with a small
// segmented control for the games that seat more than two, and "No clock" for
// a first table read slowly (timed by default, like a live table: a pig who
// learns to the clock is ready for one). A resting game keeps its how-to and
// its Practice; only the real-pig doors sleep.

import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Body, Button, Hand, HandLg, Kicker, Numeral, SegmentedControl, Sheet, Tag, Toggle, type SegmentOption } from "@/components/ui";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import type { CatalogEntry } from "@/multiplayer/protocol";
import { gameSentence } from "./GameCard";
import { gameUi } from "./gameUi";
import { GAME_ICONS } from "./playArt";
import { GAME_ICON_HERO } from "./layout";
import { GAME_COPY, botsWords, fill, gameTags } from "./playCopy";

// A step's numeral rides a small disc: drawing geometry, the size of a tag.
const STEP_DISC = 26;

export interface GameSheetProps {
	entry: CatalogEntry | null;
	open: boolean;
	onClose: () => void;
	asleep: boolean;
	asyncAllowed: boolean;
	practiceAllowed: boolean;
	practiceBusy: boolean;
	onFind: () => void;
	onByPost: () => void;
	onInvite: () => void;
	/** Total seats, you included; `untimed` drops the turn clock. */
	onPractice: (seats: number, untimed: boolean) => void;
}

export function GameSheet(props: GameSheetProps) {
	const { entry, open, onClose } = props;
	return (
		<Sheet open={open && !!entry} onClose={onClose} kicker={GAME_COPY.sheetKicker} title={entry?.title} testID="game-sheet">
			{entry ? <GameSheetBody {...props} entry={entry} /> : null}
		</Sheet>
	);
}

function GameSheetBody({ entry, asleep, asyncAllowed, practiceAllowed, practiceBusy, onFind, onByPost, onInvite, onPractice }: GameSheetProps & { entry: CatalogEntry }) {
	const ui = gameUi(entry.id);
	const steps = ui?.howTo.steps ?? [];
	const byPost = asyncAllowed && entry.paces.includes("async");
	const live = entry.paces.includes("live");
	const minBots = Math.max(1, entry.seats.min - 1);
	const maxBots = Math.max(minBots, entry.seats.max - 1);
	// Keyed on the game, so opening another game's sheet starts from its own
	// fewest bots (adjusted during render, no effect).
	const [bots, setBots] = useState({ id: entry.id, n: minBots });
	if (bots.id !== entry.id) setBots({ id: entry.id, n: minBots });
	// Timed unless the pig asks, like a live table. The body mounts with the
	// sheet, so every opening starts timed.
	const [untimed, setUntimed] = useState(false);
	const n = bots.id === entry.id ? Math.min(maxBots, Math.max(minBots, bots.n)) : minBots;
	const botOptions: SegmentOption<string>[] = Array.from({ length: maxBots - minBots + 1 }, (_, i) => {
		const count = minBots + i;
		return { value: String(count), label: botsWords(count), accessibilityHint: `Practice with ${botsWords(count)}` };
	});

	return (
		<View style={styles.body}>
			<View style={styles.lead}>
				<Image source={GAME_ICONS[entry.id]} resizeMode="contain" style={styles.icon} />
				<HandLg style={styles.sentence}>{gameSentence(entry)}</HandLg>
			</View>

			<View style={styles.steps} accessibilityRole="list">
				{steps.map((step, i) => (
					<View key={step} style={styles.step}>
						<View style={styles.disc}>
							<Numeral>{String(i + 1)}</Numeral>
						</View>
						<Body style={styles.stepText}>{step}</Body>
					</View>
				))}
			</View>

			<View style={styles.tags}>
				{gameTags(entry, asyncAllowed).map((tag) => (
					<Tag key={tag} flat label={tag} tone={tag === GAME_COPY.coop ? "sage" : "paper"} />
				))}
			</View>

			{asleep ? (
				<Hand tone="secondary" testID="game-sheet-asleep">
					{GAME_COPY.asleep}
				</Hand>
			) : (
				<View style={styles.section}>
					<Kicker>{GAME_COPY.realKicker}</Kicker>
					{live ? (
						<Button variant="primary" size="lg" full onPress={onFind} accessibilityHint={fill(GAME_COPY.findPigHint, { game: entry.title })} testID="game-sheet-find">
							{GAME_COPY.findPig}
						</Button>
					) : null}
					<View style={styles.row}>
						{byPost ? (
							<Button variant="ghost" onPress={onByPost} accessibilityHint={GAME_COPY.byPostHint} style={styles.half} testID="game-sheet-post">
								{GAME_COPY.byPost}
							</Button>
						) : null}
						<Button variant="ghost" onPress={onInvite} accessibilityHint={GAME_COPY.inviteHint} style={styles.half} testID="game-sheet-invite">
							{GAME_COPY.invite}
						</Button>
					</View>
					{byPost ? <Hand tone="secondary">{GAME_COPY.byPostNote}</Hand> : null}
				</View>
			)}

			{practiceAllowed ? (
				<View style={styles.section}>
					<Kicker>{GAME_COPY.practiceKicker}</Kicker>
					<Hand tone="secondary">{GAME_COPY.practiceNote}</Hand>
					{botOptions.length > 1 ? (
						<SegmentedControl
							label="How many bot pigs"
							options={botOptions}
							value={String(n)}
							onChange={(value) => setBots({ id: entry.id, n: Number(value) })}
						/>
					) : null}
					<Toggle
						standalone
						label={GAME_COPY.noClock}
						hint={GAME_COPY.noClockNote}
						value={untimed}
						onValueChange={setUntimed}
						accessibilityHint={GAME_COPY.noClockHint}
						testID="game-sheet-no-clock"
					/>
					<Button
						variant="lilac"
						full
						loading={practiceBusy}
						loadingLabel="setting the table"
						onPress={() => onPractice(n + 1, untimed)}
						accessibilityHint={fill(GAME_COPY.practiceHint, { bots: botsWords(n), game: entry.title })}
						testID="game-sheet-practice"
					>
						{`${GAME_COPY.practice} · ${botsWords(n)}`}
					</Button>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	body: { gap: SPACE.md },
	lead: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	icon: { width: GAME_ICON_HERO, height: GAME_ICON_HERO },
	sentence: { flex: 1, minWidth: 0 },
	steps: { gap: SPACE.sm },
	step: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
	disc: {
		width: STEP_DISC,
		height: STEP_DISC,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	stepText: { flex: 1, minWidth: 0 },
	tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
	section: { gap: SPACE.sm },
	row: { flexDirection: "row", gap: SPACE.sm },
	half: { flex: 1 },
});
