// Joinable-Sounders list — the knock-to-join path into a crew. Renders the
// open Sounders from useJoinableCrews (free slot, not mid-war) in the crew
// row grammar (portrait · body · sun pill) with a one-tap "ask to join ›".
// An open Sounder isn't walk-in: you ASK, and a member of the herd opens the
// door. Shared by the Season-1 stepper and the Friends-hub SounderCard;
// founding demotes to a secondary path beside this list.
//
// Rows the caller has already knocked on (matched by crewHook.crew's outgoing
// asks) show a quiet "asked — waiting" state with a "take it back" link. Once
// the caller has three asks out, remaining ask buttons go quiet with a hint.
//
// Renders nothing while empty — parents own the "no open Sounders" state
// (they show the founding form instead).

import { useState } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { AccentNote, CrewPortrait, CrewRow, HandLink, RowStatus, SunPill } from "./CrewRow";
import type { UseCrew } from "@/hooks/useCrew";
import type { JoinableCrew } from "@/utils/crews";
import { CREW_CAP } from "@/constants/crews";
import { SPACE } from "@/constants/theme";
import { askError, ASK_LIMIT_HINT, MAX_OPEN_ASKS } from "./sounder/inviteState";

export function JoinableSounders({
	crews,
	crewHook,
	onStale,
}: {
	crews: JoinableCrew[];
	crewHook: UseCrew;
	/** An ask failed because the list is out of date — re-fetch it. */
	onStale: () => void;
}) {
	const [busyId, setBusyId] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	// The caller's outgoing asks, keyed by the crew they're knocking on, so each
	// row knows whether it's already "asked — waiting".
	const askByCrew = new Map(crewHook.crew.joinRequestsOut.map((r) => [r.crew_id, r]));
	const atAskCap = crewHook.crew.joinRequestsOut.length >= MAX_OPEN_ASKS;

	const ask = async (crew: JoinableCrew) => {
		if (busyId) return;
		setBusyId(crew.id);
		setNote(null);
		const r = await crewHook.requestJoin(crew.id);
		setBusyId(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(askError(r.reason));
			onStale();
		}
	};

	const takeBack = async (requestId: string) => {
		if (busyId) return;
		setBusyId(requestId);
		setNote(null);
		const r = await crewHook.cancelRequest(requestId);
		setBusyId(null);
		if (!r.ok) setNote("Couldn't take that ask back — try again.");
	};

	if (crews.length === 0) return null;

	return (
		<View>
			{crews.map((c, i) => {
				const asked = askByCrew.get(c.id);
				return (
					<CrewRow
						key={c.id}
						divider={i > 0}
						left={<CrewPortrait glyph="friends" />}
						title={c.name}
						sub={
							asked
								? "asked — waiting for the herd to open up"
								: `${c.memberCount} of ${CREW_CAP} snouts${
										c.leaderName ? ` · ${c.leaderName}'s banner` : ""
								  }`
						}
						right={
							asked ? (
								<>
									<RowStatus>asked</RowStatus>
									<HandLink
										onPress={() => takeBack(asked.id)}
										disabled={busyId !== null}
									>
										take it back
									</HandLink>
								</>
							) : (
								<SunPill
									onPress={() => ask(c)}
									// A door you can't knock on yet: at the ask cap, quiet the
									// button (the hint below says why).
									disabled={busyId !== null || atAskCap}
								>
									{busyId === c.id ? "Asking…" : "ask to join ›"}
								</SunPill>
							)
						}
					/>
				);
			})}
			{atAskCap && <AccentNote style={styles.note}>{ASK_LIMIT_HINT}</AccentNote>}
			{!!note && <AccentNote style={styles.note}>{note}</AccentNote>}
		</View>
	);
}

const styles = StyleSheet.create({
	note: { textAlign: "center", marginTop: SPACE.xs },
});
