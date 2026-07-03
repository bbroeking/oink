// Their side of the bog — DELIBERATELY aggregate-only. war_side already ships
// the opponent's member names + individual mud, but rendering them would aim
// guilt at strangers and invite cross-clan dogpiling (gift-not-guilt stops at
// the clan boundary; the double-blind is the war's strategic soul). So: crew
// name, per-capita, anonymous pig-nose heads, and their progress as a distant
// hoard silhouette on the horizon that swells with their per-capita — legible
// threat, zero individual shaming. (A later privacy-hardening carry of
// war_side could strip opponent member rows from the wire entirely.)
// EXPORT-ONLY: mounted by app/mud-war.tsx (docs/mudwar-ui-integration.md).

import { View, Text, StyleSheet } from "react-native";
import { FONTS, SPACE, TYPE, WHIMSY } from "@/constants/theme";

interface Props {
	crewName: string | null;
	perCapita: number;
	active: number | null;
	isBot?: boolean;
}

// Their hoard on the horizon: three ink mounds that swell with per-capita.
// Placeholder shapes — the art manifest's "distant hoard silhouette" drops in
// here as a single Image swap.
function HoardSilhouette({ perCapita }: { perCapita: number }) {
	// Bounded growth: 0 → tiny bumps, 30+/head → full mounds.
	const g = Math.min(1, perCapita / 30);
	const h = (base: number) => Math.round(base * (0.45 + 0.55 * g));
	return (
		<View style={styles.horizon} pointerEvents="none">
			<View style={[styles.mound, { height: h(22), width: 34 }]} />
			<View style={[styles.mound, { height: h(30), width: 46, marginBottom: -2 }]} />
			<View style={[styles.mound, { height: h(18), width: 28 }]} />
		</View>
	);
}

export function RivalSide({ crewName, perCapita, active, isBot }: Props) {
	const heads = Math.max(0, active ?? 0);
	return (
		<View style={styles.wrap}>
			<View style={styles.textCol}>
				<Text style={styles.kicker}>their side of the bog</Text>
				<Text style={styles.name} numberOfLines={1}>
					{crewName ?? "Them"}
				</Text>
				<Text style={styles.line}>
					{perCapita} / head
					{heads > 0
						? ` · ${heads} ${heads === 1 ? "pig" : "pigs"} in the mud`
						: " · nobody in the mud yet"}
					{isBot ? " · the house" : ""}
				</Text>
				{heads > 0 && (
					<View style={styles.headsRow}>
						{Array.from({ length: Math.min(heads, 5) }, (_, i) => (
							<View key={i} style={styles.nose} />
						))}
					</View>
				)}
			</View>
			<HoardSilhouette perCapita={perCapita} />
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		alignItems: "flex-end",
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm + 2,
		marginTop: SPACE.sm,
		overflow: "hidden",
	},
	textCol: { flex: 1 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
	},
	name: { ...TYPE.cardTitle, color: WHIMSY.ink, marginTop: 2 },
	line: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	headsRow: { flexDirection: "row", gap: 4, marginTop: SPACE.xs },
	nose: {
		width: 12,
		height: 9,
		borderRadius: 5,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.rose,
	},
	horizon: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 3,
		opacity: 0.5,
	},
	mound: {
		backgroundColor: WHIMSY.ink,
		borderTopLeftRadius: 999,
		borderTopRightRadius: 999,
	},
});
