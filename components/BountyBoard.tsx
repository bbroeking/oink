// Phase 3 — the weekly bounty board section, mounted at the top of
// the season tab. Fetches my_weekly_bounties on focus and renders a
// BountyCard per active bounty.
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { BountyCard, type WeeklyBounty } from "./BountyCard";
import { FONTS, KICKER_TEXT, ROW_TILTS, WHIMSY } from "@/constants/theme";

export function BountyBoard() {
	const [bounties, setBounties] = useState<WeeklyBounty[]>([]);
	const [loaded, setLoaded] = useState(false);

	const fetchBounties = useCallback(() => {
		supabase.rpc("my_weekly_bounties").then(({ data }) => {
			setBounties((data as WeeklyBounty[] | null) ?? []);
			setLoaded(true);
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchBounties();
		}, [fetchBounties])
	);

	// Pre-migration / empty: render nothing rather than an empty card.
	if (loaded && bounties.length === 0) return null;

	const claimedCount = bounties.filter((b) => b.claimed).length;

	return (
		<View style={styles.wrap}>
			<View style={styles.headerRow}>
				<Text style={styles.kicker}>★ weekly bounties</Text>
				{bounties.length > 0 && (
					<Text style={styles.progress}>
						{claimedCount} / {bounties.length} claimed
					</Text>
				)}
			</View>
			{bounties.map((b, i) => (
				<BountyCard
					key={b.code}
					bounty={b}
					tilt={ROW_TILTS[i % ROW_TILTS.length]}
					onClaimed={fetchBounties}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginBottom: 14 },
	headerRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		marginBottom: 4,
	},
	kicker: { ...KICKER_TEXT },
	progress: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
});
