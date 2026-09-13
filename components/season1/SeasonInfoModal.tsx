// Season-tab reference sheets — the season story ("The Season of the Hunger")
// and the spoils shelf ("What you can earn"), lifted off the tab's scroll into
// tap-to-open modals so the tab itself stays the playable path (boss → your
// Sounder → pass). Opened from the two icon buttons in the page header:
// scroll = the tale, gift = the earnables. One modal, two topics — the chrome
// (backdrop, card, dismiss) is identical, only the content swaps.
//
// The chrome is `AdaptiveModalScaffold` + `Sticker` + `DialogCloseRow` [C-09,
// spec §3.4]: the scaffold owns the Modal, the scrim, the safe-area frame and
// the scroll path, which is why the old hand-tuned `screenH * 0.6` cap is gone.

import { StyleSheet } from "react-native";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Kicker,
	PageTitle,
	Sticker,
	useUnmanagedModalHold,
} from "@/components/ui";
import { SeasonStory } from "./SeasonStory";
import { SpoilsShowcase } from "./SpoilsShowcase";
import { RADII, SPACE, TILT } from "@/constants/theme";

export type SeasonInfoTopic = "story" | "spoils";

const COPY: Record<SeasonInfoTopic, { kicker: string; title: string }> = {
	story: { kicker: "what's happening", title: "The Season of the Hunger" },
	spoils: { kicker: "the truffle exchange", title: "What you can earn" },
};

export function SeasonInfoModal({
	topic,
	onDismiss,
}: {
	// null = closed. Keeping the topic as the open-state avoids two modals
	// fighting over the same backdrop.
	topic: SeasonInfoTopic | null;
	onDismiss: () => void;
}) {
	// Unmanaged native Modal (season-tab reference sheet, outside the popup queue):
	// hold the queue while open so a foreground poll can't present a queued popup
	// over it — the #50152 wedge (issue #4). Keyed on `topic != null` (the modal
	// stays mounted with visible={false} when topic is null).
	useUnmanagedModalHold(topic != null);
	const copy = topic ? COPY[topic] : null;
	return (
		<AdaptiveModalScaffold
			visible={topic != null}
			onRequestClose={onDismiss}
			maxWidth={400}
			bare
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				border={3}
				style={styles.card}
			>
				<DialogCloseRow onPress={onDismiss} label="Back to the season" />
				{copy && (
					<>
						<Kicker align="center" style={styles.kicker}>
							{copy.kicker} ★
						</Kicker>
						<PageTitle align="center" style={styles.headline}>
							{copy.title}
						</PageTitle>
					</>
				)}
				{topic === "story" && <SeasonStory />}
				{topic === "spoils" && <SpoilsShowcase />}
				<Button
					size="md"
					variant="primary"
					full
					onPress={onDismiss}
					style={styles.dismiss}
				>
					Back to the season
				</Button>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	card: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
	},
	kicker: { marginBottom: SPACE.xs },
	headline: { marginBottom: SPACE.md },
	dismiss: { marginTop: SPACE.md },
});
