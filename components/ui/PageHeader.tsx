// The top-of-screen page header — the "crown" every screen wears, in the three
// shapes the app actually draws (design-system-spec §2, row 03 + the variant
// additions: `tab` [E7] and `plaque` [C-10]).
//
//   · `stack`  — the default: an optional `‹ back`, the kicker pill, the whimsy
//                title (with a `right` slot) and the short ink rule.
//   · `tab`    — the same crown with no back affordance, sitting under a tab
//                screen's SafeAreaView. Reproduces the header Friends and Shop
//                hand-roll today so wave 3 can swap them 1:1.
//   · `plaque` — the Dig-Off's hanging sign: a centred kicker, two ink cords,
//                and the title inside a sun Sticker.
//
// **Kicker ruling (2026-09-11).** The five tab screens are split today —
// `friends.tsx` and `shop.tsx` both spread `KICKER_PILL`, `race-standings.tsx`
// spreads a hand-font tracked line. One ruling for the whole file:
// **a PAGE kicker is `KickerPill` (tracked uppercase Nunito, mute); a SECTION
// kicker is `Kicker` (PatrickHand, accent).** Every variant here — `stack`,
// `tab` and `plaque` alike — therefore wears `KickerPill`, and `SectionHeader`
// owns the other voice. Two kicker treatments on one screen is the drift this
// component exists to stop.
//
// **Title ruling (2026-09-11).** The title is `TYPE.pageTitle` (Caprasimo 26/28)
// in every variant. The tab screens draw `TYPE.display` (32) today; spec §1.2
// gives `display` to ceremony headlines and `pageTitle` to this component, so
// the wave-3 swap deliberately folds 32 → 26 rather than widening the role.
// `race-standings` already draws its plaque title at exactly 26/28.
//
// For in-screen SECTION headers, use SectionHeader instead.
// See docs/design/taste-standard.md.
import React from "react";
import {
	View,
	Platform,
	Pressable,
	StyleSheet,
	type ViewStyle,
	type StyleProp,
} from "react-native";
import {
	BORDER,
	OPACITY,
	PAGE_PAD,
	RADII,
	RULE_WIDTH,
	SPACE,
	TAP_MIN,
	TILT,
	UI_COLORS,
} from "@/constants/theme";
import { Hand, KickerPill, PageTitle } from "./Text";
import { TitleRule } from "./Divider";
import { Sticker } from "./Sticker";

/** Which of the three crowns this screen wears. */
export type PageHeaderVariant = "stack" | "tab" | "plaque";

interface Props {
	/** Tracked uppercase lead-in above the title. The "★ " is baked in. */
	kicker?: string;
	title: string;
	/** Rides the title row's far edge (a balance chip, an action button). */
	right?: React.ReactNode;
	/** Spans the full width under the rule (a stats line, a segmented control). */
	below?: React.ReactNode;
	/** The `‹ back` affordance. Stack + plaque only; a tab screen has no back. */
	onBack?: () => void;
	/**
	 * What the back affordance goes back TO, when "back" alone is ambiguous —
	 * a room reached from several doors names its door ("back to the shop").
	 * (2026-09-17)
	 */
	backLabel?: string;
	/** Hand-voice line under a `plaque` title ("sounders, one board"). */
	subtitle?: string;
	variant?: PageHeaderVariant;
	ruleWidth?: number;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

// The plaque's own geometry — the width of the hanging sign and the inset of the
// two cords it swings from. Neither is a spacing decision: they are the drawing
// of a sign on two strings (the `Ribbon` precedent in Chip.tsx), so they are
// named here rather than borrowed from SPACE. Matches the sign race-standings
// hangs today. (2026-09-11)
const PLAQUE_WIDTH = 258;
const HANGER_INSET = 92;
const HANGER_HEIGHT = SPACE.lg;

function BackButton({
	onBack,
	label = "back",
}: {
	onBack: () => void;
	label?: string;
}) {
	return (
		<Pressable
			onPress={onBack}
			accessibilityRole="button"
			// Spoken as a sentence, drawn as the hand line it is.
			accessibilityLabel={label.charAt(0).toUpperCase() + label.slice(1)}
			style={styles.backBtn}
		>
			<Hand tone="secondary">‹ {label}</Hand>
		</Pressable>
	);
}

export function PageHeader({
	kicker,
	title,
	right,
	below,
	onBack,
	backLabel,
	subtitle,
	variant = "stack",
	ruleWidth = RULE_WIDTH,
	testID,
	style,
}: Props) {
	// The hanging sign. Its own layout, because a plaque has no title ROW — the
	// title is centred inside the sign, so `right` rides the back row instead.
	if (variant === "plaque") {
		return (
			<View testID={testID} style={[styles.wrap, styles.plaqueWrap, style]}>
				{onBack || right ? (
					<View style={styles.plaqueTopRow}>
						{onBack ? (
							<BackButton onBack={onBack} label={backLabel} />
						) : (
							<View />
						)}
						{right ? <View style={styles.rightSlot}>{right}</View> : null}
					</View>
				) : null}
				{kicker ? (
					<KickerPill align="center" accessibilityRole="text">
						{kicker}
					</KickerPill>
				) : null}
				<View style={styles.hangers} pointerEvents="none">
					<View style={styles.hanger} />
					<View style={styles.hanger} />
				</View>
				<Sticker
					color="sun"
					rotate={TILT.card}
					radius={RADII.md}
					border={BORDER.heavy}
					shadow="sm"
					style={styles.plaque}
				>
					<PageTitle align="center" accessibilityRole="header">
						{title}
					</PageTitle>
					{subtitle ? (
						<Hand tone="secondary" align="center">
							{subtitle}
						</Hand>
					) : null}
				</Sticker>
				{below ? <View>{below}</View> : null}
			</View>
		);
	}

	const tab = variant === "tab";
	return (
		<View
			testID={testID}
			style={[styles.wrap, tab ? styles.tabWrap : styles.stackWrap, style]}
		>
			{/* A tab screen is already at the root of its stack: no back. */}
			{!tab && onBack ? (
				<BackButton onBack={onBack} label={backLabel} />
			) : null}
			{kicker ? <KickerPill accessibilityRole="text">{kicker}</KickerPill> : null}
			<View style={styles.row}>
				<PageTitle accessibilityRole="header" style={styles.title}>
					{title}
				</PageTitle>
				{right ? <View style={styles.rightSlot}>{right}</View> : null}
			</View>
			<TitleRule width={ruleWidth} style={styles.rule} />
			{below ? <View>{below}</View> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { paddingHorizontal: PAGE_PAD },
	stackWrap: { paddingTop: SPACE.sm, paddingBottom: SPACE.md },
	// The tab crown sits directly under a SafeAreaView on iOS and under the
	// status bar on Android, which is why the two platforms differ.
	// TODO(ui-audit): SafeAreaView inset + SPACE.sm (deferred — device QA).
	// Carried verbatim from friends.tsx / shop.tsx so the wave-3 swap is 1:1;
	// the Android 20 folds to `SPACE.xl` per the spec §1.3 folding rule.
	tabWrap: {
		paddingTop: Platform.OS === "ios" ? SPACE.sm : SPACE.xl,
		paddingBottom: SPACE.sm,
	},
	plaqueWrap: { paddingTop: SPACE.sm, paddingBottom: SPACE.md },
	plaqueTopRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	backBtn: {
		alignSelf: "flex-start",
		minHeight: TAP_MIN,
		minWidth: TAP_MIN,
		justifyContent: "center",
		marginBottom: SPACE.xs,
	},
	row: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	title: { flexShrink: 1 },
	rightSlot: {
		marginLeft: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	rule: { marginTop: SPACE.xs, marginBottom: SPACE.sm },
	hangers: {
		height: HANGER_HEIGHT,
		marginHorizontal: HANGER_INSET,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	hanger: {
		width: BORDER.ink,
		height: HANGER_HEIGHT,
		backgroundColor: UI_COLORS.border,
		opacity: OPACITY.muted,
	},
	plaque: {
		alignSelf: "center",
		width: PLAQUE_WIDTH,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		alignItems: "center",
	},
});
