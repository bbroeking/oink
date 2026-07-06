// Joinable-Sounders list — the join-first path into a crew. Renders the
// open Sounders from useJoinableCrews (free slot, not mid-war) in the crew
// row grammar (portrait · body · sun pill) with a one-tap Join. Shared by
// the Season-1 stepper and the Friends-hub SounderCard; founding demotes
// to a secondary path beside this list.
//
// Renders nothing while empty — parents own the "no open Sounders" state
// (they show the founding form instead).

import { useState } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { AccentNote, CrewPortrait, CrewRow, SunPill } from "./CrewRow";
import type { UseCrew } from "@/hooks/useCrew";
import type { JoinableCrew } from "@/utils/mudWars";
import { CREW_CAP } from "@/constants/mudFights";
import { SPACE } from "@/constants/theme";
import { joinError } from "./sounder/inviteState";

export function JoinableSounders({
	crews,
	crewHook,
	onStale,
}: {
	crews: JoinableCrew[];
	crewHook: UseCrew;
	/** A join failed because the list is out of date — re-fetch it. */
	onStale: () => void;
}) {
	const [busyId, setBusyId] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const join = async (crew: JoinableCrew) => {
		if (busyId) return;
		setBusyId(crew.id);
		setNote(null);
		const r = await crewHook.join(crew.id);
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(joinError(r.reason));
			onStale();
		}
	};

	if (crews.length === 0) return null;

	return (
		<View>
			{crews.map((c, i) => (
				<CrewRow
					key={c.id}
					divider={i > 0}
					left={<CrewPortrait glyph="friends" />}
					title={c.name}
					sub={`${c.memberCount} of ${CREW_CAP} snouts${
						c.leaderName ? ` · ${c.leaderName}'s banner` : ""
					}`}
					right={
						<SunPill onPress={() => join(c)} disabled={busyId !== null}>
							{busyId === c.id ? "Joining…" : "Join"}
						</SunPill>
					}
				/>
			))}
			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}
		</View>
	);
}

const styles = StyleSheet.create({
	note: { textAlign: "center", marginTop: SPACE.xs },
});
