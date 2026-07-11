// Season-tab reference sheets — the season story ("The Season of the Hunger")
// and the spoils shelf ("What you can earn"), lifted off the tab's scroll into
// tap-to-open modals so the tab itself stays the playable path (boss → your
// Sounder → pass). Opened from the two icon buttons in the page header:
// scroll = the tale, gift = the earnables. One modal, two topics — the chrome
// (backdrop, card, dismiss) is identical, only the content swaps.

import {
	Modal,
	View,
	Text,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";
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
	spoils: { kicker: "★ the truffle exchange ★", title: "What you can earn" },
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
	// Cap the scroll region to a fraction of the screen so the whole card —
	// title above, dismiss button below — always fits within the centered
	// backdrop and nothing clips off the top/bottom edges (matches the
	// screenH-fraction cap in GreatHungerIntroModal). Leaves ~40% for title,
	// button, card padding and the backdrop's own inset.
	const { height: screenH } = useWindowDimensions();
	const scrollMaxH = Math.round(screenH * 0.6);
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
					<ScrollView
						style={[styles.scroll, { maxHeight: scrollMaxH }]}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
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
	// maxHeight is set inline from the screen height; keep only the spacing
	// below the scroll region here. A small top margin keeps the first
	// (tilted) beat card off the headline above it.
	scroll: { marginTop: SPACE.xs, marginBottom: SPACE.md },
	// Top pad gives the first tilted sticker corner room to clear the title;
	// trailing pad so the last beat card clears the fade edge / dismiss button
	// when the story overflows and scrolls.
	scrollContent: { paddingTop: SPACE.xs, paddingBottom: SPACE.xs },
});
