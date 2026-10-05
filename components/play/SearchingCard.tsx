// The searching card: your pig, out sniffing for another, at the top of the
// hub while the queue runs. It says what you are looking for and how long
// you have been at it, in the hand voice, with a way to stop. It never
// guesses how many pigs are about or how long it will take: at a small
// population that number would be a lie on most days.
//
// After the server's practice offer time (welcome.timing.practiceOfferMs) in
// the live queue, it offers the two honest alternatives: Leave an open seat
// (the same games by post: the table starts now and the next pig who looks
// takes the other chair) and Practice with a bot pig, plainly labelled.

import { StyleSheet, View } from "react-native";
import { Button, Divider, Hand, HandLg, Sticker } from "@/components/ui";
import { SPACE } from "@/constants/theme";
import { useServerClock } from "@/hooks/useMultiplayer";
import type { QueueState } from "@/multiplayer/protocol";
import { TablePig } from "./TablePig";
import { useMyCard } from "./useMyCard";
import { SEARCH_PIG } from "./layout";
import { SEARCH_COPY, elapsedWords, fill } from "./playCopy";

// The elapsed line moves by the second.
const SEARCH_TICK_MS = 1_000;

export interface SearchingCardProps {
	queue: QueueState;
	practiceOfferMs: number;
	/** What the queue is looking for, in words ("Rootle", "any of the five"). */
	gamesLine: string;
	/** Whether a by-post table can be offered for these games. */
	canOpenSeat: boolean;
	canPractice: boolean;
	busy: "stop" | "seat" | "practice" | null;
	onStop: () => void;
	onOpenSeat: () => void;
	onPractice: () => void;
}

export function SearchingCard({ queue, practiceOfferMs, gamesLine, canOpenSeat, canPractice, busy, onStop, onOpenSeat, onPractice }: SearchingCardProps) {
	const now = useServerClock(SEARCH_TICK_MS);
	const me = useMyCard();
	const elapsed = queue.since !== null ? Math.max(0, now - queue.since) : 0;
	const live = queue.pace === "live";
	const offer = live && queue.since !== null && elapsed >= practiceOfferMs && (canOpenSeat || canPractice);
	return (
		<Sticker color="sky" pad style={styles.card} testID="searching-card">
			<View style={styles.row} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${live ? SEARCH_COPY.live : SEARCH_COPY.async} ${gamesLine}`}>
				<TablePig look={me?.look ?? null} size={SEARCH_PIG} facing="right" />
				<View style={styles.words}>
					<HandLg>{live ? SEARCH_COPY.live : SEARCH_COPY.async}</HandLg>
					{gamesLine ? <Hand tone="secondary">{gamesLine}</Hand> : null}
					{queue.since !== null ? (
						<Hand tone="secondary" testID="searching-elapsed">
							{fill(SEARCH_COPY.elapsed, { time: elapsedWords(elapsed) })}
						</Hand>
					) : null}
				</View>
			</View>
			<Button variant="ghost" size="sm" loading={busy === "stop"} onPress={onStop} accessibilityHint={SEARCH_COPY.stopHint} testID="searching-stop">
				{SEARCH_COPY.stop}
			</Button>
			{offer ? (
				<View style={styles.offer} testID="searching-offer">
					<Divider space="xs" />
					<Hand>{SEARCH_COPY.offer}</Hand>
					{canOpenSeat ? (
						<Button variant="lilac" full loading={busy === "seat"} onPress={onOpenSeat} accessibilityHint={SEARCH_COPY.openSeatHint} testID="searching-open-seat">
							{SEARCH_COPY.openSeat}
						</Button>
					) : null}
					{canPractice ? (
						<Button variant="ghost" full loading={busy === "practice"} onPress={onPractice} accessibilityHint={SEARCH_COPY.practiceHint} testID="searching-practice">
							{SEARCH_COPY.practice}
						</Button>
					) : null}
				</View>
			) : null}
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: { gap: SPACE.sm },
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	words: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	offer: { gap: SPACE.sm },
});
