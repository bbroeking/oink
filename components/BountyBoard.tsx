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

// Count down to the server's actual rollover: bounty weeks key off
// date_trunc('week', now() AT TIME ZONE 'UTC'), i.e. Monday 00:00 UTC —
// NOT local midnight (local was hours late for US players).
function resetsIn(): string {
	const now = new Date();
	const dowUtc = now.getUTCDay(); // 0=Sun
	const daysToMon = (8 - dowUtc) % 7 || 7;
	const next = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + daysToMon
	);
	const hours = Math.max(1, Math.round((next - now.getTime()) / 3.6e6));
	if (hours <= 24) {
		return `resets in ${hours}h`;
	}
	return `resets in ${Math.ceil(hours / 24)}d`;
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
