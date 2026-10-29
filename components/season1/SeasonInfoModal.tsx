// The Season tab's reference sheet — the season story ("The Season of the
// Hunger"), lifted off the tab's scroll into a tap-to-open modal so the tab
// itself stays the playable path (Feed · Draw · Pass). Opened from the `?`
// door's chooser. The spoils shelf ("What you can earn") retired with the herd
// race on 2026-09-21 — the drum pays tickles and the pass pays the rest, and
// each says so where it is played.
//
// The chrome is `AdaptiveModalScaffold` [C-09, spec §3.4]: the scaffold owns
// the Modal, the scrim, the safe-area frame and the scroll path, which is why
// the old hand-tuned `screenH * 0.6` cap is gone. With `card` its frame IS
// the sticker card and its pinned close is the card's ×, so on a short phone
// the four beats scroll under a × that stays put (2026-10-04).

import { StyleSheet } from "react-native";
import {
	AdaptiveModalScaffold,
	Button,
	Kicker,
	PageTitle,
	useUnmanagedModalHold,
} from "@/components/ui";
import { SeasonStory } from "./SeasonStory";
import { SPACE } from "@/constants/theme";
import { seasonTheme, type SeasonTheme } from "@/utils/seasonTheme";

export type SeasonInfoTopic = "story";

// The headline is the season's own name (utils/seasonTheme.ts).
const COPY: Record<SeasonInfoTopic, { kicker: string; title: (t: SeasonTheme) => string }> = {
	story: { kicker: "what's happening", title: (t) => t.seasonName },
};

export function SeasonInfoModal({
	topic,
	onDismiss,
	theme = seasonTheme("snout_season_1"),
}: {
	// null = closed. Keeping the topic as the open-state avoids two modals
	// fighting over the same backdrop.
	topic: SeasonInfoTopic | null;
	onDismiss: () => void;
	/** The active season's fiction; Season 1's when absent. */
	theme?: SeasonTheme;
}) {
	// Unmanaged native Modal (season-tab reference sheet, outside the popup queue):
	// hold the queue while open so a foreground poll can't present a queued popup
	// over it — the #50152 wedge (issue #4). Keyed on `topic != null` (the modal
	// stays mounted with visible={false} when topic is null).
	useUnmanagedModalHold(topic != null);
	// The story is the one topic, so the card keeps its words while it fades
	// out (topic drops to null the moment it is dismissed) instead of fading
	// as a card holding only its button.
	const copy = COPY[topic ?? "story"];
	return (
		<AdaptiveModalScaffold
			visible={topic != null}
			onRequestClose={onDismiss}
			maxWidth={400}
			// The card's pinned × is a "Close"; the button below is the named
			// way back.
			card
		>
			<Kicker align="center" style={styles.kicker}>
				{copy.kicker} ★
			</Kicker>
			<PageTitle align="center" accessibilityRole="header" style={styles.headline}>
				{copy.title(theme)}
			</PageTitle>
			<SeasonStory theme={theme} />
			<Button
				size="md"
				variant="primary"
				full
				onPress={onDismiss}
				accessibilityLabel="Back to the season"
				accessibilityHint="Closes the story"
				style={styles.dismiss}
			>
				Back to the season
			</Button>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	kicker: { marginBottom: SPACE.xs },
	headline: { marginBottom: SPACE.md },
	dismiss: { marginTop: SPACE.md },
});
