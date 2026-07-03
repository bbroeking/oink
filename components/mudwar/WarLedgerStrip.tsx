// The week at a glance — seven knot-slots under the rope, one per war day.
// Folded day = a settled knot; today = an open, gently pulsing slot; future
// days = dotted outlines. When the server starts shipping a per-day ledger
// (dayLedger — the mud_war_day_notches read that must ride the Bog Weather
// carry of score_mud_war_days/war_fronts_state, NOT a separate migration),
// settled knots tint to the day's holder: rose = ours, lilac = theirs,
// cream = a wash. Until then past days render as neutral settled knots —
// the wire only carries the cumulative rope today.
// EXPORT-ONLY: mounted by app/mud-war.tsx (docs/mudwar-ui-integration.md).

import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { FONTS, SPACE, WHIMSY } from "@/constants/theme";

export interface LedgerDay {
	day: number; // 1-based war day
	holder: "mine" | "them" | "tie";
}

interface Props {
	totalDays: number; // 7 on fronts wars, 5 legacy
	currentDay: number; // 1-based
	ropeNorm?: number; // caller-POV −1..1; ±1 ≈ rout
	dayLedger?: LedgerDay[]; // future server read — see header note
}

export function WarLedgerStrip({ totalDays, currentDay, ropeNorm, dayLedger }: Props) {
	// Today's slot breathes — the day still being fought.
	const pulse = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
				Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [pulse]);

	const holderFor = (day: number): LedgerDay["holder"] | null => {
		const row = dayLedger?.find((d) => d.day === day);
		return row ? row.holder : null;
	};

	const mineKnots = dayLedger?.filter((d) => d.holder === "mine").length ?? null;
	const nearRout = typeof ropeNorm === "number" && Math.abs(ropeNorm) >= 0.75;

	return (
		<View style={styles.wrap}>
			<View style={styles.row}>
				{Array.from({ length: totalDays }, (_, i) => {
					const day = i + 1;
					if (day === currentDay) {
						return (
							<Animated.View
								key={day}
								style={[
									styles.slot,
									styles.today,
									{
										transform: [
											{
												scale: pulse.interpolate({
													inputRange: [0, 1],
													outputRange: [1, 1.18],
												}),
											},
										],
									},
								]}
							/>
						);
					}
					if (day < currentDay) {
						const holder = holderFor(day);
						return (
							<View
								key={day}
								style={[
									styles.slot,
									styles.settled,
									holder === "mine" && { backgroundColor: WHIMSY.roseDeep },
									holder === "them" && { backgroundColor: WHIMSY.lilacDeep },
									holder === "tie" && { backgroundColor: WHIMSY.cream2 },
								]}
							/>
						);
					}
					return <View key={day} style={[styles.slot, styles.future]} />;
				})}
			</View>
			<Text style={styles.note}>
				{`Day ${Math.min(currentDay, totalDays)} of ${totalDays}`}
				{mineKnots != null
					? ` — ${mineKnots} ${mineKnots === 1 ? "knot" : "knots"} yours.`
					: ""}
			</Text>
			{nearRout && (
				<Text style={styles.fray}>
					{ropeNorm! > 0
						? "They're close to a rout — the rope groans your way."
						: "Close to a rout — the rope frays. Rally!"}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: SPACE.sm, alignItems: "center" },
	row: { flexDirection: "row", gap: 7, justifyContent: "center" },
	slot: {
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	settled: { backgroundColor: WHIMSY.cream2 },
	today: { backgroundColor: WHIMSY.sun },
	future: {
		backgroundColor: "transparent",
		borderStyle: "dashed",
		opacity: 0.55,
	},
	note: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	fray: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		marginTop: 1,
	},
});
