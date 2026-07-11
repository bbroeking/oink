// The weekly bounty board section, mounted at the top of the season
// tab. Fetches my_weekly_bounties on focus and renders a BountyCard
// per active bounty.
import React, { useCallback, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { rpc } from "@/utils/rpc";
import { BountyCard, type WeeklyBounty } from "./BountyCard";
import { ROW_TILTS } from "@/constants/theme";
import { SectionHeader } from "./ui/SectionHeader";

// Approximate the next Monday 00:00 local — most weekly bounties roll
// over on Mondays. Worst case the label is off by a day; still better
// than "resets weekly" which gives no urgency.
function resetsIn(): string {
	const now = new Date();
	const dow = now.getDay(); // 0=Sun
	const daysToMon = (8 - dow) % 7 || 7;
	if (daysToMon === 1) {
		// less than 24h — show hours
		const next = new Date(now);
		next.setDate(now.getDate() + 1);
		next.setHours(0, 0, 0, 0);
		const hours = Math.max(1, Math.round((next.getTime() - now.getTime()) / 3.6e6));
		return `resets in ${hours}h`;
	}
	return `resets in ${daysToMon}d`;
}

export function BountyBoard() {
	const [bounties, setBounties] = useState<WeeklyBounty[]>([]);
	const [loaded, setLoaded] = useState(false);

	const fetchBounties = useCallback(() => {
		rpc<WeeklyBounty[]>("my_weekly_bounties").then((data) => {
			setBounties(data ?? []);
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

	return (
		<View style={styles.wrap}>
			<SectionHeader
				kicker="weekly board"
				title="Bounties"
				right={resetsIn()}
				ruleWidth={84}
			/>
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
	// No own bottom margin — the season tab's list gap (SPACE.sm) owns the
	// seam to the next section; a second margin here double-counted it.
	wrap: {},
});
