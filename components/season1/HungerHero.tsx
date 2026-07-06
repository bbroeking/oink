// Season-1 hero — the Great Hungerer, big and strong at the top of the season
// tab, with the "power we're taking back" strip beneath him: six stage
// segments that fill as the WHOLE barnyard's war effort drains him, plus the
// pried-back tally. The vignette itself (GreatHungerMeter) shows the feeling;
// this strip is the progression readout (numbers allowed for progression per
// the taste standard). A "Hear the tale again" chip retriggers the intro
// storybook any time.
//
// Note: GreatHungerMeter owns its own useHungerMeter() read; we read it again
// here for the strip. Two calls to one cheap STABLE read — collapse into a
// shared provider if it ever grows a cost.

import { View, Text, Pressable, StyleSheet } from "react-native";
import { GreatHungerMeter } from "../GreatHungerMeter";
import { Glyph } from "../ui/Glyph";
import {
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import {
	useHungerMeter,
	HUNGER_STAGES,
	HUNGER_STAGE_LINE,
} from "@/hooks/useHungerMeter";

export function HungerHero({ onTellTale }: { onTellTale: () => void }) {
	const meter = useHungerMeter();

	const nextStage =
		meter.stageIndex < HUNGER_STAGES.length - 1
			? HUNGER_STAGES[meter.stageIndex + 1]
			: null;
	const toNext =
		meter.available && meter.nextThreshold != null
			? Math.max(0, meter.nextThreshold - meter.total)
			: null;

	return (
		<View>
			<GreatHungerMeter />

			{/* The power we're taking back — six stage segments, filled as the
			    herd weakens him. Discrete on purpose: the server owns the
			    boundary values, so we show stages crossed, not a false pct. */}
			<View style={styles.strip}>
				<View style={styles.segRow}>
					{HUNGER_STAGES.map((s, i) => {
						const crossed = i < meter.stageIndex;
						const current = i === meter.stageIndex;
						return (
							<View
								key={s}
								style={[
									styles.seg,
									crossed && styles.segCrossed,
									current && styles.segCurrent,
								]}
							/>
						);
					})}
				</View>
				<Text style={styles.tally}>
					{meter.available
						? toNext != null && nextStage
							? `The herd has pried ${meter.total} tickles back — ${toNext} more and he slips to ${nextStage}.`
							: `The herd has pried ${meter.total} tickles back. He's on his last legs.`
						: "No one has wounded his hoard yet — the first wars will change that."}
				</Text>
				<Text style={styles.everyWar}>
					Every Mud War weakens him — win or lose, the bog keeps what you pry
					loose.
				</Text>
			</View>

			{/* Retell the intro storybook. */}
			<Pressable onPress={onTellTale} style={styles.taleChip} hitSlop={8}>
				<Glyph name="sparkles" size={14} />
				<Text style={styles.taleText}>Hear the tale again</Text>
			</Pressable>
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
	},
	segCrossed: { backgroundColor: WHIMSY.sun },
	segCurrent: { backgroundColor: WHIMSY.peach },
	tally: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	everyWar: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	taleChip: {
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: 6,
		minHeight: 32,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.lilac,
		...SHADOW_SM,
	},
	taleText: {
		...TYPE.label,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
	},
});
