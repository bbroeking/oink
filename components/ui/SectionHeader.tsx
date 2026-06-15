import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { WHIMSY, FONTS, KICKER_TEXT, TITLE_RULE } from "@/constants/theme";

interface Props {
	/** Hand-script accent line above the title. Prefix "★ " baked in. */
	kicker?: string;
	/** Main display-font header. */
	title: string;
	/** Right-aligned secondary text (e.g. "resets in 4d", "12 items"). */
	right?: React.ReactNode;
	/** Width of the ink underline rule (in px). Canonical 64 (June 2026 UI audit). */
	ruleWidth?: number;
	/** Container style override. */
	style?: StyleProp<ViewStyle>;
}

/**
 * The kicker + title + right-text + underline-rule header used everywhere
 * in the redesign (Barn, Friends, Season, Shop, Account). Mirrors
 * `SectionHeader` from the design's ui.jsx so the same shape lands in
 * every screen.
 */
export function SectionHeader({
	kicker,
	title,
	right,
	ruleWidth = 64,
	style,
}: Props) {
	return (
		<View style={[styles.wrap, style]}>
			{kicker ? <Text style={styles.kicker}>★ {kicker}</Text> : null}
			<View style={styles.row}>
				<Text style={styles.title}>{title}</Text>
				{right ? (
					typeof right === "string" ? (
						<Text style={styles.right}>{right}</Text>
					) : (
						<View style={styles.rightSlot}>{right}</View>
					)
				) : null}
			</View>
			<View style={[styles.rule, { width: ruleWidth }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		marginBottom: 12,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	row: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		lineHeight: 24,
		color: WHIMSY.ink,
		letterSpacing: 0.2,
		flexShrink: 1,
	},
	right: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.mute,
		marginLeft: 8,
	},
	rightSlot: {
		marginLeft: 8,
		flexDirection: "row",
		alignItems: "center",
	},
	rule: {
		...TITLE_RULE,
		marginTop: 4,
		marginBottom: 10,
	},
});
