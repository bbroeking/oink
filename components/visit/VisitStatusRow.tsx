// The visit screen's second row: the two heart tallies and the visit counter,
// as three capsules on one line.
//
// It replaces a 72pt scoreboard card. The YOU / <NAME> kickers are gone: each
// tally wears the pig it belongs to, which is the same information without
// repeating the host's name (it is written once, on the header plaque). The
// pulsing heart emblem between the tallies is gone too — the "+1 ♥" that rises
// off each tag on every tap already says the hearts moved together.
//
// The capsules WRAP. At an accessibility text size the third one drops to a
// second line rather than clipping, which is why the scene below is `flex: 1`
// and never a fixed height.
import { type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Glyph, T, Tag } from "@/components/ui";
import { AVATAR_SIZE, SPACE } from "@/constants/theme";
import { VISIT_TYPE_CAP } from "./chrome";

// The rising "+1 ♥" — a drawing size, matched to the capsule's own mark.
const TICK_MARK = 12;

export interface VisitTickStyle {
	opacity: Animated.AnimatedInterpolation<number>;
	transform: { translateY: Animated.AnimatedInterpolation<number> }[];
}

/** The height of a status capsule — the avatar sets it, so the header's total
 *  chrome is STATUS_SAFE + TAP_MIN + SPACE.sm + this. */
export const STATUS_TAG_H = AVATAR_SIZE[0];

export function VisitStatusRow({
	youHearts,
	hostHearts,
	visitsLeft,
	visitBudget,
	youAvatar,
	hostAvatar,
	hostName,
	tickStyle,
}: {
	youHearts: number;
	hostHearts: number;
	visitsLeft: number;
	visitBudget: number;
	youAvatar: ReactNode;
	hostAvatar: ReactNode;
	hostName: string;
	tickStyle: VisitTickStyle;
}) {
	return (
		<View style={styles.row}>
			<HeartTally
				avatar={youAvatar}
				total={youHearts}
				a11yLabel={`Your hearts, ${youHearts}`}
				tickStyle={tickStyle}
			/>
			<HeartTally
				avatar={hostAvatar}
				total={hostHearts}
				a11yLabel={`${hostName}'s hearts, ${hostHearts}`}
				tickStyle={tickStyle}
			/>
			{/* One vocabulary: this number is always "visits", never "barns" and
			    never a round. A COUNT is not a countdown — at zero it simply
			    says zero rather than switching to hours-until. */}
			<Tag
				tone="sun"
				glyph="barn"
				maxFontSizeMultiplier={VISIT_TYPE_CAP}
				style={styles.capped}
				label={
					visitsLeft <= 0
						? "0 visits left"
						: `${visitsLeft} of ${visitBudget} visits left`
				}
			/>
		</View>
	);
}

// One tally capsule — the pig it belongs to, its heart count, and the "+1 ♥"
// that rises off it on every tap.
function HeartTally({
	avatar,
	total,
	a11yLabel,
	tickStyle,
}: {
	avatar: ReactNode;
	total: number;
	a11yLabel: string;
	tickStyle: VisitTickStyle;
}) {
	return (
		<View style={styles.tally}>
			<Animated.View
				pointerEvents="none"
				style={[styles.tick, tickStyle]}
			>
				<T
					role="cardTitleSm"
					tone="accent"
					maxFontSizeMultiplier={VISIT_TYPE_CAP}
				>
					+1
				</T>
				<Glyph name="heart" size={TICK_MARK} />
			</Animated.View>
			<Tag
				leading={avatar}
				glyph="heart"
				label={total.toLocaleString()}
				accessibilityLabel={a11yLabel}
				maxFontSizeMultiplier={VISIT_TYPE_CAP}
				style={styles.tallyTag}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
		// `flexWrap` only wraps against a DEFINITE width. Left to size itself the
		// row measured at its content, ran past the screen edge and never found a
		// line to break on — and the capsules' `maxWidth: "100%"` had no definite
		// parent to resolve against either. Stretching the row to its column
		// gives both the number they were missing. (2026-09-12)
		alignSelf: "stretch",
		width: "100%",
	},
	// A capsule may be as wide as the row and not one point wider. Without the
	// ceiling a `Tag` measures at its content width (React Native defaults
	// flexShrink to 0), so at a large text size the third capsule ran off the
	// right edge instead of wrapping onto a second line. With it — plus the
	// shrinkable label inside `Tag` — the row wraps the way it always claimed
	// to. At 1.3x on a 375pt phone the three capsules measure ~100 + ~100 +
	// ~150 against 339pt of content width: the first two share line one (208 +
	// SPACE.sm), the visit counter takes line two. (2026-09-12)
	capped: { maxWidth: "100%" },
	tally: { position: "relative", maxWidth: "100%" },
	// The capsule hugs its avatar: no vertical pad, so a 32pt pig sets a 32pt
	// tag and the header's height stays arithmetic.
	tallyTag: { paddingVertical: 0, paddingLeft: SPACE.xxs, maxWidth: "100%" },
	// The float rises OUT of the capsule it belongs to — the tag that gained
	// the heart is the one that says so.
	tick: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xxs,
		zIndex: 3,
	},
});
