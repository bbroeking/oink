// The two rules, canvas section 09.
//
// `Divider` is the full-width hairline that separates two stacked things inside
// one surface — deliberately drawn in `WHIMSY.barkMute`, a warm paper crease,
// never a cool grey 1px line borrowed from a settings app. `TitleRule` is the
// short ink underline that lives under a whimsy title, at the one sanctioned
// `RULE_WIDTH` (it was hand-tuned per string before [B-17]).
//
// Both are decoration: they carry no meaning a screen reader needs, so they opt
// out of the accessibility tree rather than reading as blank elements. When you
// need a *semantic* break, that is a SectionHeader, not a line.
//
// Extracted so `SectionHeader` / `PageHeader` can consume `TitleRule` instead of
// spreading `TITLE_RULE` with their own width each time.
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import {
	BORDER,
	RULE_WIDTH,
	SPACE,
	TITLE_RULE,
	WHIMSY,
} from "@/constants/theme";

interface DividerProps {
	/** Breathing room above and below, as a SPACE step. */
	space?: keyof typeof SPACE;
	style?: StyleProp<ViewStyle>;
}

export function Divider({ space = "md", style }: DividerProps) {
	return (
		<View
			accessible={false}
			importantForAccessibility="no-hide-descendants"
			style={[styles.divider, { marginVertical: SPACE[space] }, style]}
		/>
	);
}

interface TitleRuleProps {
	/** Rule width. The canonical 64 unless a surface genuinely needs otherwise. */
	width?: number;
	style?: StyleProp<ViewStyle>;
}

export function TitleRule({ width = RULE_WIDTH, style }: TitleRuleProps) {
	return (
		<View
			accessible={false}
			importantForAccessibility="no-hide-descendants"
			style={[styles.titleRule, { width }, style]}
		/>
	);
}

const styles = StyleSheet.create({
	divider: {
		height: BORDER.hair,
		backgroundColor: WHIMSY.barkMute,
	},
	titleRule: TITLE_RULE,
});
