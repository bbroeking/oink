// The visit screen's first row: whose barn this is, and the way out.
//
// One name, one row. The host's name is written ONCE on the whole screen — on
// this bark plaque — because the background behind it is whatever cosmetic the
// HOST equipped, so the title cannot know its own contrast and brings a token
// surface with it instead of leaning on a text shadow. [A-18]
//
// The row is exactly `TAP_MIN` tall so the header's height is arithmetic rather
// than whatever the plaque happens to measure: STATUS_SAFE + TAP_MIN + SPACE.sm
// + the status row's tags is the whole chrome above the scene.
import { StyleSheet, View } from "react-native";
import {
	Button,
	Glyph,
	Icon,
	IconText,
	Sticker,
	T,
} from "@/components/ui";
import { RADII, SPACE, TAP_MIN } from "@/constants/theme";
import { VISIT_TYPE_CAP } from "./chrome";

// Marks: the plaque's star and the Leave pill's ✕. Drawing sizes, not spacing.
const PLAQUE_MARK = 12;
const LEAVE_MARK = 14;
// The header is a fixed-height row, so its text stops growing where the friend
// row's does — one step of Dynamic Type, then it truncates instead of clipping.
const HEADER_TYPE_CAP = VISIT_TYPE_CAP;

export function VisitHeader({
	hostName,
	onLeave,
}: {
	hostName: string;
	onLeave: () => void;
}) {
	return (
		<View style={styles.row}>
			<Sticker
				color="bark"
				radius={RADII.lg}
				shadow="sm"
				style={styles.plaque}
			>
				<IconText left={<Glyph name="star" size={PLAQUE_MARK} />} gap={SPACE.xs}>
					<T
						role="cardTitle"
						tone="onDark"
						numberOfLines={1}
						maxFontSizeMultiplier={HEADER_TYPE_CAP}
					>
						{`${hostName}'s Barn`}
					</T>
				</IconText>
			</Sticker>
			{/* The way out never gives. A `Button` label is shrinkable by design
			    (a long CTA wraps rather than overflowing its pill), so in a
			    `space-between` row it was the element that yielded — "× Leav".
			    The wrapper takes the row's shrink away from it, and the plaque
			    beside it absorbs all of it instead. */}
			<View style={styles.leave}>
				<Button
					variant="ghost"
					size="sm"
					icon={<Icon name="x" size={LEAVE_MARK} />}
					onPress={onLeave}
					maxFontSizeMultiplier={VISIT_TYPE_CAP}
					accessibilityLabel={`Leave ${hostName}'s barn`}
					accessibilityHint="Ends this visit and heads back to your Barn"
				>
					Leave
				</Button>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		height: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.md,
	},
	// The plaque yields before the Leave pill does — a long name truncates, the
	// way out never shrinks. `minWidth: 0` is what makes `flexShrink` mean
	// anything: without it a flex item is floored at its content's width, so the
	// plaque could not give and the overflow landed on the button instead (the
	// `ListRow` lesson, 2026-09-12).
	plaque: {
		flexShrink: 1,
		minWidth: 0,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
	},
	leave: { flexShrink: 0 },
});
