// The host pig's thought bubble — what it is hoping for, drawn as the find
// itself with one hand line. It sits over the pig's slot so it rides with the
// pig and never mirrors with it (the stage flips; the slot does not).
//
// Three states, one shape:
//   open      → the find, "hoping for a blue feather"
//   you gave  → the NEXT wish, kicker "next time" — this visitor cannot fulfil
//               a second wish in the same visit, and the bubble says so rather
//               than inviting a tap that would bounce.
//   silent    → nothing (the server has no wish for this pig — un-pushed
//               migration, or a non-friend).
import { StyleSheet, View } from "react-native";
import { satchelFind } from "@/constants/satchel";
import { ART_SIZE, BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import type { FriendWish } from "@/utils/satchel";
import { Sticker, T } from "../ui";
import { FindArt } from "../satchel/FindArt";
import { VISIT_TYPE_CAP } from "./chrome";

// The bubble's tail: two dots stepping down toward the pig's head. Drawing
// sizes, not spacing steps.
const TAIL_LG = 10;
const TAIL_SM = 6;
const BUBBLE_MAX_W = 176;

export function WishBubble({
	wish,
	hostName,
	givenThisVisit,
}: {
	wish: FriendWish | null;
	hostName: string;
	givenThisVisit: boolean;
}) {
	if (!wish) return null;
	const find = satchelFind(wish.find_id);
	if (!find) return null;
	const line = givenThisVisit
		? `next time: ${find.withArticle}`
		: `hoping for ${find.withArticle}`;
	return (
		<View
			pointerEvents="none"
			style={styles.wrap}
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${hostName}'s pig is ${line}`}
			testID="visit-wish-bubble"
		>
			<Sticker color="paper" radius={RADII.xl} shadow="sm" rotate={0} style={styles.bubble}>
				<FindArt id={find.id} size={ART_SIZE.glyphSm} />
				<T
					role="kicker"
					tone={givenThisVisit ? "secondary" : undefined}
					numberOfLines={2}
					maxFontSizeMultiplier={VISIT_TYPE_CAP}
					style={styles.line}
				>
					{line}
				</T>
			</Sticker>
			<View style={[styles.tail, styles.tailLg]} />
			<View style={[styles.tail, styles.tailSm]} />
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { alignItems: "center", marginBottom: -SPACE.xs },
	bubble: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		maxWidth: BUBBLE_MAX_W,
	},
	line: { flexShrink: 1 },
	tail: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
	},
	tailLg: { width: TAIL_LG, height: TAIL_LG, marginTop: SPACE.xxs, marginLeft: SPACE.lg },
	tailSm: { width: TAIL_SM, height: TAIL_SM, marginTop: SPACE.xxs, marginLeft: SPACE.xl },
});
