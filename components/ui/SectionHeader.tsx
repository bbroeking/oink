// The in-screen SECTION crown — kicker, title, right-slot meta, ink rule
// (design-system-spec §2, row 03).
//
// The counterpart to `PageHeader`, and the split between them is a ruling, not
// a preference: **a page kicker is `KickerPill` (tracked uppercase Nunito,
// mute); a section kicker is `Kicker` (PatrickHand, accent)** — see the header
// comment in PageHeader.tsx. One screen, two voices, each with one job.
//
// Everything it draws now comes from the text + rule primitives (`Kicker`,
// `SectionTitle`, `Label`, `TitleRule`), so the ★ prefix, the accent ink, the
// 12pt right-slot meta and the rule width live in exactly one place each. The
// internal 12 / 4 / 8 / 10 literals the audit flagged are folded onto `SPACE`.
import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { RULE_WIDTH, SPACE } from "@/constants/theme";
import { Kicker, Label, SectionTitle } from "./Text";
import { TitleRule } from "./Divider";

interface Props {
	/** Hand-script accent line above the title. Prefix "★ " baked in. */
	kicker?: string;
	/** Main display-font header. */
	title: string;
	/** Right-aligned secondary text (e.g. "resets in 4d", "12 items"). */
	right?: React.ReactNode;
	/** Width of the ink underline rule (in px). Canonical `RULE_WIDTH`. */
	ruleWidth?: number;
	/** Container style override. */
	style?: StyleProp<ViewStyle>;
}

/**
 * The kicker + title + right-text + underline-rule header used everywhere
 * in the redesign (Barn, Friends, Season, Shop, Account).
 */
export function SectionHeader({
	kicker,
	title,
	right,
	ruleWidth = RULE_WIDTH,
	style,
}: Props) {
	return (
		<View style={[styles.wrap, style]}>
			{kicker ? <Kicker style={styles.kicker}>{kicker}</Kicker> : null}
			<View style={styles.row}>
				<SectionTitle accessibilityRole="header" style={styles.title}>
					{title}
				</SectionTitle>
				{right ? (
					typeof right === "string" ? (
						<Label tone="secondary" style={styles.right}>
							{right}
						</Label>
					) : (
						<View style={styles.rightSlot}>{right}</View>
					)
				) : null}
			</View>
			<TitleRule width={ruleWidth} style={styles.rule} />
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		marginBottom: SPACE.md,
	},
	kicker: {
		marginBottom: SPACE.xs,
	},
	row: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	title: {
		flexShrink: 1,
	},
	right: {
		marginLeft: SPACE.sm,
	},
	rightSlot: {
		marginLeft: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	rule: {
		marginTop: SPACE.xs,
		marginBottom: SPACE.sm,
	},
});
