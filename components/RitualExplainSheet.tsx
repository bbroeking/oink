// RitualExplainSheet — what today's blessing (or curse) DOES, in one small
// bottom panel. The Friends list names the day's two rituals in a strip above
// the rows; tapping either capsule opens this. It speaks to the caster about a
// friend — "Their pig floats…" — and says the two things a blurb leaves out:
// how long it lasts, and how many casts are left today. (2026-09-14)

import { StyleSheet, View } from "react-native";
import { Hand, Kicker, RitualIconWell, Sheet, T } from "./ui";
import { SPACE } from "@/constants/theme";
import { RITUAL_DOOR } from "@/hooks/useRitualDoor";
import type { UseRitualCaster } from "@/hooks/useRitualCaster";
import { castBlurb, untilDailyReset, type RitualMode } from "@/utils/rituals";

// The well is the panel's one picture, so it takes the large icon size rather
// than the 40pt the strip chips and effect rows share.
const WELL = SPACE.xxl * 2;

export function RitualExplainSheet({
	mode,
	caster,
	onClose,
}: {
	/** Which of today's two rituals is open; null keeps the sheet unmounted. */
	mode: RitualMode | null;
	caster: UseRitualCaster;
	onClose: () => void;
}) {
	if (!mode) return null;
	const ritual = caster.today(mode);
	const usage = caster.usage(mode);
	const door = RITUAL_DOOR[mode];
	const left =
		usage === null
			? null
			: usage.remaining === 0
				? "none left today"
				: `${usage.remaining} of ${usage.cap} left today`;
	return (
		<Sheet
			open
			onClose={onClose}
			kicker={`today's ${door.word}`}
			title={ritual.name}
			closeLabel="Done"
			// A one-paragraph panel: it never needs the 85% default.
			maxHeightFrac={0.6}
			testID={`ritual-explain-${mode}`}
		>
			<View style={styles.body}>
				<RitualIconWell
					icon={ritual.icon}
					blessed={mode === "bless"}
					size={WELL}
					badge={false}
				/>
				<View style={styles.words}>
					<Hand testID="ritual-explain-blurb">{castBlurb(ritual.blurb)}</Hand>
					<T role="kicker" tone="secondary">
						six hours on their pig or Barn · cosmetic only
					</T>
					<Kicker star={false} testID="ritual-explain-allowance">
						{left === null
							? `resets in ${untilDailyReset()}`
							: `${left} · resets in ${untilDailyReset()}`}
					</Kicker>
				</View>
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	body: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.md,
		paddingTop: SPACE.sm,
	},
	words: { flex: 1, minWidth: 0, gap: SPACE.xs },
});
