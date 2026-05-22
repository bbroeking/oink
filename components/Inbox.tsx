// Inbox — the "Inbox" segment of the Friends hub.
//
// Phase A: a placeholder. Phase B fleshes this into the full activity
// feed — actionable rows (incoming friend + trade requests, inline
// buttons) sorted above passive event rows (blessed/cursed you, trade
// answered, bounty ready, leaderboard pass). See
// docs/season-1-social-redesign.md §"The Inbox feed".
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FONTS, WHIMSY } from "@/constants/theme";

export function Inbox() {
	return (
		<View style={styles.container}>
			<Text style={styles.emptyTitle}>The Inbox is on its way</Text>
			<Text style={styles.emptyBody}>
				Friend requests, trade requests, blessings and curses will all
				land here soon — one themed feed.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 36,
	},
	emptyTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		marginBottom: 6,
		textAlign: "center",
	},
	emptyBody: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 20,
	},
});
