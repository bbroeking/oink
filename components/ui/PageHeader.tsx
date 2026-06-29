import React from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	ViewStyle,
	StyleProp,
} from "react-native";
import {
	FONTS,
	WHIMSY,
	KICKER_PILL,
	TITLE_RULE,
	PAGE_PAD,
	SPACE,
	TYPE,
} from "@/constants/theme";

// The top-of-screen page header — the "crown" every screen wears. An uppercase
// KICKER_PILL accent over a big whimsy title and the short ink rule. Stack
// screens pass `onBack` for the ‹ back affordance; tab screens omit it. `right`
// sits beside the title (e.g. action buttons); `below` spans the full width
// under the rule (e.g. a stats line). Mirrors the hand-rolled headers on
// Shop / Friends / Achievements so they can't drift apart again. For in-screen
// SECTION headers, use SectionHeader instead. See docs/design/taste-standard.md.
export function PageHeader({
	kicker,
	title,
	right,
	below,
	onBack,
	ruleWidth = 64,
	style,
}: {
	kicker?: string;
	title: string;
	right?: React.ReactNode;
	below?: React.ReactNode;
	onBack?: () => void;
	ruleWidth?: number;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.wrap, style]}>
			{onBack ? (
				<Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
					<Text style={styles.back}>‹ back</Text>
				</Pressable>
			) : null}
			{kicker ? <Text style={styles.kicker}>★ {kicker}</Text> : null}
			<View style={styles.row}>
				<Text style={styles.title}>{title}</Text>
				{right ? <View style={styles.rightSlot}>{right}</View> : null}
			</View>
			<View style={[styles.rule, { width: ruleWidth }]} />
			{below ? <View>{below}</View> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: SPACE.md },
	backBtn: { alignSelf: "flex-start", marginBottom: SPACE.sm },
	back: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	kicker: { ...KICKER_PILL, marginBottom: SPACE.xs },
	row: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	title: {
		...TYPE.pageTitle,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	rightSlot: { marginLeft: SPACE.sm, flexDirection: "row", alignItems: "center" },
	rule: { ...TITLE_RULE, marginTop: SPACE.xs, marginBottom: SPACE.sm },
});
