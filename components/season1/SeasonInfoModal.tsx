// Season-tab reference sheets — the season story ("The Season of the Hunger")
// and the spoils shelf ("What you can earn"), lifted off the tab's scroll into
// tap-to-open modals so the tab itself stays the playable path (boss → your
// Sounder → pass). Opened from the two icon buttons in the page header:
// scroll = the tale, gift = the earnables. One modal, two topics — the chrome
// (backdrop, card, dismiss) is identical, only the content swaps.

import { Modal, View, Text, ScrollView, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { Button } from "../ui/Button";
import { SeasonStory } from "./SeasonStory";
import { SpoilsShowcase } from "./SpoilsShowcase";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

export type SeasonInfoTopic = "story" | "spoils";

const COPY: Record<SeasonInfoTopic, { kicker: string; title: string }> = {
	story: { kicker: "★ what's happening ★", title: "The Season of the Hunger" },
	spoils: { kicker: "★ scuffle spoils ★", title: "What you can earn" },
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
	const copy = topic ? COPY[topic] : null;
	return (
		<Modal
			visible={topic != null}
			transparent
			animationType="fade"
			onRequestClose={onDismiss}
		>
			<View style={styles.backdrop}>
				<Sticker
					color="paper"
					rotate={-0.8}
					radius={20}
					border={3}
					style={[styles.card, STICKER_SHADOW]}
				>
					{copy && (
						<>
							<Text style={styles.kicker}>{copy.kicker}</Text>
							<Text style={styles.headline}>{copy.title}</Text>
						</>
					)}
					<ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
						{topic === "story" && <SeasonStory />}
						{topic === "spoils" && <SpoilsShowcase />}
					</ScrollView>
					<Button size="md" variant="primary" full onPress={onDismiss}>
						Back to the season
					</Button>
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 400,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.md,
	},
	scroll: { maxHeight: 460, marginBottom: SPACE.md },
});
