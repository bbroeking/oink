// The one-time "fresh start" card at the top of the Feed panel, for a season
// that began with a reset (Season 2, The Feast). It names only the buckets the
// flip actually zeroed for this pig (my_season_reset), says what came along,
// and goes away for good on its one button. hooks/useFreshStart owns the
// read, the once-only stamp and the copy.

import { StyleSheet } from "react-native";
import { Button, Hand, Sticker, T } from "@/components/ui";
import { RADII, SPACE, TILT } from "@/constants/theme";
import { FRESH_START_KEEPS, freshStartLine, type FreshStartKind } from "@/hooks/useFreshStart";

export interface FreshStartCardProps {
	/** The season's title (the theme's), named in the sentence. */
	seasonTitle: string;
	kinds: readonly FreshStartKind[];
	onDismiss: () => void;
	testID?: string;
}

export function FreshStartCard({ seasonTitle, kinds, onDismiss, testID }: FreshStartCardProps) {
	const line = freshStartLine(seasonTitle, kinds);
	if (!line) return null;
	return (
		<Sticker color="sun" rotate={TILT.card} radius={RADII.xl} style={styles.card} testID={testID}>
			<T role="kickerPill" tone="secondary">
				a fresh start
			</T>
			<T role="cardTitle" accessibilityRole="header">
				A new table is set
			</T>
			<Hand>{line}</Hand>
			<Hand tone="secondary">{FRESH_START_KEEPS}</Hand>
			<Button
				variant="gold"
				size="sm"
				onPress={onDismiss}
				accessibilityLabel="Pull up a chair"
				accessibilityHint="Closes this note for good"
			>
				Pull up a chair
			</Button>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.card,
		gap: SPACE.sm,
		marginBottom: SPACE.md,
	},
});
