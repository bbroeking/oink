// Season-1 hero — the Great Hungerer, big and strong at the top of the season
// tab, with the "power we're taking back" strip beneath him: six stage
// segments that fill as the WHOLE barnyard's war effort drains him. The
// vignette (GreatHungerMeter) owns the feeling AND the numbers (its stat row
// reads stage · tickles reclaimed · weakens-at); this strip is just the
// stages-crossed readout plus the one flavor line. The tale replay lives in
// the page header's scene icon, not here.
//
// Note: GreatHungerMeter owns its own useHungerMeter() read; we read it again
// here for the strip. Two calls to one cheap STABLE read — collapse into a
// shared provider if it ever grows a cost.

import { View, Text, StyleSheet } from "react-native";
import { GreatHungerMeter } from "../GreatHungerMeter";
import { FONTS, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import {
	useHungerMeter,
	stageProgress,
	HUNGER_STAGES,
} from "@/hooks/useHungerMeter";

export function HungerHero() {
	const meter = useHungerMeter();
	// Within-stage drain — the current segment fills live toward the next
	// stage (the six segments together read as one power bar for the boss).
	const pct = stageProgress(meter);

	return (
		<View>
			<GreatHungerMeter />

			{/* The power we're taking back — six stage segments; crossed ones
			    are full, the current one fills as the herd drains him. */}
			<View style={styles.strip}>
				<View style={styles.segRow}>
					{HUNGER_STAGES.map((s, i) => {
						const crossed = i < meter.stageIndex;
						const current = i === meter.stageIndex;
						return (
							<View key={s} style={[styles.seg, crossed && styles.segCrossed]}>
								{current && (
									<View
										style={[
											styles.segFill,
											{ width: `${Math.round(pct * 100)}%` },
										]}
									/>
								)}
							</View>
						);
					})}
				</View>
				<Text style={styles.everyWar}>
					Every Mud War weakens him — win or lose, the bog keeps what you pry
					loose.
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	strip: { marginTop: SPACE.sm },
	segRow: { flexDirection: "row", gap: 5 },
	seg: {
		flex: 1,
		height: 12,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	segCrossed: { backgroundColor: WHIMSY.sun },
	// The live drain inside the current segment.
	segFill: { height: "100%", backgroundColor: WHIMSY.peach },
	everyWar: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
});
