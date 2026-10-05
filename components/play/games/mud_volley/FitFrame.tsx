// Every Mud Volley board's frame (the contract is in ../fit.ts): a planned
// region over a pinned foot. With a height from the match screen the frame
// is exactly that tall; the foot (the cards, the ticket, the review row)
// keeps its full size at the bottom, and the region above takes what is
// left, spreads any slack between its rows, and clips rather than ever
// pushing the foot down. It bleeds past its edges by the list bleed, so a
// tilted sticker's corner and its hard shadow survive the clip. Before the
// first layout (no height yet) the frame is simply the natural column.

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { LIST_BLEED } from "@/constants/theme";
import type { VolleyPlan } from "./layout";

export function FitFrame({ plan, testID, children, foot }: { plan: VolleyPlan; testID: string; children: ReactNode; foot: ReactNode }) {
	const fitted = plan.height !== null;
	return (
		<View style={[styles.board, { gap: plan.gap }, plan.height !== null ? { height: plan.height } : null]} testID={testID}>
			<View style={[{ gap: plan.gap }, fitted ? styles.planned : null]} testID="volley-planned">
				{children}
			</View>
			<View style={{ gap: plan.gap }} testID="volley-foot">
				{foot}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	board: { alignSelf: "stretch" },
	planned: {
		flex: 1,
		minHeight: 0,
		justifyContent: "space-between",
		overflow: "hidden",
		marginHorizontal: -LIST_BLEED,
		paddingHorizontal: LIST_BLEED,
		marginTop: -LIST_BLEED,
		paddingTop: LIST_BLEED,
	},
});
