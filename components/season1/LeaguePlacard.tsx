// The Sounder League placard — the season tab's compact table card, filling
// the slot the S0 Alignment placard vacates (docs/sounder-league-spec.md).
// One RPC (my_league_state): the open term's fixture ("This term: vs X ·
// N days left"), the season record, and the table position. Renders nothing
// until the league season is live AND the pig rides with a Sounder — the
// SounderSteps stepper above owns the join path. Deliberately shows the
// TERM clock only, never a season countdown (the end date is unannounced).

import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Sticker } from "../ui/Sticker";
import { Icon } from "../ui/Icon";
import {
	fetchMyLeagueState,
	leagueFixtureLine,
	ordinal,
	type MyLeagueState,
} from "@/utils/mudWars";
import { FONTS, SPACE, WHIMSY } from "@/constants/theme";

export function LeaguePlacard() {
	const [state, setState] = useState<MyLeagueState | null>(null);

	useFocusEffect(
		useCallback(() => {
			let alive = true;
			fetchMyLeagueState().then((s) => {
				if (alive) setState(s);
			});
			return () => {
				alive = false;
			};
		}, [])
	);

	// Quietly absent until the league is live and the pig has a record to
	// stand on: no season, or crewless (record null), renders nothing.
	if (!state?.ok || !state.season || !state.record) return null;

	const { record, position } = state;
	const fixtureLine = leagueFixtureLine(state);

	return (
		<Sticker color="paper" rotate={-0.4} radius={18} style={styles.wrap}>
			<View style={styles.fixtureRow}>
				<Icon name="trophy" size={15} color={WHIMSY.accent} />
				<Text style={styles.fixture} numberOfLines={2}>
					{fixtureLine}
				</Text>
			</View>
			<Text style={styles.record}>
				{record.wins}–{record.losses} this season
				{state.ribbons != null ? ` · ${state.ribbons} ribbons` : ""}
				{position ? ` · ${ordinal(position)} on the table` : ""}
			</Text>
			<Pressable
				testID="league-placard-standings"
				onPress={() => router.push("/clan-ladder")}
				hitSlop={8}
			>
				<Text style={styles.link}>the Sounder League ›</Text>
			</Pressable>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	wrap: {
		marginTop: SPACE.sm,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.lg,
		gap: SPACE.xs,
	},
	fixtureRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	fixture: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink },
	record: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	link: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
		marginTop: 2,
	},
});
